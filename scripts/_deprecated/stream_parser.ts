import fs from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import csv from 'csv-parser';
import { PrismaClient } from '@prisma/client';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  // Credentials will be automatically picked up from process.env.AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
});

// Helper to get a readable stream from S3 or Local FS
async function getReadStream(filePath: string): Promise<Readable> {
  if (filePath.startsWith('s3://')) {
    // Parse s3://bucket-name/path/to/key.csv
    const url = new URL(filePath);
    const bucket = url.hostname;
    const key = url.pathname.substring(1); // remove leading slash
    
    console.log(`Fetching from S3... Bucket: ${bucket}, Key: ${key}`);
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    const response = await s3Client.send(command);
    return response.Body as Readable;
  } else {
    // Local file
    if (!fs.existsSync(filePath)) {
      throw new Error(`Local file not found: ${filePath}`);
    }
    return fs.createReadStream(filePath);
  }
}

// A generic batch processor for streaming huge CSV files
export async function processCsvInBatches<T>(
  filePath: string,
  batchSize: number,
  transformFn: (row: any) => T | null,
  insertFn: (batch: T[]) => Promise<any>
) {
  let batch: T[] = [];
  let totalProcessed = 0;
  let totalInserted = 0;

  console.log(`Starting to process CSV: ${filePath}`);
  
  let readStream: Readable;
  try {
    readStream = await getReadStream(filePath);
  } catch (err) {
    console.error('Failed to open stream:', err);
    return;
  }
  
  const csvParser = csv();

  // Handle data events directly for precise batch control
  csvParser.on('data', async (data) => {
    try {
      const transformed = transformFn(data);
      if (transformed) {
        batch.push(transformed);
      }
      
      totalProcessed++;

      if (batch.length >= batchSize) {
        // Pause the stream while we process the batch
        csvParser.pause();
        const currentBatch = [...batch];
        batch = [];
        
        await insertFn(currentBatch);
        totalInserted += currentBatch.length;
        
        console.log(`Processed ${totalProcessed} rows. Inserted ${totalInserted} records.`);
        
        // Resume the stream
        csvParser.resume();
      }
    } catch (err) {
      console.error('Error processing row', err);
    }
  });

  return new Promise((resolve, reject) => {
    csvParser.on('end', async () => {
      // Process remaining items in the last batch
      if (batch.length > 0) {
        try {
          await insertFn(batch);
          totalInserted += batch.length;
          console.log(`Final batch processed. Processed ${totalProcessed} rows. Inserted ${totalInserted} records.`);
        } catch (err) {
          console.error('Error inserting final batch', err);
          reject(err);
          return;
        }
      }
      console.log(`CSV Processing Complete. Total Inserted: ${totalInserted}`);
      resolve(totalInserted);
    });
    
    csvParser.on('error', (err) => {
      console.error('CSV Parsing Error', err);
      reject(err);
    });

    readStream.pipe(csvParser);
  });
}

// Example usage function (can be invoked via CLI)
async function main() {
  const args = process.argv.slice(2);
  const file = args[0];
  const type = args[1];

  if (!file || !type) {
    console.log('Usage: npx tsx scripts/stream_parser.ts <path_to_csv> <type: doctor | realestate>');
    process.exit(1);
  }

  if (!file.startsWith('s3://') && !fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  try {
    if (type === 'doctor') {
      await processCsvInBatches(
        file,
        5000,
        (row) => {
          // Map CSV columns to Doctor model
          // This assumes standard NPI Registry CSV format columns (simplified)
          const npi = row['NPI'];
          if (!npi) return null;
          
          const firstName = row['Provider First Name'] || null;
          const lastName = row['Provider Last Name (Legal Name)'] || null;
          const clinicName = row['Provider Organization Name (Legal Business Name)'] || null;
          const specialty = row['Healthcare Provider Taxonomy Code_1'] || 'General'; // Simplified
          const city = row['Provider Business Mailing Address City Name'] || 'Unknown';
          const state = row['Provider Business Mailing Address State Name'] || 'Unknown';
          const zip = row['Provider Business Mailing Address Postal Code'] || 'Unknown';
          
          if (!firstName && !lastName && !clinicName) return null;

          const slugName = clinicName ? clinicName : `${firstName}-${lastName}`;
          const slug = `dr-${slugName}-${specialty}-${city}-${state}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

          return {
            npi,
            firstName,
            lastName,
            clinicName,
            specialty,
            city,
            state,
            zip,
            slug
          };
        },
        async (batch) => {
          await prisma.doctor.createMany({
            data: batch,
            skipDuplicates: true
          });
        }
      );
    } else if (type === 'realestate') {
      await processCsvInBatches(
        file,
        5000,
        (row) => {
          const zip = row['ZIP'] || row['zip_code'];
          const city = row['City'] || row['city'];
          const state = row['State'] || row['state'];
          if (!zip || !city || !state) return null;

          const slug = `real-estate-${city}-${state}-${zip}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

          return {
            zip,
            city,
            state,
            slug,
            avgHomePrice: parseInt(row['AvgHomePrice'] || '0', 10),
            avgPropertyTax: parseInt(row['AvgPropertyTax'] || '0', 10),
          };
        },
        async (batch) => {
          await prisma.realEstateLocation.createMany({
            data: batch,
            skipDuplicates: true
          });
        }
      );
    } else if (type === 'broadband') {
      await processCsvInBatches(file, 5000, (row) => ({ zip: row['zip'], topProviders: row['providers'] }), async (batch) => await prisma.broadbandCoverage.createMany({ data: batch, skipDuplicates: true }));
    } else if (type === 'demographics') {
      await processCsvInBatches(file, 5000, (row) => ({ zip: row['zip'], population: parseInt(row['pop']) }), async (batch) => await prisma.censusDemographic.createMany({ data: batch, skipDuplicates: true }));
    } else if (type === 'energy') {
      await processCsvInBatches(file, 5000, (row) => ({ providerName: row['provider'], state: row['state'] }), async (batch) => await prisma.utilityRate.createMany({ data: batch, skipDuplicates: true }));
    } else if (type === 'banks') {
      await processCsvInBatches(file, 5000, (row) => {
        if (!row['CERT'] || !row['NAME']) return null;
        return {
          routingNumber: row['CERT'], 
          bankName: row['NAME'],
          city: row['CITY'],
          state: row['STALP'],
          zip: row['ZIP'],
          address: row['ADDRESS']
        };
      }, async (batch) => await prisma.bankBranch.createMany({ data: batch, skipDuplicates: true }));
    } else if (type === 'executives') {
      await processCsvInBatches(file, 5000, (row) => ({ ticker: row['ticker'], companyName: row['company'] }), async (batch) => await prisma.sECExecutive.createMany({ data: batch, skipDuplicates: true }));
    } else if (type === 'trucking') {
      await processCsvInBatches(file, 5000, (row) => ({ dotNumber: row['dot'], companyName: row['name'] }), async (batch) => await prisma.dOTCarrier.createMany({ data: batch, skipDuplicates: true }));
    } else if (type === 'aircraft') {
      await processCsvInBatches(file, 5000, (row) => ({ nNumber: row['n_number'], ownerName: row['owner'] }), async (batch) => await prisma.aircraft.createMany({ data: batch, skipDuplicates: true }));
    } else if (type === 'nutrition') {
      await processCsvInBatches(file, 5000, (row) => ({ fdcId: row['fdc_id'], foodName: row['name'] }), async (batch) => await prisma.foodNutrition.createMany({ data: batch, skipDuplicates: true }));
    } else if (type === 'climate') {
      await processCsvInBatches(file, 5000, (row) => ({ zip: row['zip'], avgTemp: parseFloat(row['temp']) }), async (batch) => await prisma.climateData.createMany({ data: batch, skipDuplicates: true }));
    } else if (type === 'trademark') {
      await processCsvInBatches(file, 5000, (row) => ({ serialNumber: row['serial'], brandName: row['brand'] }), async (batch) => await prisma.trademark.createMany({ data: batch, skipDuplicates: true }));
    } else {
      console.log('Unknown type. Use: doctor, realestate, broadband, demographics, energy, banks, executives, trucking, aircraft, nutrition, climate, trademark.');
    }
  } catch (err) {
    console.error('Fatal error during parsing:', err);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
