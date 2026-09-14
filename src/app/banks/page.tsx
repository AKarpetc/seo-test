import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { DATASETS } from '@/lib/datasets';
import { absoluteUrl, formatNumber, stateName, US_STATES } from '@/lib/site';
import { Page, Breadcrumbs, PageHeader, EmptyState, JsonLd } from '@/components/Layout';
import { DirectoryTable, GroupLinks } from '@/components/Directory';
import { Pagination } from '@/components/Pagination';

export const revalidate = 86400;

const PER_PAGE = 60;
const config = DATASETS.banks;

type Props = { searchParams: Promise<{ state?: string; page?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { state } = await searchParams;
  const code = state?.toUpperCase();
  const scoped = code && US_STATES[code];

  const title = scoped
    ? `Bank Branches in ${stateName(code)} — FDIC Insured Offices`
    : `${config.title} — Branch Lookup by City & State`;
  const description = scoped
    ? `Every FDIC insured bank branch in ${stateName(code)}, with address, county and establishment date.`
    : config.description;

  return {
    title,
    description,
    // Filtered views collapse onto the unfiltered directory to avoid duplicate listings.
    alternates: { canonical: absoluteUrl(scoped ? `/banks?state=${code!.toLowerCase()}` : '/banks') },
    openGraph: { title, description },
  };
}

export default async function BanksIndex({ searchParams }: Props) {
  const { state, page: pageParam } = await searchParams;
  const code = state?.toUpperCase();
  const scoped = code && US_STATES[code] ? code : null;
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
  const where = scoped ? { state: scoped } : {};

  const [total, byState, rows] = await Promise.all([
    prisma.bankBranch.count({ where }),
    prisma.bankBranch.groupBy({ by: ['state'], _count: { _all: true }, orderBy: { _count: { state: 'desc' } } }),
    prisma.bankBranch.findMany({
      where,
      select: { slug: true, bankName: true, city: true, state: true, county: true },
      orderBy: [{ bankName: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);

  if (total === 0) {
    return (
      <Page>
        <PageHeader title={config.title} />
        <EmptyState dataset="banks" />
      </Page>
    );
  }

  const title = scoped ? `Bank Branches in ${stateName(scoped)}` : config.title;
  const totalPages = Math.ceil(total / PER_PAGE);
  const basePath = scoped ? `/banks?state=${scoped.toLowerCase()}` : '/banks';

  return (
    <Page>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: absoluteUrl('/banks'), numberOfItems: total }} />
      <Breadcrumbs items={scoped ? [{ label: 'Banks', href: '/banks' }, { label: stateName(scoped) }] : [{ label: 'Banks' }]} />
      <PageHeader
        eyebrow={config.source}
        title={title}
        subtitle={`${formatNumber(total)} FDIC insured branch offices${scoped ? ` in ${stateName(scoped)}` : ` across ${byState.length} states and territories`}.`}
      />

      {!scoped ? (
        <GroupLinks
          title="Browse by state"
          items={byState
            .filter((s) => s.state && US_STATES[s.state])
            .map((s) => ({ href: `/banks?state=${s.state!.toLowerCase()}`, label: stateName(s.state), count: s._count._all }))}
        />
      ) : null}

      <h2 className="text-xl font-bold text-slate-900 mb-4">Branch offices</h2>
      <DirectoryTable
        basePath="/banks"
        headers={['Institution', 'City', 'County']}
        rows={rows.map((b) => ({
          slug: b.slug,
          primary: b.bankName,
          secondary: b.city ? `${b.city}, ${b.state}` : null,
          tertiary: b.county,
        }))}
      />
      <Pagination basePath={basePath} page={page} totalPages={Math.min(totalPages, 200)} />
    </Page>
  );
}
