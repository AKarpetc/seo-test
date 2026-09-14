import axios from 'axios';
import { parse } from 'csv-parse/sync';
import { prisma, slugify, titleCase, toFloat, toInt, trackRun, stateNameOf, HTTP_HEADERS } from './lib/etl';

/**
 * Storm history by city.
 *
 * Tropical cyclone tracks come from the NHC HURDAT2 files (Atlantic since 1851,
 * north-east Pacific since 1949); tornadoes from the SPC database since 1950.
 * Neither is published by place, and the question people ask is "what has hit
 * my town", so every city from the ZIP table is matched to every track that
 * passed within reach.
 *
 * Distance is measured to the track segment, not to the six-hourly fixes: a
 * storm moving at 20 mph covers 120 miles between two fixes and could cross a
 * city without either fix being anywhere near it.
 *
 *   npm run load:storms
 */

const HURDAT_DIR = 'https://www.nhc.noaa.gov/data/hurdat/';
const SPC_TORNADOES = 'https://www.spc.noaa.gov/wcm/data/1950-2024_actual_tornadoes.csv';

/** A tropical system counts for a city if its track passed within this distance. */
const STORM_RADIUS_MILES = 75;
/** A tornado counts if any part of its path was within this distance. */
const TORNADO_RADIUS_MILES = 25;
/** Below tropical-storm strength a track segment is ignored. */
const MIN_WIND_KT = 34;

/** ZIPs under this population are noise in the city aggregate. */
const MIN_ZIP_POPULATION = 2000;

const MILES_PER_DEG_LAT = 69.0;

type City = { id: number; lat: number; lng: number };
type Segment = { aLat: number; aLng: number; bLat: number; bLng: number };

/** Distance in miles from a point to a segment, on a flat projection good enough for 75 miles. */
function segmentMiles(p: { lat: number; lng: number }, s: Segment): { miles: number; t: number } {
  const kx = MILES_PER_DEG_LAT * Math.cos((p.lat * Math.PI) / 180);
  const ax = (s.aLng - p.lng) * kx;
  const ay = (s.aLat - p.lat) * MILES_PER_DEG_LAT;
  const bx = (s.bLng - p.lng) * kx;
  const by = (s.bLat - p.lat) * MILES_PER_DEG_LAT;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { miles: Math.sqrt(cx * cx + cy * cy), t };
}

/** Cities bucketed by whole degree so a segment only looks at its neighbourhood. */
class CityGrid {
  private cells = new Map<string, City[]>();
  constructor(cities: City[]) {
    for (const c of cities) {
      const key = `${Math.floor(c.lat)}:${Math.floor(c.lng)}`;
      this.cells.set(key, [...(this.cells.get(key) ?? []), c]);
    }
  }
  /** Every city whose cell is within `reach` degrees of the segment's bounding box. */
  near(s: Segment, reachDeg: number): City[] {
    const out: City[] = [];
    const latLo = Math.floor(Math.min(s.aLat, s.bLat) - reachDeg);
    const latHi = Math.floor(Math.max(s.aLat, s.bLat) + reachDeg);
    const lngLo = Math.floor(Math.min(s.aLng, s.bLng) - reachDeg);
    const lngHi = Math.floor(Math.max(s.aLng, s.bLng) + reachDeg);
    for (let la = latLo; la <= latHi; la++) {
      for (let lo = lngLo; lo <= lngHi; lo++) {
        const cell = this.cells.get(`${la}:${lo}`);
        if (cell) out.push(...cell);
      }
    }
    return out;
  }
}

function saffirSimpson(windKt: number | null): number | null {
  if (windKt === null) return null;
  if (windKt >= 137) return 5;
  if (windKt >= 113) return 4;
  if (windKt >= 96) return 3;
  if (windKt >= 83) return 2;
  if (windKt >= 64) return 1;
  if (windKt >= 34) return 0;
  return null;
}

async function text(url: string): Promise<string> {
  const { data } = await axios.get(url, { headers: HTTP_HEADERS, timeout: 120_000, responseType: 'text' });
  return data as string;
}

/** Finds the newest file of each basin in the HURDAT directory listing. */
async function hurdatFiles(): Promise<string[]> {
  const listing = await text(HURDAT_DIR);
  const names = [...listing.matchAll(/hurdat2-(?:nepac-)?\d{4}-\d{4}-\d+\.txt/g)].map((m) => m[0]);
  const latest = (prefix: string) => [...new Set(names.filter((n) => n.startsWith(prefix)))].sort().pop();
  return [latest('hurdat2-1851'), latest('hurdat2-nepac')].filter(Boolean).map((n) => HURDAT_DIR + n!);
}

type ParsedStorm = {
  stormId: string; basin: string; name: string; year: number;
  points: { time: Date; lat: number; lng: number; wind: number | null; status: string }[];
};

function parseHurdat(body: string): ParsedStorm[] {
  const storms: ParsedStorm[] = [];
  let current: ParsedStorm | null = null;
  for (const raw of body.split('\n')) {
    const f = raw.split(',').map((x) => x.trim());
    if (/^(AL|EP|CP)\d{6}$/.test(f[0])) {
      current = { stormId: f[0], basin: f[0].slice(0, 2), name: f[1] || 'UNNAMED', year: parseInt(f[0].slice(4), 10), points: [] };
      storms.push(current);
      continue;
    }
    if (!current || f.length < 7 || !/^\d{8}$/.test(f[0])) continue;
    const lat = parseFloat(f[4]) * (f[4].endsWith('S') ? -1 : 1);
    const lng = parseFloat(f[5]) * (f[5].endsWith('W') ? -1 : 1);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    const wind = parseInt(f[6], 10);
    const time = new Date(Date.UTC(+f[0].slice(0, 4), +f[0].slice(4, 6) - 1, +f[0].slice(6, 8), +f[1].slice(0, 2) || 0, +f[1].slice(2, 4) || 0));
    current.points.push({ time, lat, lng, wind: wind > 0 ? wind : null, status: f[3] || '' });
  }
  return storms;
}

async function loadCities(): Promise<City[]> {
  const rows = await prisma.$queryRaw<{ city: string; state: string; lat: number; lng: number; population: number }[]>`
    SELECT city, state,
           SUM(lat * population) / SUM(population) AS lat,
           SUM(lng * population) / SUM(population) AS lng,
           SUM(population)::int AS population
    FROM "ZipClimate"
    WHERE population >= ${MIN_ZIP_POPULATION} AND lat IS NOT NULL AND city IS NOT NULL AND state IS NOT NULL
    GROUP BY city, state`;

  const cities: City[] = [];
  for (const r of rows) {
    // The ZIP table carries a few Canadian border codes; they have no state page.
    if (!stateNameOf(r.state) && !['PR', 'VI', 'GU', 'AS', 'MP'].includes(r.state)) continue;
    const city = await prisma.stormCity.upsert({
      where: { city_state: { city: r.city, state: r.state } },
      create: { city: r.city, state: r.state, slug: slugify(r.city, r.state), lat: r.lat, lng: r.lng, population: r.population },
      update: { lat: r.lat, lng: r.lng, population: r.population },
      select: { id: true, lat: true, lng: true },
    });
    cities.push(city);
  }
  return cities;
}

async function loadStorms(grid: CityGrid): Promise<{ storms: number; links: number }> {
  let stormsWritten = 0;
  let links = 0;
  const reachDeg = STORM_RADIUS_MILES / MILES_PER_DEG_LAT + 0.5;

  for (const url of await hurdatFiles()) {
    console.log(`[+] ${url}`);
    const storms = parseHurdat(await text(url));
    const slugsSeen = new Set<string>((await prisma.storm.findMany({ select: { slug: true } })).map((s) => s.slug));

    for (const s of storms) {
      if (s.points.length === 0) continue;
      const maxWind = Math.max(...s.points.map((p) => p.wind ?? 0)) || null;
      let slug = s.name === 'UNNAMED' ? `unnamed-${s.stormId.toLowerCase()}` : slugify(s.name, s.year);
      const existing = await prisma.storm.findUnique({ where: { stormId: s.stormId }, select: { slug: true } });
      if (existing) slug = existing.slug;
      else if (slugsSeen.has(slug)) slug = `${slug}-${s.stormId.toLowerCase()}`;
      slugsSeen.add(slug);

      const storm = await prisma.storm.upsert({
        where: { stormId: s.stormId },
        create: {
          stormId: s.stormId, basin: s.basin, name: titleCase(s.name) ?? s.name, year: s.year,
          maxWind, category: saffirSimpson(maxWind),
          firstDate: s.points[0].time, lastDate: s.points[s.points.length - 1].time, slug,
        },
        update: { maxWind, category: saffirSimpson(maxWind), firstDate: s.points[0].time, lastDate: s.points[s.points.length - 1].time },
      });
      stormsWritten++;

      await prisma.stormPoint.deleteMany({ where: { stormId: storm.id } });
      await prisma.stormPoint.createMany({ data: s.points.map((p) => ({ stormId: storm.id, ...p })) });

      // Closest approach per city across every segment of the track.
      const best = new Map<number, { miles: number; wind: number | null; status: string; time: Date }>();
      for (let i = 0; i < s.points.length - 1; i++) {
        const a = s.points[i];
        const b = s.points[i + 1];
        if ((a.wind ?? 0) < MIN_WIND_KT && (b.wind ?? 0) < MIN_WIND_KT) continue;
        const seg = { aLat: a.lat, aLng: a.lng, bLat: b.lat, bLng: b.lng };
        for (const city of grid.near(seg, reachDeg)) {
          const { miles, t } = segmentMiles(city, seg);
          if (miles > STORM_RADIUS_MILES) continue;
          const wind = a.wind !== null && b.wind !== null ? Math.round(a.wind + (b.wind - a.wind) * t) : (a.wind ?? b.wind);
          if ((wind ?? 0) < MIN_WIND_KT) continue;
          const prev = best.get(city.id);
          if (!prev || miles < prev.miles) {
            const nearer = t < 0.5 ? a : b;
            best.set(city.id, { miles, wind, status: nearer.status, time: new Date(a.time.getTime() + (b.time.getTime() - a.time.getTime()) * t) });
          }
        }
      }

      await prisma.cityStorm.deleteMany({ where: { stormId: storm.id } });
      if (best.size > 0) {
        await prisma.cityStorm.createMany({
          data: [...best.entries()].map(([cityId, v]) => ({
            cityId, stormId: storm.id, closestMiles: Math.round(v.miles * 10) / 10,
            windAtClosest: v.wind, statusAtClosest: v.status, closestTime: v.time,
          })),
        });
      }
      await prisma.storm.update({ where: { id: storm.id }, data: { cityCount: best.size } });
      links += best.size;
      if (stormsWritten % 100 === 0) process.stdout.write(`\r    ${stormsWritten} storms · ${links.toLocaleString()} city links`);
    }
    console.log('');
  }
  return { storms: stormsWritten, links };
}

async function loadTornadoes(grid: CityGrid): Promise<{ tornadoes: number; links: number }> {
  console.log(`[+] ${SPC_TORNADOES}`);
  const rows = parse(await text(SPC_TORNADOES), { columns: true, skip_empty_lines: true, relax_column_count: true }) as Record<string, string>[];
  const reachDeg = TORNADO_RADIUS_MILES / MILES_PER_DEG_LAT + 0.5;

  await prisma.cityTornado.deleteMany({});

  let written = 0;
  let links = 0;
  const linkBuffer: { cityId: number; tornadoId: number; miles: number }[] = [];

  for (const r of rows) {
    // Segment records of multi-state tornadoes repeat the whole track; keep the summary row only.
    if (r.sg && r.sg !== '1') continue;
    const startLat = toFloat(r.slat);
    const startLng = toFloat(r.slon);
    if (!startLat || !startLng) continue;
    const endLat = toFloat(r.elat) || null;
    const endLng = toFloat(r.elon) || null;
    const mag = toInt(r.mag);

    const tornado = await prisma.tornado.upsert({
      where: { spcKey: `${r.yr}-${r.om}` },
      create: {
        spcKey: `${r.yr}-${r.om}`, date: new Date(`${r.date}T00:00:00Z`), state: r.st,
        mag: mag !== null && mag >= 0 ? mag : null,
        injuries: toInt(r.inj) ?? 0, fatalities: toInt(r.fat) ?? 0,
        startLat, startLng, endLat: endLat || null, endLng: endLng || null,
        lengthMiles: toFloat(r.len), widthYards: toInt(r.wid),
      },
      update: { mag: mag !== null && mag >= 0 ? mag : null, injuries: toInt(r.inj) ?? 0, fatalities: toInt(r.fat) ?? 0 },
      select: { id: true },
    });
    written++;

    const seg = { aLat: startLat, aLng: startLng, bLat: endLat || startLat, bLng: endLng || startLng };
    for (const city of grid.near(seg, reachDeg)) {
      const { miles } = segmentMiles(city, seg);
      if (miles <= TORNADO_RADIUS_MILES) linkBuffer.push({ cityId: city.id, tornadoId: tornado.id, miles: Math.round(miles * 10) / 10 });
    }
    if (linkBuffer.length >= 5000) {
      await prisma.cityTornado.createMany({ data: linkBuffer.splice(0), skipDuplicates: true });
    }
    links = links;
    if (written % 2000 === 0) process.stdout.write(`\r    ${written.toLocaleString()} tornadoes`);
  }
  if (linkBuffer.length) await prisma.cityTornado.createMany({ data: linkBuffer.splice(0), skipDuplicates: true });
  links = await prisma.cityTornado.count();
  console.log('');
  return { tornadoes: written, links };
}

/** Per-city counts, so a page is one row plus its lists. */
async function summarise(): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "StormCity" c SET
      "hurricaneCount" = s.hurricanes,
      "tropicalStormCount" = s.tropical,
      "lastStormYear" = s.last_year,
      "lastStormName" = s.last_name,
      "strongestCategory" = s.strongest,
      "strongestStormName" = s.strongest_name,
      "updatedAt" = NOW()
    FROM (
      SELECT cs."cityId",
        COUNT(*) FILTER (WHERE cs."windAtClosest" >= 64) AS hurricanes,
        COUNT(*) FILTER (WHERE cs."windAtClosest" < 64) AS tropical,
        MAX(st.year) AS last_year,
        (ARRAY_AGG(st.name ORDER BY st.year DESC, cs."closestTime" DESC))[1] AS last_name,
        MAX(CASE WHEN cs."windAtClosest" >= 137 THEN 5 WHEN cs."windAtClosest" >= 113 THEN 4 WHEN cs."windAtClosest" >= 96 THEN 3
                 WHEN cs."windAtClosest" >= 83 THEN 2 WHEN cs."windAtClosest" >= 64 THEN 1 ELSE 0 END) AS strongest,
        (ARRAY_AGG(st.name ORDER BY cs."windAtClosest" DESC NULLS LAST, st.year DESC))[1] AS strongest_name
      FROM "CityStorm" cs JOIN "Storm" st ON st.id = cs."stormId"
      GROUP BY cs."cityId"
    ) s WHERE s."cityId" = c.id`;

  await prisma.$executeRaw`
    UPDATE "StormCity" c SET
      "tornadoCount" = t.total,
      "strongTornadoCount" = t.strong,
      "tornadoFatalities" = t.deaths,
      "lastTornadoYear" = t.last_year,
      "updatedAt" = NOW()
    FROM (
      SELECT ct."cityId",
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE tn.mag >= 3) AS strong,
        COALESCE(SUM(tn.fatalities), 0) AS deaths,
        MAX(EXTRACT(YEAR FROM tn.date))::int AS last_year
      FROM "CityTornado" ct JOIN "Tornado" tn ON tn.id = ct."tornadoId"
      GROUP BY ct."cityId"
    ) t WHERE t."cityId" = c.id`;
}

async function main() {
  await trackRun('storms', HURDAT_DIR, async () => {
    const cities = await loadCities();
    console.log(`[+] ${cities.length.toLocaleString()} cities`);
    const grid = new CityGrid(cities);

    const storms = await loadStorms(grid);
    console.log(`[+] ${storms.storms.toLocaleString()} storms, ${storms.links.toLocaleString()} city links`);

    const tornadoes = await loadTornadoes(grid);
    console.log(`[+] ${tornadoes.tornadoes.toLocaleString()} tornadoes, ${tornadoes.links.toLocaleString()} city links`);

    await summarise();
    const withAny = await prisma.stormCity.count({ where: { OR: [{ hurricaneCount: { gt: 0 } }, { tropicalStormCount: { gt: 0 } }, { tornadoCount: { gt: 0 } }] } });
    console.log(`[+] ${withAny.toLocaleString()} cities with at least one storm or tornado`);

    return { read: storms.storms + tornadoes.tornadoes, written: withAny };
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
