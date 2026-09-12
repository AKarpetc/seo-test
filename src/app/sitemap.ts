import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // Fetch all slugs for our niches
  const salaries = await prisma.salary.findMany({ select: { slug: true, updatedAt: true } });
  const cars = await prisma.car.findMany({ select: { slug: true, updatedAt: true } });
  const weather = await prisma.weather.findMany({ select: { slug: true, updatedAt: true } });

  const salaryUrls = salaries.map((s) => ({
    url: `${baseUrl}/salaries/${s.slug}`,
    lastModified: s.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const carUrls = cars.map((c) => ({
    url: `${baseUrl}/cars/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const weatherUrls = weather.map((w) => ({
    url: `${baseUrl}/weather/${w.slug}`,
    lastModified: w.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...salaryUrls,
    ...carUrls,
    ...weatherUrls,
  ];
}
