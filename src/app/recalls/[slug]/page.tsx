import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl } from '@/lib/site';
import { Page, Card, Breadcrumbs, PageHeader, JsonLd } from '@/components/Layout';

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

const get = (slug: string) =>
  prisma.vehicle.findUnique({
    where: { slug },
    include: { recalls: { orderBy: { reportDate: 'desc' } } },
  });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const v = await get(slug);
  if (!v) return { title: 'Vehicle not found' };

  const name = `${v.modelYear} ${v.make} ${v.model}`;
  const title = `${name} Recalls — ${v.recallCount} Safety Recall${v.recallCount === 1 ? '' : 's'} | NHTSA`;
  const description = `${v.recallCount} open NHTSA safety recall${v.recallCount === 1 ? '' : 's'} for the ${name}. What the defect is, what can go wrong, and the free repair the manufacturer must provide.`;
  return { title, description, alternates: { canonical: absoluteUrl(`/recalls/${slug}`) }, openGraph: { title, description } };
}

export default async function RecallPage({ params }: Props) {
  const { slug } = await params;
  const v = await get(slug);
  if (!v) notFound();

  const [otherYears, sameMake] = await Promise.all([
    prisma.vehicle.findMany({
      where: { make: v.make, model: v.model, NOT: { id: v.id } },
      select: { slug: true, modelYear: true, recallCount: true },
      orderBy: { modelYear: 'desc' },
      take: 20,
    }),
    prisma.vehicle.findMany({
      where: { make: v.make, modelYear: v.modelYear, NOT: { id: v.id } },
      select: { slug: true, model: true, recallCount: true },
      orderBy: { recallCount: 'desc' },
      take: 12,
    }),
  ]);

  const name = `${v.modelYear} ${v.make} ${v.model}`;

  return (
    <Page>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'Car', name,
        manufacturer: { '@type': 'Organization', name: v.make },
        model: v.model, vehicleModelDate: String(v.modelYear),
        url: absoluteUrl(`/recalls/${slug}`),
      }} />
      <Breadcrumbs items={[{ label: 'Recalls', href: '/recalls' }, { label: name }]} />
      <PageHeader
        eyebrow="NHTSA Safety Recalls"
        title={`${name} Recalls`}
        subtitle={`${v.recallCount} recall${v.recallCount === 1 ? '' : 's'} on file. Recall repairs are free — a dealer cannot charge you for them, regardless of the car's age or mileage.`}
      />

      <div className="space-y-5">
        {v.recalls.map((r) => (
          <Card key={r.id} className="p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
              <h2 className="text-lg font-bold text-slate-900">{r.component || 'Safety recall'}</h2>
              <span className="text-xs font-mono text-slate-500">NHTSA {r.campaignNumber}</span>
            </div>
            {r.summary ? (
              <div className="mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">The defect</h3>
                <p className="text-slate-700 text-sm leading-relaxed">{r.summary}</p>
              </div>
            ) : null}
            {r.consequence ? (
              <div className="mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">The risk</h3>
                <p className="text-slate-700 text-sm leading-relaxed">{r.consequence}</p>
              </div>
            ) : null}
            {r.remedy ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">The fix</h3>
                <p className="text-slate-700 text-sm leading-relaxed">{r.remedy}</p>
              </div>
            ) : null}
            {r.reportDate ? (
              <p className="mt-3 text-xs text-slate-400">
                Reported {r.reportDate.toLocaleDateString('en-US', { dateStyle: 'long' })}
                {r.manufacturer ? ` by ${r.manufacturer}` : ''}
              </p>
            ) : null}
          </Card>
        ))}
      </div>

      <Card className="p-6 mt-8">
        <h2 className="text-lg font-bold text-slate-900 mb-2">Checking your own car</h2>
        <p className="text-slate-600 text-sm leading-relaxed">
          A recall applies to a range of VINs, not to every {name} built. To confirm whether
          yours is affected, check the VIN — the 17-character number on the driver-side dashboard
          or door jamb — on{' '}
          <a href="https://www.nhtsa.gov/recalls" rel="nofollow noopener" target="_blank" className="text-blue-600 hover:underline">
            NHTSA&apos;s official lookup
          </a>
          . Repairs are free and have no expiry for safety recalls.
        </p>
      </Card>

      {otherYears.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">{v.make} {v.model} by model year</h2>
          <Card className="p-6">
            <ul className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-y-2 gap-x-4">
              {otherYears.map((o) => (
                <li key={o.slug}>
                  <Link href={`/recalls/${o.slug}`} className="text-blue-600 hover:underline">{o.modelYear}</Link>
                  <span className="text-slate-400 text-xs ml-1">({o.recallCount})</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {sameMake.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Other {v.modelYear} {v.make} models</h2>
          <Card className="p-6">
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-y-2 gap-x-4">
              {sameMake.map((o) => (
                <li key={o.slug}>
                  <Link href={`/recalls/${o.slug}`} className="text-blue-600 hover:underline">{o.model}</Link>
                  <span className="text-slate-400 text-xs ml-1">({o.recallCount})</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </Page>
  );
}
