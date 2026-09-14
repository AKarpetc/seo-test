import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, formatNumber, stateName } from '@/lib/site';
import { strengthLabel, categoryLabel, mph, stormName, STORM_RADIUS_MILES } from '@/lib/storms';
import { Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd, AnswerBox, Prose, SectionHeading } from '@/components/Layout';
import { ShareBar } from '@/components/Share';
import { AdSlot } from '@/components/Ads';

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

async function getStorm(slug: string) {
  const storm = await prisma.storm.findUnique({
    where: { slug },
    include: {
      cities: {
        include: { city: { select: { slug: true, city: true, state: true, population: true } } },
        orderBy: [{ windAtClosest: 'desc' }, { closestMiles: 'asc' }],
      },
    },
  });
  if (!storm || storm.cities.length === 0) return null;
  return storm;
}

function fmt(d: Date | null) {
  return d ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await getStorm(slug);
  if (!s) return { title: 'Storm not found' };
  const kind = (s.category ?? 0) >= 1 ? 'Hurricane' : 'Tropical Storm';
  const title = s.name === 'Unnamed' ? `The Unnamed ${s.year} ${kind} (${s.stormId}) — Cities It Hit` : `${kind} ${s.name} (${s.year}) — Cities It Hit, Track and Strength`;
  const states = [...new Set(s.cities.map((c) => c.city.state))];
  const description = `${kind} ${stormName(s.name, s.year)} passed within ${STORM_RADIUS_MILES} miles of ${formatNumber(s.cities.length)} US cities in ${states.length} state${states.length === 1 ? '' : 's'}, peaking at ${categoryLabel(s.category)} (${mph(s.maxWind)}). Which cities, how close, and how strong it was there.`;
  return { title, description, alternates: { canonical: absoluteUrl(`/storms/hurricane/${slug}`) }, openGraph: { title, description } };
}

export default async function StormPage({ params }: Props) {
  const { slug } = await params;
  const s = await getStorm(slug);
  if (!s) notFound();

  const kind = (s.category ?? 0) >= 1 ? 'Hurricane' : 'Tropical Storm';
  const byState = new Map<string, typeof s.cities>();
  for (const c of s.cities) byState.set(c.city.state, [...(byState.get(c.city.state) ?? []), c]);
  const hurricaneCities = s.cities.filter((c) => (c.windAtClosest ?? 0) >= 64).length;
  const answer = `${kind} ${stormName(s.name, s.year)} peaked at ${categoryLabel(s.category)} with ${mph(s.maxWind)} sustained winds and passed within ${STORM_RADIUS_MILES} miles of ${formatNumber(s.cities.length)} US cities, ${formatNumber(hurricaneCities)} of them while still at hurricane strength.`;

  return (
    <Page>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Event', name: `${kind} ${s.name} ${s.year}`, startDate: s.firstDate?.toISOString(), endDate: s.lastDate?.toISOString(), url: absoluteUrl(`/storms/hurricane/${slug}`) }} />
      <Breadcrumbs items={[{ label: 'Storm History', href: '/storms' }, { label: `${s.name} ${s.year}` }]} />
      <PageHeader eyebrow={`NHC ${s.stormId} · ${s.basin === 'AL' ? 'Atlantic' : 'Eastern Pacific'} basin`} title={s.name === 'Unnamed' ? `Unnamed ${kind} of ${s.year}` : `${kind} ${s.name} (${s.year})`} subtitle={`${fmt(s.firstDate)} – ${fmt(s.lastDate)}`} />

      <AnswerBox tone={(s.category ?? 0) >= 3 ? 'danger' : 'accent'}><p><strong>{answer}</strong></p></AnswerBox>

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Peak strength" value={categoryLabel(s.category)} hint={mph(s.maxWind)} />
        <Stat label="Cities within 75 mi" value={formatNumber(s.cities.length)} />
        <Stat label="At hurricane strength" value={formatNumber(hurricaneCities)} hint="when closest" />
        <Stat label="States" value={byState.size} />
      </dl>

      <div className="mt-6"><ShareBar title={`${kind} ${s.name} ${s.year}`} summary={answer} /></div>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP} />

      <section className="mt-10">
        <SectionHeading id="cities">Cities {stormName(s.name, s.year)} passed near, strongest first</SectionHeading>
        <div className="space-y-4">
          {[...byState.entries()].sort((a, b) => b[1].length - a[1].length).map(([state, list]) => (
            <Card key={state} className="p-5 sm:p-6">
              <h3 className="mb-3 font-bold text-fg">{stateName(state)} <span className="font-normal text-faint">({list.length})</span></h3>
              <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {list.slice(0, 60).map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-2">
                    <Link href={`/storms/${c.city.slug}`} className="inline-flex min-h-11 items-center text-accent hover:underline">{c.city.city}</Link>
                    <span className="whitespace-nowrap text-xs text-faint">{strengthLabel(c.windAtClosest)} · {c.closestMiles < 1 ? 'overhead' : `${Math.round(c.closestMiles)} mi`}</span>
                  </li>
                ))}
              </ul>
              {list.length > 60 ? <p className="mt-2 text-xs text-faint">and {list.length - 60} more</p> : null}
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <SectionHeading>About this record</SectionHeading>
        <Prose className="space-y-4">
          <p>
            The track is the National Hurricane Center&apos;s best-track record, revised after the season with
            every observation available. Strength at a city is the sustained wind on the track at the closest
            point, not the wind that city measured.
          </p>
        </Prose>
      </section>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM} />
    </Page>
  );
}
