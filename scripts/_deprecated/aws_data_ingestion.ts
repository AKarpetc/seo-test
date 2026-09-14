import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import stream from 'stream';

dotenv.config();

const REGION = process.env.AWS_REGION || 'us-east-1';

const s3Client = new S3Client({ 
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  }
});

// A robust helper to stream an HTTP response directly into AWS S3
async function streamToS3(url: string, bucket: string, key: string, headers: any = {}) {
  console.log(`[+] Starting streaming download from: ${url}`);
  console.log(`    Destination: s3://${bucket}/${key}`);
  
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream', // Extremely important to keep memory usage low
      headers: headers
    });

    const passThroughStream = new stream.PassThrough();
    response.data.pipe(passThroughStream);

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: passThroughStream,
      },
    });

    upload.on('httpUploadProgress', (progress) => {
      if (progress.loaded) {
        const mb = (progress.loaded / 1024 / 1024).toFixed(2);
        process.stdout.write(`\r    Progress: ${mb} MB uploaded...`);
      }
    });

    await upload.done();
    console.log(`\n[+] ✅ Successfully uploaded ${key} to ${bucket}`);

  } catch (error: any) {
    console.error(`\n[!] ❌ Failed to stream ${url}:`, error.message);
  }
}

// ---------------------------------------------------------------------------
// 1. FAA Aircraft Database (Static Zip Link)
// ---------------------------------------------------------------------------
async function ingestAircraft() {
  const bucket = process.env.AWS_BUCKET_AIRCRAFT;
  if (!bucket) throw new Error('AWS_BUCKET_AIRCRAFT not found in .env');

  const url = 'https://registry.faa.gov/database/ReleasableAircraft.zip';
  await streamToS3(url, bucket, 'ReleasableAircraft.zip');
}

// ---------------------------------------------------------------------------
// 2. NPPES Doctors (Dynamic CMS Link)
// ---------------------------------------------------------------------------
async function ingestDoctors() {
  const bucket = process.env.AWS_BUCKET_DOCTORS;
  if (!bucket) throw new Error('AWS_BUCKET_DOCTORS not found in .env');

  console.log('[+] Scraping CMS NPPES for latest download link...');
  const pageUrl = 'https://download.cms.gov/nppes/NPI_Files.html';
  
  try {
    const response = await axios.get(pageUrl);
    const $ = cheerio.load(response.data);
    
    // Find the link that contains "NPPES_Data_Dissemination_"
    let downloadLink = '';
    $('a').each((i, link) => {
      const href = $(link).attr('href');
      if (href && href.includes('NPPES_Data_Dissemination_') && href.endsWith('.zip') && !href.includes('Weekly')) {
        downloadLink = href;
      }
    });

    if (!downloadLink) {
      throw new Error('Could not find the NPPES Full Replacement zip link on the CMS page.');
    }

    if (!downloadLink.startsWith('http')) {
      downloadLink = `https://download.cms.gov/nppes/${downloadLink.replace('./', '')}`;
    }

    const fileName = downloadLink.split('/').pop() || 'NPPES_Data.zip';
    await streamToS3(downloadLink, bucket, fileName);
  } catch (error: any) {
    console.error('[!] Failed to ingest doctors:', error.message);
  }
}

// ---------------------------------------------------------------------------
// Main Pipeline Execution
// ---------------------------------------------------------------------------
async function runPipeline() {
  console.log('🚀 Starting AWS Zero-Disk Data Ingestion Pipeline\n');
  
  // To avoid overloading network, we do these sequentially
  console.log('--- Phase 1: Aircraft (FAA) ---');
  await ingestAircraft();
  
  console.log('\n--- Phase 2: Doctors (NPPES) ---');
  await ingestDoctors();
  
  console.log('\n✅ Pipeline run complete.');
}

runPipeline();
