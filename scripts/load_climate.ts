import zlib from 'zlib';
import { parse } from 'csv-parse';
import * as tar from 'tar-stream';
import {
  prisma, s3Stream, requireBucket, BatchWriter, slugify, titleCase,
  toFloat, toInt, trackRun,
} from './lib/etl';

const KEY = 'noaa_normals_annualseasonal.tar.gz';

/** NOAA writes frost probability dates as "MM/DD", padded with spaces. */
function frostDateLabel(raw: string | undefined): string | null {
  const m = (raw || '').trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(2001, month - 1, day));
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** Station names arrive as "AUSTIN BERGSTROM INTL AP, TX US". */
function splitStation(name: string): { city: string | null; state: string | null } {
  const m = name.match(/^(.*),\s*([A-Z]{2})\s+US$/);
  if (!m) return { city: titleCase(name), state: null };
  return { city: titleCase(m[1]), state: m[2] };
}

async function main() {
  const bucket = requireBucket('AWS_BUCKET_CLIMATE');

  await trackRun('climate', `s3://${bucket}/${KEY}`, async () => {
    const writer = new BatchWriter<any>(
      (rows) => prisma.climateData.createMany({ data: rows, skipDuplicates: true }),
      (r) => r.stationId,
      1000,
      'stations',
    );

    const extract = tar.extract();
    (await s3Stream(bucket, KEY)).pipe(zlib.createGunzip()).pipe(extract);

    let read = 0;
    const slugSeen = new Set<string>();

    for await (const entry of extract as any) {
      const header = entry.header;
      if (!header.name.toLowerCase().endsWith('.csv')) {
        entry.resume();
        continue;
      }

      const parser = entry.pipe(parse({ columns: true, skip_empty_lines: true, relax_column_count: true }));
      for await (const row of parser) {
        const stationId = (row['STATION'] || '').trim();
        const rawName = (row['NAME'] || '').trim();
        if (!stationId || !rawName) continue;

        const { city, state } = splitStation(rawName);
        // Only US stations map onto the site's geography.
        if (!state) continue;

        // T32FP50: the date by which a 32F frost has a 50% chance of having occurred.
        const lastFrost = frostDateLabel(row['ANN-TMIN-PRBLST-T32FP50']);
        const firstFrost = frostDateLabel(row['ANN-TMIN-PRBFST-T32FP50']);
        const growing = toInt(row['ANN-TMIN-PRBGSL-T32FP50']);

        let slug = slugify(city, state, 'climate');
        if (slugSeen.has(slug)) slug = `${slug}-${stationId.toLowerCase()}`;
        slugSeen.add(slug);

        await writer.push({
          stationId,
          stationName: titleCase(rawName) || rawName,
          city,
          state,
          lat: toFloat(row['LATITUDE']),
          lng: toFloat(row['LONGITUDE']),
          elevation: toFloat(row['ELEVATION']),
          avgTemp: toFloat(row['ANN-TAVG-NORMAL']),
          avgTempJan: toFloat(row['DJF-TAVG-NORMAL']),
          avgTempJul: toFloat(row['JJA-TAVG-NORMAL']),
          avgHighJul: toFloat(row['JJA-TMAX-NORMAL']),
          avgLowJan: toFloat(row['DJF-TMIN-NORMAL']),
          annualRainfall: toFloat(row['ANN-PRCP-NORMAL']),
          annualSnowfall: toFloat(row['ANN-SNOW-NORMAL']),
          firstFrostDate: firstFrost,
          lastFrostDate: lastFrost,
          growingDays: growing,
          slug,
        });
        read++;
      }
      entry.resume();
    }

    await writer.flush();
    return { read, written: writer.written };
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
