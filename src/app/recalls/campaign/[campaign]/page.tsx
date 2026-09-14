import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, slugify, formatNumber, NHTSA_HOTLINE } from '@/lib/site';
import {
  Page, Card, Breadcrumbs, PageHeader, JsonLd, AnswerBox, Prose, SectionHeading, CallLink,
} from '@/components/Layout';
import { ShareBar } from '@/components/Share';

export const revalidate = 86400;

type Props = { params: Promise<{ campaign: string }> };

/**
 * Every row of a campaign carries the same defect text, so the narrative comes
 * from the first row and the rows themselves only supply the affected vehicles.
 */
async function getCampaign(campaign: string) {
  const rows = await prisma.vehicleRecall.findMany({
    where: { campaignNumber: campaign.toUpperCase() },
    include: { vehicle: { select: { slug: true, modelYear: true, make: true, model: true } } },
  });
  if (rows.length === 0) return null;
  return { detail: rows[0], vehicles: rows.map((r) => r.vehicle) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { campaign } = await params;
  const data = await getCampaign(campaign);
  if (!data) return { title: 'Recall not found' };

  const { detail, vehicles } = data;
  const number = detail.campaignNumber;
  const makes = [...new Set(vehicles.map((v) => v.make))];
  const who = makes.length === 1 ? makes[0] : `${makes.length} makes`;
  const title = `NHTSA Recall ${number} — ${detail.component || 'Safety Recall'} (${who})`;
  const description = `NHTSA campaign ${number} affects ${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}. ${detail.consequence ?? detail.summary ?? 'Safety recall details and the free repair.'}`.slice(0, 300);

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/recalls/campaign/${number.toLowerCase()}`) },
    openGraph: { title, description },
  };
}

export default async function CampaignPage({ params }: Props) {
  const { campaign } = await params;
  const data = await getCampaign(campaign);
  if (!data) notFound();

  const { detail, vehicles } = data;
  const number = detail.campaignNumber;
  const byMake = new Map<string, typeof vehicles>();
  for (const v of vehicles) {
    const list = byMake.get(v.make) ?? [];
    list.push(v);
    byMake.set(v.make, list);
  }
  const answer = `NHTSA campaign ${number} covers ${formatNumber(vehicles.length)} vehicle${vehicles.length === 1 ? '' : 's'}${detail.component ? ` and concerns the ${detail.component.toLowerCase()}` : ''}. The repair is free.`;

  return (
    <Page>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'Article',
        headline: `NHTSA Recall ${number}`,
        description: detail.summary ?? undefined,
        datePublished: detail.reportDate?.toISOString(),
        url: absoluteUrl(`/recalls/campaign/${number.toLowerCase()}`),
      }} />
      <Breadcrumbs items={[{ label: 'Recalls', href: '/recalls' }, { label: `Campaign ${number}` }]} />
      <PageHeader
        eyebrow={`NHTSA Campaign ${number}`}
        title={detail.component || `Safety recall ${number}`}
        subtitle={detail.manufacturer ? `Filed by ${detail.manufacturer}.` : undefined}
      />

      <AnswerBox tone="danger">
        <p>
          <strong>{answer}</strong>
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
        <ShareBar title={`NHTSA recall ${number}`} summary={answer} />
      </div>

      <section className="mt-10">
        <SectionHeading id="detail">What this recall covers</SectionHeading>
        <Card className="p-5 sm:p-6">
          <dl className="space-y-4">
            {detail.summary ? (
              <div>
                <dt className="mb-1 text-xs font-semibold uppercase tracking-wider text-faint">The defect</dt>
                <dd className="leading-relaxed text-muted">{detail.summary}</dd>
              </div>
            ) : null}
            {detail.consequence ? (
              <div>
                <dt className="mb-1 text-xs font-semibold uppercase tracking-wider text-faint">The risk</dt>
                <dd className="leading-relaxed text-muted">{detail.consequence}</dd>
              </div>
            ) : null}
            {detail.remedy ? (
              <div>
                <dt className="mb-1 text-xs font-semibold uppercase tracking-wider text-faint">The fix</dt>
                <dd className="leading-relaxed text-muted">{detail.remedy}</dd>
              </div>
            ) : null}
            {detail.notes ? (
              <div>
                <dt className="mb-1 text-xs font-semibold uppercase tracking-wider text-faint">Notes</dt>
                <dd className="leading-relaxed text-muted">{detail.notes}</dd>
              </div>
            ) : null}
          </dl>
          {detail.reportDate ? (
            <p className="mt-5 text-xs text-faint">
              Reported {detail.reportDate.toLocaleDateString('en-US', { dateStyle: 'long' })}
            </p>
          ) : null}
        </Card>
      </section>

      <section className="mt-10">
        <SectionHeading id="vehicles">
          Vehicles covered by {number} ({formatNumber(vehicles.length)})
        </SectionHeading>
        <div className="space-y-4">
          {[...byMake.entries()].sort((a, b) => b[1].length - a[1].length).map(([make, list]) => (
            <Card key={make} className="p-5 sm:p-6">
              <h3 className="mb-3 font-bold text-fg">
                {make} <span className="font-normal text-faint">({list.length})</span>
              </h3>
              <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {list
                  .sort((a, b) => a.model.localeCompare(b.model) || a.modelYear - b.modelYear)
                  .map((v) => (
                    <li key={v.slug}>
                      <Link href={`/recalls/${v.slug}`} className="inline-flex min-h-11 items-center text-accent hover:underline">
                        {v.modelYear} {v.make} {v.model}
                      </Link>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <SectionHeading>Is my car affected?</SectionHeading>
        <Prose className="space-y-4">
          <p>
            Being on this list means your year, make and model fall inside campaign {number}. It does
            not mean your individual car does: a campaign covers a range of VINs built in a specific
            window, and cars either side of that window are untouched.
          </p>
          <p>
            Check the 17-character VIN from the driver-side dashboard or door jamb against{' '}
            <a href="https://www.nhtsa.gov/recalls" rel="nofollow noopener" target="_blank" className="text-accent hover:underline">
              NHTSA&apos;s lookup
            </a>
            . If it is covered, the dealer must do the work free of charge, regardless of the car&apos;s
            age or mileage.
          </p>
        </Prose>
      </section>

      <div className="mt-10 border-t border-edge pt-6">
        <ShareBar title={`NHTSA recall ${number}`} summary={answer} />
      </div>
    </Page>
  );
}
