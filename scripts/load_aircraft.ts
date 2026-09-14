import unzipper from 'unzipper';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import {
  prisma, s3Stream, requireBucket, BatchWriter, slugify, titleCase,
  toInt, toDate, zip5, trackRun,
} from './lib/etl';

const KEY = 'ReleasableAircraft.zip';

/** FAA codes the registrant type as a single digit in MASTER.txt. */
const OWNER_TYPE: Record<string, string> = {
  '1': 'Individual', '2': 'Partnership', '3': 'Corporation', '4': 'Co-Owned',
  '5': 'Government', '7': 'LLC', '8': 'Non Citizen Corporation', '9': 'Non Citizen Co-Owned',
};

const AIRCRAFT_TYPE: Record<string, string> = {
  '1': 'Glider', '2': 'Balloon', '3': 'Blimp/Dirigible', '4': 'Fixed wing single engine',
  '5': 'Fixed wing multi engine', '6': 'Rotorcraft', '7': 'Weight-shift-control',
  '8': 'Powered Parachute', '9': 'Gyroplane', 'H': 'Hybrid Lift', 'O': 'Other',
};

const ENGINE_TYPE: Record<string, string> = {
  '0': 'None', '1': 'Reciprocating', '2': 'Turbo-prop', '3': 'Turbo-shaft', '4': 'Turbo-jet',
  '5': 'Turbo-fan', '6': 'Ramjet', '7': '2 Cycle', '8': '4 Cycle', '10': 'Electric', '11': 'Rotary',
};

const STATUS: Record<string, string> = {
  A: 'Triennial form mailed, not returned', N: 'Non-citizen corporation',
  V: 'Valid registration', R: 'Registration pending', T: 'Valid registration (from a trainee)',
  D: 'Expired Dealer', E: 'Certificate revoked', M: 'Valid registration (aircraft dismantled)',
  S: 'Second triennial attempt', W: 'Certificate cancelled', X: 'Enforcement letter',
  Z: 'Permanent reserved', '1': 'Triennial form returned undeliverable',
};

type Row = Record<string, string>;

function clean(v: string | undefined): string | null {
  const t = (v || '').trim();
  return t === '' ? null : t;
}

async function readEntries(buf: Buffer) {
  const dir = await unzipper.Open.buffer(buf);
  return dir.files;
}

async function parseEntry(stream: Readable): Promise<Row[]> {
  const rows: Row[] = [];
  const parser = stream.pipe(parse({ columns: true, skip_empty_lines: true, relax_column_count: true, trim: true, quote: false }));
  for await (const row of parser) rows.push(row as Row);
  return rows;
}

async function main() {
  const bucket = requireBucket('AWS_BUCKET_AIRCRAFT');

  await trackRun('aircraft', `s3://${bucket}/${KEY}`, async () => {
    console.log('[+] Buffering FAA archive (needed to join MASTER against ACFTREF)...');
    const chunks: Buffer[] = [];
    for await (const c of await s3Stream(bucket, KEY)) chunks.push(Buffer.from(c));
    const buf = Buffer.concat(chunks);
    console.log(`[+] ${(buf.length / 1024 / 1024).toFixed(1)} MB in memory`);

    const files = await readEntries(buf);
    const find = (name: string) =>
      files.find((f) => f.path.toUpperCase().endsWith(name)) ||
      (() => { throw new Error(`${name} not found in ${KEY}`); })();

    console.log('[+] Loading ACFTREF (manufacturer / model lookup)...');
    const refRows = await parseEntry(find('ACFTREF.TXT').stream() as unknown as Readable);
    const models = new Map<string, { mfr: string | null; model: string | null; seats: number | null; engines: number | null }>();
    for (const r of refRows) {
      const code = clean(r['CODE']);
      if (!code) continue;
      models.set(code, {
        mfr: titleCase(clean(r['MFR'])),
        model: clean(r['MODEL']),
        seats: toInt(r['NO-SEATS']),
        engines: toInt(r['NO-ENG']),
      });
    }
    console.log(`    ${models.size.toLocaleString()} model codes`);

    const writer = new BatchWriter<any>(
      (rows) => prisma.aircraft.createMany({ data: rows, skipDuplicates: true }),
      (r) => r.nNumber,
      5000,
      'aircraft',
      false,
    );

    console.log('[+] Streaming MASTER...');
    const master = find('MASTER.TXT').stream() as unknown as Readable;
    const parser = master.pipe(parse({ columns: true, skip_empty_lines: true, relax_column_count: true, trim: true, quote: false }));

    let read = 0;
    for await (const r of parser) {
      const row = r as Row;
      const nRaw = clean(row['N-NUMBER']);
      if (!nRaw) continue;

      const ref = models.get(clean(row['MFR MDL CODE']) || '');
      const nNumber = `N${nRaw}`;
      const ownerName = titleCase(clean(row['NAME']));
      const city = titleCase(clean(row['CITY']));
      const state = clean(row['STATE']);
      const year = toInt(row['YEAR MFR']);

      await writer.push({
        nNumber,
        serialNumber: clean(row['SERIAL NUMBER']),
        manufacturer: ref?.mfr || null,
        modelName: ref?.model || null,
        yearBuilt: year && year > 1900 && year < 2100 ? year : null,
        ownerName,
        ownerType: OWNER_TYPE[clean(row['TYPE REGISTRANT']) || ''] || null,
        aircraftType: AIRCRAFT_TYPE[clean(row['TYPE AIRCRAFT']) || ''] || null,
        engineType: ENGINE_TYPE[clean(row['TYPE ENGINE']) || ''] || null,
        engineCount: ref?.engines ?? null,
        seats: ref?.seats ?? null,
        address: titleCase(clean(row['STREET'])),
        city,
        state,
        zip: zip5(row['ZIP CODE']),
        statusCode: STATUS[clean(row['STATUS CODE']) || ''] || clean(row['STATUS CODE']),
        certIssueDate: toDate(row['CERT ISSUE DATE']),
        slug: slugify(nNumber, ref?.mfr, ref?.model, year),
      });

      read++;
      if (read % 50_000 === 0) process.stdout.write(`\r    read ${read.toLocaleString()}`);
    }

    await writer.flush();
    return { read, written: writer.written };
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
