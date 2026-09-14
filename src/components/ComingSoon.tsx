import type { Metadata } from 'next';
import { Page, Card, Breadcrumbs, PageHeader } from '@/components/Layout';
import type { DatasetConfig } from '@/lib/datasets';

/**
 * A dataset whose upstream feed is not yet wired up must not be indexed: an empty
 * directory is thin content and drags down the rest of the site.
 */
export function pendingMetadata(config: DatasetConfig): Metadata {
  return {
    title: `${config.title} — Coming Soon`,
    description: config.description,
    robots: { index: false, follow: true },
  };
}

export function ComingSoon({ config }: { config: DatasetConfig }) {
  return (
    <Page>
      <Breadcrumbs items={[{ label: config.name }]} />
      <PageHeader eyebrow={config.source} title={config.title} subtitle={config.description} />
      <Card className="p-8">
        <h2 className="text-lg font-bold text-slate-900 mb-2">This directory is not live yet</h2>
        <p className="text-slate-600">
          {config.blockedReason ?? 'The upstream dataset has not been ingested yet.'}
        </p>
        <p className="text-slate-600 mt-3">
          Source:{' '}
          <a href={config.sourceUrl} rel="nofollow noopener" target="_blank" className="text-blue-600 hover:underline">
            {config.sourceUrl}
          </a>
        </p>
      </Card>
    </Page>
  );
}
