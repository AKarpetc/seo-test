import dotenv from 'dotenv';

dotenv.config();

/**
 * Real-browser traffic for the published sites, from Cloudflare Web Analytics.
 *
 * Needs CLOUDFLARE_ANALYTICS_TOKEN with Account Analytics: Read only. The Pages
 * deploy token cannot read analytics, and should not be widened to do so.
 *
 * The "adaptive" dataset is sampled when the window is large: a query over two
 * weeks returned round tens, the same days over one week came back exact. Figures
 * are estimates; read trends over a week, not single days.
 *
 *   npm run traffic            # since the sites launched
 *   npm run traffic -- 7       # last 7 days
 */

const SITES: Record<string, string> = { frost: 'frost', recall: 'recalls', storm: 'storms' };
const ORDER = ['frost', 'recalls', 'storms'];

type Row = { count: number; sum: { visits: number }; dimensions: Record<string, string> };

function siteOf(host: string): string | null {
  for (const [needle, name] of Object.entries(SITES)) if (host.includes(needle)) return name;
  return null;
}

async function query(since: string, dims: string[]): Promise<Row[]> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const q = `{ viewer { accounts(filter:{accountTag:"${account}"}) { rumPageloadEventsAdaptiveGroups(limit:5000, filter:{date_geq:"${since}"}) { count sum { visits } dimensions { ${dims.join(' ')} } } } } }`;
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_ANALYTICS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  const data = (await res.json()) as any;
  if (data.errors?.length) throw new Error(data.errors.map((e: any) => e.message).join('; '));
  return data.data.viewer.accounts[0].rumPageloadEventsAdaptiveGroups;
}

function tally<K>(rows: Row[], key: (r: Row) => K | null): Map<K, number> {
  const out = new Map<K, number>();
  for (const r of rows) {
    const k = key(r);
    if (k !== null) out.set(k, (out.get(k) ?? 0) + r.count);
  }
  return out;
}

async function main() {
  if (!process.env.CLOUDFLARE_ANALYTICS_TOKEN) {
    console.error('CLOUDFLARE_ANALYTICS_TOKEN is not set (Account Analytics: Read).');
    process.exit(1);
  }
  const days = parseInt(process.argv[2] || '0', 10);
  const since = days > 0 ? new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10) : '2026-09-14';

  const byDay = await query(since, ['date', 'requestHost']);
  const table = new Map<string, Map<string, [number, number]>>();
  for (const r of byDay) {
    const site = siteOf(r.dimensions.requestHost);
    if (!site) continue;
    const day = table.get(r.dimensions.date) ?? new Map();
    const cell = day.get(site) ?? [0, 0];
    cell[0] += r.count;
    cell[1] += r.sum.visits;
    day.set(site, cell);
    table.set(r.dimensions.date, day);
  }

  console.log(`\nPage views / visits since ${since} (estimates, may be sampled)\n`);
  console.log('date        ' + ORDER.map((s) => s.padStart(14)).join(''));
  const totals = new Map<string, [number, number]>();
  for (const date of [...table.keys()].sort()) {
    const day = table.get(date)!;
    console.log(date + '  ' + ORDER.map((s) => {
      const [v, u] = day.get(s) ?? [0, 0];
      const t = totals.get(s) ?? [0, 0];
      totals.set(s, [t[0] + v, t[1] + u]);
      return `${v}/${u}`.padStart(14);
    }).join(''));
  }
  console.log('total       ' + ORDER.map((s) => `${(totals.get(s) ?? [0, 0]).join('/')}`.padStart(14)).join(''));

  const refs = await query(since, ['requestHost', 'refererHost']);
  const search = tally(refs, (r) => {
    const site = siteOf(r.dimensions.requestHost);
    const ref = r.dimensions.refererHost || '';
    return site && /google|bing|duckduckgo|yahoo|yandex|ecosia|brave/.test(ref) ? `${site} ← ${ref}` : null;
  });
  console.log('\nFrom search engines');
  for (const [k, v] of [...search.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(40)} ${v}`);

  const paths = await query(since, ['requestHost', 'requestPath']);
  const top = tally(paths, (r) => {
    const site = siteOf(r.dimensions.requestHost);
    return site ? `${site.padEnd(8)} ${r.dimensions.requestPath}` : null;
  });
  console.log('\nTop pages');
  for (const [k, v] of [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log('');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
