import { config } from 'dotenv';
config();
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.AWS_S3_DATA_BUCKET;

if (!BUCKET) {
  console.error('❌ Missing AWS_S3_DATA_BUCKET in .env file.');
  process.exit(1);
}

const s3Client = new S3Client({ region: REGION });

async function downloadAndUploadToS3(url: string, s3Key: string) {
  console.log(`📡 Fetching data from: ${url}`);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is empty');
    }

    console.log(`🚀 Starting stream upload to s3://${BUCKET}/${s3Key}`);
    
    // Convert Web ReadableStream to Node.js Readable stream
    // @ts-ignore - response.body in Node 20 fetch is a ReadableStream which works with Readable.fromWeb
    const bodyStream = Readable.fromWeb(response.body);

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET,
        Key: s3Key,
        Body: bodyStream,
      },
      queueSize: 4, // 4 concurrent uploads
      partSize: 5 * 1024 * 1024, // 5 MB per chunk
    });

    upload.on('httpUploadProgress', (progress) => {
      if (progress.loaded) {
        const mb = (progress.loaded / (1024 * 1024)).toFixed(2);
        process.stdout.write(`\r⏳ Uploaded: ${mb} MB`);
      }
    });

    await upload.done();
    console.log(`\n✅ Upload complete: s3://${BUCKET}/${s3Key}`);

  } catch (error) {
    console.error(`\n❌ Error during download/upload process:`, error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const target = args[0];

  if (!target) {
    console.log('Usage: npx tsx scripts/download_to_s3.ts <preset_name>');
    console.log('Available presets: banks, food');
    process.exit(1);
  }

  if (target === 'banks') {
    // FDIC Bank Institutions Data (CSV)
    const url = 'https://api.fdic.gov/banks/institutions?limit=10000&format=csv&download=true';
    await downloadAndUploadToS3(url, 'banks_dump.csv');
  } 
  else if (target === 'food') {
    // USDA FoodData Central requires an API key, so a static sample URL is used here for demonstration
    // If you have an API key, you can construct the URL
    console.log('USDA Food Data download requires an API key. Please use "banks" for a quick test.');
  }
  else {
    console.log(`Unknown preset: ${target}`);
  }
}

if (require.main === module) {
  main();
}
