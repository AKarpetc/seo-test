import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { DATASETS } from '@/lib/datasets';
import { absoluteUrl, formatNumber } from '@/lib/site';
import { Page, Breadcrumbs, PageHeader, EmptyState, JsonLd } from '@/components/Layout';
import { DirectoryTable } from '@/components/Directory';
import { Pagination } from '@/components/Pagination';

export const revalidate = 86400;

const PER_PAGE = 60;
const config = DATASETS.nutrition;
const title = `${config.title} — Calories, Protein & Macros`;

export const metadata: Metadata = {
  title,
  description: config.description,
  alternates: { canonical: absoluteUrl('/nutrition') },
  openGraph: { title, description: config.description },
};

export default async function NutritionIndex({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);

  const [total, rows] = await Promise.all([
    prisma.foodNutrition.count(),
    prisma.foodNutrition.findMany({
      select: { slug: true, foodName: true, brandOwner: true, calories: true, protein: true },
      orderBy: [{ foodName: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);

  if (total === 0) {
    return (
      <Page>
        <PageHeader title={config.title} />
        <EmptyState dataset="nutrition" />
      </Page>
    );
  }

  return (
    <Page>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: absoluteUrl('/nutrition'), numberOfItems: total }} />
      <Breadcrumbs items={[{ label: 'Nutrition' }]} />
      <PageHeader eyebrow={config.source} title={config.title}
        subtitle={`${formatNumber(total)} foods with per-100g calorie, macronutrient and mineral values.`} />

      <DirectoryTable basePath="/nutrition" headers={['Food', 'Brand', 'Calories / 100g']}
        rows={rows.map((f) => ({
          slug: f.slug, primary: f.foodName, secondary: f.brandOwner,
          tertiary: f.calories !== null ? `${Math.round(f.calories)} kcal` : null,
        }))} />
      <Pagination basePath="/nutrition" page={page} totalPages={Math.min(Math.ceil(total / PER_PAGE), 200)} />
    </Page>
  );
}
