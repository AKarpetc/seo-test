import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, formatNumber, stateName, US_STATES } from '@/lib/site';
import { Page, Card, Breadcrumbs, PageHeader, EmptyState, JsonLd, SectionHeading } from '@/components/Layout';
import { DirectoryTable } from '@/components/Directory';

// Not prerendered: the build container has no database.
export const dynamic = 'force-dynamic';

const title = 'Hurricanes and Tornadoes That Hit Your City — Storm History Since 1851';
const description =
  'Look up every hurricane, tropical storm and tornado that has passed near any US city: closest approach, strength, dates. From the official NHC and SPC records.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl('/storms') },
  openGraph: { title, description },
};

const getSummary = unstable_cache(
  async () =>
    Promise.all([
      prisma.stormCity.count({ where: { OR: [{ hurricaneCount: { gt: 0 } }, { tropicalStormCount: { gt: 0 } }, { tornadoCount: { gt: 0 } }] } }),
      prisma.stormCity.groupBy({
        by: ['state'],
        where: { OR: [{ hurricaneCount: { gt: 0 } }, { tropicalStormCount: { gt: 0 } }, { tornadoCount: { gt: 0 } }] },
        _count: { _all: true },
        _sum: { hurricaneCount: true, tornadoCount: true },
        orderBy: { state: 'asc' },
      }),
      prisma.stormCity.findMany({
        where: { population: { gte: 20000 } },
        select: { slug: true, city: true, state: true, hurricaneCount: true, lastStormName: true, lastStormYear: true },
        orderBy: { hurricaneCount: 'desc' },
        take: 25,
      }),
      prisma.stormCity.findMany({
        where: { population: { gte: 20000 } },
        select: { slug: true, city: true, state: true, tornadoCount: true, strongTornadoCount: true },
        orderBy: { tornadoCount: 'desc' },
        take: 25,
      }),
    ]),
  ['storms-index-summary'],
  { revalidate: 86400 },
);

export default async function StormsIndex() {
  const [total, byState, hurricaneCities, tornadoCities] = await getSummary();

  if (total === 0) {
    return (
      <Page>
        <PageHeader title="Storm History by City" />
        <EmptyState dataset="storms" />
      </Page>
    );
  }

  return (
    <Page>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: absoluteUrl('/storms'), numberOfItems: total }} />
      <Breadcrumbs items={[{ label: 'Storm History' }]} />
      <PageHeader
        eyebrow="NHC HURDAT2 · SPC Tornado Database"
        title="Hurricanes and Tornadoes That Hit Your City"
        subtitle={`${formatNumber(total)} US cities with every tropical system within 75 miles since 1851 and every tornado within 25 miles since 1950.`}
      />

      <section className="mb-10">
        <SectionHeading id="states">Browse by state</SectionHeading>
        <Card className="p-5 sm:p-6">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
            {byState.filter((s) => US_STATES[s.state]).map((s) => (
              <li key={s.state}>
                <Link href={`/storms/state/${s.state.toLowerCase()}`} className="inline-flex min-h-11 items-center gap-1.5 text-accent hover:underline">
                  {stateName(s.state)}
                  <span className="text-xs text-faint">({formatNumber(s._count._all)})</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <SectionHeading id="hurricanes">Most hurricane-hit cities</SectionHeading>
      <DirectoryTable
        basePath="/storms"
        headers={['City', 'Hurricanes within 75 mi', 'Most recent']}
        rows={hurricaneCities.map((c) => ({
          slug: c.slug,
          primary: `${c.city}, ${c.state}`,
          secondary: formatNumber(c.hurricaneCount),
          tertiary: c.lastStormName ? `${c.lastStormName === 'Unnamed' ? 'Unnamed storm' : c.lastStormName} (${c.lastStormYear})` : '—',
        }))}
      />

      <div className="mt-10">
        <SectionHeading id="tornadoes">Most tornado-prone cities</SectionHeading>
        <DirectoryTable
          basePath="/storms"
          headers={['City', 'Tornadoes within 25 mi', 'EF3 or stronger']}
          rows={tornadoCities.map((c) => ({
            slug: c.slug,
            primary: `${c.city}, ${c.state}`,
            secondary: formatNumber(c.tornadoCount),
            tertiary: formatNumber(c.strongTornadoCount),
          }))}
        />
      </div>

      <p className="mt-8 max-w-[68ch] text-sm text-faint">
        Sources: the National Hurricane Center&apos;s HURDAT2 best-track database and the Storm Prediction
        Center&apos;s tornado database. Cities with a population above 2,000 in the 2020 census.
      </p>
    </Page>
  );
}
