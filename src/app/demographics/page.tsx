import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { DATASETS } from '@/lib/datasets';
import { absoluteUrl, formatNumber, stateName, US_STATES } from '@/lib/site';
import { Page, Breadcrumbs, PageHeader, EmptyState, JsonLd } from '@/components/Layout';
import { DirectoryTable, GroupLinks } from '@/components/Directory';
import { Pagination } from '@/components/Pagination';

export const revalidate = 86400;

const PER_PAGE = 60;
const config = DATASETS.demographics;

type Props = { searchParams: Promise<{ state?: string; page?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { state } = await searchParams;
  const code = state?.toUpperCase();
  const scoped = code && US_STATES[code];
  const title = scoped
    ? `Cost of Living by ZIP Code in ${stateName(code)} — Income, Rent & Home Values`
    : `${config.title} — Income, Rent & Home Values`;
  const description = scoped
    ? `Median income, rent, home values and education levels for every ZIP code in ${stateName(code)}, from Census ACS 5-year estimates.`
    : config.description;
  return { title, description, alternates: { canonical: absoluteUrl(scoped ? `/demographics?state=${code!.toLowerCase()}` : '/demographics') }, openGraph: { title, description } };
}

export default async function DemographicsIndex({ searchParams }: Props) {
  const { state, page: pageParam } = await searchParams;
  const code = state?.toUpperCase();
  const scoped = code && US_STATES[code] ? code : null;
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
  const where = scoped ? { state: scoped } : {};

  const [total, byState, rows] = await Promise.all([
    prisma.censusDemographic.count({ where }),
    prisma.censusDemographic.groupBy({ by: ['state'], where: { state: { not: null } }, _count: { _all: true }, orderBy: { _count: { state: 'desc' } } }),
    prisma.censusDemographic.findMany({
      where,
      select: { slug: true, zip: true, city: true, state: true, population: true, medianIncome: true },
      orderBy: [{ population: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);

  if (total === 0) {
    return (
      <Page>
        <PageHeader title={config.title} />
        <EmptyState dataset="demographics" />
      </Page>
    );
  }

  const title = scoped ? `Cost of Living by ZIP Code in ${stateName(scoped)}` : config.title;
  const basePath = scoped ? `/demographics?state=${scoped.toLowerCase()}` : '/demographics';

  return (
    <Page>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: absoluteUrl('/demographics'), numberOfItems: total }} />
      <Breadcrumbs items={scoped ? [{ label: 'Demographics', href: '/demographics' }, { label: stateName(scoped) }] : [{ label: 'Demographics' }]} />
      <PageHeader eyebrow={config.source} title={title}
        subtitle={`${formatNumber(total)} ZIP code tabulation areas with population, income, rent and home value estimates.`} />

      {!scoped ? (
        <GroupLinks title="Browse by state" items={byState.filter((s) => s.state && US_STATES[s.state]).map((s) => ({
          href: `/demographics?state=${s.state!.toLowerCase()}`, label: stateName(s.state), count: s._count._all,
        }))} />
      ) : null}

      <h2 className="text-xl font-bold text-slate-900 mb-4">ZIP codes by population</h2>
      <DirectoryTable basePath="/demographics" headers={['ZIP', 'Population', 'Median Income']}
        rows={rows.map((r) => ({
          slug: r.slug,
          primary: r.city ? `${r.zip} — ${r.city}, ${r.state}` : r.zip,
          secondary: formatNumber(r.population),
          tertiary: r.medianIncome ? `$${r.medianIncome.toLocaleString('en-US')}` : null,
        }))} />
      <Pagination basePath={basePath} page={page} totalPages={Math.min(Math.ceil(total / PER_PAGE), 200)} />
    </Page>
  );
}
