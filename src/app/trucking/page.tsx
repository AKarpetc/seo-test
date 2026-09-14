import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { DATASETS } from '@/lib/datasets';
import { absoluteUrl, formatNumber, stateName, US_STATES } from '@/lib/site';
import { Page, Breadcrumbs, PageHeader, EmptyState, JsonLd } from '@/components/Layout';
import { DirectoryTable, GroupLinks } from '@/components/Directory';
import { Pagination } from '@/components/Pagination';

export const revalidate = 86400;

const PER_PAGE = 60;
const config = DATASETS.trucking;

type Props = { searchParams: Promise<{ state?: string; page?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { state } = await searchParams;
  const code = state?.toUpperCase();
  const scoped = code && US_STATES[code];
  const title = scoped
    ? `Trucking Companies in ${stateName(code)} — USDOT Carrier Lookup`
    : `${config.title} — Fleet Size & Carrier Search`;
  const description = scoped
    ? `Active motor carriers based in ${stateName(code)} with USDOT numbers, fleet size and driver counts from the FMCSA census.`
    : config.description;
  return { title, description, alternates: { canonical: absoluteUrl(scoped ? `/trucking?state=${code!.toLowerCase()}` : '/trucking') }, openGraph: { title, description } };
}

export default async function TruckingIndex({ searchParams }: Props) {
  const { state, page: pageParam } = await searchParams;
  const code = state?.toUpperCase();
  const scoped = code && US_STATES[code] ? code : null;
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
  const where = scoped ? { state: scoped } : {};

  const [total, summaries, rows] = await Promise.all([
    prisma.dOTCarrier.count({ where }),
    prisma.carrierStateSummary.findMany({ orderBy: { carrierCount: 'desc' } }),
    prisma.dOTCarrier.findMany({
      where,
      select: { slug: true, companyName: true, city: true, state: true, fleetSize: true },
      orderBy: [{ fleetSize: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);

  if (total === 0) {
    return (
      <Page>
        <PageHeader title={config.title} />
        <EmptyState dataset="trucking" />
      </Page>
    );
  }

  const title = scoped ? `Trucking Companies in ${stateName(scoped)}` : config.title;
  const basePath = scoped ? `/trucking?state=${scoped.toLowerCase()}` : '/trucking';

  return (
    <Page>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: absoluteUrl('/trucking'), numberOfItems: total }} />
      <Breadcrumbs items={scoped ? [{ label: 'Carriers', href: '/trucking' }, { label: stateName(scoped) }] : [{ label: 'Carriers' }]} />
      <PageHeader eyebrow={config.source} title={title}
        subtitle={`${formatNumber(total)} active motor carriers${scoped ? ` based in ${stateName(scoped)}` : ''}, ranked by fleet size.`} />

      {!scoped ? (
        <GroupLinks title="Browse by state" items={summaries.filter((s) => US_STATES[s.state]).map((s) => ({
          href: `/trucking?state=${s.state.toLowerCase()}`, label: stateName(s.state), count: s.carrierCount,
        }))} />
      ) : null}

      <h2 className="text-xl font-bold text-slate-900 mb-4">Carriers by fleet size</h2>
      <DirectoryTable basePath="/trucking" headers={['Carrier', 'Location', 'Power Units']}
        rows={rows.map((c) => ({
          slug: c.slug, primary: c.companyName,
          secondary: c.city ? `${c.city}, ${c.state}` : null,
          tertiary: formatNumber(c.fleetSize),
        }))} />
      <Pagination basePath={basePath} page={page} totalPages={Math.min(Math.ceil(total / PER_PAGE), 200)} />
    </Page>
  );
}
