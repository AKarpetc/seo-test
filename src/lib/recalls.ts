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

/**
 * Vehicle categories as stored by the recall loader. Order is display order on
 * the index: cars first because that is most of the traffic.
 */
export const CATEGORIES: { key: string; label: string; noun: string; plural: string; schema: string; vin: string }[] = [
  { key: 'car', label: 'Cars, trucks and SUVs', noun: 'car', plural: 'cars', schema: 'Car',
    vin: 'on the driver-side dashboard, visible through the windshield, or on the door jamb sticker' },
  { key: 'rv', label: 'RVs, motorhomes and campers', noun: 'RV', plural: 'RVs', schema: 'Vehicle',
    vin: 'on a plate near the entry door, inside a cabinet, or on the trailer tongue for a towable' },
  { key: 'motorcycle', label: 'Motorcycles', noun: 'motorcycle', plural: 'motorcycles', schema: 'Motorcycle',
    vin: 'stamped on the steering head, just behind the headlight, and on the frame label' },
  { key: 'powersports', label: 'ATVs, side-by-sides and snowmobiles', noun: 'vehicle', plural: 'vehicles', schema: 'Vehicle',
    vin: 'on the frame, usually near the footwell or under the seat' },
  { key: 'trailer', label: 'Trailers', noun: 'trailer', plural: 'trailers', schema: 'Vehicle',
    vin: 'on a plate or sticker on the tongue or the front of the frame' },
];

export function categoryOf(key: string) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];
}

export type TopComponent = { component: string; count: number };

/** topComponents is stored as JSON text; a bad value must not break the page. */
export function parseTopComponents(raw: string | null): TopComponent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.component === 'string') : [];
  } catch {
    return [];
  }
}

export function titleCaseComponent(value: string): string {
  return value.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}
