import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, stateName } from '@/lib/site';
import { Page, Card, Stat, Breadcrumbs, PageHeader, JsonLd } from '@/components/Layout';

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

const get = (slug: string) => prisma.aircraft.findUnique({ where: { slug } });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await get(slug);
  if (!a) return { title: 'Aircraft not found' };

  const model = [a.manufacturer, a.modelName].filter(Boolean).join(' ') || 'aircraft';
  const title = `${a.nNumber} — ${model} Tail Number Lookup | FAA Registry`;
  const description = `FAA registration details for tail number ${a.nNumber}: ${model}${a.yearBuilt ? `, built ${a.yearBuilt}` : ''}. Registered owner, aircraft type, engine configuration and registration status.`;
  return { title, description, alternates: { canonical: absoluteUrl(`/aircraft/${slug}`) }, openGraph: { title, description } };
}

export default async function AircraftPage({ params }: Props) {
  const { slug } = await params;
  const a = await get(slug);
  if (!a) notFound();

  const sameModel = a.manufacturer && a.modelName
    ? await prisma.aircraft.findMany({
        where: { manufacturer: a.manufacturer, modelName: a.modelName, NOT: { id: a.id } },
        select: { slug: true, nNumber: true, yearBuilt: true },
        take: 10,
      })
    : [];

  const model = [a.manufacturer, a.modelName].filter(Boolean).join(' ') || 'Unknown model';

  return (
    <Page>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'Vehicle', name: `${a.nNumber} ${model}`,
        vehicleIdentificationNumber: a.serialNumber || undefined,
        manufacturer: a.manufacturer || undefined, model: a.modelName || undefined,
        vehicleModelDate: a.yearBuilt ? String(a.yearBuilt) : undefined,
        url: absoluteUrl(`/aircraft/${slug}`),
      }} />
      <Breadcrumbs items={[{ label: 'Aircraft', href: '/aircraft' }, { label: a.nNumber }]} />
      <PageHeader eyebrow="FAA Aircraft Registry" title={`${a.nNumber} — ${model}`}
        subtitle={`Registration record for tail number ${a.nNumber}${a.city ? `, based in ${a.city}, ${stateName(a.state)}` : ''}.`} />

      <Card className="p-6 sm:p-8">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Tail Number" value={<span className="font-mono">{a.nNumber}</span>} />
          <Stat label="Manufacturer" value={a.manufacturer || '—'} />
          <Stat label="Model" value={a.modelName || '—'} />
          <Stat label="Year Built" value={a.yearBuilt ?? '—'} />
          <Stat label="Aircraft Type" value={a.aircraftType || '—'} />
          <Stat label="Engine Type" value={a.engineType || '—'} />
          <Stat label="Engines" value={a.engineCount ?? '—'} />
          <Stat label="Seats" value={a.seats ?? '—'} />
        </dl>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Registered owner</h2>
            <p className="text-slate-700">{a.ownerName || 'Not listed'}</p>
            {a.ownerType ? <p className="text-sm text-slate-500 mt-1">{a.ownerType}</p> : null}
            {a.city ? (
              <address className="not-italic text-slate-600 mt-2 text-sm">
                {a.address ? <>{a.address}<br /></> : null}
                {a.city}, {a.state} {a.zip}
              </address>
            ) : null}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Registration</h2>
            <p className="text-slate-700">{a.statusCode || 'Unknown status'}</p>
            {a.serialNumber ? <p className="text-sm text-slate-500 mt-1">Serial number {a.serialNumber}</p> : null}
            {a.certIssueDate ? (
              <p className="text-sm text-slate-500 mt-1">
                Certificate issued {a.certIssueDate.toLocaleDateString('en-US', { dateStyle: 'long' })}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-8 prose prose-slate max-w-none text-slate-600">
          <h2 className="text-lg font-bold text-slate-900">About tail number {a.nNumber}</h2>
          <p>
            Every civil aircraft flying in the United States carries an N-number issued by the FAA.
            {' '}<strong>{a.nNumber}</strong> is assigned to a {model}
            {a.yearBuilt ? ` manufactured in ${a.yearBuilt}` : ''}
            {a.ownerName ? ` and registered to ${a.ownerName}` : ''}. Registration must be renewed
            every seven years; the status above reflects the most recent FAA releasable file.
          </p>
        </div>
      </Card>

      {sameModel.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Other registered {model} aircraft</h2>
          <Card className="p-6">
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {sameModel.map((o) => (
                <li key={o.slug}>
                  <Link href={`/aircraft/${o.slug}`} className="text-blue-600 hover:underline font-mono text-sm">
                    {o.nNumber}
                  </Link>
                  {o.yearBuilt ? <span className="text-slate-400 text-xs ml-1">({o.yearBuilt})</span> : null}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </Page>
  );
}
