import axios from 'axios';
import { prisma, trackRun, HTTP_HEADERS } from './lib/etl';

/**
 * NHTSA owner complaints and NCAP crash-test ratings for every vehicle already on
 * file. Both hang off the vehicle row, so a recall page gains a "what owners
 * report" section and a star rating without a single extra page being published.
 *
 * Complaints are counted, not stored: the page needs "412 complaints, 38 crashes,
 * most about the electrical system", not the 412 narratives.
 *
 *   npm run load:complaints              # vehicles not yet loaded
 *   COMPLAINTS_REFRESH=1 npm run load:complaints   # everything again
 *   RATINGS_ONLY=1 npm run load:complaints         # only cars still without any star rating
 */

const API = 'https://api.nhtsa.gov';
const CONCURRENCY = parseInt(process.env.COMPLAINT_CONCURRENCY || '6', 10);
const REFRESH = process.env.COMPLAINTS_REFRESH === '1';
const RATINGS_ONLY = process.env.RATINGS_ONLY === '1';

/** NHTSA answers "nothing on file" with HTTP 400 and a valid empty body. */
async function get<T>(path: string): Promise<T | null> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const { data } = await axios.get(`${API}${path}`, {
        headers: HTTP_HEADERS,
        timeout: 60_000,
        validateStatus: (status) => status === 200 || status === 400 || status === 404,
      });
      return data as T;
    } catch (err: any) {
      if (attempt === 5) {
        console.warn(`\n[!] ${path}: ${err.message}`);
        return null;
      }
      // 403 and 429 are NHTSA throttling, which clears after a real pause.
      const throttled = err.response?.status === 403 || err.response?.status === 429;
      await new Promise((r) => setTimeout(r, (throttled ? 15_000 : 1500) * attempt));
    }
  }
  return null;
}

type Complaint = {
  crash?: boolean; fire?: boolean; numberOfInjuries?: number; numberOfDeaths?: number;
  components?: string;
};
type ComplaintList = { count?: number; results?: Complaint[] };
type RatingList = { Results?: { VehicleId: number; VehicleDescription?: string }[] };
type Rating = {
  Results?: {
    OverallRating?: string; OverallFrontCrashRating?: string;
    OverallSideCrashRating?: string; RolloverRating?: string;
    FrontCrashDriversideRating?: string; SideCrashDriversideRating?: string;
  }[];
};

/**
 * A dropped connection must not end a run that has an hour of API calls behind
 * it, so writes are retried before giving up.
 */
async function persist(fn: () => Promise<unknown>): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await fn();
      return;
    } catch (err: any) {
      if (attempt === 5) throw err;
      console.warn(`\n[!] database write failed (${err.code ?? err.message}), retrying`);
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
}

/** "5" becomes 5; "Not Rated" and anything else becomes null. */
function stars(v: string | undefined): number | null {
  const n = parseInt(v || '', 10);
  return n >= 1 && n <= 5 ? n : null;
}

function summarise(rows: Complaint[]) {
  const components = new Map<string, number>();
  let crash = 0;
  let fire = 0;
  let injuries = 0;
  let deaths = 0;

  for (const r of rows) {
    if (r.crash) crash++;
    if (r.fire) fire++;
    injuries += r.numberOfInjuries || 0;
    deaths += r.numberOfDeaths || 0;
    for (const c of (r.components || '').split(',')) {
      const name = c.trim();
      if (!name) continue;
      components.set(name, (components.get(name) || 0) + 1);
    }
  }

  const top = [...components.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([component, count]) => ({ component, count }));

  return { crash, fire, injuries, deaths, top };
}

async function loadRatings(year: number, make: string, model: string) {
  const list = await get<RatingList>(
    `/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(make)}/model/${encodeURIComponent(model)}`,
  );
  const variants = list?.Results ?? [];
  let best: { overall: number | null; frontal: number | null; side: number | null; rollover: number | null } | null = null;

  // A model has several tested variants (FWD, AWD); the best-rated one is shown,
  // since that is how the manufacturers themselves quote it.
  for (const v of variants.slice(0, 2)) {
    const detail = await get<Rating>(`/SafetyRatings/VehicleId/${v.VehicleId}`);
    const r = detail?.Results?.[0];
    if (!r) continue;
    // Before 2011 NHTSA published no overall star; the driver-side frontal and
    // side ratings are what those model years have.
    const candidate = {
      overall: stars(r.OverallRating),
      frontal: stars(r.OverallFrontCrashRating) ?? stars(r.FrontCrashDriversideRating),
      side: stars(r.OverallSideCrashRating) ?? stars(r.SideCrashDriversideRating),
      rollover: stars(r.RolloverRating),
    };
    if (candidate.overall === null && candidate.frontal === null && candidate.side === null) continue;
    const score = (c: typeof candidate) => c.overall ?? Math.max(c.frontal ?? 0, c.side ?? 0);
    if (!best || score(candidate) > score(best)) best = candidate;
  }
  return best;
}

async function main() {
  await trackRun('complaints', `${API}/complaints`, async () => {
    const vehicles = await prisma.vehicle.findMany({
      where: RATINGS_ONLY
        ? { category: 'car', overallRating: null, frontalRating: null, sideRating: null }
        : REFRESH ? {} : { complaintsLoadedAt: null },
      select: { id: true, modelYear: true, make: true, model: true, category: true },
      orderBy: { id: 'asc' },
    });
    console.log(`[+] ${vehicles.length.toLocaleString()} vehicles to query`);

    let cursor = 0;
    let done = 0;
    let complaints = 0;
    let rated = 0;

    async function worker() {
      for (;;) {
        const i = cursor++;
        if (i >= vehicles.length) return;
        const v = vehicles[i];

        if (RATINGS_ONLY) {
          const rating = await loadRatings(v.modelYear, v.make, v.model);
          if (rating) rated++;
          await persist(() => prisma.vehicle.update({
            where: { id: v.id },
            data: {
              overallRating: rating?.overall ?? null,
              frontalRating: rating?.frontal ?? null,
              sideRating: rating?.side ?? null,
              rolloverRating: rating?.rollover ?? null,
              ratingsLoadedAt: new Date(),
            },
          }));
          done++;
          if (done % 25 === 0) process.stdout.write(`\r    ${done}/${vehicles.length} vehicles · ${rated} rated`);
          continue;
        }

        const data = await get<ComplaintList>(
          `/complaints/complaintsByVehicle?make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&modelYear=${v.modelYear}`,
        );
        const rows = data?.results ?? [];
        const s = summarise(rows);
        complaints += rows.length;

        // NCAP tests passenger vehicles only; asking about a travel trailer is a wasted call.
        const rating = v.category === 'car' ? await loadRatings(v.modelYear, v.make, v.model) : null;
        if (rating) rated++;

        await persist(() => prisma.vehicle.update({
          where: { id: v.id },
          data: {
            complaintCount: rows.length,
            crashCount: s.crash,
            fireCount: s.fire,
            injuryCount: s.injuries,
            deathCount: s.deaths,
            topComponents: s.top.length ? JSON.stringify(s.top) : null,
            overallRating: rating?.overall ?? null,
            frontalRating: rating?.frontal ?? null,
            sideRating: rating?.side ?? null,
            rolloverRating: rating?.rollover ?? null,
            complaintsLoadedAt: new Date(),
            ratingsLoadedAt: v.category === 'car' ? new Date() : null,
          },
        }));

        done++;
        if (done % 25 === 0) {
          process.stdout.write(
            `\r    ${done}/${vehicles.length} vehicles · ${complaints.toLocaleString()} complaints · ${rated} rated`,
          );
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    return { read: vehicles.length, written: done };
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
