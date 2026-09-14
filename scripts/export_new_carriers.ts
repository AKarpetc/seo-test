import fs from 'fs';
import path from 'path';
import { prisma, stateNameOf } from './lib/etl';

/**
 * The saleable slice of the FMCSA census: carriers whose operating authority was
 * granted recently. Every new authority must file proof of insurance before it
 * activates, which is why insurance agencies pay for this list and not for the
 * full 2.2M-row table.
 *
 * Usage:
 *   npx tsx scripts/export_new_carriers.ts --days 30 --state TX
 *   npx tsx scripts/export_new_carriers.ts --days 7            (all states)
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
  const minFleet = parseInt(arg('min-fleet', '1')!, 10);

  if (state && !stateNameOf(state)) throw new Error(`Unknown state code: ${state}`);

  const since = new Date(Date.now() - days * 86_400_000);

  const carriers = await prisma.dOTCarrier.findMany({
    where: {
      authorityDate: { gte: since },
      ...(state ? { state } : {}),
      ...(minFleet > 0 ? { fleetSize: { gte: minFleet } } : {}),
    },
    select: {
      dotNumber: true, companyName: true, dbaName: true, authorityDate: true,
      fleetSize: true, driverCount: true, carrierOperation: true,
      phone: true, address: true, city: true, state: true, zip: true,
    },
    orderBy: { authorityDate: 'desc' },
  });

  const header = [
    'dot_number', 'legal_name', 'dba_name', 'authority_date', 'power_units',
    'drivers', 'operation', 'phone', 'address', 'city', 'state', 'zip',
  ];

  const lines = [header.join(',')];
  for (const c of carriers) {
    lines.push([
      c.dotNumber, c.companyName, c.dbaName,
      c.authorityDate?.toISOString().slice(0, 10),
      c.fleetSize, c.driverCount, c.carrierOperation,
      c.phone, c.address, c.city, c.state, c.zip,
    ].map(csvEscape).join(','));
  }

  const dir = path.join(process.cwd(), 'exports');
  fs.mkdirSync(dir, { recursive: true });
  const name = `new-carriers-${state ?? 'us'}-${days}d-${new Date().toISOString().slice(0, 10)}.csv`;
  const file = path.join(dir, name);
  fs.writeFileSync(file, lines.join('\n'));

  const withPhone = carriers.filter((c) => c.phone).length;

  console.log(`\n${carriers.length.toLocaleString()} carriers granted authority in the last ${days} days`);
  console.log(`  state filter : ${state ?? 'all'}`);
  console.log(`  with phone   : ${withPhone.toLocaleString()} (${Math.round((withPhone / (carriers.length || 1)) * 100)}%)`);
  console.log(`  written to   : ${file}\n`);

  if (!state) {
    const byState = await prisma.dOTCarrier.groupBy({
      by: ['state'],
      where: { authorityDate: { gte: since }, state: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { state: 'desc' } },
      take: 12,
    });
    console.log('Top states (this window):');
    for (const s of byState) {
      console.log(`  ${s.state}  ${String(s._count._all).padStart(6)}   ${stateNameOf(s.state)}`);
    }
    console.log('');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
