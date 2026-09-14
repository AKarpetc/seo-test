import { S3Client, ListBucketsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1',
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }});
try {
  const b = await s3.send(new ListBucketsCommand({}));
  const mine = b.Buckets.filter(x => x.Name.startsWith('seo-pr'));
  for (const bk of mine) {
    try {
      const o = await s3.send(new ListObjectsV2Command({ Bucket: bk.Name }));
      const objs = (o.Contents||[]).map(c => `${c.Key} (${(c.Size/1024/1024).toFixed(1)} MB)`);
      console.log(`${bk.Name}: ${objs.length ? objs.join(', ') : '(empty)'}`);
    } catch(e) { console.log(`${bk.Name}: ERR ${e.name}`); }
  }
} catch(e) { console.log('ListBuckets failed:', e.name, e.message); }
