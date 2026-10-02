import places from '@/data/hail-places.json';

/** States in the hail belt, where a link to hail history is relevant to a storm-history reader. */
export const HAIL_STATES = ['tx', 'ok', 'ks', 'ne', 'co', 'sd', 'nd', 'ia', 'mn', 'mo', 'wy', 'mt', 'nm'] as const;

const HAIL_ORIGIN = 'https://myhailmap.com';
const byState = places as Record<string, Record<string, string>>;

/** Matching key for a city name: "Saint Louis", "St. Louis" and "Lee's Summit" / "Lees Summit" meet. */
export function cityKey(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\bsaint\b/g, 'st')
    .replace(/[^a-z0-9]/g, '');
}

function tagged(path: string, medium: 'city' | 'state'): string {
  return `${HAIL_ORIGIN}${path}?utm_source=stormsthathit&utm_medium=${medium}`;
}

/** Link to the city's hail page on myhailmap.com, or null outside the hail belt or when it has no page. */
export function hailCityUrl(state: string, city: string): string | null {
  const st = state.toLowerCase();
  const slug = byState[st]?.[cityKey(city)];
  return slug ? tagged(`/hail/${st}/${slug}`, 'city') : null;
}

/** Link to the state's hail page on myhailmap.com, or null outside the hail belt. */
export function hailStateUrl(state: string): string | null {
  const st = state.toLowerCase();
  return byState[st] ? tagged(`/hail/${st}`, 'state') : null;
}
