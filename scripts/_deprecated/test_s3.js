require('dotenv').config();
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const csv = require('csv-parser');

const s3Client = new S3Client({ region: 'us-east-1' });

async function test() {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_DATA_BUCKET,
    Key: 'banks_dump.csv',
  });
  const response = await s3Client.send(command);
  
  response.Body.pipe(csv())
    .on('data', (data) => {
      console.log('Row:', data.CERT, data.NAME);
      process.exit(0);
    });
}
test();
