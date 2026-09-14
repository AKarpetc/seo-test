import axios from 'axios';
import { prisma, BatchWriter, bulkUpsert, slugify, toFloat, trackRun, stateNameOf } from './lib/etl';

const BASE = 'https://api.eia.gov/v2/electricity/retail-sales/data/';

/**
 * EIA v2 exposes retail rates by state and sector only — there is no utility-level
 * route. Utility-level figures live in the EIA-861 spreadsheets, which are a separate
 * ingestion job. State averages are what the API can give, and they are enough to
 * combine with Census household data.
 */
const COLUMNS = [
  'utilityId', 'providerName', 'state', 'ownership', 'customers',
  'avgKwhRate', 'commercialRate', 'avgMonthlyBill', 'avgMonthlyKwh', 'slug', 'updatedAt',
];

type Row = {
  period: string;
  stateid: string;
  sectorid: string;
  price: string | null;
  sales: string | null;
  customers: string | null;
};

async function fetchSector(key: string, sector: string, period: string): Promise<Map<string, Row>> {
  const { data } = await axios.get(BASE, {
    params: {
      api_key: key,
      frequency: 'monthly',
      'data[0]': 'price',
      'data[1]': 'sales',
      'data[2]': 'customers',
      'facets[sectorid][]': sector,
      start: period,
      end: period,
      length: 5000,
    },
    timeout: 120_000,
  });
  const rows: Row[] = data?.response?.data ?? [];
  return new Map(rows.map((r) => [r.stateid, r]));
}

/** Finds the most recent month that actually has data. */
async function latestPeriod(key: string): Promise<string> {
  const { data } = await axios.get(BASE, {
    params: {
      api_key: key, frequency: 'monthly', 'data[0]': 'price',
      'facets[sectorid][]': 'RES', 'sort[0][column]': 'period', 'sort[0][direction]': 'desc', length: 1,
    },
    timeout: 60_000,
  });
  const period = data?.response?.data?.[0]?.period;
  if (!period) throw new Error('EIA returned no periods');
  return period;
}

async function main() {
  const key = process.env.EIA_API_KEY;
  if (!key) throw new Error('EIA_API_KEY is not set — see docs/API_KEYS.md');

  await trackRun('energy', BASE, async () => {
    const period = await latestPeriod(key);
    console.log(`[+] Latest published month: ${period}`);

    const [residential, commercial] = await Promise.all([
      fetchSector(key, 'RES', period),
      fetchSector(key, 'COM', period),
    ]);
    console.log(`    ${residential.size} states (residential), ${commercial.size} (commercial)`);

    const writer = new BatchWriter<any>(
      async (batch) => ({ count: await bulkUpsert('UtilityRate', 'utilityId', COLUMNS, batch) }),
      (r) => r.utilityId,
      100,
      'states',
    );

    let read = 0;
    for (const [stateId, res] of residential) {
      // The dataset includes regional roll-ups such as US and NEW alongside states.
      const name = stateNameOf(stateId);
      if (!name) continue;

      const rate = toFloat(res.price);
      const customers = toFloat(res.customers);
      const salesMwh = toFloat(res.sales);

      // sales is reported in million kWh for the month; convert to kWh per customer.
      const avgMonthlyKwh =
        salesMwh !== null && customers !== null && customers > 0
          ? Math.round((salesMwh * 1_000_000) / customers)
          : null;
      const avgMonthlyBill =
        avgMonthlyKwh !== null && rate !== null ? Math.round((avgMonthlyKwh * rate) / 100) : null;

      await writer.push({
        utilityId: `STATE-${stateId}`,
        providerName: `${name} statewide average`,
        state: stateId,
        ownership: 'State average (EIA-861)',
        customers: customers === null ? null : Math.round(customers),
        avgKwhRate: rate,
        commercialRate: toFloat(commercial.get(stateId)?.price ?? null),
        avgMonthlyBill,
        avgMonthlyKwh,
        slug: slugify('average electricity rates in', name),
        updatedAt: new Date(),
      });
      read++;
    }

    await writer.flush();
    return { read, written: writer.written };
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
