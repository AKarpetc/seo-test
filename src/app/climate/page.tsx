import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { DATASETS } from '@/lib/datasets';
import { absoluteUrl, formatNumber, stateName, US_STATES } from '@/lib/site';
import { Page, Breadcrumbs, PageHeader, EmptyState, JsonLd } from '@/components/Layout';
import { DirectoryTable, GroupLinks } from '@/components/Directory';

export const revalidate = 86400;

const config = DATASETS.climate;
const title = `${config.title} — First & Last Frost Dates by City`;

export const metadata: Metadata = {
  title,
  description: config.description,
  alternates: { canonical: absoluteUrl('/climate') },
  openGraph: { title, description: config.description },
};

export default async function ClimateIndex({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  const code = state?.toUpperCase();
  const scoped = code && US_STATES[code] ? code : null;
  const where = scoped ? { state: scoped } : {};

  const [total, byState, rows] = await Promise.all([
    prisma.climateData.count({ where }),
    prisma.climateData.groupBy({ by: ['state'], where: { state: { not: null } }, _count: { _all: true }, orderBy: { _count: { state: 'desc' } } }),
    prisma.climateData.findMany({
      where,
      select: { slug: true, city: true, state: true, growingDays: true, lastFrostDate: true },
      orderBy: [{ city: 'asc' }, { id: 'asc' }],
      take: 200,
    }),
  ]);

  if (total === 0) {
    return (
      <Page>
        <PageHeader title={config.title} />
        <EmptyState dataset="climate" />
      </Page>
    );
  }

  return (
    <Page>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: absoluteUrl('/climate'), numberOfItems: total }} />
      <Breadcrumbs items={scoped ? [{ label: 'Climate', href: '/climate' }, { label: stateName(scoped) }] : [{ label: 'Climate' }]} />
      <PageHeader eyebrow={config.source} title={scoped ? `Frost Dates & Climate in ${stateName(scoped)}` : config.title}
        subtitle={`${formatNumber(total)} weather stations with 1991–2020 normals, frost dates and growing season length.`} />

      {!scoped ? (
        <GroupLinks title="Browse by state" items={byState.filter((s) => s.state && US_STATES[s.state]).map((s) => ({
          href: `/climate?state=${s.state!.toLowerCase()}`, label: stateName(s.state), count: s._count._all,
        }))} />
      ) : null}

      <h2 className="text-xl font-bold text-slate-900 mb-4">Weather stations</h2>
      <DirectoryTable basePath="/climate" headers={['Location', 'Growing Season', 'Last Spring Frost']}
        rows={rows.map((c) => ({
          slug: c.slug, primary: `${c.city ?? '—'}, ${c.state}`,
          secondary: c.growingDays ? `${c.growingDays} days` : null, tertiary: c.lastFrostDate,
        }))} />
    </Page>
  );
}
