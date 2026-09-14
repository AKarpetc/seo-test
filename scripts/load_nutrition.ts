import unzipper from 'unzipper';
import { parse } from 'csv-parse';
import {
  prisma, s3Stream, requireBucket, BatchWriter, slugify, toFloat, trackRun,
} from './lib/etl';

const KEY = 'FoodData_Central_csv.zip';

/**
 * USDA nutrient ids worth publishing. food_nutrient.csv holds 26M+ rows covering
 * hundreds of nutrients; everything outside this map is discarded while streaming.
 */
const NUTRIENTS: Record<string, keyof Nutrients> = {
  '1008': 'calories', '1003': 'protein', '1004': 'fat', '1005': 'carbs',
  '1079': 'fiber', '2000': 'sugar', '1093': 'sodium', '1092': 'potassium',
  '1087': 'calcium', '1089': 'iron',
};

type Nutrients = {
  calories?: number; protein?: number; fat?: number; carbs?: number; fiber?: number;
  sugar?: number; sodium?: number; potassium?: number; calcium?: number; iron?: number;
};

/**
 * Branded entries are 1.9M of the 2M rows but carry sparse, duplicated values, and
 * a page per barcode is thin content. Curated USDA data types are the default;
 * raise the cap deliberately if branded pages are wanted.
 */
const BRANDED_LIMIT = parseInt(process.env.NUTRITION_BRANDED_LIMIT || '0', 10);
const CURATED = new Set(['foundation_food', 'sr_legacy_food', 'survey_fndds_food', 'sub_sample_food']);

type FoodRow = {
  fdcId: string;
  foodName: string;
  dataType: string;
  categoryId: string | null;
};

async function main() {
  const bucket = requireBucket('AWS_BUCKET_NUTRITION');

  await trackRun('nutrition', `s3://${bucket}/${KEY}`, async () => {
    // The archive is ordered branded_food.csv -> food.csv -> food_nutrient.csv, so a
    // single sequential pass is enough and avoids buffering a 1 GB zip or re-downloading it.
    const zip = (await s3Stream(bucket, KEY)).pipe(unzipper.Parse({ forceStream: true }));

    const brands = new Map<string, { owner: string | null; category: string | null; serving: number | null; unit: string | null }>();
    const foods: FoodRow[] = [];
    const wanted = new Set<string>();
    const nutrients = new Map<string, Nutrients>();

    for await (const entry of zip) {
      const name = entry.path.toLowerCase().split('/').pop() || '';
      const parser = () => entry.pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true }));

      if (name === 'branded_food.csv' && BRANDED_LIMIT > 0) {
        console.log('[+] branded_food.csv');
        for await (const row of parser()) {
          const id = (row['fdc_id'] || '').trim();
          if (!id) continue;
          brands.set(id, {
            owner: (row['brand_owner'] || '').trim() || null,
            category: (row['branded_food_category'] || '').trim() || null,
            serving: toFloat(row['serving_size']),
            unit: (row['serving_size_unit'] || '').trim() || null,
          });
        }
        console.log(`    ${brands.size.toLocaleString()} branded entries`);
      } else if (name === 'food.csv') {
        console.log('[+] food.csv');
        let branded = 0;
        for await (const row of parser()) {
          const fdcId = (row['fdc_id'] || '').trim();
          const foodName = (row['description'] || '').trim();
          const dataType = (row['data_type'] || '').trim();
          if (!fdcId || !foodName) continue;

          if (!CURATED.has(dataType)) {
            if (branded >= BRANDED_LIMIT) continue;
            branded++;
          }

          foods.push({ fdcId, foodName, dataType, categoryId: (row['food_category_id'] || '').trim() || null });
          wanted.add(fdcId);
        }
        console.log(`    ${foods.length.toLocaleString()} foods selected`);
      } else if (name === 'food_nutrient.csv') {
        console.log('[+] food_nutrient.csv (values for selected foods only)');
        let scanned = 0;
        for await (const row of parser()) {
          scanned++;
          if (scanned % 5_000_000 === 0) process.stdout.write(`\r    scanned ${scanned.toLocaleString()} rows`);
          const field = NUTRIENTS[(row['nutrient_id'] || '').trim()];
          if (!field) continue;
          const fdcId = (row['fdc_id'] || '').trim();
          if (!wanted.has(fdcId)) continue;
          const amount = toFloat(row['amount']);
          if (amount === null) continue;
          const rec = nutrients.get(fdcId) || {};
          rec[field] = amount;
          nutrients.set(fdcId, rec);
        }
        console.log(`\n    nutrient values for ${nutrients.size.toLocaleString()} foods`);
        break; // everything after this file is reference data
      } else {
        entry.autodrain();
      }
    }

    const writer = new BatchWriter<any>(
      (rows) => prisma.foodNutrition.createMany({ data: rows, skipDuplicates: true }),
      (r) => r.fdcId,
      2000,
      'foods',
    );

    const slugSeen = new Set<string>();
    let read = 0;

    for (const food of foods) {
      const n = nutrients.get(food.fdcId);
      // Without macros there is nothing to publish or compare.
      if (!n || (n.calories === undefined && n.protein === undefined)) continue;

      const brand = brands.get(food.fdcId);
      let slug = slugify(food.foodName, brand?.owner);
      if (!slug) continue;
      if (slugSeen.has(slug)) slug = `${slug}-${food.fdcId}`;
      slugSeen.add(slug);

      await writer.push({
        fdcId: food.fdcId,
        foodName: food.foodName,
        brandOwner: brand?.owner ?? null,
        category: brand?.category ?? food.categoryId,
        dataType: food.dataType,
        servingSize: brand?.serving ?? null,
        servingUnit: brand?.unit ?? null,
        calories: n.calories ?? null,
        protein: n.protein ?? null,
        fat: n.fat ?? null,
        carbs: n.carbs ?? null,
        fiber: n.fiber ?? null,
        sugar: n.sugar ?? null,
        sodium: n.sodium ?? null,
        potassium: n.potassium ?? null,
        calcium: n.calcium ?? null,
        iron: n.iron ?? null,
        slug,
      });
      read++;
    }

    await writer.flush();
    return { read, written: writer.written };
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
