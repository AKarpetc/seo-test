import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, formatNumber, formatPhone, stateName, US_STATES } from '@/lib/site';
import { Page, Card, Breadcrumbs, PageHeader, JsonLd } from '@/components/Layout';
import { Pagination } from '@/components/Pagination';

export const revalidate = 86400;

const PER_PAGE = 50;

type Props = {
  params: Promise<{ state: string; city: string }>;
  searchParams: Promise<{ page?: string }>;
};

function cityLabel(raw: string) {
  return decodeURIComponent(raw)
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state, city } = await params;
  const code = state.toUpperCase();
  const label = cityLabel(city);
  const title = `Doctors in ${label}, ${code} — NPI Numbers, Specialties & Addresses`;
  const description = `Directory of registered doctors, clinics and medical organizations in ${label}, ${stateName(code)}. Search by specialty and view NPI numbers, practice addresses and phone numbers.`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/doctors/in/${state.toLowerCase()}/${city.toLowerCase()}`) },
    openGraph: { title, description },
  };
}

export default async function CityPage({ params, searchParams }: Props) {
  const { state, city } = await params;
  const { page: pageParam } = await searchParams;
  const code = state.toUpperCase();
  if (!US_STATES[code]) notFound();

  const label = cityLabel(city);
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
  // Cities are stored title-cased by the loader, so an exact match keeps the
  // (state, city, specialty) index in play; `mode: 'insensitive'` would force a scan.
  const where = { state: code, city: label };

  const [total, providers, specialties] = await Promise.all([
    prisma.doctor.count({ where }),
    prisma.doctor.findMany({
      where,
      select: {
        slug: true, npi: true, firstName: true, lastName: true, clinicName: true,
        credential: true, specialty: true, address: true, phone: true,
      },
      orderBy: { lastName: 'asc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.doctor.groupBy({
      by: ['specialty'],
      where,
      _count: { _all: true },
      orderBy: { _count: { specialty: 'desc' } },
      take: 20,
    }),
  ]);

  if (total === 0) notFound();
  const totalPages = Math.ceil(total / PER_PAGE);
  const basePath = `/doctors/in/${state.toLowerCase()}/${city.toLowerCase()}`;

  return (
    <Page>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `Doctors in ${label}, ${code}`,
          url: absoluteUrl(basePath),
          numberOfItems: total,
        }}
      />
      <Breadcrumbs
        items={[
          { label: 'Doctors', href: '/doctors' },
          { label: stateName(code), href: `/doctors/in/${state.toLowerCase()}` },
          { label },
        ]}
      />
      <PageHeader
        eyebrow="CMS NPPES Registry"
        title={`Doctors & Medical Providers in ${label}, ${code}`}
        subtitle={`${formatNumber(total)} providers registered in ${label}, ${stateName(code)}. Page ${page} of ${formatNumber(totalPages)}.`}
      />

      {specialties.length > 0 ? (
        <Card className="p-6 mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Specialties in {label}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {specialties.map((s) => (
              <li key={s.specialty} className="text-sm bg-slate-100 text-slate-700 rounded-full px-3 py-1">
                {s.specialty} ({formatNumber(s._count._all)})
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Provider</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Specialty</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">NPI</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Phone</th>
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
                    {d.address ? <div className="text-slate-500 text-xs mt-0.5">{d.address}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{d.specialty}</td>
                  <td className="px-4 py-3 font-mono text-slate-500 text-xs">{d.npi}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatPhone(d.phone) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination basePath={basePath} page={page} totalPages={totalPages} />
    </Page>
  );
}
