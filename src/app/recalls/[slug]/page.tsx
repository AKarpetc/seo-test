import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, slugify, formatNumber, NHTSA_HOTLINE } from '@/lib/site';
import { categoryOf, parseTopComponents, titleCaseComponent } from '@/lib/recalls';
import {
  Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd, AnswerBox, Prose, SectionHeading, CallLink,
} from '@/components/Layout';
import { ShareBar } from '@/components/Share';
import { AdSlot } from '@/components/Ads';

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

const get = (slug: string) =>
  prisma.vehicle.findUnique({
    where: { slug },
    include: { recalls: { orderBy: { reportDate: 'desc' } } },
  });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const v = await get(slug);
  if (!v) return { title: 'Vehicle not found' };

  const name = `${v.modelYear} ${v.make} ${v.model}`;
  const title = `${name} Recalls — ${v.recallCount} Safety Recall${v.recallCount === 1 ? '' : 's'} | NHTSA`;
  const complaints = v.complaintCount > 0 ? ` Plus ${formatNumber(v.complaintCount)} owner complaints and what they are about.` : '';
  const description = `${v.recallCount} open NHTSA safety recall${v.recallCount === 1 ? '' : 's'} for the ${name}. What the defect is, what can go wrong, and the free repair the manufacturer must provide.${complaints}`;
  return { title, description, alternates: { canonical: absoluteUrl(`/recalls/${slug}`) }, openGraph: { title, description } };
}

export default async function RecallPage({ params }: Props) {
  const { slug } = await params;
  const v = await get(slug);
  if (!v) notFound();

  const [otherYears, sameMake] = await Promise.all([
    prisma.vehicle.findMany({
      where: { make: v.make, model: v.model, NOT: { id: v.id } },
      select: { slug: true, modelYear: true, recallCount: true },
      orderBy: { modelYear: 'desc' },
      take: 20,
    }),
    prisma.vehicle.findMany({
      where: { make: v.make, modelYear: v.modelYear, NOT: { id: v.id } },
      select: { slug: true, model: true, recallCount: true },
      orderBy: { recallCount: 'desc' },
      take: 12,
    }),
  ]);

  const name = `${v.modelYear} ${v.make} ${v.model}`;
  const plural = v.recallCount === 1 ? '' : 's';
  const kind = categoryOf(v.category);
  const answer = `The ${name} has ${v.recallCount} NHTSA safety recall${plural} on file. Recall repairs are always free, whatever the ${kind.noun}'s age or mileage.`;
  const modelHub = `/recalls/model/${slugify(`${v.make}-${v.model}`)}`;
  const topComponents = parseTopComponents(v.topComponents);
  const stars = (n: number | null) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : null);
  const hasRating = Boolean(v.overallRating || v.frontalRating || v.sideRating);
  const ratingStat = v.overallRating
    ? { value: stars(v.overallRating), hint: 'overall, 5 stars max' }
    : v.frontalRating || v.sideRating
      ? { value: stars(v.frontalRating ?? v.sideRating), hint: v.frontalRating ? 'frontal crash, no overall star before 2011' : 'side crash, no overall star before 2011' }
      : { value: 'Not rated', hint: undefined };

  return (
    <Page>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': kind.schema, name,
        manufacturer: { '@type': 'Organization', name: v.make },
        model: v.model, vehicleModelDate: String(v.modelYear),
        url: absoluteUrl(`/recalls/${slug}`),
      }} />
      <Breadcrumbs items={[
        { label: 'Recalls', href: '/recalls' },
        { label: v.make, href: `/recalls/make/${slugify(v.make)}` },
        { label: v.model, href: modelHub },
        { label: String(v.modelYear) },
      ]} />
      <PageHeader eyebrow="NHTSA Safety Recalls" title={`${name} Recalls`} />

      <AnswerBox tone={v.recallCount > 0 ? 'danger' : 'ok'}>
        <p>
          <strong>{answer}</strong>
        </p>
        <p className="mt-3 text-[0.95rem] text-muted">
          A recall covers a range of VINs, not every {v.make} {v.model} built. Check your own
          17-character VIN before assuming yours is affected.
        </p>
      </AnswerBox>

      {v.complaintCount > 0 || hasRating ? (
        <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Recalls" value={v.recallCount} hint="NHTSA campaigns" />
          <Stat label="Owner complaints" value={formatNumber(v.complaintCount)} hint="filed with NHTSA" />
          <Stat label="Crashes reported" value={formatNumber(v.crashCount)} hint={v.fireCount > 0 ? `${formatNumber(v.fireCount)} fires` : 'in complaints'} />
          <Stat label="NHTSA crash test" value={ratingStat.value} hint={ratingStat.hint} />
        </dl>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a
          href="https://www.nhtsa.gov/recalls"
          rel="nofollow noopener"
          target="_blank"
          className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90"
        >
          Check your VIN on NHTSA
        </a>
        <CallLink number={NHTSA_HOTLINE} label={`Call NHTSA ${NHTSA_HOTLINE}`} />
      </div>

      <div className="mt-5">
        <ShareBar title={`${name} recalls`} summary={answer} />
      </div>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP} />

      <section className="mt-10">
        <SectionHeading id="recalls">
          {v.recallCount} recall{plural} on the {name}
        </SectionHeading>
        <div className="space-y-4">
          {v.recalls.map((r) => (
            <Card key={r.id} className="p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-lg font-bold leading-snug text-fg">{r.component || 'Safety recall'}</h3>
                <Link
                  href={`/recalls/campaign/${r.campaignNumber.toLowerCase()}`}
                  className="font-mono text-xs text-accent hover:underline"
                >
                  NHTSA {r.campaignNumber}
                </Link>
              </div>
              <dl className="space-y-3">
                {r.summary ? <Detail term="The defect">{r.summary}</Detail> : null}
                {r.consequence ? <Detail term="The risk">{r.consequence}</Detail> : null}
                {r.remedy ? <Detail term="The fix">{r.remedy}</Detail> : null}
              </dl>
              {r.reportDate ? (
                <p className="mt-4 text-xs text-faint">
                  Reported {r.reportDate.toLocaleDateString('en-US', { dateStyle: 'long' })}
                  {r.manufacturer ? ` by ${r.manufacturer}` : ''}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      {v.complaintCount > 0 ? (
        <section className="mt-10">
          <SectionHeading id="complaints">What owners report about the {name}</SectionHeading>
          <Card className="p-5 sm:p-6">
            <p className="text-muted">
              Owners have filed <strong className="text-fg">{formatNumber(v.complaintCount)}</strong> complaint
              {v.complaintCount === 1 ? '' : 's'} about the {name} with NHTSA
              {v.crashCount > 0 ? <>, <strong className="text-fg">{formatNumber(v.crashCount)}</strong> of them describing a crash</> : null}
              {v.fireCount > 0 ? <> and <strong className="text-fg">{formatNumber(v.fireCount)}</strong> a fire</> : null}
              {v.injuryCount > 0 || v.deathCount > 0 ? (
                <>. They report {formatNumber(v.injuryCount)} injur{v.injuryCount === 1 ? 'y' : 'ies'}{v.deathCount > 0 ? ` and ${formatNumber(v.deathCount)} death${v.deathCount === 1 ? '' : 's'}` : ''}</>
              ) : null}
              .
            </p>
            {topComponents.length > 0 ? (
              <>
                <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-faint">Most complained about</h3>
                <ul className="space-y-2">
                  {topComponents.map((c) => (
                    <li key={c.component} className="flex items-baseline justify-between gap-4 border-b border-edge pb-2 last:border-0">
                      <span className="text-muted">{titleCaseComponent(c.component)}</span>
                      <span className="shrink-0 font-semibold text-fg">{formatNumber(c.count)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {hasRating ? (
              <p className="mt-5 text-sm text-muted">
                NHTSA crash-test rating: {v.overallRating ? <><strong className="text-fg">{stars(v.overallRating)}</strong> overall</> : 'no overall star for this model year'}
                {v.frontalRating ? `, ${v.frontalRating}/5 frontal` : ''}
                {v.sideRating ? `, ${v.sideRating}/5 side` : ''}
                {v.rolloverRating ? `, ${v.rolloverRating}/5 rollover` : ''}.
              </p>
            ) : null}
            <p className="mt-4 text-xs text-faint">
              Complaints are owner reports, not verified defects, and a popular model collects more of
              them than a rare one. They show what to ask about, not what is certain to fail.
            </p>
          </Card>
        </section>
      ) : null}

      <section className="mt-10">
        <SectionHeading id="your-car">Checking your own {kind.noun}</SectionHeading>
        <Prose className="space-y-4">
          <p>
            A recall applies to a range of VINs, not to every {name} built. To confirm whether yours
            is affected, find the 17-character VIN, {kind.vin}, and
            enter it in{' '}
            <a href="https://www.nhtsa.gov/recalls" rel="nofollow noopener" target="_blank" className="text-accent hover:underline">
              NHTSA&apos;s official lookup
            </a>
            .
          </p>
          <p>
            Repairs for safety recalls are free and never expire. A dealer cannot charge you, and
            cannot refuse on the grounds that the {kind.noun} is old or out of warranty. If one does, call
            the NHTSA hotline on <strong>{NHTSA_HOTLINE}</strong>.
          </p>
        </Prose>
      </section>

      {otherYears.length > 0 ? (
        <section className="mt-10">
          <SectionHeading>
            {v.make} {v.model} by model year
          </SectionHeading>
          <Card className="p-5 sm:p-6">
            <ul className="grid grid-cols-3 gap-x-4 gap-y-1 sm:grid-cols-5 lg:grid-cols-7">
              {otherYears.map((o) => (
                <li key={o.slug}>
                  <Link href={`/recalls/${o.slug}`} className="inline-flex min-h-11 items-center gap-1 text-accent hover:underline">
                    {o.modelYear}
                    <span className="text-xs text-faint">({o.recallCount})</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm">
              <Link href={modelHub} className="font-medium text-accent hover:underline">
                All {v.make} {v.model} recalls, every year →
              </Link>
            </p>
          </Card>
        </section>
      ) : null}

      {sameMake.length > 0 ? (
        <section className="mt-8">
          <SectionHeading>
            Other {v.modelYear} {v.make} models
          </SectionHeading>
          <Card className="p-5 sm:p-6">
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
              {sameMake.map((o) => (
                <li key={o.slug}>
                  <Link href={`/recalls/${o.slug}`} className="inline-flex min-h-11 items-center gap-1 text-accent hover:underline">
                    {o.model}
                    <span className="text-xs text-faint">({o.recallCount})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM} />

      <div className="mt-10 border-t border-edge pt-6">
        <ShareBar title={`${name} recalls`} summary={answer} />
      </div>
    </Page>
  );
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-semibold uppercase tracking-wider text-faint">{term}</dt>
      <dd className="text-[0.975rem] leading-relaxed text-muted">{children}</dd>
    </div>
  );
}
