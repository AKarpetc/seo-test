import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/site';

/**
 * Make and model hub routes are addressed by slug, but the database stores the
 * original spelling ("MERCEDES-BENZ", "F-150 LIGHTNING"). Slugging is lossy and
 * cannot be reversed, so the whole set of distinct values is slugged once and
 * kept as a lookup. There are 41 makes and roughly 1,200 pairs, which is small
 * enough to hold and cheap enough to build.
 *
 * The cached layer returns arrays, not Maps: unstable_cache stores its value as
 * JSON, and a Map survives that round trip as an empty object.
 */

export type MakeModel = { make: string; model: string };

const cachedMakes = unstable_cache(
  async (): Promise<string[]> => {
    const rows = await prisma.vehicle.findMany({ select: { make: true }, distinct: ['make'] });
    return rows.map((r) => r.make);
  },
  ['recalls-makes'],
  { revalidate: 86400 },
);

const cachedModels = unstable_cache(
  async (): Promise<MakeModel[]> => {
    const rows = await prisma.vehicle.findMany({
      select: { make: true, model: true },
      distinct: ['make', 'model'],
    });
    return rows.map((r) => ({ make: r.make, model: r.model }));
  },
  ['recalls-models'],
  { revalidate: 86400 },
);

export async function makeBySlug(): Promise<Map<string, string>> {
  const makes = await cachedMakes();
  return new Map(makes.map((make) => [slugify(make), make]));
}

export async function modelBySlug(): Promise<Map<string, MakeModel>> {
  const models = await cachedModels();
  return new Map(models.map((m) => [slugify(`${m.make}-${m.model}`), m]));
}

export function modelSlug(make: string, model: string): string {
  return slugify(`${make}-${model}`);
}
