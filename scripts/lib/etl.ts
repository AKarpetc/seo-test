import { PrismaClient } from '@prisma/client';
import { S3Client, GetObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import axios from 'axios';
import stream, { Readable } from 'stream';
import dotenv from 'dotenv';

dotenv.config();

export const prisma = new PrismaClient({ log: ['warn', 'error'] });

export const REGION = process.env.AWS_REGION || 'us-east-1';

export const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  requestHandler: { requestTimeout: 0, connectionTimeout: 30_000 },
});

/**
 * Several federal portals (FAA, Census) reject non-browser agents with a 403,
 * which is what silently broke the first aircraft ingestion run.
 */
export const HTTP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** SEC requires a contact address in the agent string or it blocks the request. */
export const SEC_HEADERS = {
  'User-Agent': process.env.SEC_CONTACT || 'programmatic-seo-platform admin@example.com',
  'Accept-Encoding': 'gzip, deflate',
};

export function slugify(...parts: (string | number | null | undefined)[]): string {
  return parts
    .filter((p) => p !== null && p !== undefined && String(p).trim() !== '')
    .join(' ')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

export function titleCase(input: string | null | undefined): string | null {
  if (!input) return null;
  return input
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Llc|Inc|Pllc|Pc|Pa|Dds|Md|Do|Np|Usa|Us|Ii|Iii|Iv)\b/g, (m) => m.toUpperCase())
    .trim();
}

export function toInt(v: unknown): number | null {
  // Sources write whole numbers as "204.0"; stripping the dot would yield 2040.
  const n = toFloat(v);
  return n === null ? null : Math.trunc(n);
}

export function toFloat(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.eE+-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function toDate(v: unknown): Date | null {
  if (!v) return null;
  const raw = String(v).trim();
  if (!raw) return null;

  // FMCSA and FAA write dates as compact YYYYMMDD, which Date() rejects.
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  const iso = compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : raw;

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  // Guard against sentinel values like 00010101 or a mis-parsed field.
  const year = d.getUTCFullYear();
  return year < 1900 || year > 2100 ? null : d;
}

/** Keeps only the 5-digit ZIP from FAA/NPPES style 9-digit postal codes. */
export function zip5(v: unknown): string | null {
  if (!v) return null;
  const digits = String(v).replace(/[^0-9]/g, '');
  return digits.length >= 5 ? digits.slice(0, 5) : null;
}

/**
 * Batches rows into createMany calls. Deduplicates on a caller supplied key so a
 * single batch never trips a unique constraint, which aborts the whole insert.
 */
export class BatchWriter<T> {
  private buffer: T[] = [];
  private seen = new Set<string>();
  written = 0;
  skipped = 0;

  constructor(
    private readonly insert: (rows: T[]) => Promise<{ count: number }>,
    private readonly keyOf: (row: T) => string,
    private readonly batchSize = 5000,
    private readonly label = 'rows',
    private readonly dedupe = true,
  ) {}

  async push(row: T): Promise<void> {
    if (this.dedupe) {
      const key = this.keyOf(row);
      if (this.seen.has(key)) {
        this.skipped++;
        return;
      }
      this.seen.add(key);
    }
    this.buffer.push(row);
    if (this.buffer.length >= this.batchSize) await this.flush();
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const rows = this.buffer;
    this.buffer = [];
    try {
      const res = await this.insert(rows);
      this.written += res.count;
    } catch (err: any) {
      // One malformed row must not cost the whole batch: retry in halves.
      if (rows.length > 1) {
        const mid = Math.floor(rows.length / 2);
        this.buffer = rows.slice(0, mid);
        await this.flush();
        this.buffer = rows.slice(mid);
        await this.flush();
      } else {
        this.skipped++;
        console.warn(`\n[!] Dropped 1 row: ${err.message?.slice(0, 160)}`);
      }
    }
    process.stdout.write(`\r    [${this.label}] written: ${this.written.toLocaleString()}   `);
  }
}

/** Opens an HTTP response as a stream, retrying on transient network failures. */
export async function httpStream(url: string, headers = HTTP_HEADERS, attempts = 3): Promise<Readable> {
  let lastErr: any;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await axios({
        method: 'GET',
        url,
        responseType: 'stream',
        headers,
        maxRedirects: 10,
        timeout: 120_000,
        decompress: true,
      });
      return res.data as Readable;
    } catch (err: any) {
      lastErr = err;
      const status = err.response?.status;
      console.warn(`\n[!] Attempt ${i}/${attempts} for ${url} failed (${status || err.code}). Retrying...`);
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw lastErr;
}

/** Streams a URL straight into S3 without ever touching local disk. */
export async function streamUrlToS3(url: string, bucket: string, key: string, headers = HTTP_HEADERS): Promise<void> {
  console.log(`[+] ${url}\n    -> s3://${bucket}/${key}`);
  const source = await httpStream(url, headers);
  const pass = new stream.PassThrough();
  source.pipe(pass);

  const upload = new Upload({
    client: s3,
    params: { Bucket: bucket, Key: key, Body: pass },
    queueSize: 4,
    partSize: 16 * 1024 * 1024,
  });

  upload.on('httpUploadProgress', (p) => {
    if (p.loaded) process.stdout.write(`\r    ${(p.loaded / 1024 / 1024).toFixed(1)} MB uploaded`);
  });

  await upload.done();
  console.log(`\n[+] done: s3://${bucket}/${key}`);
}

export async function s3Stream(bucket: string, key: string): Promise<Readable> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return res.Body as Readable;
}

export async function s3Exists(bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Finds the newest object matching a pattern, so no key has to be hardcoded. */
export async function s3FindLatest(bucket: string, pattern: RegExp): Promise<string | null> {
  const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
  const matches = (res.Contents || [])
    .filter((o) => o.Key && pattern.test(o.Key))
    .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0));
  return matches[0]?.Key || null;
}

export function requireBucket(name: string): string {
  const bucket = process.env[name];
  if (!bucket) throw new Error(`${name} is not set in .env — run "npm run aws:buckets" first.`);
  return bucket;
}

/**
 * Wraps a loader so every run is recorded in IngestionRun, which is what the
 * /status page and the freshness cron read.
 */
export async function trackRun(
  dataset: string,
  source: string,
  fn: (report: (read: number, written: number) => void) => Promise<{ read: number; written: number }>,
): Promise<void> {
  const run = await prisma.ingestionRun.create({
    data: { dataset, source, status: 'running' },
  });
  const started = Date.now();
  try {
    const { read, written } = await fn(() => {});
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: 'success', rowsRead: read, rowsWritten: written, finishedAt: new Date() },
    });
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\n✅ ${dataset}: read ${read.toLocaleString()}, written ${written.toLocaleString()} in ${secs}s`);
  } catch (err: any) {
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: 'failed', errorText: String(err.message || err).slice(0, 2000), finishedAt: new Date() },
    });
    console.error(`\n❌ ${dataset} failed:`, err.message || err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Bulk INSERT ... ON CONFLICT DO UPDATE.
 *
 * `createMany({ skipDuplicates: true })` silently ignores rows that already exist,
 * so a monthly re-run would never pick up a changed address, fleet size or status —
 * the table would freeze at whatever the first import saw. This upserts instead.
 *
 * Columns are quoted identifiers from the Prisma model; values are passed as
 * parameters, never interpolated.
 */
export async function bulkUpsert(
  table: string,
  conflictColumn: string,
  columns: string[],
  rows: Record<string, unknown>[],
  updateColumns?: string[],
): Promise<number> {
  if (rows.length === 0) return 0;

  // updatedAt is set explicitly below; listing it twice is a Postgres syntax error.
  const updatable = (updateColumns ?? columns).filter(
    (c) => c !== conflictColumn && c !== 'updatedAt',
  );
  const params: unknown[] = [];
  const tuples: string[] = [];

  for (const row of rows) {
    const placeholders = columns.map((c) => {
      params.push(row[c] ?? null);
      return `$${params.length}`;
    });
    tuples.push(`(${placeholders.join(',')})`);
  }

  const quoted = columns.map((c) => `"${c}"`).join(',');
  const setClause = updatable.map((c) => `"${c}" = EXCLUDED."${c}"`).join(',');

  const sql =
    `INSERT INTO "${table}" (${quoted}) VALUES ${tuples.join(',')} ` +
    `ON CONFLICT ("${conflictColumn}") DO UPDATE SET ${setClause}, "updatedAt" = NOW()`;

  return prisma.$executeRawUnsafe(sql, ...params);
}

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

/** Returns null for the regional roll-up codes EIA mixes in with real states. */
export function stateNameOf(code: string | null | undefined): string | null {
  if (!code) return null;
  return STATE_NAMES[code.toUpperCase()] ?? null;
}
