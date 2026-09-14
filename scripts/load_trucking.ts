import { parse } from 'csv-parse';
import {
  prisma, s3Stream, requireBucket, BatchWriter, bulkUpsert, slugify, titleCase,
  toInt, toDate, zip5, trackRun,
} from './lib/etl';

const COLUMNS = [
  'dotNumber', 'companyName', 'dbaName', 'fleetSize', 'driverCount', 'carrierOperation',
  'authorityDate', 'mcs150Date', 'phone', 'address', 'city', 'state', 'zip', 'slug', 'updatedAt',
];

const KEY = 'fmcsa_census.csv';

/** FMCSA encodes the authority scope as a single letter. */
const OPERATION: Record<string, string> = {
  A: 'Interstate', B: 'Intrastate (hazmat)', C: 'Intrastate (non-hazmat)',
};

async function main() {
  const bucket = requireBucket('AWS_BUCKET_TRUCKING');

  await trackRun('trucking', `s3://${bucket}/${KEY}`, async () => {
    const stream = await s3Stream(bucket, KEY);
    const parser = stream.pipe(
      parse({ columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true, trim: true }),
    );

    // Upsert, not insert-or-skip: a refresh must pick up changed fleet size,
    // address and status on the 2.2M carriers that already exist.
    const writer = new BatchWriter<any>(
      async (rows) => ({ count: await bulkUpsert('DOTCarrier', 'dotNumber', COLUMNS, rows) }),
      (r) => r.dotNumber,
      1000,
      'carriers',
      false,
    );

    let read = 0;
    for await (const row of parser) {
      const dot = (row['DOT_NUMBER'] || '').trim();
      const legal = titleCase(row['LEGAL_NAME']);
      if (!dot || !legal) continue;

      // Only carriers with an active authority should become indexable pages.
      const status = (row['STATUS_CODE'] || '').trim().toUpperCase();
      if (status && status !== 'A') continue;

      const city = titleCase(row['PHY_CITY']);
      const state = (row['PHY_STATE'] || '').trim().toUpperCase() || null;

      await writer.push({
        dotNumber: dot,
        companyName: legal,
        dbaName: titleCase(row['DBA_NAME']),
        fleetSize: toInt(row['POWER_UNITS']) ?? toInt(row['TRUCK_UNITS']),
        driverCount: toInt(row['TOTAL_DRIVERS']),
        carrierOperation: OPERATION[(row['CARRIER_OPERATION'] || '').trim()] || null,
        authorityDate: toDate(row['ADD_DATE']),
        mcs150Date: toDate(row['MCS150_DATE']),
        phone: (row['PHONE'] || '').trim() || null,
        address: titleCase(row['PHY_STREET']),
        city,
        state,
        zip: zip5(row['PHY_ZIP']),
        slug: slugify(legal, city, state, dot),
        updatedAt: new Date(),
      });

      read++;
      if (read % 100_000 === 0) process.stdout.write(`\r    read ${read.toLocaleString()}`);
    }

    await writer.flush();

    console.log('\n[+] Rebuilding per-state carrier summary...');
    const byState = await prisma.dOTCarrier.groupBy({
      by: ['state'],
      where: { state: { not: null } },
      _count: { _all: true },
      _sum: { fleetSize: true, driverCount: true },
    });

    for (const s of byState) {
      const state = s.state!;
      await prisma.carrierStateSummary.upsert({
        where: { state },
        create: {
          state,
          carrierCount: s._count._all,
          totalTrucks: s._sum.fleetSize,
          totalDrivers: s._sum.driverCount,
          slug: slugify('trucking companies in', state),
        },
        update: {
          carrierCount: s._count._all,
          totalTrucks: s._sum.fleetSize,
          totalDrivers: s._sum.driverCount,
        },
      });
    }
    console.log(`    ${byState.length} state summaries`);

    return { read, written: writer.written };
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
