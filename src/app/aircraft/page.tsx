import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { DATASETS } from '@/lib/datasets';
import { absoluteUrl, formatNumber } from '@/lib/site';
import { Page, Breadcrumbs, PageHeader, EmptyState, JsonLd } from '@/components/Layout';
import { DirectoryTable } from '@/components/Directory';

// Not prerendered: the build container has no database.
export const dynamic = 'force-dynamic';

const getSummary = unstable_cache(
  async () =>
    Promise.all([
      prisma.aircraft.count(),
      prisma.aircraft.groupBy({
        by: ['manufacturer'],
        where: { manufacturer: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { manufacturer: 'desc' } },
        take: 24,
      }),
      prisma.aircraft.findMany({
        select: { slug: true, nNumber: true, manufacturer: true, modelName: true, yearBuilt: true },
        orderBy: { nNumber: 'asc' },
        take: 60,
      }),
    ]),
  ['aircraft-index-summary'],
  { revalidate: 86400 },
);

const config = DATASETS.aircraft;
const title = `${config.title} — Search 300,000+ Tail Numbers`;

export const metadata: Metadata = {
  title,
  description: config.description,
  alternates: { canonical: absoluteUrl('/aircraft') },
  openGraph: { title, description: config.description },
};

export default async function AircraftIndex() {
  const [total, byManufacturer, sample] = await getSummary();

  if (total === 0) {
    return (
      <Page>
        <PageHeader title={config.title} />
        <EmptyState dataset="aircraft" />
      </Page>
    );
  }

  return (
    <Page>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: absoluteUrl('/aircraft'), numberOfItems: total }} />
      <Breadcrumbs items={[{ label: 'Aircraft' }]} />
      <PageHeader eyebrow={config.source} title={config.title}
        subtitle={`${formatNumber(total)} civil aircraft on the FAA registry, searchable by N-number, manufacturer and model.`} />

      <section className="mb-10">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Most registered manufacturers</h2>
        <ul className="flex flex-wrap gap-2">
          {byManufacturer.map((m) => (
            <li key={m.manufacturer} className="text-sm bg-white border border-slate-200 rounded-full px-3 py-1.5 text-slate-700">
              {m.manufacturer} <span className="text-slate-400">({formatNumber(m._count._all)})</span>
            </li>
          ))}
        </ul>
      </section>

      <h2 className="text-xl font-bold text-slate-900 mb-4">Registered aircraft</h2>
      <DirectoryTable basePath="/aircraft" headers={['Tail Number', 'Aircraft', 'Year']}
        rows={sample.map((a) => ({
          slug: a.slug, primary: a.nNumber,
          secondary: [a.manufacturer, a.modelName].filter(Boolean).join(' ') || null,
          tertiary: a.yearBuilt ? String(a.yearBuilt) : null,
        }))} />
    </Page>
  );
}
