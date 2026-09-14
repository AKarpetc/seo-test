import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, formatNumber, formatPhone, stateName } from '@/lib/site';
import { Page, Card, Breadcrumbs, PageHeader, JsonLd } from '@/components/Layout';

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

async function getAggregate(slug: string) {
  return prisma.doctorSpecialtyCity.findUnique({ where: { slug } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const agg = await getAggregate(slug);
  if (!agg) return { title: 'Not found' };

  const title = `${agg.specialty} in ${agg.city}, ${agg.state} — ${agg.providerCount} Providers`;
  const description = `${agg.providerCount} registered ${agg.specialty} providers in ${agg.city}, ${stateName(agg.state)}. NPI numbers, practice addresses and phone numbers from the CMS NPPES registry.`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/doctors/specialty/${slug}`) },
    openGraph: { title, description },
  };
}

export default async function SpecialtyCityPage({ params }: Props) {
  const { slug } = await params;
  const agg = await getAggregate(slug);
  if (!agg) notFound();

  const [providers, nearby] = await Promise.all([
    prisma.doctor.findMany({
      where: { specialty: agg.specialty, city: agg.city, state: agg.state },
      select: { slug: true, npi: true, firstName: true, lastName: true, clinicName: true, credential: true, address: true, phone: true },
      orderBy: { lastName: 'asc' },
      take: 100,
    }),
    prisma.doctorSpecialtyCity.findMany({
      where: { specialty: agg.specialty, state: agg.state, NOT: { id: agg.id } },
      orderBy: { providerCount: 'desc' },
      take: 12,
    }),
  ]);

  return (
    <Page>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `${agg.specialty} in ${agg.city}, ${agg.state}`,
          url: absoluteUrl(`/doctors/specialty/${slug}`),
          numberOfItems: agg.providerCount,
        }}
      />
      <Breadcrumbs
        items={[
          { label: 'Doctors', href: '/doctors' },
          { label: stateName(agg.state), href: `/doctors/in/${agg.state.toLowerCase()}` },
          { label: agg.city, href: `/doctors/in/${agg.state.toLowerCase()}/${encodeURIComponent(agg.city.toLowerCase())}` },
          { label: agg.specialty },
        ]}
      />
      <PageHeader
        eyebrow={`${agg.city}, ${stateName(agg.state)}`}
        title={`${agg.specialty} in ${agg.city}, ${agg.state}`}
        subtitle={`${formatNumber(agg.providerCount)} providers registered under this specialty${agg.taxonomyCode ? ` (NUCC taxonomy ${agg.taxonomyCode})` : ''}.`}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Provider</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Address</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {providers.map((d) => (
                <tr key={d.npi} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/doctors/${d.slug}`} className="text-blue-600 hover:underline font-medium">
                      {d.clinicName || [d.firstName, d.lastName].filter(Boolean).join(' ')}
                      {d.credential ? `, ${d.credential}` : ''}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{d.address || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatPhone(d.phone) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {nearby.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            {agg.specialty} in other {stateName(agg.state)} cities
          </h2>
          <Card className="p-6">
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-y-2 gap-x-4">
              {nearby.map((n) => (
                <li key={n.slug}>
                  <Link href={`/doctors/specialty/${n.slug}`} className="text-blue-600 hover:underline">
                    {n.city}
                  </Link>
                  <span className="text-slate-400 text-sm ml-1">({formatNumber(n.providerCount)})</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </Page>
  );
}
