import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, formatNumber, stateName } from '@/lib/site';
import { strengthLabel, mph, tornadoRating, decadeOf, stormName, STORM_RADIUS_MILES, TORNADO_RADIUS_MILES } from '@/lib/storms';
import {
  Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd, AnswerBox, Prose, SectionHeading,
} from '@/components/Layout';
import { ShareBar } from '@/components/Share';
import { AdSlot } from '@/components/Ads';

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

async function getCity(slug: string) {
  const city = await prisma.stormCity.findUnique({
    where: { slug },
    include: {
      storms: {
        include: { storm: { select: { slug: true, name: true, year: true, category: true, maxWind: true } } },
        orderBy: [{ storm: { year: 'desc' } }, { closestTime: 'desc' }],
      },
      tornadoes: {
        include: { tornado: true },
        orderBy: { tornado: { date: 'desc' } },
      },
    },
  });
  if (!city) return null;
  if (city.storms.length === 0 && city.tornadoes.length === 0) return null;
  return city;
}

function describe(city: NonNullable<Awaited<ReturnType<typeof getCity>>>) {
  const place = `${city.city}, ${stateName(city.state)}`;
  const systems = city.hurricaneCount + city.tropicalStormCount;
  const parts: string[] = [];
  if (systems > 0) {
    parts.push(
      `${formatNumber(systems)} tropical system${systems === 1 ? ' has' : 's have'} passed within ${STORM_RADIUS_MILES} miles of ${place} since 1851, ` +
        `${formatNumber(city.hurricaneCount)} of them at hurricane strength` +
        (city.lastStormName ? `; the most recent was ${city.lastStormName === 'Unnamed' ? `an unnamed storm` : city.lastStormName} in ${city.lastStormYear}` : '') +
        '.',
    );
  } else {
    parts.push(`No tropical storm or hurricane has passed within ${STORM_RADIUS_MILES} miles of ${place} since records began in 1851.`);
  }
  if (city.tornadoCount > 0) {
    parts.push(
      `Since 1950, ${formatNumber(city.tornadoCount)} tornado${city.tornadoCount === 1 ? ' has' : 'es have'} touched down within ${TORNADO_RADIUS_MILES} miles, ` +
        `${formatNumber(city.strongTornadoCount)} of them rated EF3 or stronger.`,
    );
  } else {
    parts.push(`No tornado has been recorded within ${TORNADO_RADIUS_MILES} miles since 1950.`);
  }
  return { place, answer: parts.join(' ') };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const city = await getCity(slug);
  if (!city) return { title: 'City not found' };
  const { place, answer } = describe(city);
  const title = `Hurricanes and Tornadoes That Hit ${city.city}, ${city.state} — Storm History`;
  return { title, description: answer.slice(0, 300), alternates: { canonical: absoluteUrl(`/storms/${slug}`) }, openGraph: { title, description: answer.slice(0, 300) } };
}

export default async function CityStormPage({ params }: Props) {
  const { slug } = await params;
  const city = await getCity(slug);
  if (!city) notFound();

  const { place, answer } = describe(city);
  const shareTitle = `Storms that hit ${city.city}, ${city.state}`;

  const decades = new Map<string, { total: number; strong: number }>();
  for (const t of city.tornadoes) {
    const d = decadeOf(t.tornado.date);
    const e = decades.get(d) ?? { total: 0, strong: 0 };
    e.total++;
    if ((t.tornado.mag ?? 0) >= 3) e.strong++;
    decades.set(d, e);
  }
  const notable = [...city.tornadoes]
    .sort((a, b) => (b.tornado.mag ?? -1) - (a.tornado.mag ?? -1) || b.tornado.fatalities - a.tornado.fatalities || b.tornado.date.getTime() - a.tornado.date.getTime())
    .slice(0, 12);

  const nearby = await prisma.stormCity.findMany({
    where: { state: city.state, NOT: { id: city.id }, OR: [{ hurricaneCount: { gt: 0 } }, { tropicalStormCount: { gt: 0 } }, { tornadoCount: { gt: 0 } }] },
    select: { slug: true, city: true, hurricaneCount: true, tornadoCount: true },
    orderBy: { population: 'desc' },
    take: 12,
  });

  return (
    <Page>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'Place',
        name: place,
        address: { '@type': 'PostalAddress', addressLocality: city.city, addressRegion: city.state, addressCountry: 'US' },
        geo: { '@type': 'GeoCoordinates', latitude: city.lat, longitude: city.lng },
        url: absoluteUrl(`/storms/${slug}`),
      }} />
      <Breadcrumbs items={[
        { label: 'Storm History', href: '/storms' },
        { label: stateName(city.state), href: `/storms/state/${city.state.toLowerCase()}` },
        { label: city.city },
      ]} />
      <PageHeader
        eyebrow="NHC HURDAT2 · SPC Tornado Database"
        title={`Hurricanes and Tornadoes That Hit ${city.city}, ${city.state}`}
        subtitle={`Every tropical system within ${STORM_RADIUS_MILES} miles since 1851 and every tornado within ${TORNADO_RADIUS_MILES} miles since 1950.`}
      />

      <AnswerBox tone={city.hurricaneCount > 0 || city.strongTornadoCount > 0 ? 'danger' : 'accent'}>
        <p><strong>{answer}</strong></p>
      </AnswerBox>

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Hurricanes" value={formatNumber(city.hurricaneCount)} hint={`within ${STORM_RADIUS_MILES} mi, since 1851`} />
        <Stat label="Tropical storms" value={formatNumber(city.tropicalStormCount)} hint="below hurricane strength" />
        <Stat label="Tornadoes" value={formatNumber(city.tornadoCount)} hint={`within ${TORNADO_RADIUS_MILES} mi, since 1950`} />
        <Stat label="EF3 or stronger" value={formatNumber(city.strongTornadoCount)} hint={city.tornadoFatalities > 0 ? `${formatNumber(city.tornadoFatalities)} deaths in all` : 'no recorded deaths'} />
      </dl>

      <div className="mt-6">
        <ShareBar title={shareTitle} summary={answer} />
      </div>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP} />

      {city.storms.length > 0 ? (
        <section className="mt-10">
          <SectionHeading id="hurricanes">Tropical storms and hurricanes near {city.city}</SectionHeading>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <caption className="sr-only">Tropical systems that passed within {STORM_RADIUS_MILES} miles of {place}, newest first</caption>
                <thead className="bg-sunk">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Year</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Storm</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Closest</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Strength when closest</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Peak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {city.storms.map((s) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-fg">{s.storm.year}</td>
                      <td className="px-4 py-3">
                        <Link href={`/storms/hurricane/${s.storm.slug}`} className="font-semibold text-accent hover:underline">{stormName(s.storm.name, s.storm.year)}</Link>
                        {s.closestTime ? <span className="ml-2 text-xs text-faint">{s.closestTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span> : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{s.closestMiles < 1 ? 'overhead' : `${Math.round(s.closestMiles)} mi`}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{strengthLabel(s.windAtClosest)} <span className="text-xs text-faint">({mph(s.windAtClosest)})</span></td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{strengthLabel(s.storm.maxWind)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="mt-3 text-xs text-faint">
            Strength is the sustained wind on the track at the closest point, which is not the wind felt in {city.city}: a hurricane&apos;s worst winds sit within a few dozen miles of its centre, and inland cities are usually past that.
          </p>
        </section>
      ) : null}

      {city.tornadoes.length > 0 ? (
        <section className="mt-10">
          <SectionHeading id="tornadoes">Tornadoes within {TORNADO_RADIUS_MILES} miles of {city.city}</SectionHeading>
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="p-5 lg:col-span-2">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">By decade</h3>
              <ul className="space-y-1.5">
                {[...decades.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([decade, d]) => (
                  <li key={decade} className="flex items-baseline justify-between gap-4 border-b border-edge pb-1.5 last:border-0">
                    <span className="text-muted">{decade}</span>
                    <span className="font-semibold text-fg">{d.total}{d.strong > 0 ? <span className="ml-1 text-xs font-normal text-faint">({d.strong} EF3+)</span> : null}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="overflow-hidden lg:col-span-3">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <caption className="sr-only">Strongest tornadoes near {place}</caption>
                  <thead className="bg-sunk">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Date</th>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Rating</th>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Distance</th>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Path</th>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Killed / injured</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {notable.map((t) => (
                      <tr key={t.id}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-fg">{t.tornado.date.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' })}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{tornadoRating(t.tornado.mag, t.tornado.date)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{t.miles < 1 ? 'in town' : `${Math.round(t.miles)} mi`}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{t.tornado.lengthMiles ? `${t.tornado.lengthMiles} mi` : '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{t.tornado.fatalities} / {t.tornado.injuries}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
          <p className="mt-3 text-xs text-faint">
            The strongest {notable.length} of {formatNumber(city.tornadoCount)}, by rating and then by deaths. Ratings before February 2007 are on the original Fujita scale.
          </p>
        </section>
      ) : null}

      <section className="mt-10">
        <SectionHeading id="reading">How to read this page</SectionHeading>
        <Prose className="space-y-4">
          <p>
            A storm is listed when the centre of its track passed within {STORM_RADIUS_MILES} miles of {city.city} while
            it was at least a tropical storm, which is the reach of damaging wind and rain for a typical
            hurricane. Being on the list does not mean the city took a direct hit; the &quot;closest&quot; column says how
            near the centre came. Tornadoes are counted when any part of the path came within {TORNADO_RADIUS_MILES} miles.
          </p>
          <p>
            Tornado records before the 1990s are thinner, because weak tornadoes in open country often went
            unreported before Doppler radar and mobile phones. A rise in the decade counts is mostly better
            reporting, not a change in the weather.
          </p>
          <p>
            Tracks come from the National Hurricane Center&apos;s HURDAT2 database, tornadoes from the Storm
            Prediction Center&apos;s database. Both are the official federal records and both are revised
            as old storms are re-analysed.
          </p>
        </Prose>
      </section>

      {nearby.length > 0 ? (
        <section className="mt-10">
          <SectionHeading>Other cities in {stateName(city.state)}</SectionHeading>
          <Card className="p-5 sm:p-6">
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
              {nearby.map((n) => (
                <li key={n.slug}>
                  <Link href={`/storms/${n.slug}`} className="inline-flex min-h-11 items-center gap-1.5 text-accent hover:underline">
                    {n.city}
                    <span className="text-xs text-faint">{n.hurricaneCount} / {n.tornadoCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm">
              <Link href={`/storms/state/${city.state.toLowerCase()}`} className="font-medium text-accent hover:underline">
                All {stateName(city.state)} cities →
              </Link>
            </p>
          </Card>
        </section>
      ) : null}

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM} />

      <div className="mt-10 border-t border-edge pt-6">
        <ShareBar title={shareTitle} summary={answer} />
      </div>
    </Page>
  );
}
