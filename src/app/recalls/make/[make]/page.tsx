import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, slugify, formatNumber, NHTSA_HOTLINE } from '@/lib/site';
import { makeBySlug, modelSlug } from '@/lib/recalls';
import {
  Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd, AnswerBox, Prose, SectionHeading, CallLink,
} from '@/components/Layout';
import { ShareBar } from '@/components/Share';
import { AdSlot } from '@/components/Ads';

export const revalidate = 86400;

type Props = { params: Promise<{ make: string }> };

async function getMake(slug: string) {
  const make = (await makeBySlug()).get(slug.toLowerCase());
  if (!make) return null;

  const [vehicles, components] = await Promise.all([
    prisma.vehicle.findMany({
      where: { make },
      select: { slug: true, model: true, modelYear: true, recallCount: true },
      orderBy: [{ model: 'asc' }, { modelYear: 'desc' }],
    }),
    prisma.vehicleRecall.groupBy({
      by: ['component'],
      where: { vehicle: { make } },
      _count: { _all: true },
      orderBy: { _count: { component: 'desc' } },
      take: 12,
    }),
  ]);
  if (vehicles.length === 0) return null;

  return { make, vehicles, components };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { make } = await params;
  const data = await getMake(make);
  if (!data) return { title: 'Make not found' };

  const total = data.vehicles.reduce((sum, v) => sum + v.recallCount, 0);
  const models = new Set(data.vehicles.map((v) => v.model)).size;
  const title = `${data.make} Recalls — All Models and Years | NHTSA`;
  const description = `Every NHTSA safety recall on ${data.make} vehicles: ${formatNumber(total)} recalls across ${models} models. Browse by model, then by year.`;

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/recalls/make/${slugify(data.make)}`) },
    openGraph: { title, description },
  };
}

export default async function MakePage({ params }: Props) {
  const { make: makeParam } = await params;
  const data = await getMake(makeParam);
  if (!data) notFound();

  const { make, vehicles, components } = data;

  const models = new Map<string, { count: number; recalls: number; years: number[] }>();
  for (const v of vehicles) {
    const entry = models.get(v.model) ?? { count: 0, recalls: 0, years: [] };
    entry.count += 1;
    entry.recalls += v.recallCount;
    entry.years.push(v.modelYear);
    models.set(v.model, entry);
  }

  const ranked = [...models.entries()].sort((a, b) => b[1].recalls - a[1].recalls);
  const total = vehicles.reduce((sum, v) => sum + v.recallCount, 0);
  const allYears = vehicles.map((v) => v.modelYear);
  const answer = `${make} has ${formatNumber(total)} NHTSA recalls on record across ${models.size} models and ${Math.min(...allYears)}–${Math.max(...allYears)} model years. The most-recalled model is the ${ranked[0][0]}, with ${ranked[0][1].recalls}.`;

  return (
    <Page>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: `${make} recalls by model`,
        numberOfItems: models.size,
        url: absoluteUrl(`/recalls/make/${slugify(make)}`),
      }} />
      <Breadcrumbs items={[{ label: 'Recalls', href: '/recalls' }, { label: make }]} />
      <PageHeader
        eyebrow="NHTSA Safety Recalls"
        title={`${make} Recalls`}
        subtitle={`Every ${make} model on file, ranked by how many safety recalls it carries.`}
      />

      <AnswerBox tone="accent">
        <p>
          <strong>{answer}</strong>
        </p>
      </AnswerBox>

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Models" value={models.size} />
        <Stat label="Total recalls" value={formatNumber(total)} />
        <Stat label="Model years" value={`${Math.min(...allYears)}–${Math.max(...allYears)}`} />
        <Stat label="Pages on file" value={formatNumber(vehicles.length)} hint="year + model" />
      </dl>

      <div className="mt-6">
        <ShareBar title={`${make} recalls`} summary={answer} />
      </div>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP} />

      <section className="mt-10">
        <SectionHeading id="models">{make} models, most recalls first</SectionHeading>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">{make} models ranked by total NHTSA recalls</caption>
              <thead className="bg-sunk">
                <tr>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Model</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Recalls</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">Years covered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {ranked.map(([model, stats]) => (
                  <tr key={model}>
                    <td className="px-4 py-3">
                      <Link href={`/recalls/model/${modelSlug(make, model)}`} className="font-semibold text-accent hover:underline">
                        {make} {model}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-fg">{formatNumber(stats.recalls)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {Math.min(...stats.years)}–{Math.max(...stats.years)}
                      <span className="ml-1 text-xs text-faint">({stats.count})</span>
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
          <SectionHeading id="components">What gets recalled most on {make} vehicles</SectionHeading>
          <Card className="p-5 sm:p-6">
            <ul className="space-y-2">
              {components.map((c) => (
                <li key={c.component ?? 'unknown'} className="flex items-baseline justify-between gap-4 border-b border-edge pb-2 last:border-0">
                  <span className="text-muted">{c.component || 'Unspecified'}</span>
                  <span className="shrink-0 font-semibold text-fg">{formatNumber(c._count._all)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <section className="mt-10">
        <SectionHeading>Before you read anything into the ranking</SectionHeading>
        <Prose className="space-y-4">
          <p>
            Models that sold in large numbers over many years collect more recalls than niche ones,
            and that says more about production volume than about build quality. A recall is also
            evidence that a defect was found and fixed at the maker&apos;s expense, which is the system
            working rather than failing.
          </p>
          <p>
            The only question that matters for one particular car is whether its VIN sits inside an
            open campaign. Check on{' '}
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
        <ShareBar title={`${make} recalls`} summary={answer} />
      </div>
    </Page>
  );
}
