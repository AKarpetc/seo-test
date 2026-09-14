import Link from 'next/link';
import type { Metadata } from 'next';
import { DATASETS, liveDatasets } from '@/lib/datasets';
import { absoluteUrl, formatNumber, SITE_NAME } from '@/lib/site';
import { Page, Card, PageHeader, JsonLd } from '@/components/Layout';

// The build container cannot reach the database, so these pages must not be
// prerendered; the expensive queries are cached at the data layer instead.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl('/') },
};

export default async function Home() {
  const counts = await liveDatasets();
  const datasets = counts.map(({ key, count }) => ({ config: DATASETS[key], count }));
  const live = datasets.filter((d) => d.count > 0);
  const pending = datasets.filter((d) => d.count === 0);
  const totalRecords = live.reduce((sum, d) => sum + d.count, 0);

  return (
    <Page>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: absoluteUrl('/'),
        }}
      />
      <PageHeader
        title="Public US data, made searchable"
        subtitle={`${formatNumber(totalRecords)} records compiled from federal open data sources — provider registries, bank branches, aircraft, carriers, foods and climate normals — with one page per record.`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {live.map(({ config, count }) => (
          <Link key={config.key} href={config.path} className="group block">
            <Card className="p-6 h-full transition-all hover:shadow-md hover:border-blue-400">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-600">{config.name}</h2>
                <span className="text-sm font-mono text-slate-400">{formatNumber(count)}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{config.description}</p>
              <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">{config.source}</p>
            </Card>
          </Link>
        ))}
      </div>

      {pending.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-lg font-bold text-slate-900 mb-3">In progress</h2>
          <p className="text-sm text-slate-600 mb-4">
            These directories are built but waiting on upstream access credentials.
          </p>
          <ul className="flex flex-wrap gap-2">
            {pending.map(({ config }) => (
              <li key={config.key} className="text-sm bg-white border border-slate-200 rounded-full px-3 py-1.5 text-slate-500">
                {config.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Page>
  );
}
