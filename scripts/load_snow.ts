import zlib from 'zlib';
import readline from 'readline';
import * as tar from 'tar-stream';
import type { Prisma } from '@prisma/client';
import { prisma, httpStream, trackRun } from './lib/etl';

/**
 * First and last measurable snow per station, computed from GHCN-daily.
 *
 * NOAA's 1991–2020 normals carry seasonal snowfall totals but no snow dates, and
 * the question people ask is "when does it start snowing here". So the daily
 * record is read for the same thirty winters and the median first and last day
 * of measurable snow is taken.
 *
 * The archive is one 3.7 GB tarball of every station on Earth. It is streamed,
 * never written to disk, and only the stations already in ClimateData are parsed.
 *
 *   npm run load:snow
 */

const URL = 'https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd_all.tar.gz';

/** Seasons run July to June, so a December first snow and a March last snow share one winter. */
const FIRST_SEASON = 1990;
const LAST_SEASON = 2019;

/** 0.1 inch, the NWS threshold for "measurable", is 2.54 mm; GHCN stores whole mm. */
const MEASURABLE_MM = 3;

/** A season is used only if most of October–April was actually observed. */
const MIN_OBSERVED_DAYS = 150;

/** At least this many usable winters, or the station stays blank. */
const MIN_SEASONS = 15;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** How far a ZIP may reach for a snow-reporting station before it goes without. */
const MAX_SNOW_STATION_MILES = 40;

/** Skips the 3.7 GB stream and only redoes the ZIP-to-station assignment. */
const ASSIGN_ONLY = process.env.SNOW_ASSIGN_ONLY === '1';

type Season = { observed: number; first: number | null; last: number | null };

/** Day index inside the season, counted from 1 July. */
function seasonDay(year: number, month: number, day: number): { season: number; index: number } {
  const season = month >= 7 ? year : year - 1;
  const start = Date.UTC(season, 6, 1);
  const index = Math.round((Date.UTC(year, month - 1, day) - start) / 86_400_000);
  return { season, index };
}

function label(season: number, index: number): string {
  const d = new Date(Date.UTC(season, 6, 1) + index * 86_400_000);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * One .dly line is a station-month of one element: 11-char id, year, month,
 * element, then 31 slots of value (5), measurement, quality and source flags.
 */
function parseLine(line: string, seasons: Map<number, Season>) {
  if (line.slice(17, 21) !== 'SNOW') return;
  const year = parseInt(line.slice(11, 15), 10);
  const month = parseInt(line.slice(15, 17), 10);
  if (year < FIRST_SEASON || year > LAST_SEASON + 1) return;

  const days = month === 2 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 29 : DAYS_IN_MONTH[month - 1];
  for (let d = 0; d < days; d++) {
    const at = 21 + d * 8;
    const value = parseInt(line.slice(at, at + 5), 10);
    const qflag = line[at + 6];
    if (value === -9999 || Number.isNaN(value) || (qflag && qflag !== ' ')) continue;

    const { season, index } = seasonDay(year, month, d + 1);
    if (season < FIRST_SEASON || season > LAST_SEASON) continue;

    let s = seasons.get(season);
    if (!s) {
      s = { observed: 0, first: null, last: null };
      seasons.set(season, s);
    }
    if (month >= 10 || month <= 4) s.observed++;
    if (value >= MEASURABLE_MM) {
      if (s.first === null || index < s.first) s.first = index;
      if (s.last === null || index > s.last) s.last = index;
    }
  }
}

function summarise(seasons: Map<number, Season>) {
  const usable = [...seasons.values()].filter((s) => s.observed >= MIN_OBSERVED_DAYS);
  if (usable.length < MIN_SEASONS) return null;

  const snowy = usable.filter((s) => s.first !== null);
  const result = { snowSeasons: usable.length, snowySeasons: snowy.length, firstSnowDate: null as string | null, lastSnowDate: null as string | null };

  // A date is only meaningful where snow is the rule, not the exception.
  if (snowy.length * 2 >= usable.length) {
    const anySeason = FIRST_SEASON;
    result.firstSnowDate = label(anySeason, median(snowy.map((s) => s.first!)));
    result.lastSnowDate = label(anySeason, median(snowy.map((s) => s.last!)));
  }
  return result;
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

/**
 * Points every ZIP at the nearest station with snow observations. Many airport
 * stations carry frost normals but no snowfall element, so the frost station and
 * the snow station are allowed to differ.
 */
/**
 * A station is trusted for snow dates when its daily record agrees with its own
 * climate. Some observers log precipitation faithfully and snowfall as zero; such
 * a station reports "snow is rare" in Minneapolis, and the ZIP is better served
 * by the next station over. "Rare" is believed only where January is mild or the
 * NOAA snowfall normal itself is small.
 */
const TRUSTED_SNOW_STATION: Prisma.ClimateDataWhereInput = {
  snowSeasons: { not: null },
  lat: { not: null },
  lng: { not: null },
  OR: [
    { firstSnowDate: { not: null } },
    { annualSnowfall: { lt: 5 } },
    { avgLowJan: { gte: 33 } },
  ],
};

async function assignSnowStations(): Promise<number> {
  const snowy = (
    await prisma.climateData.findMany({
      where: TRUSTED_SNOW_STATION,
      select: { stationId: true, lat: true, lng: true, firstSnowDate: true, snowySeasons: true, snowSeasons: true },
    })
  ).map((s) => ({
    ...s,
    // An observer who missed snow in a third of winters is worth a longer trip to avoid.
    penalty: s.firstSnowDate ? (1 - (s.snowySeasons ?? 0) / (s.snowSeasons || 1)) * 40 : 0,
  }));

  const zips = await prisma.zipClimate.findMany({
    where: { lat: { not: null }, lng: { not: null } },
    select: { id: true, lat: true, lng: true, stationId: true },
  });
  console.log(`[+] assigning ${zips.length.toLocaleString()} ZIPs to ${snowy.length.toLocaleString()} snow stations`);

  // A coarse grid keeps this from being 31k × 7k distance checks.
  const cell = (lat: number, lng: number) => `${Math.floor(lat)}:${Math.floor(lng)}`;
  const grid = new Map<string, typeof snowy>();
  for (const s of snowy) {
    const key = cell(s.lat!, s.lng!);
    grid.set(key, [...(grid.get(key) ?? []), s]);
  }

  let assigned = 0;
  for (const z of zips) {
    let best: { id: string; miles: number; score: number } | null = null;
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLng = -1; dLng <= 1; dLng++) {
        for (const s of grid.get(`${Math.floor(z.lat!) + dLat}:${Math.floor(z.lng!) + dLng}`) ?? []) {
          const miles = haversine(z.lat!, z.lng!, s.lat!, s.lng!);
          if (miles > MAX_SNOW_STATION_MILES) continue;
          // The frost station gets a small edge so both dates come from one place when it is sound.
          const score = miles + s.penalty - (s.stationId === z.stationId ? 3 : 0);
          if (!best || score < best.score) best = { id: s.stationId, miles, score };
        }
      }
    }
    await prisma.zipClimate.update({
      where: { id: z.id },
      data: { snowStationId: best?.id ?? null, snowStationMiles: best ? Math.round(best.miles * 10) / 10 : null },
    });
    if (best) assigned++;
  }
  console.log(`[+] ${assigned.toLocaleString()} ZIPs have a snow station within ${MAX_SNOW_STATION_MILES} miles`);
  return assigned;
}

async function main() {
  await trackRun('snow', URL, async () => {
    if (ASSIGN_ONLY) {
      const assigned = await assignSnowStations();
      return { read: 0, written: assigned };
    }

    const stations = new Set((await prisma.climateData.findMany({ select: { stationId: true } })).map((r) => r.stationId));
    console.log(`[+] ${stations.size.toLocaleString()} stations wanted; streaming ${URL}`);

    const extract = tar.extract();
    (await httpStream(URL)).pipe(zlib.createGunzip()).pipe(extract);

    let seen = 0;
    let matched = 0;
    let written = 0;

    for await (const entry of extract as any) {
      seen++;
      const id = entry.header.name.split('/').pop()?.replace(/\.dly$/, '') ?? '';
      if (!stations.has(id)) {
        entry.resume();
        if (seen % 5000 === 0) process.stdout.write(`\r    ${seen.toLocaleString()} archive entries · ${matched} matched · ${written} written`);
        continue;
      }
      matched++;

      const seasons = new Map<number, Season>();
      const lines = readline.createInterface({ input: entry, crlfDelay: Infinity });
      for await (const line of lines) parseLine(line, seasons);

      const summary = summarise(seasons);
      if (!summary) continue;
      await prisma.climateData.update({ where: { stationId: id }, data: summary });
      written++;
    }

    console.log(`\n[+] ${matched} of ${stations.size} stations found in the archive, ${written} with enough winters`);
    await assignSnowStations();
    return { read: matched, written };
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
