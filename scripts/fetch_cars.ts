import axios from 'axios';
import unzipper from 'unzipper';
import csv from 'csv-parser';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const EPA_ZIP_URL = 'https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip';
const DOWNLOAD_DIR = path.join(process.cwd(), 'tmp');
const ZIP_PATH = path.join(DOWNLOAD_DIR, 'vehicles.csv.zip');
const CSV_PATH = path.join(DOWNLOAD_DIR, 'vehicles.csv');

// Утилита для создания slug
const generateSlug = (make: string, model: string, year: number) => {
  return `${make}-${model}-${year}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

async function downloadAndExtract() {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR);
  }

  console.log('Downloading zip from fueleconomy.gov...');
  const response = await axios({
    url: EPA_ZIP_URL,
    method: 'GET',
    responseType: 'stream',
  });

  const writer = fs.createWriteStream(ZIP_PATH);
  response.data.pipe(writer);

  return new Promise<void>((resolve, reject) => {
    writer.on('finish', () => {
      console.log('Extracting zip...');
      fs.createReadStream(ZIP_PATH)
        .pipe(unzipper.Extract({ path: DOWNLOAD_DIR }))
        .on('close', () => {
          console.log('Extraction complete.');
          resolve();
        })
        .on('error', reject);
    });
    writer.on('error', reject);
  });
}

async function processData() {
  console.log('Processing CSV and inserting to database...');
  const carsToInsert: any[] = [];
  
  return new Promise<void>((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', (row) => {
        const year = parseInt(row.year);
        
        // MVP: Берем только современные машины с 2020 по 2024 год, чтобы ускорить импорт
        if (year >= 2020 && year <= 2024) {
          const make = row.make;
          const model = row.model;
          const slug = generateSlug(make, model, year);
          
          let engine = null;
          if (row.displ && row.cylinders) {
            engine = `${row.displ}L ${row.cylinders}-Cylinder`;
          }

          carsToInsert.push({
            make,
            model,
            year,
            slug,
            engine,
            mpgCity: parseInt(row.city08) || null,
            mpgHighway: parseInt(row.highway08) || null,
            description: `Official EPA fuel economy specs for the ${year} ${make} ${model}.`
          });
        }
      })
      .on('end', async () => {
        console.log(`Parsed ${carsToInsert.length} cars from 2020-2024.`);
        
        // Для S3: В будущем можно сериализовать массив carsToInsert в JSON и выгрузить на AWS S3.
        // await uploadToS3(JSON.stringify(carsToInsert), 'cars-2020-2024.json');

        // Batch upsert into PostgreSQL
        let inserted = 0;
        console.log('Pushing to PostgreSQL database...');
        
        // Убираем дубликаты по slug (EPA часто дублирует модели с разными комплектациями)
        const uniqueCarsMap = new Map();
        for (const car of carsToInsert) {
          if (!uniqueCarsMap.has(car.slug)) {
            uniqueCarsMap.set(car.slug, car);
          }
        }
        
        const uniqueCars = Array.from(uniqueCarsMap.values());
        console.log(`Unique models to insert: ${uniqueCars.length}`);

        for (const car of uniqueCars) {
          try {
            await prisma.car.upsert({
              where: { slug: car.slug },
              update: {},
              create: car,
            });
            inserted++;
            if (inserted % 500 === 0) console.log(`Inserted ${inserted}...`);
          } catch (e) {
            // Ignore uniqueness collisions in edge cases
          }
        }

        console.log(`Done! Successfully pushed ${inserted} real cars to PostgreSQL.`);
        resolve();
      })
      .on('error', reject);
  });
}

async function main() {
  try {
    await downloadAndExtract();
    await processData();
  } catch (e) {
    console.error('ETL Pipeline Failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
