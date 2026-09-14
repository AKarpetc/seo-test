import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { DATASETS } from '@/lib/datasets';
import { absoluteUrl, formatNumber, stateName } from '@/lib/site';
import { Page, Breadcrumbs, PageHeader, EmptyState, JsonLd } from '@/components/Layout';
import { DirectoryTable } from '@/components/Directory';

export const revalidate = 86400;

const config = DATASETS.energy;
const title = `${config.title} — Cost per kWh and Typical Monthly Bill`;

export const metadata: Metadata = {
  title,
  description: config.description,
  alternates: { canonical: absoluteUrl('/energy') },
  openGraph: { title, description: config.description },
};

export default async function EnergyIndex() {
  const rows = await prisma.utilityRate.findMany({
    select: { slug: true, state: true, avgKwhRate: true, avgMonthlyBill: true, avgMonthlyKwh: true },
    orderBy: { avgKwhRate: 'asc' },
  });

  if (rows.length === 0) {
    return (
      <Page>
        <PageHeader title={config.title} />
        <EmptyState dataset="energy" />
      </Page>
    );
  }

  return (
    <Page>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: absoluteUrl('/energy'), numberOfItems: rows.length }} />
      <Breadcrumbs items={[{ label: 'Electricity' }]} />
      <PageHeader eyebrow={config.source} title={config.title}
        subtitle={`All ${rows.length} states ranked from cheapest to most expensive residential electricity, with typical usage and monthly bill.`} />

      <DirectoryTable basePath="/energy" headers={['State', 'Rate per kWh', 'Typical Monthly Bill']}
        rows={rows.map((r) => ({
          slug: r.slug,
          primary: stateName(r.state),
          secondary: `${r.avgKwhRate}¢`,
          tertiary: r.avgMonthlyBill ? `$${r.avgMonthlyBill} (${formatNumber(r.avgMonthlyKwh)} kWh)` : null,
        }))} />
    </Page>
  );
}
