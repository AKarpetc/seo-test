import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Tells IndexNow which pages changed, so Bing (and Yandex, Seznam, Naver) can
 * fetch them without waiting to rediscover them on their own crawl schedule.
 *
 * Only genuinely changed pages are sent. The protocol exists to announce
 * changes, and re-announcing 18,000 unchanged URLs on every deploy would be
 * both pointless and a good way to get the key ignored. A manifest of content
 * hashes from the previous run is what makes that distinction possible; with no
 * manifest — the first run — everything is new and everything is submitted.
 *
 * Usage:
 *   npx tsx scripts/ops/indexnow.ts --dir static/frost --host frostdatefinder.com
 *   npx tsx scripts/ops/indexnow.ts --dir static/frost --host frostdatefinder.com --dry-run
 */

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const BATCH_SIZE = 10_000;

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

/** static/frost/frost/foo.html is served at /frost/foo; index.html at the root. */
function urlPathFor(dir: string, file: string): string {
  const rel = path.relative(dir, file).split(path.sep).join('/');
  if (rel === 'index.html') return '/';
  return `/${rel.replace(/\.html$/, '')}`;
}

function walkHtml(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

type Manifest = Record<string, string>;

function readManifest(file: string): Manifest {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Manifest;
  } catch {
    return {};
  }
}

async function submit(host: string, key: string, urls: string[]): Promise<void> {
  const body = {
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList: urls,
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });

  // 200 accepted, 202 accepted while the key is still being validated.
  if (res.status === 200 || res.status === 202) {
    console.log(`    ${urls.length.toLocaleString()} URLs -> HTTP ${res.status}`);
    return;
  }
  const text = await res.text().catch(() => '');
  throw new Error(`IndexNow refused the batch: HTTP ${res.status} ${text.slice(0, 200)}`);
}

async function main() {
  const dir = path.resolve(arg('dir')!);
  const host = arg('host')!;
  const key = process.env.INDEXNOW_KEY;

  if (!key) {
    console.log('[=] INDEXNOW_KEY is not set — skipping IndexNow.');
    return;
  }
  if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
    throw new Error('INDEXNOW_KEY must be 8-128 characters of letters, digits or hyphens.');
  }

  const manifestFile = path.join('logs', `indexnow-${path.basename(dir)}.json`);
  const previous = readManifest(manifestFile);
  const current: Manifest = {};
  const changed: string[] = [];

  for (const file of walkHtml(dir)) {
    const urlPath = urlPathFor(dir, file);
    const hash = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
    current[urlPath] = hash;
    if (previous[urlPath] !== hash) changed.push(`https://${host}${urlPath}`);
  }

  const total = Object.keys(current).length;
  if (changed.length === 0) {
    console.log(`[=] IndexNow: nothing changed across ${total.toLocaleString()} pages.`);
    return;
  }

  const first = Object.keys(previous).length === 0;
  console.log(
    `[+] IndexNow: ${changed.length.toLocaleString()} of ${total.toLocaleString()} pages ` +
      `${first ? '(first run — all of them)' : 'changed'}`,
  );

  if (process.argv.includes('--dry-run')) {
    console.log('    dry run — nothing submitted, manifest not written. Sample:');
    for (const url of changed.slice(0, 3)) console.log(`      ${url}`);
    return;
  }

  for (let i = 0; i < changed.length; i += BATCH_SIZE) {
    await submit(host, key, changed.slice(i, i + BATCH_SIZE));
  }

  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  fs.writeFileSync(manifestFile, JSON.stringify(current));
  console.log(`[+] IndexNow: manifest written to ${manifestFile}`);
}

main().catch((err) => {
  // A failed ping must not fail a deployment that already succeeded.
  console.error(`[!] IndexNow: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 0;
});
