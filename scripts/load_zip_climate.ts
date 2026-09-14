import axios from 'axios';
import { prisma, BatchWriter, bulkUpsert, slugify, titleCase, toInt, toFloat, trackRun, HTTP_HEADERS } from './lib/etl';

/**
 * Joins ZIP codes to their USDA hardiness zone and nearest weather station.
 *
 * Autocomplete shows the demand runs on ZIP and zone ("first frost date by zip
 * code", "frost date for zone 6b"), but NOAA publishes normals per station and
 * has no zone at all. This table is the bridge.
 *
 * Hardiness zones come from phzmapi.org, which serves the official USDA Plant
 * Hardiness Zone Map. They are not derived here: the earlier attempt to compute
 * zones from NOAA mean-minimum temperatures produced zone 12a for Alabama,
 * because USDA uses the *extreme* annual minimum, which NOAA normals do not carry.
 */

const ODS = 'https://public.opendatasoft.com/api/records/1.0/search/';
const PHZM = 'https://phzmapi.org';

const COLUMNS = [
  'zip', 'zone', 'zoneTempRange', 'lat', 'lng', 'city', 'state', 'county',
  'population', 'stationId', 'stationMiles', 'slug', 'updatedAt',
];

const CONCURRENCY = parseInt(process.env.ZIP_CONCURRENCY || '10', 10);

type Centroid = {
  zip: string; lat: number; lng: number;
  city: string | null; state: string | null; county: string | null; population: number | null;
};

/** Great-circle distance in miles. */
function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fetchCentroids(): Promise<Centroid[]> {
  const out: Centroid[] = [];
  const PAGE = 1000;

  for (let start = 0; ; start += PAGE) {
    const { data } = await axios.get(ODS, {
      params: {
        dataset: 'georef-united-states-of-america-zc-point',
        rows: PAGE,
        start,
        fields: 'zip_code,ste_name,coty_name,population,geo_point_2d',
      },
      headers: HTTP_HEADERS,
      timeout: 90_000,
    });

    const records = data?.records ?? [];
    if (records.length === 0) break;

    for (const r of records) {
      const f = r.fields ?? {};
      const point = f.geo_point_2d;
      const zip = String(f.zip_code || '').padStart(5, '0');
      if (!zip || zip.length !== 5 || !Array.isArray(point)) continue;

      out.push({
        zip,
        lat: point[0],
        lng: point[1],
        city: null,
        state: Array.isArray(f.ste_name) ? f.ste_name[0] : f.ste_name ?? null,
        county: Array.isArray(f.coty_name) ? f.coty_name[0] : f.coty_name ?? null,
        population: toInt(f.population),
      });
    }

    process.stdout.write(`\r    ${out.length.toLocaleString()} ZIP centroids`);
    if (records.length < PAGE) break;
    // ODS caps deep paging; stop before it starts refusing.
    if (start + PAGE >= 10_000) break;
  }

  console.log('');
  return out;
}

async function fetchZone(zip: string): Promise<{ zone: string; range: string; lat: number; lng: number } | null> {
  try {
    const { data } = await axios.get(`${PHZM}/${zip}.json`, { headers: HTTP_HEADERS, timeout: 20_000 });
    if (!data?.zone) return null;
    return {
      zone: String(data.zone),
      range: String(data.temperature_range ?? ''),
      lat: toFloat(data.coordinates?.lat) ?? 0,
      lng: toFloat(data.coordinates?.lon) ?? 0,
    };
  } catch {
    return null;
  }
}

async function main() {
  await trackRun('zip-climate', `${PHZM} + ${ODS}`, async () => {
    // The ZIPs worth publishing are the ones Census already confirmed are populated.
    const known = await prisma.censusDemographic.findMany({
      select: { zip: true, city: true, state: true, population: true },
    });
    console.log(`[+] ${known.length.toLocaleString()} populated ZIPs from Census`);

    console.log('[+] Fetching ZIP centroids...');
    const centroids = new Map<string, Centroid>();
    for (const c of await fetchCentroids()) centroids.set(c.zip, c);

    const stations = await prisma.climateData.findMany({
      where: { lat: { not: null }, lng: { not: null }, lastFrostDate: { not: null } },
      select: { stationId: true, lat: true, lng: true },
    });
    console.log(`[+] ${stations.length.toLocaleString()} stations with frost data to match against`);

    const writer = new BatchWriter<any>(
      async (rows) => ({ count: await bulkUpsert('ZipClimate', 'zip', COLUMNS, rows) }),
      (r) => r.zip,
      500,
      'ZIPs',
    );

    let cursor = 0;
    let read = 0;

    async function worker() {
      for (;;) {
        const i = cursor++;
        if (i >= known.length) return;
        const entry = known[i];

        const zone = await fetchZone(entry.zip);
        const centroid = centroids.get(entry.zip);
        const lat = zone?.lat || centroid?.lat || null;
        const lng = zone?.lng || centroid?.lng || null;

        let stationId: string | null = null;
        let miles: number | null = null;
        if (lat && lng) {
          let best = Infinity;
          for (const s of stations) {
            const d = haversine(lat, lng, s.lat!, s.lng!);
            if (d < best) {
              best = d;
              stationId = s.stationId;
            }
          }
          miles = Number.isFinite(best) ? Math.round(best * 10) / 10 : null;
        }

        const city = titleCase(entry.city);
        await writer.push({
          zip: entry.zip,
          zone: zone?.zone ?? null,
          zoneTempRange: zone?.range || null,
          lat,
          lng,
          city,
          state: entry.state,
          county: centroid?.county ?? null,
          population: entry.population,
          stationId,
          stationMiles: miles,
          slug: slugify('frost dates', entry.zip, city, entry.state),
          updatedAt: new Date(),
        });

        read++;
        if (read % 250 === 0) {
          process.stdout.write(`\r    ${read.toLocaleString()} / ${known.length.toLocaleString()}`);
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    await writer.flush();
    return { read, written: writer.written };
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
