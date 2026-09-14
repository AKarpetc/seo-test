import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, stateName } from '@/lib/site';
import { Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd } from '@/components/Layout';

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

const get = (slug: string) => prisma.bankBranch.findUnique({ where: { slug } });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await get(slug);
  if (!b) return { title: 'Branch not found' };

  const title = `${b.bankName} — ${b.city}, ${b.state} Branch | FDIC Cert ${b.cert ?? ''}`.trim();
  const description = `${b.bankName} branch at ${b.address ?? b.city}, ${b.city}, ${stateName(b.state)} ${b.zip ?? ''}. FDIC certificate, office number and branch details from the FDIC BankFind registry.`;
  return { title, description, alternates: { canonical: absoluteUrl(`/banks/${slug}`) }, openGraph: { title, description } };
}

export default async function BankPage({ params }: Props) {
  const { slug } = await params;
  const b = await get(slug);
  if (!b) notFound();

  const nearby = await prisma.bankBranch.findMany({
    where: { city: b.city, state: b.state, NOT: { id: b.id } },
    select: { slug: true, bankName: true, branchName: true },
    take: 12,
  });

  return (
    <Page>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'BankOrCreditUnion', name: b.bankName,
        branchOf: b.branchName && b.branchName !== b.bankName ? b.branchName : undefined,
        address: {
          '@type': 'PostalAddress', streetAddress: b.address || undefined,
          addressLocality: b.city || undefined, addressRegion: b.state || undefined,
          postalCode: b.zip || undefined, addressCountry: 'US',
        },
        ...(b.lat && b.lng ? { geo: { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng } } : {}),
        url: absoluteUrl(`/banks/${slug}`),
      }} />
      <Breadcrumbs items={[{ label: 'Banks', href: '/banks' }, { label: `${b.city}, ${b.state}` }, { label: b.bankName }]} />
      <PageHeader eyebrow="FDIC Insured Institution" title={b.bankName}
        subtitle={`${b.branchName && b.branchName !== b.bankName ? `${b.branchName} — ` : ''}${b.city}, ${stateName(b.state)}`} />

      <Card className="p-6 sm:p-8">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="FDIC Certificate" value={<span className="font-mono">{b.cert ?? '—'}</span>} />
          <Stat label="Office Number" value={<span className="font-mono">{b.uninum}</span>} />
          <Stat label="County" value={b.county || '—'} />
          <Stat label="Established" value={b.established ? b.established.getFullYear() : '—'} />
        </dl>

        <div className="mt-8">
          <h2 className="text-lg font-bold text-slate-900 mb-2">Branch address</h2>
          <address className="not-italic text-slate-700 leading-relaxed">
            {b.address ? <>{b.address}<br /></> : null}
            {b.city}, {b.state} {b.zip}
          </address>
        </div>

        <div className="mt-8 prose prose-slate max-w-none text-slate-600">
          <h2 className="text-lg font-bold text-slate-900">Routing numbers and this branch</h2>
          <p>
            <strong>{b.bankName}</strong> is insured by the FDIC under certificate{' '}
            <strong>{b.cert ?? 'n/a'}</strong>. A routing number identifies the institution rather than
            an individual branch, so every office of {b.bankName} in {stateName(b.state)} normally shares
            the same routing number for ACH and wire transfers.
          </p>
          <p>
            Confirm the routing number on your own check or in online banking before sending a wire.
            Deposit insurance covers $250,000 per depositor, per ownership category, per insured bank —
            not per branch.
          </p>
        </div>
      </Card>

      {nearby.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Other bank branches in {b.city}, {b.state}</h2>
          <Card className="divide-y divide-slate-200">
            {nearby.map((n) => (
              <Link key={n.slug} href={`/banks/${n.slug}`} className="block px-6 py-3 hover:bg-slate-50 text-blue-600">
                {n.bankName}
                {n.branchName && n.branchName !== n.bankName ? <span className="text-slate-500"> — {n.branchName}</span> : null}
              </Link>
            ))}
          </Card>
        </section>
      ) : null}
    </Page>
  );
}
