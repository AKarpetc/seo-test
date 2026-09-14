import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, slugify, formatNumber, NHTSA_HOTLINE } from '@/lib/site';
import { modelBySlug } from '@/lib/recalls';
import {
  Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd, AnswerBox, Prose, SectionHeading, CallLink,
} from '@/components/Layout';
import { ShareBar } from '@/components/Share';
import { AdSlot } from '@/components/Ads';

export const revalidate = 86400;

type Props = { params: Promise<{ model: string }> };

async function getModel(slug: string) {
  const pair = (await modelBySlug()).get(slug.toLowerCase());
  if (!pair) return null;

  const years = await prisma.vehicle.findMany({
    where: { make: pair.make, model: pair.model },
    select: { slug: true, modelYear: true, recallCount: true },
    orderBy: { modelYear: 'desc' },
  });
  if (years.length === 0) return null;

  const components = await prisma.vehicleRecall.groupBy({
    by: ['component'],
    where: { vehicle: { make: pair.make, model: pair.model } },
    _count: { _all: true },
    orderBy: { _count: { component: 'desc' } },
    take: 10,
  });

  return { ...pair, years, components };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { model } = await params;
  const data = await getModel(model);
  if (!data) return { title: 'Model not found' };

  const total = data.years.reduce((sum, y) => sum + y.recallCount, 0);
  const first = data.years[data.years.length - 1]?.modelYear;
  const last = data.years[0]?.modelYear;
  const title = `${data.make} ${data.model} Recalls by Year — ${first}–${last} | NHTSA`;
  const description = `Every NHTSA safety recall on the ${data.make} ${data.model}, ${first} to ${last}: ${total} recalls across ${data.years.length} model years. Which years are worst, and what the defects are.`;

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/recalls/model/${slugify(`${data.make}-${data.model}`)}`) },
    openGraph: { title, description },
  };
}

export default async function ModelPage({ params }: Props) {
  const { model } = await params;
  const data = await getModel(model);
  if (!data) notFound();

  const { make, years, components } = data;
  const name = `${make} ${data.model}`;
  const total = years.reduce((sum, y) => sum + y.recallCount, 0);
  const worst = [...years].sort((a, b) => b.recallCount - a.recallCount)[0];
  const cleanest = [...years].sort((a, b) => a.recallCount - b.recallCount)[0];
  const first = years[years.length - 1]?.modelYear;
  const last = years[0]?.modelYear;
  const answer = `Across ${years.length} model years (${first}–${last}) the ${name} has ${formatNumber(total)} NHTSA recalls. The worst year is ${worst.modelYear} with ${worst.recallCount}; the cleanest is ${cleanest.modelYear} with ${cleanest.recallCount}.`;

  return (
    <Page>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: `${name} recalls by model year`,
        numberOfItems: years.length,
        url: absoluteUrl(`/recalls/model/${slugify(`${make}-${data.model}`)}`),
      }} />
      <Breadcrumbs items={[
        { label: 'Recalls', href: '/recalls' },
        { label: make, href: `/recalls/make/${slugify(make)}` },
        { label: data.model },
      ]} />
      <PageHeader
        eyebrow="NHTSA Safety Recalls"
        title={`${name} Recalls by Year`}
        subtitle={`Every model year from ${first} to ${last}, ranked by how many recalls it carries.`}
      />

      <AnswerBox tone="accent">
        <p>
          <strong>{answer}</strong>
        </p>
      </AnswerBox>

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Model years" value={years.length} hint={`${first}–${last}`} />
        <Stat label="Total recalls" value={formatNumber(total)} />
        <Stat label="Worst year" value={worst.modelYear} hint={`${worst.recallCount} recalls`} />
        <Stat label="Cleanest year" value={cleanest.modelYear} hint={`${cleanest.recallCount} recalls`} />
      </dl>

      <div className="mt-6">
        <ShareBar title={`${name} recalls by year`} summary={answer} />
      </div>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP} />

      <section className="mt-10">
        <SectionHeading id="by-year">Recalls by model year</SectionHeading>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">NHTSA recall counts for the {name}, by model year</caption>
              <thead className="bg-sunk">
                <tr>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Year</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Recalls</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Relative</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {years.map((y) => (
                  <tr key={y.slug}>
                    <td className="px-4 py-3">
                      <Link href={`/recalls/${y.slug}`} className="font-semibold text-accent hover:underline">
                        {y.modelYear} {name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-fg">{y.recallCount}</td>
                    <td className="px-4 py-3">
                      <div className="h-2 w-full max-w-32 overflow-hidden rounded-full bg-sunk" aria-hidden>
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${worst.recallCount ? Math.round((y.recallCount / worst.recallCount) * 100) : 0}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {components.length > 0 ? (
        <section className="mt-10">
          <SectionHeading id="components">What gets recalled most on the {name}</SectionHeading>
          <Card className="p-5 sm:p-6">
            <ul className="space-y-2">
              {components.map((c) => (
                <li key={c.component ?? 'unknown'} className="flex items-baseline justify-between gap-4 border-b border-edge pb-2 last:border-0">
                  <span className="text-muted">{c.component || 'Unspecified'}</span>
                  <span className="shrink-0 font-semibold text-fg">{c._count._all}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <section className="mt-10">
        <SectionHeading>Reading these numbers</SectionHeading>
        <Prose className="space-y-4">
          <p>
            A high recall count is not the same as an unreliable vehicle. Recalls are safety defects the
            manufacturer reports and repairs free; a maker that files many of them is often being
            more diligent, not less. Older model years also accumulate recalls simply by existing
            longer.
          </p>
          <p>
            What matters for a specific vehicle is whether its own VIN is covered by an open campaign.
            Check it on{' '}
            <a href="https://www.nhtsa.gov/recalls" rel="nofollow noopener" target="_blank" className="text-accent hover:underline">
              NHTSA&apos;s lookup
            </a>{' '}
            or call <strong>{NHTSA_HOTLINE}</strong>.
          </p>
        </Prose>
        <div className="mt-5">
          <CallLink number={NHTSA_HOTLINE} label={`Call NHTSA ${NHTSA_HOTLINE}`} />
        </div>
      </section>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM} />

      <div className="mt-10 border-t border-edge pt-6">
        <ShareBar title={`${name} recalls by year`} summary={answer} />
      </div>
    </Page>
  );
}
