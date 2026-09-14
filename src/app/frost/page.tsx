import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, formatNumber, stateName, US_STATES } from '@/lib/site';
import { Page, Card, Breadcrumbs, PageHeader, EmptyState, JsonLd } from '@/components/Layout';
import { GroupLinks } from '@/components/Directory';

// Not prerendered: the build container has no database.
export const dynamic = 'force-dynamic';

const title = 'Frost Dates by ZIP Code — First & Last Frost, Planting Calendar';
const description =
  'Look up the first and last frost date for any US ZIP code, with the USDA hardiness zone and growing season length. Thirty-year NOAA climate normals.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl('/frost') },
  openGraph: { title, description },
};

const getSummary = unstable_cache(
  async () =>
    Promise.all([
      prisma.zipClimate.count(),
      prisma.zipClimate.groupBy({
        by: ['zone'],
        where: { zone: { not: null } },
        _count: { _all: true },
        orderBy: { zone: 'asc' },
      }),
      prisma.zipClimate.groupBy({
        by: ['state'],
        where: { state: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { state: 'desc' } },
      }),
      prisma.zipClimate.findMany({
        select: { slug: true, zip: true, city: true, state: true, zone: true },
        orderBy: { population: 'desc' },
        take: 40,
      }),
    ]),
  ['frost-index-summary'],
  { revalidate: 86400 },
);

export default async function FrostIndex() {
  const [total, byZone, byState, biggest] = await getSummary();

  if (total === 0) {
    return (
      <Page>
        <PageHeader title="Frost Dates by ZIP Code" />
        <EmptyState dataset="zipclimate" />
      </Page>
    );
  }

  return (
    <Page>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: absoluteUrl('/frost'), numberOfItems: total }} />
      <Breadcrumbs items={[{ label: 'Frost Dates' }]} />
      <PageHeader
        eyebrow="NOAA 1991–2020 Normals · USDA Hardiness Zones"
        title="Frost Dates by ZIP Code"
        subtitle={`${formatNumber(total)} ZIP codes with first and last frost dates, hardiness zone and growing season length.`}
      />

      <GroupLinks
        title="Browse by hardiness zone"
        items={byZone.map((z) => ({ href: `/frost/zone/${z.zone}`, label: `Zone ${z.zone}`, count: z._count._all }))}
      />

      <section className="mb-10">
        <h2 className="text-xl font-bold text-fg mb-4">Largest ZIP codes</h2>
        <Card className="p-6">
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-y-2 gap-x-4">
            {biggest.map((z) => (
              <li key={z.slug}>
                <Link href={`/frost/${z.slug}`} className="text-accent hover:underline">
                  {z.zip}
                </Link>
                <span className="text-faint text-xs ml-1">
                  {z.city}{z.zone ? ` · ${z.zone}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-bold text-fg mb-4">Coverage by state</h2>
        <Card className="p-6">
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-y-2 gap-x-4 text-fg">
            {byState.filter((s) => s.state && US_STATES[s.state]).map((s) => (
              <li key={s.state}>
                {stateName(s.state)}
                <span className="text-faint text-sm ml-1">({formatNumber(s._count._all)})</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </Page>
  );
}
