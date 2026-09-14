import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import unzipper from 'unzipper';
import { parse } from 'csv-parse';
import dotenv from 'dotenv';
import { slugify } from './utils'; // We will inline slugify here to avoid missing imports

dotenv.config();

const prisma = new PrismaClient();

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.AWS_BUCKET_DOCTORS;
const FILE_KEY = 'NPPES_Data_Dissemination_August_2026_V2.zip'; // Based on our streaming script

const s3Client = new S3Client({ 
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  }
});

function createSlug(firstName: string | null, lastName: string | null, clinicName: string | null, specialty: string, city: string, state: string, npi: string): string {
  const name = firstName && lastName ? `Dr ${firstName} ${lastName}` : (clinicName || 'Provider');
  const base = `${name} ${specialty} ${city} ${state} ${npi}`.toLowerCase();
  return base.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

async function runEtl() {
  if (!BUCKET) throw new Error('AWS_BUCKET_DOCTORS not set');

  console.log(`[+] Fetching S3 Object Stream: s3://${BUCKET}/${FILE_KEY}`);

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: FILE_KEY
  });

  const response = await s3Client.send(command);
  const s3Stream = response.Body as NodeJS.ReadableStream;

  if (!s3Stream) {
    throw new Error('Failed to get stream from S3');
  }

  console.log('[+] Starting on-the-fly unzip and CSV parsing...');

  const zip = s3Stream.pipe(unzipper.Parse({ forceStream: true }));
  let rowsProcessed = 0;
  let batch: any[] = [];
  const BATCH_SIZE = 10000;
  const MAX_RECORDS = 50000; // Let's limit to 50k for testing so we don't wait 40 minutes

  for await (const entry of zip) {
    const fileName = entry.path;
    
    // The main data file starts with npidata_pfile_ and ends with .csv
    if (fileName.startsWith('npidata_pfile_') && fileName.endsWith('.csv') && !fileName.includes('FileHeader')) {
      console.log(`[+] Found main CSV file inside ZIP: ${fileName}`);
      
      const parser = entry.pipe(parse({
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        escape: '\\'
      }));

      for await (const row of parser) {
        if (rowsProcessed >= MAX_RECORDS) {
          console.log(`\n[+] Reached limit of ${MAX_RECORDS} for this test run.`);
          break;
        }

        // Only parse US records (state length = 2)
        const state = row['Provider Business Practice Location Address State Name'];
        if (!state || state.length !== 2) continue;

        const isIndividual = row['Entity Type Code'] === '1';
        const npi = row['NPI'];
        const firstName = isIndividual ? row['Provider First Name'] : null;
        const lastName = isIndividual ? row['Provider Last Name (Legal Name)'] : null;
        const clinicName = !isIndividual ? row['Provider Organization Name (Legal Business Name)'] : null;
        
        // Sometimes names are empty, skip malformed rows
        if (isIndividual && !firstName && !lastName) continue;
        if (!isIndividual && !clinicName) continue;

        const city = row['Provider Business Practice Location Address City Name'];
        const zipCode = row['Provider Business Practice Location Address Postal Code']?.substring(0, 5);
        const phone = row['Provider Business Practice Location Address Telephone Number'];
        const taxonomy = row['Healthcare Provider Taxonomy Code_1'] || 'Healthcare Provider';

        // Basic cleanups
        if (!city || !zipCode) continue;

        const slug = createSlug(firstName, lastName, clinicName, taxonomy, city, state, npi);

        batch.push({
          npi,
          firstName,
          lastName,
          clinicName,
          specialty: taxonomy,
          city,
          state,
          zip: zipCode,
          phone,
          slug
        });

        rowsProcessed++;

        if (batch.length >= BATCH_SIZE) {
          process.stdout.write(`\r    [Processing] Inserting batch of ${BATCH_SIZE}... Total processed: ${rowsProcessed}`);
          await prisma.doctor.createMany({
            data: batch,
            skipDuplicates: true
          });
          batch = []; // Clear batch
        }
      }

      // Insert any remaining in the final batch
      if (batch.length > 0) {
        console.log(`\n[+] Inserting final batch of ${batch.length}...`);
        await prisma.doctor.createMany({
          data: batch,
          skipDuplicates: true
        });
        batch = [];
      }
      
      console.log('\n[+] CSV processing completed!');
      // Once we've processed the correct file, we can break out of the zip parsing
      break; 
    } else {
      // Drain other files in the zip to prevent stream blocking
      entry.autodrain();
    }
  }

  console.log(`✅ ETL complete. Inserted ~${rowsProcessed} doctors into PostgreSQL.`);
}

runEtl().catch(e => {
  console.error('[!] ETL Error:', e);
  process.exit(1);
});
