import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, formatPhone, stateName } from '@/lib/site';
import { Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd } from '@/components/Layout';

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

async function getDoctor(slug: string) {
  return prisma.doctor.findUnique({ where: { slug } });
}

function displayName(d: { firstName: string | null; lastName: string | null; clinicName: string | null; credential: string | null }) {
  if (d.clinicName) return d.clinicName;
  const base = [d.firstName, d.lastName].filter(Boolean).join(' ');
  return d.credential ? `${base}, ${d.credential}` : base;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doctor = await getDoctor(slug);
  if (!doctor) return { title: 'Provider not found' };

  const name = displayName(doctor);
  const title = `${name} — ${doctor.specialty} in ${doctor.city}, ${doctor.state} | NPI ${doctor.npi}`;
  const description = `NPI ${doctor.npi}: ${name} is a ${doctor.specialty} located in ${doctor.city}, ${stateName(doctor.state)} ${doctor.zip}. Address, phone number and taxonomy details from the CMS NPPES registry.`;

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/doctors/${doctor.slug}`) },
    openGraph: { title, description, type: 'profile', url: absoluteUrl(`/doctors/${doctor.slug}`) },
  };
}

export default async function DoctorPage({ params }: Props) {
  const { slug } = await params;
  const doctor = await getDoctor(slug);
  if (!doctor) notFound();

  const [sameSpecialty, cityCount] = await Promise.all([
    prisma.doctor.findMany({
      where: { city: doctor.city, state: doctor.state, specialty: doctor.specialty, NOT: { id: doctor.id } },
      select: { slug: true, firstName: true, lastName: true, clinicName: true, credential: true },
      take: 8,
    }),
    prisma.doctor.count({ where: { city: doctor.city, state: doctor.state } }),
  ]);

  const name = displayName(doctor);
  const phone = formatPhone(doctor.phone);
  const isOrg = doctor.entityType === '2';

  return (
    <Page>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': isOrg ? 'MedicalOrganization' : 'Physician',
          name,
          identifier: { '@type': 'PropertyValue', propertyID: 'NPI', value: doctor.npi },
          medicalSpecialty: doctor.specialty,
          ...(phone ? { telephone: phone } : {}),
          address: {
            '@type': 'PostalAddress',
            streetAddress: doctor.address || undefined,
            addressLocality: doctor.city,
            addressRegion: doctor.state,
            postalCode: doctor.zip,
            addressCountry: 'US',
          },
          url: absoluteUrl(`/doctors/${doctor.slug}`),
        }}
      />

      <Breadcrumbs
        items={[
          { label: 'Doctors', href: '/doctors' },
          { label: stateName(doctor.state), href: `/doctors/in/${doctor.state.toLowerCase()}` },
          { label: doctor.city, href: `/doctors/in/${doctor.state.toLowerCase()}/${encodeURIComponent(doctor.city.toLowerCase())}` },
          { label: name },
        ]}
      />

      <PageHeader
        eyebrow={doctor.specialty}
        title={name}
        subtitle={`${isOrg ? 'Healthcare organization' : 'Healthcare provider'} registered with CMS in ${doctor.city}, ${stateName(doctor.state)}.`}
      />

      <Card className="p-6 sm:p-8">
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="NPI Number" value={<span className="font-mono">{doctor.npi}</span>} />
          <Stat label="Specialty" value={doctor.specialty} hint={doctor.taxonomyCode ? `NUCC ${doctor.taxonomyCode}` : undefined} />
          <Stat label="Phone" value={phone || 'Not listed'} />
          <Stat label="Entity Type" value={isOrg ? 'Organization' : 'Individual'} />
        </dl>

        <div className="mt-8">
          <h2 className="text-xl font-bold text-slate-900 mb-3">Practice location</h2>
          <address className="not-italic text-slate-700 leading-relaxed">
            {doctor.address ? (
              <>
                {doctor.address}
                <br />
              </>
            ) : null}
            {doctor.city}, {doctor.state} {doctor.zip}
          </address>
        </div>

        <div className="mt-8 prose prose-slate max-w-none text-slate-600">
          <h2 className="text-xl font-bold text-slate-900">About this NPI record</h2>
          <p>
            <strong>{name}</strong> holds National Provider Identifier <strong>{doctor.npi}</strong>, a
            ten-digit number issued by the Centers for Medicare &amp; Medicaid Services. It is the identifier
            used on insurance claims, prescriptions and electronic health records, and it stays with the
            provider for life even if the practice moves or changes name.
          </p>
          <p>
            The registered taxonomy is <strong>{doctor.specialty}</strong>
            {doctor.taxonomyCode ? ` (NUCC code ${doctor.taxonomyCode})` : ''}, and the practice address on
            file is in {doctor.city}, {stateName(doctor.state)}. There are{' '}
            <strong>{cityCount.toLocaleString()}</strong> registered providers in {doctor.city} overall.
            Always confirm current licensure with your state medical board before booking care.
          </p>
        </div>
      </Card>

      {sameSpecialty.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Other {doctor.specialty} providers in {doctor.city}
          </h2>
          <Card className="divide-y divide-slate-200">
            {sameSpecialty.map((d) => (
              <Link key={d.slug} href={`/doctors/${d.slug}`} className="block px-6 py-3 hover:bg-slate-50 text-blue-600">
                {d.clinicName || [d.firstName, d.lastName].filter(Boolean).join(' ')}
              </Link>
            ))}
          </Card>
        </section>
      ) : null}
    </Page>
  );
}
