import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { absoluteUrl } from '@/lib/site';
import { CHUNK_SIZE } from '@/app/sitemap.xml/route';

// Dynamic for the same reason as the index: the origin is a runtime value.
export const dynamic = 'force-dynamic';

type Loader = (skip: number, take: number) => Promise<{ slug: string; updatedAt: Date }[]>;

/** One entry per sitemap chunk namespace; the path prefix is where each slug lives. */
const LOADERS: Record<string, { prefix: string; load: Loader }> = {
  doctors: {
    prefix: '/doctors',
    load: (skip, take) => prisma.doctor.findMany({ select: { slug: true, updatedAt: true }, orderBy: { id: 'asc' }, skip, take }),
  },
  'doctor-specialties': {
    prefix: '/doctors/specialty',
    load: (skip, take) => prisma.doctorSpecialtyCity.findMany({ select: { slug: true, updatedAt: true }, orderBy: { id: 'asc' }, skip, take }),
  },
  banks: {
    prefix: '/banks',
    load: (skip, take) => prisma.bankBranch.findMany({ select: { slug: true, updatedAt: true }, orderBy: { id: 'asc' }, skip, take }),
  },
  aircraft: {
    prefix: '/aircraft',
    load: (skip, take) => prisma.aircraft.findMany({ select: { slug: true, updatedAt: true }, orderBy: { id: 'asc' }, skip, take }),
  },
  trucking: {
    prefix: '/trucking',
    load: (skip, take) => prisma.dOTCarrier.findMany({ select: { slug: true, updatedAt: true }, orderBy: { id: 'asc' }, skip, take }),
  },
  nutrition: {
    prefix: '/nutrition',
    load: (skip, take) => prisma.foodNutrition.findMany({ select: { slug: true, updatedAt: true }, orderBy: { id: 'asc' }, skip, take }),
  },
  frost: {
    prefix: '/frost',
    load: (skip, take) =>
      prisma.zipClimate.findMany({
        // Station pages cover the same intent, so only the ZIP pages are submitted.
        where: { population: { gte: 2000 } },
        select: { slug: true, updatedAt: true },
        orderBy: { id: 'asc' },
        skip,
        take,
      }),
  },
  executives: {
    prefix: '/executives',
    load: (skip, take) => prisma.sECExecutive.findMany({ select: { slug: true, updatedAt: true }, orderBy: { id: 'asc' }, skip, take }),
  },
  demographics: {
    prefix: '/demographics',
    load: (skip, take) => prisma.censusDemographic.findMany({ select: { slug: true, updatedAt: true }, orderBy: { id: 'asc' }, skip, take }),
  },
  energy: {
    prefix: '/energy',
    load: (skip, take) => prisma.utilityRate.findMany({ select: { slug: true, updatedAt: true }, orderBy: { id: 'asc' }, skip, take }),
  },
  recalls: {
    prefix: '/recalls',
    load: (skip, take) => prisma.vehicle.findMany({ select: { slug: true, updatedAt: true }, orderBy: { id: 'asc' }, skip, take }),
  },
  cars: {
    prefix: '/cars',
    load: (skip, take) => prisma.car.findMany({ select: { slug: true, updatedAt: true }, orderBy: { id: 'asc' }, skip, take }),
  },
};

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dataset: string; chunk: string }> },
) {
  const { dataset, chunk } = await params;
  const entry = LOADERS[dataset];
  const index = parseInt(chunk.replace(/\.xml$/, ''), 10);

  if (!entry || Number.isNaN(index) || index < 0) {
    return new NextResponse('Not found', { status: 404 });
  }

  const rows = await entry.load(index * CHUNK_SIZE, CHUNK_SIZE);
  if (rows.length === 0) {
    return new NextResponse('Not found', { status: 404 });
  }

  const urls = rows
    .map(
      (r) =>
        `<url><loc>${escapeXml(absoluteUrl(`${entry.prefix}/${r.slug}`))}</loc><lastmod>${r.updatedAt.toISOString()}</lastmod><changefreq>monthly</changefreq></url>`,
    )
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
