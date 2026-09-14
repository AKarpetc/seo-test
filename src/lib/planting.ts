/**
 * Turns the two frost dates into the dates a gardener actually acts on.
 *
 * NOAA publishes the normals as display strings ("April 4"), so they are parsed
 * back to a day of year, shifted by the offsets standard growing guides use, and
 * formatted again. The year is arbitrary and never shown; only month and day are.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** A non-leap reference year keeps 29 February out of the output. */
const REFERENCE_YEAR = 2001;

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = value.trim().match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  if (!match) return null;
  const month = MONTHS.findIndex((m) => m.toLowerCase() === match[1].toLowerCase());
  if (month < 0) return null;
  const day = parseInt(match[2], 10);
  if (day < 1 || day > 31) return null;
  return new Date(Date.UTC(REFERENCE_YEAR, month, day));
}

function format(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function shift(date: Date, days: number): Date {
  const out = new Date(date.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export type PlantingTask = { window: string; what: string; why: string };

/**
 * The offsets below are the ones common growing guides agree on; they are
 * deliberately given as ranges because a normal is an average, not a promise.
 */
export function plantingCalendar(
  lastSpringFrost: string | null | undefined,
  firstFallFrost: string | null | undefined,
): PlantingTask[] {
  const spring = parse(lastSpringFrost);
  const fall = parse(firstFallFrost);
  const tasks: PlantingTask[] = [];

  if (spring) {
    tasks.push({
      window: `${format(shift(spring, -70))} – ${format(shift(spring, -56))}`,
      what: 'Start peppers and aubergines indoors',
      why: 'They need eight to ten weeks under lights before they can go out.',
    });
    tasks.push({
      window: `${format(shift(spring, -56))} – ${format(shift(spring, -42))}`,
      what: 'Start tomatoes indoors',
      why: 'Six to eight weeks gives a transplant big enough to set fruit early.',
    });
    tasks.push({
      window: `${format(shift(spring, -28))} – ${format(shift(spring, -14))}`,
      what: 'Sow peas, spinach, lettuce, radish outdoors',
      why: 'These tolerate light frost and prefer to germinate in cool soil.',
    });
    tasks.push({
      window: `${format(spring)} onward`,
      what: 'Transplant tomatoes, peppers, basil, squash, cucumbers',
      why: 'The average last freeze has passed — still watch the actual forecast.',
    });
  }

  if (fall) {
    tasks.push({
      window: `by ${format(shift(fall, -84))}`,
      what: 'Sow the autumn crop of carrots, beets and brassicas',
      why: 'They need about twelve weeks to size up before growth stops.',
    });
    tasks.push({
      window: `by ${format(shift(fall, -14))}`,
      what: 'Harvest tender crops, or be ready to cover them',
      why: 'A first freeze two weeks early is well within normal variation.',
    });
    tasks.push({
      window: `${format(fall)} onward`,
      what: 'Plant garlic, mulch beds, lift tender bulbs',
      why: 'Garlic wants a cold spell; bare soil loses structure over winter.',
    });
  }

  return tasks;
}

/** Both frost dates as a single sentence, for meta descriptions and answer boxes. */
export function frostSummary(
  lastSpringFrost: string | null | undefined,
  firstFallFrost: string | null | undefined,
  growingDays: number | null | undefined,
): string | null {
  if (!lastSpringFrost || !firstFallFrost) return null;
  const days = growingDays ? ` That leaves about ${growingDays} frost-free days.` : '';
  return `Plant tender crops after ${lastSpringFrost}, and expect the first autumn freeze around ${firstFallFrost}.${days}`;
}
