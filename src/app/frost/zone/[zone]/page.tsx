import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, formatNumber, stateName } from '@/lib/site';
import { Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd } from '@/components/Layout';

export const revalidate = 86400;

type Props = { params: Promise<{ zone: string }> };

/** Aggregates the frost window across every ZIP in a zone. */
async function getZone(zone: string) {
  const zips = await prisma.zipClimate.findMany({
    where: { zone },
    select: { zip: true, slug: true, city: true, state: true, zoneTempRange: true, stationId: true, population: true },
    orderBy: { population: 'desc' },
  });
  if (zips.length === 0) return null;

  const stationIds = [...new Set(zips.map((z) => z.stationId).filter(Boolean))] as string[];
  const stations = await prisma.climateData.findMany({
    where: { stationId: { in: stationIds.slice(0, 800) } },
    select: { lastFrostDate: true, firstFrostDate: true, growingDays: true },
  });

  const days = stations.map((s) => s.growingDays).filter((d): d is number => d !== null);
  const avgDays = days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null;

  const states = [...new Set(zips.map((z) => z.state).filter(Boolean))] as string[];

  return { zips, avgDays, states, tempRange: zips[0].zoneTempRange };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { zone } = await params;
  const data = await getZone(zone);
  if (!data) return { title: 'Zone not found' };

  const title = `USDA Zone ${zone} Frost Dates & Planting Calendar`;
  const description = `Frost dates for USDA hardiness zone ${zone}${data.tempRange ? ` (${data.tempRange}°F average annual low)` : ''}. ${formatNumber(data.zips.length)} ZIP codes across ${data.states.length} states, with an average ${data.avgDays ?? '—'}-day growing season.`;
  return { title, description, alternates: { canonical: absoluteUrl(`/frost/zone/${zone}`) }, openGraph: { title, description } };
}

export default async function ZonePage({ params }: Props) {
  const { zone } = await params;
  const data = await getZone(zone);
  if (!data) notFound();

  const byState = new Map<string, { zip: string; slug: string; city: string | null }[]>();
  for (const z of data.zips) {
    if (!z.state) continue;
    const list = byState.get(z.state) ?? [];
    if (list.length < 10) list.push({ zip: z.zip, slug: z.slug, city: z.city });
    byState.set(z.state, list);
  }

  return (
    <Page>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        name: `USDA hardiness zone ${zone}`,
        url: absoluteUrl(`/frost/zone/${zone}`),
        numberOfItems: data.zips.length,
      }} />
      <Breadcrumbs items={[{ label: 'Frost Dates', href: '/frost' }, { label: `Zone ${zone}` }]} />
      <PageHeader
        eyebrow="USDA Plant Hardiness Zone"
        title={`Zone ${zone} Frost Dates & Planting Calendar`}
        subtitle={`${formatNumber(data.zips.length)} ZIP codes across ${data.states.length} states fall in zone ${zone}.`}
      />

      <Card className="p-6 sm:p-8">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Zone" value={zone} />
          <Stat label="Average Annual Low" value={data.tempRange ? `${data.tempRange}°F` : '—'} />
          <Stat label="Typical Growing Season" value={data.avgDays ? `${data.avgDays} days` : '—'} />
          <Stat label="ZIP Codes" value={formatNumber(data.zips.length)} />
        </dl>

        <div className="mt-8 prose max-w-none text-muted">
          <h2 className="text-lg font-bold text-fg">What zone {zone} actually tells you</h2>
          <p>
            A hardiness zone describes one thing: the average coldest night of the year
            {data.tempRange ? `, which in zone ${zone} falls between ${data.tempRange}°F` : ''}.
            It answers whether a perennial will survive the winter — not when to plant in spring.
          </p>
          <p>
            Frost dates answer the planting question, and they vary widely inside a single zone.
            Zone {zone} spans {data.states.length} states, and a coastal ZIP can differ from an
            inland one by three weeks despite sharing the zone. Pick your own ZIP code below
            rather than planting by zone alone.
          </p>
        </div>
      </Card>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-fg mb-4">Zone {zone} ZIP codes by state</h2>
        <div className="space-y-4">
          {[...byState.entries()].sort().map(([state, zips]) => (
            <Card key={state} className="p-5">
              <h3 className="font-semibold text-fg mb-2">{stateName(state)}</h3>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {zips.map((z) => (
                  <li key={z.slug}>
                    <Link href={`/frost/${z.slug}`} className="text-accent hover:underline text-sm">
                      {z.zip}
                    </Link>
                    {z.city ? <span className="text-faint text-xs ml-1">{z.city}</span> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
    </Page>
  );
}
