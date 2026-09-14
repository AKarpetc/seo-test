import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, formatNumber, stateName } from '@/lib/site';
import { Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd } from '@/components/Layout';

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

const get = (slug: string) => prisma.censusDemographic.findUnique({ where: { slug } });

const money = (v: number | null) => (v === null ? '—' : `$${v.toLocaleString('en-US')}`);
const percent = (v: number | null) => (v === null ? '—' : `${v}%`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await get(slug);
  if (!d) return { title: 'ZIP code not found' };

  const place = d.city ? `${d.city}, ${d.state}` : `ZIP ${d.zip}`;
  const title = `${place} ${d.zip} — Cost of Living, Income & Demographics`;
  const description = `ZIP ${d.zip}${d.city ? ` (${place})` : ''}: population ${formatNumber(d.population)}, median household income ${money(d.medianIncome)}, median rent ${money(d.medianRent)}. Census ACS 5-year estimates.`;
  return { title, description, alternates: { canonical: absoluteUrl(`/demographics/${slug}`) }, openGraph: { title, description } };
}

export default async function DemographicsPage({ params }: Props) {
  const { slug } = await params;
  const d = await get(slug);
  if (!d) notFound();

  // The differentiator: the Census household figures alone do not answer
  // "what will power cost here", but combined with the state rate they do.
  const [energy, neighbours] = await Promise.all([
    d.state ? prisma.utilityRate.findUnique({ where: { utilityId: `STATE-${d.state}` } }) : null,
    d.state
      ? prisma.censusDemographic.findMany({
          where: { state: d.state, city: d.city, NOT: { id: d.id } },
          select: { slug: true, zip: true, medianIncome: true },
          take: 10,
        })
      : [],
  ]);

  const estimatedBill =
    energy?.avgKwhRate && energy.avgMonthlyKwh
      ? Math.round((energy.avgMonthlyKwh * energy.avgKwhRate) / 100)
      : null;

  const place = d.city ? `${d.city}, ${stateName(d.state)}` : `ZIP code ${d.zip}`;

  return (
    <Page>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'Place', name: `${place} (${d.zip})`,
        address: { '@type': 'PostalAddress', postalCode: d.zip, addressLocality: d.city || undefined, addressRegion: d.state || undefined, addressCountry: 'US' },
        url: absoluteUrl(`/demographics/${slug}`),
      }} />
      <Breadcrumbs items={[{ label: 'Demographics', href: '/demographics' }, { label: d.zip }]} />
      <PageHeader eyebrow={`Census ACS · ZIP ${d.zip}`} title={`Cost of Living in ${place}`}
        subtitle={`American Community Survey 5-year estimates for ZIP code tabulation area ${d.zip}.`} />

      <Card className="p-6 sm:p-8">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Population" value={formatNumber(d.population)} />
          <Stat label="Households" value={formatNumber(d.households)} />
          <Stat label="Median Household Income" value={money(d.medianIncome)} />
          <Stat label="Median Age" value={d.medianAge ?? '—'} />
          <Stat label="Median Gross Rent" value={money(d.medianRent)} hint="per month" />
          <Stat label="Median Home Value" value={money(d.homeValue)} />
          <Stat label="Owner Occupied" value={percent(d.ownerOccupied)} />
          <Stat label="Bachelor's or Higher" value={percent(d.bachelorsPct)} />
          <Stat label="Below Poverty Line" value={percent(d.povertyPct)} />
          {estimatedBill ? (
            <Stat label="Typical Electric Bill" value={`$${estimatedBill}`} hint={`${energy!.avgKwhRate}¢/kWh state average`} />
          ) : null}
        </dl>

        {estimatedBill && energy ? (
          <div className="mt-8 prose prose-slate max-w-none text-slate-600">
            <h2 className="text-lg font-bold text-slate-900">What it costs to live here</h2>
            <p>
              A household in {place} pays a median gross rent of{' '}
              <strong>{money(d.medianRent)}</strong> per month against a median household income
              of <strong>{money(d.medianIncome)}</strong>
              {d.medianRent && d.medianIncome
                ? ` — about ${Math.round(((d.medianRent * 12) / d.medianIncome) * 100)}% of gross income on rent alone`
                : ''}.
            </p>
            <p>
              Electricity adds roughly <strong>${estimatedBill}</strong> a month, based on{' '}
              {stateName(d.state)}&apos;s residential average of {energy.avgKwhRate}¢ per kWh and typical
              usage of {formatNumber(energy.avgMonthlyKwh)} kWh. That rate is a statewide figure from
              EIA, so an individual utility in {place} may bill above or below it.
            </p>
          </div>
        ) : null}
      </Card>

      {neighbours.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Other ZIP codes in {d.city}</h2>
          <Card className="p-6">
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-2 gap-x-4">
              {neighbours.map((n) => (
                <li key={n.slug}>
                  <Link href={`/demographics/${n.slug}`} className="text-blue-600 hover:underline font-mono text-sm">
                    {n.zip}
                  </Link>
                  {n.medianIncome ? <span className="text-slate-400 text-xs ml-1">({money(n.medianIncome)})</span> : null}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </Page>
  );
}
