import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, formatNumber, stateName, US_STATES } from '@/lib/site';
import { Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd, AnswerBox } from '@/components/Layout';

export const revalidate = 86400;

type Props = { params: Promise<{ state: string }> };

async function getState(code: string) {
  const state = code.toUpperCase();
  if (!US_STATES[state]) return null;
  const cities = await prisma.stormCity.findMany({
    where: { state, OR: [{ hurricaneCount: { gt: 0 } }, { tropicalStormCount: { gt: 0 } }, { tornadoCount: { gt: 0 } }] },
    select: { slug: true, city: true, hurricaneCount: true, tropicalStormCount: true, tornadoCount: true, strongTornadoCount: true, lastStormName: true, lastStormYear: true, population: true },
    orderBy: { population: 'desc' },
  });
  if (cities.length === 0) return null;

  const tornadoes = await prisma.tornado.aggregate({ where: { state }, _count: { _all: true }, _sum: { fatalities: true } });
  const strong = await prisma.tornado.count({ where: { state, mag: { gte: 3 } } });
  return { state, cities, tornadoes: tornadoes._count._all, deaths: tornadoes._sum.fatalities ?? 0, strong };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state } = await params;
  const data = await getState(state);
  if (!data) return { title: 'State not found' };
  const name = stateName(data.state);
  const title = `${name} Hurricane and Tornado History by City`;
  const description = `Storm history for ${formatNumber(data.cities.length)} ${name} cities: hurricanes and tropical storms within 75 miles since 1851, and ${formatNumber(data.tornadoes)} tornadoes recorded in the state since 1950.`;
  return { title, description, alternates: { canonical: absoluteUrl(`/storms/state/${data.state.toLowerCase()}`) }, openGraph: { title, description } };
}

export default async function StatePage({ params }: Props) {
  const { state } = await params;
  const data = await getState(state);
  if (!data) notFound();

  const name = stateName(data.state);
  const mostHurricanes = [...data.cities].sort((a, b) => b.hurricaneCount - a.hurricaneCount)[0];
  const mostTornadoes = [...data.cities].sort((a, b) => b.tornadoCount - a.tornadoCount)[0];
  const answer =
    `${name} has ${formatNumber(data.tornadoes)} tornadoes on record since 1950, ${formatNumber(data.strong)} of them EF3 or stronger, with ${formatNumber(data.deaths)} deaths. ` +
    (mostHurricanes.hurricaneCount > 0
      ? `The city with the most hurricanes within 75 miles is ${mostHurricanes.city} (${mostHurricanes.hurricaneCount}); `
      : 'No hurricane has passed within 75 miles of any city in the state; ') +
    `the most tornado-prone is ${mostTornadoes.city} (${mostTornadoes.tornadoCount}).`;

  return (
    <Page>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'ItemList', name: `${name} storm history by city`, numberOfItems: data.cities.length, url: absoluteUrl(`/storms/state/${data.state.toLowerCase()}`) }} />
      <Breadcrumbs items={[{ label: 'Storm History', href: '/storms' }, { label: name }]} />
      <PageHeader eyebrow="NHC HURDAT2 · SPC Tornado Database" title={`${name} Hurricane and Tornado History`} subtitle="Every city, with the storms and tornadoes that came near it." />

      <AnswerBox tone="accent"><p><strong>{answer}</strong></p></AnswerBox>

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cities" value={formatNumber(data.cities.length)} />
        <Stat label="Tornadoes in state" value={formatNumber(data.tornadoes)} hint="since 1950" />
        <Stat label="EF3 or stronger" value={formatNumber(data.strong)} />
        <Stat label="Tornado deaths" value={formatNumber(data.deaths)} />
      </dl>

      <section className="mt-10">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">{name} cities by storm history</caption>
              <thead className="bg-sunk">
                <tr>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">City</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Hurricanes</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Tropical storms</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Tornadoes</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">EF3+</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Last storm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {data.cities.map((c) => (
                  <tr key={c.slug}>
                    <td className="px-4 py-3"><Link href={`/storms/${c.slug}`} className="font-semibold text-accent hover:underline">{c.city}</Link></td>
                    <td className="px-4 py-3 text-muted">{c.hurricaneCount}</td>
                    <td className="px-4 py-3 text-muted">{c.tropicalStormCount}</td>
                    <td className="px-4 py-3 text-muted">{c.tornadoCount}</td>
                    <td className="px-4 py-3 text-muted">{c.strongTornadoCount}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{c.lastStormName ? `${c.lastStormName} ${c.lastStormYear}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </Page>
  );
}
