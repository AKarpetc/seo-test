import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  streamUrlToS3, requireBucket, s3Exists, HTTP_HEADERS,
} from './lib/etl';

/**
 * Pulls each upstream bulk file straight into its S3 bucket without touching
 * local disk. Re-running is cheap: an object already in S3 is skipped unless
 * FORCE=1 is set.
 */

const FORCE = process.env.FORCE === '1';

async function put(dataset: string, bucketVar: string, url: string, key: string) {
  const bucket = requireBucket(bucketVar);
  if (!FORCE && (await s3Exists(bucket, key))) {
    console.log(`[=] ${dataset}: s3://${bucket}/${key} already present, skipping (FORCE=1 to re-download)`);
    return;
  }
  await streamUrlToS3(url, bucket, key);
}

/** CMS publishes a new NPPES full replacement monthly under a dated filename. */
async function doctors() {
  const page = 'https://download.cms.gov/nppes/NPI_Files.html';
  const { data } = await axios.get(page, { headers: HTTP_HEADERS, timeout: 60_000 });
  const $ = cheerio.load(data);

  let link = '';
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('NPPES_Data_Dissemination_') && href.endsWith('.zip') && !/Weekly|Deactivated/i.test(href)) {
      if (!link) link = href; // the first full-replacement link is the current month
    }
  });
  if (!link) throw new Error('NPPES full replacement link not found on the CMS page');
  if (!link.startsWith('http')) link = `https://download.cms.gov/nppes/${link.replace(/^\.\//, '')}`;

  await put('doctors', 'AWS_BUCKET_DOCTORS', link, link.split('/').pop()!);
}

/** FAA returns 403 to non-browser agents — that is why the first run produced nothing. */
async function aircraft() {
  await put(
    'aircraft',
    'AWS_BUCKET_AIRCRAFT',
    'https://registry.faa.gov/database/ReleasableAircraft.zip',
    'ReleasableAircraft.zip',
  );
}

/** FMCSA motor carrier census, refreshed nightly on the DOT open data portal. */
async function trucking() {
  await put(
    'trucking',
    'AWS_BUCKET_TRUCKING',
    'https://data.transportation.gov/api/views/az4n-8mr2/rows.csv?accessType=DOWNLOAD',
    'fmcsa_census.csv',
  );
}

/** USDA ships FoodData Central twice a year under a dated filename; probe for the newest. */
async function nutrition() {
  const today = new Date();
  let found = '';
  for (let back = 0; back < 900 && !found; back++) {
    const d = new Date(today.getTime() - back * 86_400_000);
    const stamp = d.toISOString().slice(0, 10);
    const url = `https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_csv_${stamp}.zip`;
    try {
      const res = await axios.head(url, { headers: HTTP_HEADERS, timeout: 10_000, validateStatus: () => true });
      if (res.status >= 200 && res.status < 300) found = url;
    } catch {
      /* keep probing */
    }
  }
  if (!found) throw new Error('No FoodData Central release found in the last 900 days');
  console.log(`[+] Newest FoodData Central release: ${found}`);
  await put('nutrition', 'AWS_BUCKET_NUTRITION', found, 'FoodData_Central_csv.zip');
}

/** NOAA 1991-2020 annual/seasonal normals, one archive covering every US station. */
async function climate() {
  await put(
    'climate',
    'AWS_BUCKET_CLIMATE',
    'https://www.ncei.noaa.gov/data/normals-annualseasonal/1991-2020/archive/us-climate-normals_1991-2020_v1.0.1_annualseasonal_multivariate_by-station_c20230404.tar.gz',
    'noaa_normals_annualseasonal.tar.gz',
  );
}

const TASKS: Record<string, () => Promise<void>> = {
  doctors,
  aircraft,
  trucking,
  nutrition,
  climate,
};

async function main() {
  const requested = process.argv.slice(2);
  const names = requested.length > 0 ? requested : Object.keys(TASKS);

  for (const name of names) {
    const task = TASKS[name];
    if (!task) {
      console.error(`[!] Unknown dataset "${name}". Available: ${Object.keys(TASKS).join(', ')}`);
      continue;
    }
    console.log(`\n--- ${name} ---`);
    try {
      await task();
    } catch (err: any) {
      console.error(`[!] ${name} failed: ${err.message}`);
    }
  }
}

main();
