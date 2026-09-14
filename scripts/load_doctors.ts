import unzipper from 'unzipper';
import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';
import {
  prisma, s3Stream, s3FindLatest, requireBucket, BatchWriter,
  slugify, titleCase, zip5, trackRun,
} from './lib/etl';

type TaxonomyEntry = { name: string; grouping: string; classification: string; specialization: string };

const TAXONOMY: Record<string, TaxonomyEntry> = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data', 'nucc_taxonomy.json'), 'utf8'),
);

/** NPPES stores only the NUCC code; the readable name is what a page can rank for. */
function specialtyName(code: string | undefined): { specialty: string; taxonomyCode: string | null } {
  if (!code) return { specialty: 'Healthcare Provider', taxonomyCode: null };
  const entry = TAXONOMY[code.trim()];
  return { specialty: entry?.name || 'Healthcare Provider', taxonomyCode: code.trim() };
}

const LIMIT = process.env.ETL_LIMIT ? parseInt(process.env.ETL_LIMIT, 10) : Infinity;

async function main() {
  const bucket = requireBucket('AWS_BUCKET_DOCTORS');
  const key = await s3FindLatest(bucket, /^NPPES_Data_Dissemination_.*\.zip$/i);
  if (!key) throw new Error(`No NPPES zip found in s3://${bucket} — run "npm run ingest:doctors" first.`);

  await trackRun('doctors', `s3://${bucket}/${key}`, async () => {
    console.log(`[+] Streaming s3://${bucket}/${key}`);
    const zip = (await s3Stream(bucket, key)).pipe(unzipper.Parse({ forceStream: true }));

    const writer = new BatchWriter<any>(
      (rows) => prisma.doctor.createMany({ data: rows, skipDuplicates: true }),
      (r) => r.npi,
      5000,
      'doctors',
      false, // NPI is unique upstream; an 8M-entry dedupe set would eat ~500MB
    );

    let read = 0;
    let found = false;

    for await (const entry of zip) {
      const name: string = entry.path;
      const isMain = /^npidata_pfile_.*\.csv$/i.test(name) && !/FileHeader/i.test(name);
      if (!isMain) {
        entry.autodrain();
        continue;
      }

      found = true;
      console.log(`[+] Parsing ${name}`);
      const parser = entry.pipe(
        parse({ columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true }),
      );

      for await (const row of parser) {
        if (read >= LIMIT) break;

        const state = row['Provider Business Practice Location Address State Name'];
        const city = row['Provider Business Practice Location Address City Name'];
        const zip = zip5(row['Provider Business Practice Location Address Postal Code']);
        const npi = row['NPI'];
        if (!npi || !state || state.length !== 2 || !city || !zip) continue;

        // NPPES flags deactivated providers; they must not become live pages.
        if (row['NPI Deactivation Date']) continue;

        const entityType = row['Entity Type Code'];
        const isIndividual = entityType === '1';
        const firstName = isIndividual ? titleCase(row['Provider First Name']) : null;
        const lastName = isIndividual ? titleCase(row['Provider Last Name (Legal Name)']) : null;
        const clinicName = !isIndividual
          ? titleCase(row['Provider Organization Name (Legal Business Name)'])
          : null;
        if (isIndividual && !lastName) continue;
        if (!isIndividual && !clinicName) continue;

        const { specialty, taxonomyCode } = specialtyName(row['Healthcare Provider Taxonomy Code_1']);
        const cityName = titleCase(city)!;
        const displayName = isIndividual ? `dr ${firstName} ${lastName}` : clinicName!;

        await writer.push({
          npi,
          entityType: entityType || '1',
          firstName,
          lastName,
          credential: row['Provider Credential Text']?.replace(/[^A-Za-z.]/g, '').slice(0, 20) || null,
          clinicName,
          specialty,
          taxonomyCode,
          address: titleCase(row['Provider First Line Business Practice Location Address']),
          city: cityName,
          state: state.toUpperCase(),
          zip,
          phone: row['Provider Business Practice Location Address Telephone Number'] || null,
          slug: slugify(displayName, specialty, cityName, state, npi),
        });

        read++;
        if (read % 100_000 === 0) process.stdout.write(`\r    read ${read.toLocaleString()}`);
      }

      await writer.flush();
      break; // main file handled; the rest of the archive is reference data
    }

    if (!found) throw new Error('npidata_pfile CSV not found inside the archive');
    return { read, written: writer.written };
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
