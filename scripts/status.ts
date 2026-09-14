import { prisma } from './lib/etl';

/** Prints what is loaded and when each dataset last ran. */
/**
 * The published sites, checked over the network.
 *
 * The row counts above say what is in the database, which is not the same as
 * what readers can see. Between the two sits a build, a deploy and a DNS record,
 * and every one of them has been wrong at least once. This asks the live domain.
 */
const SITES = [
  { name: 'frostdatefinder.com', probe: '/frost' },
  { name: 'checkcarrecalls.com', probe: '/recalls' },
];

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/140.0 Safari/537.36';

async function fetchText(url: string): Promise<{ status: number; body: string } | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA }, redirect: 'manual' });
    return { status: res.status, body: await res.text() };
  } catch {
    return null;
  }
}

async function reportLiveSites(): Promise<void> {
  console.log('Published sites');
  console.log('-'.repeat(78));

  for (const site of SITES) {
    const page = await fetchText(`https://${site.name}${site.probe}`);
    if (!page) {
      console.log(`  ${site.name.padEnd(24)} unreachable`);
      continue;
    }

    const sitemap = await fetchText(`https://${site.name}/sitemap.xml`);
    const urls = sitemap ? (sitemap.body.match(/<loc>/g) ?? []).length : 0;
    const analytics = /beacon\.min\.js|cloudflareinsights/.test(page.body);
    const ads = /adsbygoogle|googlesyndication/.test(page.body);

    console.log(
      `  ${site.name.padEnd(24)} HTTP ${page.status}  ` +
        `${urls.toLocaleString().padStart(7)} URLs in sitemap  ` +
        `analytics ${analytics ? 'on ' : 'off'}  ads ${ads ? 'on' : 'off'}`,
    );
  }
  console.log('');
}

async function main() {
  const counts: [string, number][] = [
    ['Doctor', await prisma.doctor.count()],
    ['DoctorSpecialtyCity', await prisma.doctorSpecialtyCity.count()],
    ['BankBranch', await prisma.bankBranch.count()],
    ['Aircraft', await prisma.aircraft.count()],
    ['DOTCarrier', await prisma.dOTCarrier.count()],
    ['BusinessEntity', await prisma.businessEntity.count()],
    ['Vehicle (recalls)', await prisma.vehicle.count()],
    ['VehicleRecall', await prisma.vehicleRecall.count()],
    ['FoodNutrition', await prisma.foodNutrition.count()],
    ['ClimateData', await prisma.climateData.count()],
    ['SECExecutive', await prisma.sECExecutive.count()],
    ['BroadbandCoverage', await prisma.broadbandCoverage.count()],
    ['CensusDemographic', await prisma.censusDemographic.count()],
    ['UtilityRate', await prisma.utilityRate.count()],
    ['Trademark', await prisma.trademark.count()],
    ['Car', await prisma.car.count()],
  ];

  const total = counts.reduce((s, [, n]) => s + n, 0);

  console.log('\nRows loaded');
  console.log('-'.repeat(46));
  for (const [name, n] of counts) {
    console.log(`  ${name.padEnd(24)} ${n.toLocaleString().padStart(14)}`);
  }
  console.log('-'.repeat(46));
  console.log(`  ${'TOTAL'.padEnd(24)} ${total.toLocaleString().padStart(14)}\n`);

  const runs = await prisma.ingestionRun.findMany({ orderBy: { startedAt: 'desc' }, take: 15 });
  console.log('Recent ingestion runs');
  console.log('-'.repeat(78));
  for (const r of runs) {
    const secs = r.finishedAt ? `${((+r.finishedAt - +r.startedAt) / 1000).toFixed(0)}s` : 'running';
    console.log(
      `  ${r.startedAt.toISOString().slice(0, 16)}  ${r.dataset.padEnd(12)} ${r.status.padEnd(8)} ` +
        `${r.rowsWritten.toLocaleString().padStart(11)} rows  ${secs}`,
    );
  }
  console.log('');
  await prisma.$disconnect();
  await reportLiveSites();
}

main();
