import fs from 'fs';
import path from 'path';
import { prisma } from './lib/etl';

/**
 * The saleable slice of the state business registries: entities formed recently.
 * A company that filed this month has not yet chosen an insurer, a payroll
 * provider, a bank, a bookkeeper or a POS vendor — which is why the recent
 * window sells and the historical registry does not.
 *
 * Usage:
 *   npx tsx scripts/export_new_businesses.ts --days 30 --state CO
 *   npx tsx scripts/export_new_businesses.ts --days 7
 */

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const days = parseInt(arg('days', '30')!, 10);
  const state = arg('state')?.toUpperCase();
  const since = new Date(Date.now() - days * 86_400_000);

  const rows = await prisma.businessEntity.findMany({
    where: { filingDate: { gte: since }, ...(state ? { state } : {}) },
    select: {
      stateId: true, state: true, name: true, entityType: true, status: true,
      filingDate: true, address: true, city: true, zip: true, county: true, agentName: true,
    },
    orderBy: { filingDate: 'desc' },
  });

  const header = [
    'filing_id', 'state', 'business_name', 'entity_type', 'status',
    'filing_date', 'address', 'city', 'zip', 'county', 'registered_agent',
  ];

  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      r.stateId, r.state, r.name, r.entityType, r.status,
      r.filingDate?.toISOString().slice(0, 10),
      r.address, r.city, r.zip, r.county, r.agentName,
    ].map(csvEscape).join(','));
  }

  const dir = path.join(process.cwd(), 'exports');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `new-businesses-${state ?? 'all'}-${days}d-${new Date().toISOString().slice(0, 10)}.csv`,
  );
  fs.writeFileSync(file, lines.join('\n'));

  const withAddress = rows.filter((r) => r.address).length;

  console.log(`\n${rows.length.toLocaleString()} businesses formed in the last ${days} days`);
  console.log(`  state filter : ${state ?? 'all'}`);
  console.log(`  with address : ${withAddress.toLocaleString()} (${Math.round((withAddress / (rows.length || 1)) * 100)}%)`);
  console.log(`  written to   : ${file}\n`);

  const byState = await prisma.businessEntity.groupBy({
    by: ['state'],
    where: { filingDate: { gte: since } },
    _count: { _all: true },
  });
  console.log('By state in this window:');
  for (const s of byState) console.log(`  ${s.state}  ${String(s._count._all).padStart(7)}`);
  console.log('');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
