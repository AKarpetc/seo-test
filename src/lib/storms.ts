/** Wind in knots to the Saffir-Simpson label a reader recognises. */
export function strengthLabel(windKt: number | null | undefined): string {
  if (windKt === null || windKt === undefined) return 'Unknown';
  if (windKt >= 137) return 'Category 5';
  if (windKt >= 113) return 'Category 4';
  if (windKt >= 96) return 'Category 3';
  if (windKt >= 83) return 'Category 2';
  if (windKt >= 64) return 'Category 1';
  if (windKt >= 34) return 'Tropical storm';
  return 'Tropical depression';
}

export function categoryLabel(category: number | null | undefined): string {
  if (category === null || category === undefined) return 'Unknown';
  return category === 0 ? 'Tropical storm' : `Category ${category}`;
}

export const KT_TO_MPH = 1.15078;

/** Storms before 1950 carry no name; "Unnamed" reads as a name, so say what it is. */
export function stormName(name: string, year: number): string {
  return name === 'Unnamed' ? `Unnamed ${year} storm` : name;
}

export function mph(windKt: number | null | undefined): string {
  return windKt ? `${Math.round(windKt * KT_TO_MPH)} mph` : '—';
}

/** The F scale before February 2007, the EF scale after it. */
export function tornadoRating(mag: number | null, date: Date): string {
  if (mag === null) return 'Unrated';
  return `${date < new Date('2007-02-01') ? 'F' : 'EF'}${mag}`;
}

export function decadeOf(date: Date): string {
  const y = date.getUTCFullYear();
  return `${Math.floor(y / 10) * 10}s`;
}

export const STORM_RADIUS_MILES = 75;
export const TORNADO_RADIUS_MILES = 25;
