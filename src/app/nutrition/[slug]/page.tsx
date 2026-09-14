import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl } from '@/lib/site';
import { Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd } from '@/components/Layout';

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

const get = (slug: string) => prisma.foodNutrition.findUnique({ where: { slug } });

const n = (v: number | null, unit: string) => (v === null ? '—' : `${Math.round(v * 10) / 10} ${unit}`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const f = await get(slug);
  if (!f) return { title: 'Food not found' };

  const title = `${f.foodName} Nutrition Facts — Calories, Protein & Carbs`;
  const description = `${f.foodName}${f.brandOwner ? ` by ${f.brandOwner}` : ''}: ${f.calories !== null ? `${Math.round(f.calories)} calories` : 'nutrition facts'} per 100g, with protein, fat, carbohydrate, fiber and mineral content from USDA FoodData Central.`;
  return { title, description, alternates: { canonical: absoluteUrl(`/nutrition/${slug}`) }, openGraph: { title, description } };
}

export default async function FoodPage({ params }: Props) {
  const { slug } = await params;
  const f = await get(slug);
  if (!f) notFound();

  const similar = f.category
    ? await prisma.foodNutrition.findMany({
        where: { category: f.category, NOT: { id: f.id } },
        select: { slug: true, foodName: true, calories: true },
        take: 10,
      })
    : [];

  return (
    <Page>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'NutritionInformation',
        name: f.foodName,
        calories: f.calories !== null ? `${Math.round(f.calories)} cal` : undefined,
        proteinContent: f.protein !== null ? `${f.protein} g` : undefined,
        fatContent: f.fat !== null ? `${f.fat} g` : undefined,
        carbohydrateContent: f.carbs !== null ? `${f.carbs} g` : undefined,
        fiberContent: f.fiber !== null ? `${f.fiber} g` : undefined,
        sodiumContent: f.sodium !== null ? `${f.sodium} mg` : undefined,
        servingSize: '100 g',
      }} />
      <Breadcrumbs items={[{ label: 'Nutrition', href: '/nutrition' }, { label: f.foodName }]} />
      <PageHeader eyebrow={f.brandOwner || f.category || 'USDA FoodData Central'}
        title={`${f.foodName} — Nutrition Facts`}
        subtitle="All values are per 100 grams unless a serving size is listed." />

      <Card className="p-6 sm:p-8">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Calories" value={n(f.calories, 'kcal')} hint="per 100 g" />
          <Stat label="Protein" value={n(f.protein, 'g')} />
          <Stat label="Total Fat" value={n(f.fat, 'g')} />
          <Stat label="Carbohydrate" value={n(f.carbs, 'g')} />
          <Stat label="Fiber" value={n(f.fiber, 'g')} />
          <Stat label="Sugars" value={n(f.sugar, 'g')} />
          <Stat label="Sodium" value={n(f.sodium, 'mg')} />
          <Stat label="Potassium" value={n(f.potassium, 'mg')} />
          <Stat label="Calcium" value={n(f.calcium, 'mg')} />
          <Stat label="Iron" value={n(f.iron, 'mg')} />
          {f.servingSize ? <Stat label="Serving Size" value={`${f.servingSize} ${f.servingUnit ?? ''}`} /> : null}
          <Stat label="FDC ID" value={<span className="font-mono text-sm">{f.fdcId}</span>} />
        </dl>

        <div className="mt-8 prose prose-slate max-w-none text-slate-600">
          <h2 className="text-lg font-bold text-slate-900">How to read these numbers</h2>
          <p>
            <strong>{f.foodName}</strong> provides{' '}
            {f.calories !== null ? `${Math.round(f.calories)} calories` : 'an unreported calorie count'} per
            100 grams{f.protein !== null ? `, of which ${Math.round(f.protein)} grams is protein` : ''}.
            USDA measures on a per-100-gram basis so foods can be compared directly regardless of package size.
          </p>
        </div>
      </Card>

      {similar.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Compare with similar foods</h2>
          <Card className="divide-y divide-slate-200">
            {similar.map((s) => (
              <Link key={s.slug} href={`/nutrition/${s.slug}`} className="flex justify-between px-6 py-3 hover:bg-slate-50">
                <span className="text-blue-600">{s.foodName}</span>
                <span className="text-slate-500 text-sm">{s.calories !== null ? `${Math.round(s.calories)} kcal` : '—'}</span>
              </Link>
            ))}
          </Card>
        </section>
      ) : null}
    </Page>
  );
}
