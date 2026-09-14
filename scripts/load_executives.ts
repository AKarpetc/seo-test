import axios from 'axios';
import unzipper from 'unzipper';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import {
  prisma, BatchWriter, slugify, toInt, trackRun, SEC_HEADERS,
} from './lib/etl';

const TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';
const DATASET_BASE = 'https://www.sec.gov/files/dera/data/financial-statement-data-sets';

/** SIC division ranges, enough to label a company page with a readable industry. */
const SIC_RANGES: [number, number, string][] = [
  [100, 999, 'Agriculture, Forestry & Fishing'],
  [1000, 1499, 'Mining & Extraction'],
  [1500, 1799, 'Construction'],
  [2000, 3999, 'Manufacturing'],
  [4000, 4999, 'Transportation & Utilities'],
  [5000, 5199, 'Wholesale Trade'],
  [5200, 5999, 'Retail Trade'],
  [6000, 6799, 'Finance, Insurance & Real Estate'],
  [7000, 8999, 'Services'],
  [9100, 9999, 'Public Administration'],
];

function industryOf(sic: number | null): string | null {
  if (!sic) return null;
  return SIC_RANGES.find(([lo, hi]) => sic >= lo && sic <= hi)?.[2] || null;
}

/** Finds the most recent published quarterly dataset. */
async function latestQuarter(): Promise<string | null> {
  const now = new Date();
  for (let back = 0; back < 8; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back * 3, 1);
    const q = `${d.getFullYear()}q${Math.floor(d.getMonth() / 3) + 1}`;
    const res = await axios.head(`${DATASET_BASE}/${q}.zip`, {
      headers: SEC_HEADERS, timeout: 20_000, validateStatus: () => true,
    });
    if (res.status >= 200 && res.status < 300) return q;
  }
  return null;
}

type Financials = { sic: number | null; revenue: bigint | null; netIncome: bigint | null; fy: number | null };

/**
 * sub.txt carries the filer's SIC and fiscal year; num.txt carries the tagged
 * values. Reading both from the quarterly zip avoids ~10k per-company API calls.
 */
async function loadFinancials(quarter: string): Promise<Map<string, Financials>> {
  const url = `${DATASET_BASE}/${quarter}.zip`;
  console.log(`[+] Fetching ${url}`);
  const res = await axios.get(url, { headers: SEC_HEADERS, responseType: 'arraybuffer', timeout: 300_000 });
  const dir = await unzipper.Open.buffer(Buffer.from(res.data));

  const byCik = new Map<string, Financials>();
  const adshToCik = new Map<string, string>();

  const sub = dir.files.find((f) => f.path === 'sub.txt');
  if (!sub) throw new Error('sub.txt missing from SEC dataset');

  for await (const row of (sub.stream() as unknown as Readable).pipe(
    parse({ columns: true, delimiter: '\t', skip_empty_lines: true, relax_quotes: true, relax_column_count: true, quote: false }),
  )) {
    const cik = String(parseInt(row['cik'], 10));
    const adsh = row['adsh'];
    if (!cik || !adsh) continue;
    adshToCik.set(adsh, cik);
    if (!byCik.has(cik)) {
      byCik.set(cik, { sic: toInt(row['sic']), revenue: null, netIncome: null, fy: toInt(row['fy']) });
    }
  }
  console.log(`    ${byCik.size.toLocaleString()} filers in ${quarter}`);

  const num = dir.files.find((f) => f.path === 'num.txt');
  if (!num) throw new Error('num.txt missing from SEC dataset');

  const REVENUE_TAGS = new Set(['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet']);
  for await (const row of (num.stream() as unknown as Readable).pipe(
    parse({ columns: true, delimiter: '\t', skip_empty_lines: true, relax_quotes: true, relax_column_count: true, quote: false }),
  )) {
    const tag = row['tag'];
    if (tag !== 'NetIncomeLoss' && !REVENUE_TAGS.has(tag)) continue;
    if (row['qtrs'] !== '4' || row['coreg']) continue;

    const cik = adshToCik.get(row['adsh']);
    if (!cik) continue;
    const value = row['value'] ? BigInt(Math.round(Number(row['value']))) : null;
    if (value === null) continue;

    const rec = byCik.get(cik);
    if (!rec) continue;
    if (tag === 'NetIncomeLoss') rec.netIncome ??= value;
    else rec.revenue ??= value;
  }

  return byCik;
}

async function main() {
  await trackRun('executives', TICKERS_URL, async () => {
    const { data } = await axios.get(TICKERS_URL, { headers: SEC_HEADERS, timeout: 60_000 });
    const companies = Object.values(data as Record<string, { cik_str: number; ticker: string; title: string }>);
    console.log(`[+] ${companies.length.toLocaleString()} registered tickers`);

    let financials = new Map<string, Financials>();
    const quarter = await latestQuarter();
    if (quarter) {
      try {
        financials = await loadFinancials(quarter);
      } catch (err: any) {
        console.warn(`[!] Financial dataset skipped: ${err.message}`);
      }
    } else {
      console.warn('[!] No quarterly financial dataset available; loading company list only');
    }

    const writer = new BatchWriter<any>(
      (rows) => prisma.sECExecutive.createMany({ data: rows, skipDuplicates: true }),
      (r) => r.ticker,
      1000,
      'companies',
    );

    let read = 0;
    for (const c of companies) {
      const ticker = (c.ticker || '').trim().toUpperCase();
      const name = (c.title || '').trim();
      if (!ticker || !name) continue;

      const cik = String(c.cik_str);
      const fin = financials.get(cik);

      await writer.push({
        ticker,
        cik,
        companyName: name,
        sic: fin?.sic ? String(fin.sic) : null,
        industry: industryOf(fin?.sic ?? null),
        revenue: fin?.revenue ?? null,
        netIncome: fin?.netIncome ?? null,
        fiscalYear: fin?.fy ?? null,
        slug: slugify(name, ticker),
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
