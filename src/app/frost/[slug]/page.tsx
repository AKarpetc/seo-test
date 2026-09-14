import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, formatNumber, stateName } from '@/lib/site';
import { Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd } from '@/components/Layout';

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

async function getZip(slug: string) {
  const zip = await prisma.zipClimate.findUnique({ where: { slug } });
  if (!zip?.stationId) return zip ? { zip, station: null } : null;
  const station = await prisma.climateData.findUnique({ where: { stationId: zip.stationId } });
  return { zip, station };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getZip(slug);
  if (!data) return { title: 'ZIP code not found' };

  const { zip, station } = data;
  const place = zip.city ? `${zip.city}, ${zip.state}` : `ZIP ${zip.zip}`;
  const title = `Frost Dates for ${zip.zip} (${place}) — Zone ${zip.zone ?? ''} Planting Calendar`.replace(' ()', '');
  const description = station?.lastFrostDate
    ? `Last spring frost in ${place} is around ${station.lastFrostDate}, first fall frost around ${station.firstFrostDate}. USDA hardiness zone ${zip.zone}. When to plant in ZIP ${zip.zip}.`
    : `USDA hardiness zone ${zip.zone} for ZIP ${zip.zip} (${place}), with the nearest NOAA station's climate normals.`;

  return { title, description, alternates: { canonical: absoluteUrl(`/frost/${slug}`) }, openGraph: { title, description } };
}

export default async function ZipFrostPage({ params }: Props) {
  const { slug } = await params;
  const data = await getZip(slug);
  if (!data) notFound();

  const { zip, station } = data;
  const place = zip.city ? `${zip.city}, ${stateName(zip.state)}` : `ZIP ${zip.zip}`;

  const nearby = zip.state
    ? await prisma.zipClimate.findMany({
        where: { state: zip.state, zone: zip.zone, NOT: { id: zip.id } },
        select: { slug: true, zip: true, city: true },
        orderBy: { population: 'desc' },
        take: 12,
      })
    : [];

  return (
    <Page>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'Place',
        name: `${place} (${zip.zip})`,
        address: { '@type': 'PostalAddress', postalCode: zip.zip, addressLocality: zip.city || undefined, addressRegion: zip.state || undefined, addressCountry: 'US' },
        ...(zip.lat && zip.lng ? { geo: { '@type': 'GeoCoordinates', latitude: zip.lat, longitude: zip.lng } } : {}),
        url: absoluteUrl(`/frost/${slug}`),
      }} />
      <Breadcrumbs items={[
        { label: 'Frost Dates', href: '/frost' },
        ...(zip.zone ? [{ label: `Zone ${zip.zone}`, href: `/frost/zone/${zip.zone}` }] : []),
        { label: zip.zip },
      ]} />
      <PageHeader
        eyebrow={zip.zone ? `USDA Hardiness Zone ${zip.zone}` : 'NOAA Climate Normals'}
        title={`Frost Dates for ${zip.zip} — ${place}`}
        subtitle={station ? `Based on ${station.stationName}, the nearest reporting station (${zip.stationMiles} miles away).` : undefined}
      />

      <Card className="p-6 sm:p-8">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Last Spring Frost" value={station?.lastFrostDate || '—'} hint="50% probability" />
          <Stat label="First Fall Frost" value={station?.firstFrostDate || '—'} hint="50% probability" />
          <Stat label="Growing Season" value={station?.growingDays ? `${station.growingDays} days` : '—'} />
          <Stat label="Hardiness Zone" value={zip.zone || '—'} hint={zip.zoneTempRange ? `${zip.zoneTempRange}°F annual low` : undefined} />
        </dl>

        <div className="mt-8 prose prose-slate max-w-none text-slate-600">
          <h2 className="text-lg font-bold text-slate-900">When to plant in {zip.zip}</h2>
          {station?.lastFrostDate && station.firstFrostDate ? (
            <p>
              Wait until after <strong>{station.lastFrostDate}</strong> to put tender plants — tomatoes,
              peppers, basil, squash — in the ground. That is the date by which half of years in{' '}
              {place} are past their last freeze. Harvest before <strong>{station.firstFrostDate}</strong>,
              which leaves roughly <strong>{station.growingDays ?? '—'} frost-free days</strong>.
            </p>
          ) : (
            <p>
              The nearest reporting station does not publish frost probability normals. Use the
              hardiness zone below as a rough guide, or check a neighbouring ZIP code.
            </p>
          )}
          {zip.zone ? (
            <p>
              ZIP {zip.zip} sits in <strong>USDA hardiness zone {zip.zone}</strong>
              {zip.zoneTempRange ? `, meaning the average coldest night of the year falls between ${zip.zoneTempRange}°F` : ''}.
              Zone decides what survives the winter; frost dates decide when to plant each spring.
              They are different questions and a plant can pass one and fail the other.
            </p>
          ) : null}
          <p className="text-sm">
            These are thirty-year NOAA averages for 1991–2020, not a forecast. Any individual year
            can frost two to three weeks either side of these dates, so watch the actual forecast
            before planting out.
          </p>
        </div>
      </Card>

      {nearby.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Other zone {zip.zone} ZIP codes in {stateName(zip.state)}
          </h2>
          <Card className="p-6">
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-y-2 gap-x-4">
              {nearby.map((n) => (
                <li key={n.slug}>
                  <Link href={`/frost/${n.slug}`} className="text-blue-600 hover:underline">
                    {n.zip}
                  </Link>
                  {n.city ? <span className="text-slate-400 text-xs ml-1">{n.city}</span> : null}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </Page>
  );
}
