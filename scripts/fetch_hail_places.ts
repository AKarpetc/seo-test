import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HAIL_STATES, cityKey } from '../src/lib/hail';

/**
 * Snapshot of the city pages myhailmap.com has in the hail-belt states, so storm
 * pages link only to hail pages that exist. Written to src/data/hail-places.json
 * and committed: the static build must not depend on another site being up.
 *
 *   npm run hail:places
 */

const ORIGIN = 'https://myhailmap.com';

function unescape(s: string): string {
  return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

async function main() {
  const out: Record<string, Record<string, string>> = {};
  for (const st of HAIL_STATES) {
    const res = await fetch(`${ORIGIN}/hail/${st}`);
    if (!res.ok) throw new Error(`${st}: HTTP ${res.status}`);
    const page = await res.text();
    const seen = new Map<string, string[]>();
    for (const m of page.matchAll(new RegExp(`<a href="/hail/${st}/([a-z0-9-]+)">([^<]+)</a>`, 'g'))) {
      const name = cityKey(unescape(m[2]));
      seen.set(name, [...(seen.get(name) ?? []), m[1]]);
    }
    // A name used by two places in one state is ambiguous without coordinates; skip it.
    out[st] = Object.fromEntries([...seen].filter(([, slugs]) => slugs.length === 1).map(([name, [slug]]) => [name, slug]));
    console.log(`${st}: ${Object.keys(out[st]).length} cities`);
  }
  writeFileSync(join(__dirname, '../src/data/hail-places.json'), JSON.stringify(out, null, 1) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
