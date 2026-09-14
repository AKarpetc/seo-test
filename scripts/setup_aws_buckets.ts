import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { 
  S3Client, 
  CreateBucketCommand, 
  PutPublicAccessBlockCommand 
} from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Load existing environment variables
dotenv.config();

const REGION = process.env.AWS_REGION || 'us-east-1';

// We must explicitly read credentials from process.env if they exist, 
// though the AWS SDK automatically picks up AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
const s3Client = new S3Client({ 
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  }
});

// We generate a short hex to guarantee global uniqueness of buckets
const hash = crypto.randomBytes(3).toString('hex'); // 6 character random hex
const prefix = 'seo-pr-';

const niches = [
  'doctors', 'broadband', 'demographics', 'energy', 
  'executives', 'trucking', 'aircraft', 'nutrition', 
  'climate', 'trademark'
];

async function createBuckets() {
  const newBuckets: Record<string, string> = {};

  console.log('Starting S3 infrastructure provisioning...');

  for (const niche of niches) {
    const bucketName = `${prefix}${niche}-${hash}`;
    const command = new CreateBucketCommand({
      Bucket: bucketName
    });

    try {
      console.log(`Creating bucket: ${bucketName}...`);
      await s3Client.send(command);
      
      // Block all public access (Security Best Practice)
      const blockPublicAccessCommand = new PutPublicAccessBlockCommand({
        Bucket: bucketName,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true
        }
      });
      await s3Client.send(blockPublicAccessCommand);
      console.log(`✅ Secured and created: ${bucketName}`);

      // Store in our dictionary for updating .env
      const envKey = `AWS_BUCKET_${niche.toUpperCase()}`;
      newBuckets[envKey] = bucketName;
    } catch (error: any) {
      console.error(`❌ Failed to create bucket ${bucketName}:`, error.message);
    }
  }

  // Update .env file
  updateEnvFile(newBuckets);
}

function updateEnvFile(newBuckets: Record<string, string>) {
  const envPath = path.resolve(process.cwd(), '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  console.log('\nUpdating .env file with new bucket names...');

  let changed = false;
  for (const [key, value] of Object.entries(newBuckets)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}="${value}"`);
    } else {
      envContent += `\n${key}="${value}"`;
    }
    changed = true;
    console.log(`Added: ${key}="${value}"`);
  }

  if (changed) {
    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
    console.log('\n✅ .env file successfully updated.');
  }
}

createBuckets();
