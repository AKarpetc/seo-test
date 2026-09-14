import fs from 'fs';
import path from 'path';
import { prisma, slugify } from './lib/etl';

/**
 * The first test run stored the raw NUCC taxonomy code in `specialty` and left
 * `taxonomyCode` null, producing slugs like "dr-jane-doe-207x00000x-...".
 * This repairs those rows in place rather than deleting real provider records.
 */
const TAXONOMY: Record<string, { name: string }> = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data', 'nucc_taxonomy.json'), 'utf8'),
);

const CODE_PATTERN = /^[0-9]{3}[A-Z0-9]{6}X?$/;

async function main() {
  const broken = await prisma.doctor.findMany({
    where: { taxonomyCode: null },
    select: { id: true, specialty: true, firstName: true, lastName: true, clinicName: true, city: true, state: true, npi: true },
  });

  console.log(`[+] ${broken.length.toLocaleString()} rows to repair`);

  let fixed = 0;
  for (const d of broken) {
    const isCode = CODE_PATTERN.test(d.specialty);
    const code = isCode ? d.specialty : null;
    const specialty = isCode ? TAXONOMY[d.specialty]?.name || 'Healthcare Provider' : d.specialty;
    const displayName = d.clinicName || `dr ${[d.firstName, d.lastName].filter(Boolean).join(' ')}`;

    await prisma.doctor.update({
      where: { id: d.id },
      data: {
        specialty,
        taxonomyCode: code,
        slug: slugify(displayName, specialty, d.city, d.state, d.npi),
      },
    });

    fixed++;
    if (fixed % 2000 === 0) process.stdout.write(`\r    repaired ${fixed.toLocaleString()}`);
  }

  console.log(`\n✅ Repaired ${fixed.toLocaleString()} legacy doctor rows`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
