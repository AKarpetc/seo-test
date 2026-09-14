import { config } from 'dotenv';
config();
import { S3Client, CreateBucketCommand, PutBucketTaggingCommand } from '@aws-sdk/client-s3';
import { randomBytes } from 'crypto';

const REGION = process.env.AWS_REGION || 'us-east-1';
const s3Client = new S3Client({ region: REGION });

async function initS3Bucket() {
  // Generate a semi-random name to avoid global collisions, but keep the prefix
  const suffix = randomBytes(3).toString('hex');
  const bucketName = `seo-pr-data-dumps-${suffix}`;

  try {
    console.log(`Creating S3 Bucket: ${bucketName} in region ${REGION}...`);
    
    await s3Client.send(new CreateBucketCommand({
      Bucket: bucketName,
    }));
    
    console.log(`✅ Bucket ${bucketName} created successfully.`);

    // Add tags for cost tracking
    console.log(`Adding tags to bucket...`);
    await s3Client.send(new PutBucketTaggingCommand({
      Bucket: bucketName,
      Tagging: {
        TagSet: [
          { Key: 'Project', Value: 'seo' },
          { Key: 'Environment', Value: 'production' }
        ]
      }
    }));
    
    console.log(`✅ Tags added successfully.`);
    console.log(`\n🎉 SUCCESS! Your S3 bucket is ready.`);
    console.log(`👉 Please update your .env (or AWS task definitions) to use this bucket name for data uploads: ${bucketName}\n`);

  } catch (error) {
    console.error(`❌ Failed to create bucket:`, error);
  }
}

if (require.main === module) {
  initS3Bucket();
}
