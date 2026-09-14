import { prisma } from './lib/etl';

/** Prints what is loaded and when each dataset last ran. */
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
}

main();
