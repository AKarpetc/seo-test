import axios from 'axios';
import {
  prisma, BatchWriter, bulkUpsert, slugify, titleCase, toDate, zip5, trackRun, HTTP_HEADERS,
} from './lib/etl';

/**
 * Newly registered business entities from Secretary of State open-data portals.
 *
 * Each state publishes its own schema, so every source declares how to map its
 * columns onto the shared model. These are official state endpoints — no scraping,
 * no logins — which is the difference between this and the commodity scraper feeds.
 */

type Raw = Record<string, string | undefined>;

type Source = {
  state: string;
  url: string;
  dateField: string;
  map: (row: Raw) => {
    stateId: string; name: string; entityType?: string; status?: string;
    filingDate?: string; address?: string; city?: string; zip?: string;
    county?: string; agentName?: string;
  } | null;
};

const SOURCES: Source[] = [
  {
    state: 'CO',
    url: 'https://data.colorado.gov/resource/4ykn-tg5h.json',
    dateField: 'entityformdate',
    map: (r) => {
      if (!r.entityid || !r.entityname) return null;
      const agent = [r.agentfirstname, r.agentmiddlename, r.agentlastname].filter(Boolean).join(' ');
      return {
        stateId: r.entityid,
        name: r.entityname,
        entityType: r.entitytype,
        status: r.entitystatus,
        filingDate: r.entityformdate,
        address: r.principaladdress1,
        city: r.principalcity,
        zip: r.principalzipcode,
        agentName: agent || undefined,
      };
    },
  },
  {
    state: 'CT',
    url: 'https://data.ct.gov/resource/n7gp-d28j.json',
    dateField: 'date_registration',
    map: (r) => {
      if (!r.id || !r.name) return null;
      // CT ships the whole address as one comma-joined string:
      // "street, street2, city, state, zip, country", frequently with empty parts.
      const parts = (r.mailing_address || '').split(',').map((p) => p.trim());
      return {
        stateId: r.id,
        name: r.name,
        status: r.status,
        // date_registration carries 0001-01-01 sentinels; create_dt is the real timestamp.
        filingDate: r.date_registration?.startsWith('0001') ? r.create_dt : r.date_registration,
        address: parts[0] || undefined,
        city: parts[2] || undefined,
        zip: parts[4] || undefined,
      };
    },
  },
  {
    state: 'NY',
    url: 'https://data.ny.gov/resource/n9v6-gdp6.json',
    dateField: 'initial_dos_filing_date',
    map: (r) => {
      if (!r.dos_id || !r.current_entity_name) return null;
      return {
        stateId: r.dos_id,
        name: r.current_entity_name,
        entityType: r.entity_type,
        filingDate: r.initial_dos_filing_date,
        // NY publishes only the service-of-process address, which is the registered
        // agent or the business itself — not necessarily a physical storefront.
        address: r.dos_process_address_1,
        city: r.dos_process_city,
        zip: r.dos_process_zip,
        county: r.county,
        agentName: r.dos_process_name,
      };
    },
  },
];

const COLUMNS = [
  'entityKey', 'stateId', 'state', 'name', 'entityType', 'status', 'filingDate',
  'address', 'city', 'zip', 'county', 'agentName', 'slug', 'updatedAt',
];

const PAGE = 5000;

/** Only recent filings are worth storing; the historical registry is not saleable. */
const DAYS = parseInt(process.env.BUSINESS_DAYS || '365', 10);

async function loadSource(src: Source, since: string) {
  const writer = new BatchWriter<any>(
    async (rows) => ({ count: await bulkUpsert('BusinessEntity', 'entityKey', COLUMNS, rows) }),
    (r) => r.entityKey,
    1000,
    `${src.state} entities`,
  );

  let offset = 0;
  let read = 0;

  for (;;) {
    const { data } = await axios.get<Raw[]>(src.url, {
      params: {
        $limit: PAGE,
        $offset: offset,
        $where: `${src.dateField} > '${since}'`,
        $order: `${src.dateField} DESC`,
      },
      headers: HTTP_HEADERS,
      timeout: 120_000,
    });

    if (!Array.isArray(data) || data.length === 0) break;

    for (const row of data) {
      const m = src.map(row);
      if (!m) continue;

      const city = titleCase(m.city);
      const name = m.name.trim();

      await writer.push({
        entityKey: `${src.state}-${m.stateId}`,
        stateId: m.stateId,
        state: src.state,
        name,
        entityType: m.entityType ?? null,
        status: m.status ?? null,
        filingDate: toDate(m.filingDate),
        address: titleCase(m.address),
        city,
        zip: zip5(m.zip),
        county: titleCase(m.county),
        agentName: titleCase(m.agentName),
        slug: slugify(name, city, src.state, m.stateId),
        updatedAt: new Date(),
      });
      read++;
    }

    offset += PAGE;
    if (data.length < PAGE) break;
  }

  await writer.flush();
  return { read, written: writer.written };
}

async function main() {
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString().slice(0, 10);
  const wanted = process.argv.slice(2).map((s) => s.toUpperCase());
  const sources = wanted.length > 0 ? SOURCES.filter((s) => wanted.includes(s.state)) : SOURCES;

  console.log(`[+] Loading filings since ${since} from: ${sources.map((s) => s.state).join(', ')}`);

  let totalRead = 0;
  let totalWritten = 0;

  await trackRun('businesses', sources.map((s) => s.url).join(' '), async () => {
    for (const src of sources) {
      console.log(`\n--- ${src.state} ---`);
      try {
        const { read, written } = await loadSource(src, since);
        totalRead += read;
        totalWritten += written;
      } catch (err: any) {
        console.error(`\n[!] ${src.state} failed: ${err.message}`);
      }
    }
    return { read: totalRead, written: totalWritten };
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
