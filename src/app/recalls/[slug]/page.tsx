import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, slugify, NHTSA_HOTLINE } from '@/lib/site';
import {
  Page, Card, Breadcrumbs, PageHeader, JsonLd, AnswerBox, Prose, SectionHeading, CallLink,
} from '@/components/Layout';
import { ShareBar } from '@/components/Share';

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
  const description = `${v.recallCount} open NHTSA safety recall${v.recallCount === 1 ? '' : 's'} for the ${name}. What the defect is, what can go wrong, and the free repair the manufacturer must provide.`;
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
  const answer = `The ${name} has ${v.recallCount} NHTSA safety recall${plural} on file. Recall repairs are always free, whatever the car's age or mileage.`;
  const modelHub = `/recalls/model/${slugify(`${v.make}-${v.model}`)}`;

  return (
    <Page>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'Car', name,
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

      <section className="mt-10">
        <SectionHeading id="your-car">Checking your own car</SectionHeading>
        <Prose className="space-y-4">
          <p>
            A recall applies to a range of VINs, not to every {name} built. To confirm whether yours
            is affected, find the 17-character VIN on the driver-side dashboard or door jamb and
            enter it in{' '}
            <a href="https://www.nhtsa.gov/recalls" rel="nofollow noopener" target="_blank" className="text-accent hover:underline">
              NHTSA&apos;s official lookup
            </a>
            .
          </p>
          <p>
            Repairs for safety recalls are free and never expire. A dealer cannot charge you, and
            cannot refuse on the grounds that the car is old or out of warranty. If one does, call
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
