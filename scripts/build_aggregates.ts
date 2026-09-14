import { prisma, slugify, trackRun } from './lib/etl';

/**
 * "Cardiologists in Austin, TX" is the query that actually converts, but running it
 * as a GROUP BY over 9M doctor rows on every request is not viable. This job
 * materialises the combinations once so each page is a single indexed lookup.
 *
 * Combinations below MIN_PROVIDERS are skipped: a page listing one provider is
 * thin content and competes with that provider's own detail page.
 */
const MIN_PROVIDERS = parseInt(process.env.AGG_MIN_PROVIDERS || '3', 10);

async function buildDoctorSpecialtyCity() {
  console.log('[+] Aggregating specialty x city from Doctor...');

  const rows = await prisma.$queryRaw<
    { specialty: string; city: string; state: string; taxonomyCode: string | null; count: bigint }[]
  >`
    SELECT specialty,
           city,
           state,
           (array_agg("taxonomyCode" ORDER BY "taxonomyCode"))[1] AS "taxonomyCode",
           count(*) AS count
    FROM "Doctor"
    GROUP BY specialty, city, state
    HAVING count(*) >= ${MIN_PROVIDERS}
  `;

  console.log(`    ${rows.length.toLocaleString()} qualifying combinations`);

  const seen = new Set<string>();
  const payload = [];

  for (const r of rows) {
    let slug = slugify(r.specialty, 'in', r.city, r.state);
    if (!slug) continue;
    // City names repeat across states only after the state is in the slug, but
    // truncation can still collide; disambiguate rather than drop the row.
    if (seen.has(slug)) slug = `${slug}-${payload.length}`;
    seen.add(slug);

    payload.push({
      specialty: r.specialty,
      taxonomyCode: r.taxonomyCode,
      city: r.city,
      state: r.state,
      providerCount: Number(r.count),
      slug,
      updatedAt: new Date(),
    });
  }

  await prisma.doctorSpecialtyCity.deleteMany({});

  let written = 0;
  const BATCH = 5000;
  for (let i = 0; i < payload.length; i += BATCH) {
    const res = await prisma.doctorSpecialtyCity.createMany({
      data: payload.slice(i, i + BATCH),
      skipDuplicates: true,
    });
    written += res.count;
    process.stdout.write(`\r    written ${written.toLocaleString()} / ${payload.length.toLocaleString()}`);
  }
  console.log('');

  return { read: rows.length, written };
}

async function main() {
  await trackRun('aggregates', 'postgres://Doctor', async () => buildDoctorSpecialtyCity());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
