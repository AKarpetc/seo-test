import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, stateName } from '@/lib/site';
import { Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd } from '@/components/Layout';

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

const get = (slug: string) => prisma.climateData.findUnique({ where: { slug } });
const f = (v: number | null, unit: string) => (v === null ? '—' : `${Math.round(v * 10) / 10}${unit}`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await get(slug);
  if (!c) return { title: 'Station not found' };

  const place = `${c.city ?? c.stationName}, ${c.state}`;
  const title = `${place} Frost Dates & Climate Normals — Growing Season`;
  const description = `Average first and last frost dates for ${place}: ${c.lastFrostDate ?? 'spring'} to ${c.firstFrostDate ?? 'fall'}. Thirty-year NOAA climate normals and growing season length.`;
  return { title, description, alternates: { canonical: absoluteUrl(`/climate/${slug}`) }, openGraph: { title, description } };
}

export default async function ClimatePage({ params }: Props) {
  const { slug } = await params;
  const c = await get(slug);
  if (!c) notFound();

  const nearby = c.state
    ? await prisma.climateData.findMany({
        where: { state: c.state, NOT: { id: c.id } },
        select: { slug: true, city: true, growingDays: true },
        take: 12,
      })
    : [];

  const place = `${c.city ?? c.stationName}, ${c.state}`;

  return (
    <Page>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'Place', name: place,
        ...(c.lat && c.lng ? { geo: { '@type': 'GeoCoordinates', latitude: c.lat, longitude: c.lng } } : {}),
        url: absoluteUrl(`/climate/${slug}`),
      }} />
      <Breadcrumbs items={[{ label: 'Climate', href: '/climate' }, { label: place }]} />
      <PageHeader eyebrow="NOAA 1991–2020 Normals" title={`Frost Dates & Climate for ${place}`}
        subtitle={`Measured at ${c.stationName}${c.elevation !== null ? `, elevation ${Math.round(c.elevation)} m` : ''}.`} />

      <Card className="p-6 sm:p-8">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Last Spring Frost" value={c.lastFrostDate || '—'} hint="50% probability" />
          <Stat label="First Fall Frost" value={c.firstFrostDate || '—'} hint="50% probability" />
          <Stat label="Growing Season" value={c.growingDays ? `${c.growingDays} days` : '—'} />
          <Stat label="Annual Avg Temp" value={f(c.avgTemp, '°F')} />
          <Stat label="Winter Avg" value={f(c.avgTempJan, '°F')} hint="Dec–Feb" />
          <Stat label="Summer Avg" value={f(c.avgTempJul, '°F')} hint="Jun–Aug" />
          <Stat label="Summer High" value={f(c.avgHighJul, '°F')} />
          <Stat label="Annual Rainfall" value={f(c.annualRainfall, '″')} />
          <Stat label="Annual Snowfall" value={f(c.annualSnowfall, '″')} />
          <Stat label="Winter Low" value={f(c.avgLowJan, '°F')} />
          <Stat label="Station ID" value={<span className="font-mono text-sm">{c.stationId}</span>} />
        </dl>

        <div className="mt-8 prose prose-slate max-w-none text-slate-600">
          <h2 className="text-lg font-bold text-slate-900">Planning a garden in {c.city ?? c.stationName}</h2>
          <p>
            {c.lastFrostDate && c.firstFrostDate ? (
              <>
                Tender crops should go in the ground after <strong>{c.lastFrostDate}</strong>, the date by
                which half of years are frost-free, and be harvested before <strong>{c.firstFrostDate}</strong>.
                That leaves roughly {c.growingDays ?? '—'} frost-free days.
              </>
            ) : (
              <>This station does not publish frost probability normals; use the temperature normals above as a guide.</>
            )}
            {' '}These are thirty-year averages from NOAA covering 1991–2020, not a forecast — any individual
            year can frost two to three weeks either side of these dates.
          </p>
        </div>
      </Card>

      {nearby.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Other {stateName(c.state)} weather stations</h2>
          <Card className="p-6">
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-y-2 gap-x-4">
              {nearby.map((o) => (
                <li key={o.slug}>
                  <Link href={`/climate/${o.slug}`} className="text-blue-600 hover:underline">{o.city}</Link>
                  {o.growingDays ? <span className="text-slate-400 text-xs ml-1">({o.growingDays} days)</span> : null}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </Page>
  );
}
