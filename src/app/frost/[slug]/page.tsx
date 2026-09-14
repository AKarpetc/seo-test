import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, stateName } from '@/lib/site';
import { plantingCalendar, frostSummary } from '@/lib/planting';
import {
  Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd, AnswerBox, Prose, SectionHeading,
} from '@/components/Layout';
import { ShareBar } from '@/components/Share';

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
  const calendar = plantingCalendar(station?.lastFrostDate, station?.firstFrostDate);
  const summary = frostSummary(station?.lastFrostDate, station?.firstFrostDate, station?.growingDays);
  const shareTitle = `Frost dates for ${zip.zip} — ${place}`;

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
        subtitle={station ? `Averages from ${station.stationName}, the nearest reporting station, ${zip.stationMiles} miles away.` : undefined}
      />

      {summary ? (
        <AnswerBox>
          <p>
            <strong>{summary}</strong>
          </p>
        </AnswerBox>
      ) : null}

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Last spring frost" value={station?.lastFrostDate || '—'} hint="50% probability" />
        <Stat label="First fall frost" value={station?.firstFrostDate || '—'} hint="50% probability" />
        <Stat label="Growing season" value={station?.growingDays ? `${station.growingDays} days` : '—'} hint="frost-free" />
        <Stat label="Hardiness zone" value={zip.zone || '—'} hint={zip.zoneTempRange ? `${zip.zoneTempRange}°F annual low` : undefined} />
      </dl>

      <div className="mt-6">
        <ShareBar title={shareTitle} summary={summary ?? undefined} />
      </div>

      {calendar.length > 0 ? (
        <section className="mt-10">
          <SectionHeading id="calendar">Planting calendar for {zip.zip}</SectionHeading>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <caption className="sr-only">
                  What to do and when, based on the frost normals for {place}
                </caption>
                <thead className="bg-sunk">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">When</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">What to do</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {calendar.map((task) => (
                    <tr key={task.what}>
                      <td className="whitespace-nowrap px-4 py-4 align-top font-semibold text-fg">{task.window}</td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-fg">{task.what}</p>
                        <p className="mt-0.5 text-muted">{task.why}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      ) : null}

      <section className="mt-10">
        <SectionHeading id="explanation">What these dates mean</SectionHeading>
        <Prose className="space-y-4">
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
              hardiness zone as a rough guide, or check a neighbouring ZIP code below.
            </p>
          )}
          {zip.zone ? (
            <p>
              ZIP {zip.zip} sits in <strong>USDA hardiness zone {zip.zone}</strong>
              {zip.zoneTempRange ? `, meaning the average coldest night of the year falls between ${zip.zoneTempRange}°F` : ''}.
              Zone decides what survives the winter; frost dates decide when to plant each spring.
              They are different questions, and a plant can pass one and fail the other.
            </p>
          ) : null}
          <p className="rounded-xl border border-warn/30 bg-warn-sunk p-4 text-[0.95rem]">
            These are thirty-year NOAA averages for 1991–2020, not a forecast. Any individual year
            can frost two to three weeks either side of these dates, so check the actual forecast
            before planting out.
          </p>
        </Prose>
      </section>

      {nearby.length > 0 ? (
        <section className="mt-10">
          <SectionHeading>Other zone {zip.zone} ZIP codes in {stateName(zip.state)}</SectionHeading>
          <Card className="p-5 sm:p-6">
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
              {nearby.map((n) => (
                <li key={n.slug}>
                  <Link href={`/frost/${n.slug}`} className="inline-flex min-h-11 items-center gap-2 text-accent hover:underline">
                    {n.zip}
                    {n.city ? <span className="text-xs text-faint">{n.city}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <div className="mt-10 border-t border-edge pt-6">
        <ShareBar title={shareTitle} summary={summary ?? undefined} />
      </div>
    </Page>
  );
}
