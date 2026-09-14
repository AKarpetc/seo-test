import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, formatMoney, formatNumber } from '@/lib/site';
import { Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd } from '@/components/Layout';

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

const get = (slug: string) => prisma.sECExecutive.findUnique({ where: { slug } });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await get(slug);
  if (!c) return { title: 'Company not found' };

  const title = `${c.companyName} (${c.ticker}) — SEC Filings, Revenue & Company Profile`;
  const description = `SEC EDGAR profile for ${c.companyName}, ticker ${c.ticker}${c.cik ? `, CIK ${c.cik}` : ''}.${c.revenue ? ` Reported annual revenue ${formatMoney(c.revenue)}.` : ''} Industry classification and filing history.`;
  return { title, description, alternates: { canonical: absoluteUrl(`/executives/${slug}`) }, openGraph: { title, description } };
}

export default async function CompanyPage({ params }: Props) {
  const { slug } = await params;
  const c = await get(slug);
  if (!c) notFound();

  const peers = c.industry
    ? await prisma.sECExecutive.findMany({
        where: { industry: c.industry, NOT: { id: c.id } },
        select: { slug: true, ticker: true, companyName: true },
        orderBy: { revenue: 'desc' },
        take: 12,
      })
    : [];

  const edgar = c.cik ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${c.cik}&type=10-K` : null;

  return (
    <Page>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'Corporation', name: c.companyName,
        tickerSymbol: c.ticker, identifier: c.cik ? { '@type': 'PropertyValue', propertyID: 'CIK', value: c.cik } : undefined,
        url: absoluteUrl(`/executives/${slug}`),
      }} />
      <Breadcrumbs items={[{ label: 'Companies', href: '/executives' }, { label: c.ticker }]} />
      <PageHeader eyebrow={c.industry || 'SEC EDGAR Registrant'} title={`${c.companyName} (${c.ticker})`}
        subtitle={c.cik ? `Central Index Key ${c.cik}` : undefined} />

      <Card className="p-6 sm:p-8">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Ticker" value={<span className="font-mono">{c.ticker}</span>} />
          <Stat label="CIK" value={<span className="font-mono">{c.cik ?? '—'}</span>} />
          <Stat label="Annual Revenue" value={formatMoney(c.revenue)} hint={c.fiscalYear ? `FY ${c.fiscalYear}` : undefined} />
          <Stat label="Net Income" value={formatMoney(c.netIncome)} hint={c.fiscalYear ? `FY ${c.fiscalYear}` : undefined} />
          <Stat label="Industry" value={c.industry || '—'} />
          <Stat label="SIC Code" value={c.sic || '—'} />
          <Stat label="Employees" value={formatNumber(c.employees)} />
          <Stat label="Fiscal Year" value={c.fiscalYear ?? '—'} />
        </dl>

        <div className="mt-8 prose prose-slate max-w-none text-slate-600">
          <h2 className="text-lg font-bold text-slate-900">Where these figures come from</h2>
          <p>
            <strong>{c.companyName}</strong> files with the SEC under ticker <strong>{c.ticker}</strong>
            {c.cik ? ` and Central Index Key ${c.cik}` : ''}. Revenue and net income above are taken from
            annual (four-quarter) XBRL facts in the SEC Financial Statement Data Sets
            {c.fiscalYear ? ` for fiscal year ${c.fiscalYear}` : ''}.
          </p>
          <p>
            Executive compensation is disclosed in the annual proxy statement (DEF 14A) as narrative
            tables rather than tagged XBRL, so it is not included in this record.
            {edgar ? <> Full filing history is available <a href={edgar} rel="nofollow noopener" target="_blank">on EDGAR</a>.</> : null}
          </p>
        </div>
      </Card>

      {peers.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Other {c.industry} companies</h2>
          <Card className="p-6">
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-6">
              {peers.map((p) => (
                <li key={p.slug}>
                  <Link href={`/executives/${p.slug}`} className="text-blue-600 hover:underline">
                    <span className="font-mono text-sm">{p.ticker}</span> — {p.companyName}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </Page>
  );
}
