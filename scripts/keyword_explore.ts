import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { HTTP_HEADERS } from './lib/etl';

/**
 * Niche discovery from Google autocomplete.
 *
 * Autocomplete is the only free source of real query wording: it reflects what
 * people actually finish typing, not an estimate. It gives no volumes, so it
 * answers "what do they ask" and not "how many" — pair it with Keyword Planner
 * when a niche looks worth costing out.
 *
 * Usage:
 *   npx tsx scripts/keyword_explore.ts "first frost date"
 *   npx tsx scripts/keyword_explore.ts --file seeds.txt --depth 2
 */

const ENDPOINT = 'https://suggestqueries.google.com/complete/search';

/** Appending each letter surfaces a different branch of the suggestion tree. */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

/** Question words are where informational, low-competition queries live. */
const MODIFIERS = ['how', 'what', 'when', 'where', 'why', 'is', 'are', 'can', 'does', 'best', 'vs', 'near me', 'for', 'in'];

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

async function suggest(query: string): Promise<string[]> {
  try {
    const { data } = await axios.get(ENDPOINT, {
      params: { client: 'firefox', hl: 'en', gl: 'us', q: query },
      headers: HTTP_HEADERS,
      timeout: 15_000,
    });
    return Array.isArray(data?.[1]) ? (data[1] as string[]) : [];
  } catch {
    return [];
  }
}

/** Runs a batch with limited concurrency so Google does not start refusing. */
async function gather(queries: string[], concurrency = 4): Promise<string[]> {
  const out = new Set<string>();
  let cursor = 0;

  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= queries.length) return;
      for (const s of await suggest(queries[i])) out.add(s.toLowerCase());
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return [...out];
}

async function expand(seed: string, depth: number): Promise<string[]> {
  const found = new Set<string>();

  const probes = [
    seed,
    ...MODIFIERS.map((m) => `${m} ${seed}`),
    ...ALPHABET.map((c) => `${seed} ${c}`),
  ];

  console.log(`[+] "${seed}": ${probes.length} probes`);
  for (const s of await gather(probes)) found.add(s);
  console.log(`    ${found.size} suggestions`);

  if (depth > 1) {
    // A second pass over the best first-pass results reaches the long tail.
    const secondSeeds = [...found].slice(0, 40);
    console.log(`[+] second pass over ${secondSeeds.length} of them`);
    for (const s of await gather(secondSeeds.map((q) => `${q} `))) found.add(s);
    console.log(`    ${found.size} total`);
  }

  return [...found];
}

/**
 * Queries that name a place, a year or a model number are the programmatic ones:
 * one page per value, which is what this project can actually build.
 */
function isTemplatable(q: string): boolean {
  return /\b(in|near|for|by)\b/.test(q) || /\b(19|20)\d{2}\b/.test(q) || /\bzone\s?\d/.test(q);
}

function isQuestion(q: string): boolean {
  return /^(how|what|when|where|why|is|are|can|does|do|should|will)\b/.test(q);
}

async function main() {
  const file = arg('file');
  const depth = parseInt(arg('depth', '1')!, 10);

  const seeds = file
    ? fs.readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
    : process.argv.slice(2).filter((a) => !a.startsWith('--') && process.argv[process.argv.indexOf(a) - 1] !== '--depth');

  if (seeds.length === 0) {
    console.error('Usage: npx tsx scripts/keyword_explore.ts "<seed phrase>" [--depth 2]');
    process.exit(1);
  }

  const all = new Set<string>();
  for (const seed of seeds) {
    for (const q of await expand(seed, depth)) all.add(q);
  }

  const list = [...all].sort();
  const templatable = list.filter(isTemplatable);
  const questions = list.filter(isQuestion);

  const dir = path.join(process.cwd(), 'exports');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `keywords-${seeds[0].replace(/[^a-z0-9]+/gi, '-')}.txt`);
  fs.writeFileSync(out, list.join('\n'));

  console.log(`\n${list.length} unique queries`);
  console.log(`  templatable (one page per value): ${templatable.length}`);
  console.log(`  questions:                       ${questions.length}`);
  console.log(`  saved to: ${out}\n`);

  console.log('Templatable sample — these are the programmatic pages:');
  for (const q of templatable.slice(0, 15)) console.log(`  ${q}`);
  console.log('\nQuestions sample — these are the supporting articles:');
  for (const q of questions.slice(0, 10)) console.log(`  ${q}`);
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
