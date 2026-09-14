import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, formatNumber, formatPhone, stateName } from '@/lib/site';
import { Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd } from '@/components/Layout';

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

const get = (slug: string) => prisma.dOTCarrier.findUnique({ where: { slug } });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await get(slug);
  if (!c) return { title: 'Carrier not found' };

  const title = `${c.companyName} — USDOT ${c.dotNumber} | Fleet Size & Carrier Profile`;
  const description = `FMCSA census record for USDOT ${c.dotNumber}, ${c.companyName}${c.city ? ` of ${c.city}, ${stateName(c.state)}` : ''}. Fleet size, driver count and operating authority.`;
  return { title, description, alternates: { canonical: absoluteUrl(`/trucking/${slug}`) }, openGraph: { title, description } };
}

export default async function CarrierPage({ params }: Props) {
  const { slug } = await params;
  const c = await get(slug);
  if (!c) notFound();

  const stateTotal = c.state ? await prisma.dOTCarrier.count({ where: { state: c.state } }) : 0;

  return (
    <Page>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'MovingCompany', name: c.companyName,
        identifier: { '@type': 'PropertyValue', propertyID: 'USDOT', value: c.dotNumber },
        telephone: formatPhone(c.phone) || undefined,
        address: {
          '@type': 'PostalAddress', streetAddress: c.address || undefined,
          addressLocality: c.city || undefined, addressRegion: c.state || undefined,
          postalCode: c.zip || undefined, addressCountry: 'US',
        },
        url: absoluteUrl(`/trucking/${slug}`),
      }} />
      <Breadcrumbs items={[{ label: 'Carriers', href: '/trucking' }, { label: c.companyName }]} />
      <PageHeader eyebrow={`USDOT ${c.dotNumber}`} title={c.companyName}
        subtitle={c.dbaName && c.dbaName !== c.companyName ? `Doing business as ${c.dbaName}` : undefined} />

      <Card className="p-6 sm:p-8">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="USDOT Number" value={<span className="font-mono">{c.dotNumber}</span>} />
          <Stat label="Power Units" value={formatNumber(c.fleetSize)} hint="Trucks and tractors" />
          <Stat label="Drivers" value={formatNumber(c.driverCount)} />
          <Stat label="Operation" value={c.carrierOperation || '—'} />
        </dl>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Principal place of business</h2>
            <address className="not-italic text-slate-700 leading-relaxed">
              {c.address ? <>{c.address}<br /></> : null}
              {c.city}, {c.state} {c.zip}
            </address>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Contact</h2>
            <p className="text-slate-700">{formatPhone(c.phone) || 'Not listed'}</p>
          </div>
        </div>

        <div className="mt-8 prose prose-slate max-w-none text-slate-600">
          <h2 className="text-lg font-bold text-slate-900">About USDOT {c.dotNumber}</h2>
          <p>
            <strong>{c.companyName}</strong> is registered with the Federal Motor Carrier Safety
            Administration under USDOT number <strong>{c.dotNumber}</strong>
            {c.carrierOperation ? ` with ${c.carrierOperation.toLowerCase()} operating authority` : ''}.
            The census record lists {formatNumber(c.fleetSize)} power units and{' '}
            {formatNumber(c.driverCount)} drivers.
            {stateTotal > 0 ? ` It is one of ${formatNumber(stateTotal)} active carriers based in ${stateName(c.state)}.` : ''}
          </p>
          <p>
            Carriers must update their MCS-150 census form every two years. Current safety ratings,
            inspection history and crash data are published separately by FMCSA and are not included here.
          </p>
        </div>
      </Card>
    </Page>
  );
}
