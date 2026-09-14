import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { DATASETS } from '@/lib/datasets';
import { absoluteUrl, formatNumber } from '@/lib/site';
import { Page, Card, Breadcrumbs, PageHeader, EmptyState, JsonLd } from '@/components/Layout';
import { DirectoryTable } from '@/components/Directory';

// Not prerendered: the build container has no database.
export const dynamic = 'force-dynamic';

const config = DATASETS.recalls;
const title = `${config.title} — Check Recalls by Year, Make and Model`;

export const metadata: Metadata = {
  title,
  description: config.description,
  alternates: { canonical: absoluteUrl('/recalls') },
  openGraph: { title, description: config.description },
};

const getSummary = unstable_cache(
  async () =>
    Promise.all([
      prisma.vehicle.count(),
      prisma.vehicle.groupBy({
        by: ['make'],
        _count: { _all: true },
        orderBy: { _count: { make: 'desc' } },
        take: 40,
      }),
      prisma.vehicle.findMany({
        select: { slug: true, modelYear: true, make: true, model: true, recallCount: true },
        orderBy: [{ recallCount: 'desc' }, { id: 'asc' }],
        take: 50,
      }),
    ]),
  ['recalls-index-summary'],
  { revalidate: 86400 },
);

export default async function RecallsIndex() {
  const [total, byMake, worst] = await getSummary();

  if (total === 0) {
    return (
      <Page>
        <PageHeader title={config.title} />
        <EmptyState dataset="recalls" />
      </Page>
    );
  }

  return (
    <Page>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: absoluteUrl('/recalls'), numberOfItems: total }} />
      <Breadcrumbs items={[{ label: 'Recalls' }]} />
      <PageHeader
        eyebrow={config.source}
        title={config.title}
        subtitle={`${formatNumber(total)} vehicles with open safety recalls. Recall repairs are always free, with no mileage or age limit.`}
      />

      <section className="mb-10">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Browse by make</h2>
        <Card className="p-6">
          <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-y-2 gap-x-4">
            {byMake.map((m) => (
              <li key={m.make} className="text-slate-700">
                {m.make}
                <span className="text-slate-400 text-sm ml-1">({formatNumber(m._count._all)})</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <h2 className="text-xl font-bold text-slate-900 mb-4">Most recalled vehicles</h2>
      <DirectoryTable
        basePath="/recalls"
        headers={['Vehicle', 'Make', 'Recalls']}
        rows={worst.map((v) => ({
          slug: v.slug,
          primary: `${v.modelYear} ${v.make} ${v.model}`,
          secondary: v.make,
          tertiary: String(v.recallCount),
        }))}
      />

      <p className="mt-8 text-sm text-slate-500">
        Source:{' '}
        <Link href={config.sourceUrl} className="text-blue-600 hover:underline">
          NHTSA
        </Link>
        . A recall covers a VIN range, not every vehicle of that model — check your own VIN before
        assuming yours is affected.
      </p>
    </Page>
  );
}
