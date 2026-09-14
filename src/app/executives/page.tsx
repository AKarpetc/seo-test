import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { DATASETS } from '@/lib/datasets';
import { absoluteUrl, formatMoney, formatNumber } from '@/lib/site';
import { Page, Breadcrumbs, PageHeader, EmptyState, JsonLd } from '@/components/Layout';
import { DirectoryTable } from '@/components/Directory';
import { Pagination } from '@/components/Pagination';

export const revalidate = 86400;

const PER_PAGE = 60;
const config = DATASETS.executives;
const title = `${config.title} — Tickers, CIK Numbers & Revenue`;

export const metadata: Metadata = {
  title,
  description: config.description,
  alternates: { canonical: absoluteUrl('/executives') },
  openGraph: { title, description: config.description },
};

export default async function ExecutivesIndex({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);

  const [total, rows] = await Promise.all([
    prisma.sECExecutive.count(),
    prisma.sECExecutive.findMany({
      select: { slug: true, ticker: true, companyName: true, industry: true, revenue: true },
      orderBy: [{ ticker: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);

  if (total === 0) {
    return (
      <Page>
        <PageHeader title={config.title} />
        <EmptyState dataset="executives" />
      </Page>
    );
  }

  return (
    <Page>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: absoluteUrl('/executives'), numberOfItems: total }} />
      <Breadcrumbs items={[{ label: 'Companies' }]} />
      <PageHeader eyebrow={config.source} title={config.title}
        subtitle={`${formatNumber(total)} SEC registrants with ticker symbols, CIK numbers and reported annual financials.`} />

      <DirectoryTable basePath="/executives" headers={['Company', 'Industry', 'Revenue']}
        rows={rows.map((c) => ({
          slug: c.slug, primary: `${c.ticker} — ${c.companyName}`,
          secondary: c.industry, tertiary: c.revenue ? formatMoney(c.revenue) : null,
        }))} />
      <Pagination basePath="/executives" page={page} totalPages={Math.min(Math.ceil(total / PER_PAGE), 200)} />
    </Page>
  );
}
