import Link from 'next/link';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, formatNumber, stateName, US_STATES } from '@/lib/site';
import { Page, Card, Breadcrumbs, PageHeader, EmptyState, JsonLd } from '@/components/Layout';

// Not prerendered: the build container has no database. The GROUP BY over 9M
// rows is cached at the data layer instead of caching the whole page.
export const dynamic = 'force-dynamic';

const getSummary = unstable_cache(
  async () =>
    Promise.all([
      prisma.doctor.count(),
      prisma.doctor.groupBy({ by: ['state'], _count: { _all: true }, orderBy: { _count: { state: 'desc' } } }),
      prisma.doctor.groupBy({
        by: ['specialty'],
        _count: { _all: true },
        orderBy: { _count: { specialty: 'desc' } },
        take: 24,
      }),
    ]),
  ['doctors-index-summary'],
  { revalidate: 86400 },
);

const title = 'US Doctor & Provider NPI Directory — Search 8 Million CMS Records';
const description =
  'Look up any US doctor, clinic or medical organization by NPI number, specialty or city. Addresses, phone numbers and taxonomy codes sourced from the CMS NPPES registry.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl('/doctors') },
  openGraph: { title, description, url: absoluteUrl('/doctors') },
};

export default async function DoctorsIndex() {
  const [total, byState, topSpecialties] = await getSummary();

  if (total === 0) {
    return (
      <Page>
        <PageHeader title="Doctor & Provider Directory" />
        <EmptyState dataset="doctors" />
      </Page>
    );
  }

  return (
    <Page>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: title,
          description,
          url: absoluteUrl('/doctors'),
        }}
      />
      <Breadcrumbs items={[{ label: 'Doctors' }]} />
      <PageHeader
        eyebrow="CMS NPPES Registry"
        title="US Doctor & Provider NPI Directory"
        subtitle={`${formatNumber(total)} active providers and healthcare organizations with a National Provider Identifier, browsable by state, city and specialty.`}
      />

      <section className="mb-12">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Browse by state</h2>
        <Card className="p-6">
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-y-2 gap-x-4">
            {byState
              .filter((s) => US_STATES[s.state])
              .map((s) => (
                <li key={s.state}>
                  <Link href={`/doctors/in/${s.state.toLowerCase()}`} className="text-blue-600 hover:underline">
                    {stateName(s.state)}
                  </Link>
                  <span className="text-slate-400 text-sm ml-1">({formatNumber(s._count._all)})</span>
                </li>
              ))}
          </ul>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Most common specialties</h2>
        <Card className="p-6">
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-6">
            {topSpecialties.map((s) => (
              <li key={s.specialty} className="text-slate-700">
                {s.specialty}
                <span className="text-slate-400 text-sm ml-1">({formatNumber(s._count._all)})</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </Page>
  );
}
