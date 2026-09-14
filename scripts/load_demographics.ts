import axios from 'axios';
import { prisma, BatchWriter, bulkUpsert, slugify, toInt, toFloat, trackRun } from './lib/etl';

const YEAR = process.env.CENSUS_YEAR || '2023';
const BASE = `https://api.census.gov/data/${YEAR}/acs/acs5`;

/**
 * ACS 5-year tables. ZCTAs are published nationally only — they cannot be filtered
 * by state — so this pulls the whole country in one request.
 */
const VARS = {
  population: 'B01003_001E',
  medianIncome: 'B19013_001E',
  medianAge: 'B01002_001E',
  medianRent: 'B25064_001E',
  homeValue: 'B25077_001E',
  households: 'B11001_001E',
  ownerOccupied: 'B25003_002E',
  housingUnits: 'B25003_001E',
  bachelors: 'B15003_022E',
  masters: 'B15003_023E',
  professional: 'B15003_024E',
  doctorate: 'B15003_025E',
  educationBase: 'B15003_001E',
  povertyCount: 'B17001_002E',
  povertyBase: 'B17001_001E',
} as const;

const COLUMNS = [
  'zip', 'city', 'state', 'population', 'households', 'medianIncome', 'medianAge',
  'medianRent', 'homeValue', 'ownerOccupied', 'bachelorsPct', 'povertyPct', 'slug', 'updatedAt',
];

/** Census uses large negative sentinels for suppressed or unavailable values. */
function clean(v: string | undefined): number | null {
  const n = toFloat(v);
  return n === null || n <= -666666 ? null : n;
}

function pct(part: number | null, whole: number | null): number | null {
  if (part === null || whole === null || whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

async function main() {
  const key = process.env.CENSUS_API_KEY;
  if (!key) throw new Error('CENSUS_API_KEY is not set — see docs/API_KEYS.md');

  await trackRun('demographics', BASE, async () => {
    console.log(`[+] Fetching ACS ${YEAR} 5-year estimates for every ZCTA...`);
    const fields = Object.values(VARS);
    const { data } = await axios.get(BASE, {
      params: { get: ['NAME', ...fields].join(','), for: 'zip code tabulation area:*', key },
      timeout: 300_000,
    });

    const [header, ...rows] = data as string[][];
    const idx = Object.fromEntries(header.map((h, i) => [h, i]));
    console.log(`    ${rows.length.toLocaleString()} ZCTAs returned`);

    // ZCTAs carry no place name, but the provider tables already map ZIP to a city.
    console.log('[+] Deriving city/state per ZIP from loaded provider records...');
    const places = await prisma.$queryRaw<{ zip: string; city: string; state: string }[]>`
      SELECT DISTINCT ON (zip) zip, city, state
      FROM "Doctor"
      GROUP BY zip, city, state
      ORDER BY zip, count(*) DESC
    `;
    const placeByZip = new Map(places.map((p) => [p.zip, p]));
    console.log(`    ${placeByZip.size.toLocaleString()} ZIPs have a known city`);

    const writer = new BatchWriter<any>(
      async (batch) => ({ count: await bulkUpsert('CensusDemographic', 'zip', COLUMNS, batch) }),
      (r) => r.zip,
      1000,
      'ZCTAs',
    );

    let read = 0;
    for (const row of rows) {
      const zip = row[idx['zip code tabulation area']];
      if (!zip || zip.length !== 5) continue;

      const population = clean(row[idx[VARS.population]]);
      // A ZCTA with no residents produces a page with nothing to say.
      if (population === null || population < 100) continue;

      const place = placeByZip.get(zip);
      const owner = clean(row[idx[VARS.ownerOccupied]]);
      const units = clean(row[idx[VARS.housingUnits]]);
      const degrees =
        (clean(row[idx[VARS.bachelors]]) ?? 0) +
        (clean(row[idx[VARS.masters]]) ?? 0) +
        (clean(row[idx[VARS.professional]]) ?? 0) +
        (clean(row[idx[VARS.doctorate]]) ?? 0);

      await writer.push({
        zip,
        city: place?.city ?? null,
        state: place?.state ?? null,
        population: Math.round(population),
        households: toInt(clean(row[idx[VARS.households]])),
        medianIncome: toInt(clean(row[idx[VARS.medianIncome]])),
        medianAge: clean(row[idx[VARS.medianAge]]),
        medianRent: toInt(clean(row[idx[VARS.medianRent]])),
        homeValue: toInt(clean(row[idx[VARS.homeValue]])),
        ownerOccupied: pct(owner, units),
        bachelorsPct: pct(degrees, clean(row[idx[VARS.educationBase]])),
        povertyPct: pct(clean(row[idx[VARS.povertyCount]]), clean(row[idx[VARS.povertyBase]])),
        slug: place
          ? slugify('cost of living in', place.city, place.state, zip)
          : slugify('zip code', zip, 'demographics'),
        updatedAt: new Date(),
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
