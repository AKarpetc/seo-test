import axios from 'axios';
import { prisma, BatchWriter, slugify, titleCase, toFloat, toDate, trackRun, HTTP_HEADERS } from './lib/etl';

/**
 * FDIC moved its API from banks.data.fdic.gov to api.fdic.gov; the old host only
 * 301s, which silently produced mis-keyed rows in the first seed.
 * The locations endpoint carries every branch office (~78k), not just the ~4.5k
 * institutions, and a branch is what a "bank near me" query actually wants.
 */
const API = 'https://api.fdic.gov/banks/locations';
const PAGE = 1000;

const FIELDS = [
  'UNINUM', 'CERT', 'NAME', 'OFFNAME', 'ADDRESS', 'CITY', 'STALP', 'ZIP',
  'COUNTY', 'LATITUDE', 'LONGITUDE', 'ESTYMD', 'SERVTYPE_DESC',
].join(',');

async function main() {
  await trackRun('banks', API, async () => {
    const writer = new BatchWriter<any>(
      (rows) => prisma.bankBranch.createMany({ data: rows, skipDuplicates: true }),
      (r) => r.uninum,
      2000,
      'branches',
    );

    let offset = 0;
    let read = 0;
    let total = Infinity;

    while (offset < total) {
      const { data } = await axios.get(API, {
        params: { fields: FIELDS, limit: PAGE, offset, format: 'json' },
        headers: HTTP_HEADERS,
        timeout: 60_000,
      });

      total = data?.meta?.total ?? 0;
      const rows: any[] = data?.data ?? [];
      if (rows.length === 0) break;

      for (const wrapper of rows) {
        const b = wrapper.data || wrapper;
        const uninum = b.UNINUM != null ? String(b.UNINUM) : null;
        const bankName = titleCase(b.NAME);
        if (!uninum || !bankName) continue;

        const city = titleCase(b.CITY);
        const state = b.STALP || null;

        await writer.push({
          uninum,
          cert: b.CERT != null ? String(b.CERT) : null,
          bankName,
          branchName: titleCase(b.OFFNAME),
          address: titleCase(b.ADDRESS),
          city,
          state,
          zip: b.ZIP ? String(b.ZIP).padStart(5, '0').slice(0, 5) : null,
          county: titleCase(b.COUNTY),
          lat: toFloat(b.LATITUDE),
          lng: toFloat(b.LONGITUDE),
          established: toDate(b.ESTYMD),
          slug: slugify(bankName, b.OFFNAME !== b.NAME ? b.OFFNAME : null, city, state, uninum),
        });
        read++;
      }

      offset += PAGE;
    }

    await writer.flush();
    return { read, written: writer.written };
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
