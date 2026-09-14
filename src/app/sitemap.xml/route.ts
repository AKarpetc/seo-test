import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { absoluteUrl } from '@/lib/site';

/**
 * A sitemap index, not a urlset: Google caps one sitemap at 50,000 URLs and this
 * site has millions. Next's MetadataRoute.Sitemap can only emit a urlset, so this
 * is a route handler.
 *
 * Dynamic because the origin comes from NEXT_PUBLIC_SITE_URL at runtime; a
 * prerendered sitemap bakes in whatever origin the build machine had.
 */
export const dynamic = 'force-dynamic';

export const CHUNK_SIZE = 45_000;

const DATASETS = [
  { key: 'doctors', count: () => prisma.doctor.count() },
  { key: 'doctor-specialties', count: () => prisma.doctorSpecialtyCity.count() },
  { key: 'banks', count: () => prisma.bankBranch.count() },
  { key: 'aircraft', count: () => prisma.aircraft.count() },
  { key: 'trucking', count: () => prisma.dOTCarrier.count() },
  { key: 'nutrition', count: () => prisma.foodNutrition.count() },
  { key: 'frost', count: () => prisma.zipClimate.count() },
  { key: 'executives', count: () => prisma.sECExecutive.count() },
  { key: 'demographics', count: () => prisma.censusDemographic.count() },
  { key: 'energy', count: () => prisma.utilityRate.count() },
  { key: 'recalls', count: () => prisma.vehicle.count() },
  { key: 'cars', count: () => prisma.car.count() },
];

export async function GET() {
  const now = new Date().toISOString();
  const entries: string[] = [];

  for (const dataset of DATASETS) {
    const total = await dataset.count().catch(() => 0);
    const chunks = Math.ceil(total / CHUNK_SIZE);
    for (let i = 0; i < chunks; i++) {
      entries.push(
        `<sitemap><loc>${absoluteUrl(`/sitemaps/${dataset.key}/${i}.xml`)}</loc><lastmod>${now}</lastmod></sitemap>`,
      );
    }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
