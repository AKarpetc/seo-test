import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, formatNumber, stateName, US_STATES } from '@/lib/site';
import { Page, Card, Breadcrumbs, PageHeader, JsonLd } from '@/components/Layout';

export const revalidate = 86400;

type Props = { params: Promise<{ state: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state } = await params;
  const code = state.toUpperCase();
  if (!US_STATES[code]) return { title: 'State not found' };

  const title = `Doctors & Medical Providers in ${stateName(code)} — NPI Lookup by City`;
  const description = `Browse every registered doctor, clinic and healthcare organization in ${stateName(code)} by city. NPI numbers, specialties and practice addresses from the CMS NPPES registry.`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/doctors/in/${state.toLowerCase()}`) },
    openGraph: { title, description },
  };
}

export default async function StatePage({ params }: Props) {
  const { state } = await params;
  const code = state.toUpperCase();
  if (!US_STATES[code]) notFound();

  const [total, cities, specialties] = await Promise.all([
    prisma.doctor.count({ where: { state: code } }),
    prisma.doctor.groupBy({
      by: ['city'],
      where: { state: code },
      _count: { _all: true },
      orderBy: { _count: { city: 'desc' } },
      take: 200,
    }),
    prisma.doctor.groupBy({
      by: ['specialty'],
      where: { state: code },
      _count: { _all: true },
      orderBy: { _count: { specialty: 'desc' } },
      take: 15,
    }),
  ]);

  if (total === 0) notFound();

  return (
    <Page>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `Doctors in ${stateName(code)}`,
          url: absoluteUrl(`/doctors/in/${state.toLowerCase()}`),
        }}
      />
      <Breadcrumbs items={[{ label: 'Doctors', href: '/doctors' }, { label: stateName(code) }]} />
      <PageHeader
        eyebrow="CMS NPPES Registry"
        title={`Doctors & Medical Providers in ${stateName(code)}`}
        subtitle={`${formatNumber(total)} registered providers across ${formatNumber(cities.length)} cities in ${stateName(code)}.`}
      />

      <section className="mb-10">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Top specialties in {stateName(code)}</h2>
        <Card className="p-6">
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-6 text-slate-700">
            {specialties.map((s) => (
              <li key={s.specialty}>
                {s.specialty} <span className="text-slate-400 text-sm">({formatNumber(s._count._all)})</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Browse by city</h2>
        <Card className="p-6">
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-y-2 gap-x-4">
            {cities.map((c) => (
              <li key={c.city}>
                <Link
                  href={`/doctors/in/${state.toLowerCase()}/${encodeURIComponent(c.city.toLowerCase())}`}
                  className="text-blue-600 hover:underline"
                >
                  {c.city}
                </Link>
                <span className="text-slate-400 text-sm ml-1">({formatNumber(c._count._all)})</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </Page>
  );
}
