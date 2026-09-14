import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, formatNumber, stateName } from '@/lib/site';
import { Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd } from '@/components/Layout';

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

const get = (slug: string) => prisma.utilityRate.findUnique({ where: { slug } });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const u = await get(slug);
  if (!u) return { title: 'Not found' };

  const name = stateName(u.state);
  const title = `Average Electricity Rates in ${name} — ${u.avgKwhRate}¢/kWh & Typical Bill`;
  const description = `${name} residential electricity averages ${u.avgKwhRate}¢ per kWh. Typical household uses ${formatNumber(u.avgMonthlyKwh)} kWh for about $${u.avgMonthlyBill} a month. Commercial rate ${u.commercialRate}¢. EIA data.`;
  return { title, description, alternates: { canonical: absoluteUrl(`/energy/${slug}`) }, openGraph: { title, description } };
}

export default async function EnergyPage({ params }: Props) {
  const { slug } = await params;
  const u = await get(slug);
  if (!u) notFound();

  const [ranked, cheapest] = await Promise.all([
    prisma.utilityRate.count({ where: { avgKwhRate: { lt: u.avgKwhRate ?? 0 } } }),
    prisma.utilityRate.findMany({
      where: { NOT: { id: u.id } },
      select: { slug: true, state: true, avgKwhRate: true },
      orderBy: { avgKwhRate: 'asc' },
      take: 10,
    }),
  ]);

  const name = stateName(u.state);
  const rank = ranked + 1;

  return (
    <Page>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Dataset', name: `Electricity rates in ${name}`, url: absoluteUrl(`/energy/${slug}`), creator: { '@type': 'Organization', name: 'US Energy Information Administration' } }} />
      <Breadcrumbs items={[{ label: 'Electricity', href: '/energy' }, { label: name }]} />
      <PageHeader eyebrow="EIA Retail Sales" title={`Average Electricity Rates in ${name}`}
        subtitle={`${name} ranks ${rank} of 51 from cheapest to most expensive residential electricity.`} />

      <Card className="p-6 sm:p-8">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Residential Rate" value={`${u.avgKwhRate}¢`} hint="per kWh" />
          <Stat label="Commercial Rate" value={u.commercialRate ? `${u.commercialRate}¢` : '—'} hint="per kWh" />
          <Stat label="Typical Monthly Use" value={`${formatNumber(u.avgMonthlyKwh)} kWh`} />
          <Stat label="Typical Monthly Bill" value={u.avgMonthlyBill ? `$${u.avgMonthlyBill}` : '—'} />
          <Stat label="Residential Customers" value={formatNumber(u.customers)} />
          <Stat label="National Rank" value={`${rank} of 51`} hint="1 = cheapest" />
        </dl>

        <div className="mt-8 prose prose-slate max-w-none text-slate-600">
          <h2 className="text-lg font-bold text-slate-900">What drives the bill in {name}</h2>
          <p>
            The bill is the rate multiplied by how much you use, and the two move independently.
            {name} households average <strong>{formatNumber(u.avgMonthlyKwh)} kWh</strong> a month at{' '}
            <strong>{u.avgKwhRate}¢</strong> per kWh, which works out to about{' '}
            <strong>${u.avgMonthlyBill}</strong>. A state with a high rate but mild weather often
            ends up cheaper overall than a low-rate state that runs air conditioning half the year.
          </p>
          <p>
            These are statewide averages published by the US Energy Information Administration.
            Individual utilities set their own tariffs, so your rate will differ from the state figure.
          </p>
        </div>
      </Card>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Cheapest states for electricity</h2>
        <Card className="p-6">
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-2 gap-x-4">
            {cheapest.map((c) => (
              <li key={c.slug}>
                <Link href={`/energy/${c.slug}`} className="text-blue-600 hover:underline">
                  {stateName(c.state)}
                </Link>
                <span className="text-slate-400 text-xs ml-1">({c.avgKwhRate}¢)</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </Page>
  );
}
