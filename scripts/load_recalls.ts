import axios from 'axios';
import { prisma, slugify, titleCase, toDate, trackRun, HTTP_HEADERS } from './lib/etl';

/**
 * NHTSA safety recalls by model year, make and model.
 *
 * The enumeration walks NHTSA's own "which makes/models have recalls" endpoints
 * rather than the full vPIC catalogue: vPIC lists 12,361 makes, most of them
 * trailer and motorcycle builders with no recalls and no search demand.
 */

const API = 'https://api.nhtsa.gov';

/**
 * Mainstream passenger makes. Covers the overwhelming majority of vehicles on US
 * roads and keeps the page count inside what one site can support properly.
 * Set RECALL_ALL_MAKES=1 to walk every make NHTSA reports recalls for.
 */
const MAINSTREAM = [
  'acura', 'audi', 'bmw', 'buick', 'cadillac', 'chevrolet', 'chrysler', 'dodge',
  'fiat', 'ford', 'genesis', 'gmc', 'honda', 'hyundai', 'infiniti', 'jaguar',
  'jeep', 'kia', 'land rover', 'lexus', 'lincoln', 'mazda', 'mercedes-benz',
  'mercury', 'mini', 'mitsubishi', 'nissan', 'pontiac', 'porsche', 'ram',
  'rivian', 'saab', 'saturn', 'scion', 'subaru', 'tesla', 'toyota', 'volkswagen',
  'volvo', 'polestar', 'lucid',
];

const START_YEAR = parseInt(process.env.RECALL_START_YEAR || '2000', 10);
const END_YEAR = parseInt(process.env.RECALL_END_YEAR || String(new Date().getFullYear() + 1), 10);
const CONCURRENCY = parseInt(process.env.RECALL_CONCURRENCY || '6', 10);

/**
 * NHTSA answers "no recalls for this vehicle" with HTTP 400 and a perfectly valid
 * body of `{"Count":0,"results":[]}`. Treating that as a failure means retrying
 * thousands of requests that already answered correctly, so the body is inspected
 * before deciding anything went wrong.
 */
async function get<T>(path: string): Promise<T | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data } = await axios.get(`${API}${path}`, {
        headers: HTTP_HEADERS,
        timeout: 45_000,
        validateStatus: (status) => status === 200 || status === 400,
      });
      return data as T;
    } catch (err: any) {
      if (attempt === 3) {
        console.warn(`\n[!] ${path}: ${err.message}`);
        return null;
      }
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return null;
}

type MakeList = { results?: { make: string }[] };
type ModelList = { results?: { model: string }[] };
type RecallList = {
  results?: {
    NHTSACampaignNumber?: string; Component?: string; Summary?: string;
    Consequence?: string; Remedy?: string; Notes?: string;
    Manufacturer?: string; ReportReceivedDate?: string;
  }[];
};

/** Work item: one model year plus make, expanded into models inside the worker. */
type Job = { year: number; make: string };

async function processJob(job: Job): Promise<{ vehicles: number; recalls: number }> {
  const models = await get<ModelList>(
    `/products/vehicle/models?modelYear=${job.year}&make=${encodeURIComponent(job.make)}&issueType=r`,
  );
  const names = [...new Set((models?.results ?? []).map((m) => m.model?.trim()).filter(Boolean))] as string[];
  if (names.length === 0) return { vehicles: 0, recalls: 0 };

  let vehicles = 0;
  let recalls = 0;

  for (const name of names) {
    const data = await get<RecallList>(
      `/recalls/recallsByVehicle?make=${encodeURIComponent(job.make)}&model=${encodeURIComponent(name)}&modelYear=${job.year}`,
    );
    const rows = data?.results ?? [];
    if (rows.length === 0) continue;

    const make = titleCase(job.make)!;
    const model = titleCase(name)!;

    const vehicle = await prisma.vehicle.upsert({
      where: { modelYear_make_model: { modelYear: job.year, make, model } },
      create: {
        modelYear: job.year,
        make,
        model,
        recallCount: rows.length,
        slug: slugify(job.year, make, model, 'recalls'),
      },
      update: { recallCount: rows.length },
    });
    vehicles++;

    for (const r of rows) {
      const campaign = r.NHTSACampaignNumber?.trim();
      if (!campaign) continue;
      await prisma.vehicleRecall.upsert({
        where: { campaignNumber_vehicleId: { campaignNumber: campaign, vehicleId: vehicle.id } },
        create: {
          campaignNumber: campaign,
          vehicleId: vehicle.id,
          component: r.Component?.trim() || null,
          summary: r.Summary?.trim() || null,
          consequence: r.Consequence?.trim() || null,
          remedy: r.Remedy?.trim() || null,
          notes: r.Notes?.trim() || null,
          manufacturer: r.Manufacturer?.trim() || null,
          reportDate: toDate(r.ReportReceivedDate),
        },
        update: {
          component: r.Component?.trim() || null,
          summary: r.Summary?.trim() || null,
          consequence: r.Consequence?.trim() || null,
          remedy: r.Remedy?.trim() || null,
        },
      });
      recalls++;
    }
  }

  return { vehicles, recalls };
}

async function main() {
  await trackRun('recalls', `${API}/recalls`, async () => {
    let makes = MAINSTREAM;

    if (process.env.RECALL_ALL_MAKES === '1') {
      const found = new Set<string>();
      for (let y = START_YEAR; y <= END_YEAR; y++) {
        const list = await get<MakeList>(`/products/vehicle/makes?modelYear=${y}&issueType=r`);
        for (const m of list?.results ?? []) if (m.make) found.add(m.make.toLowerCase());
      }
      makes = [...found];
      console.log(`[+] ${makes.length} makes reported recalls across ${START_YEAR}-${END_YEAR}`);
    }

    const jobs: Job[] = [];
    for (let y = START_YEAR; y <= END_YEAR; y++) {
      for (const make of makes) jobs.push({ year: y, make });
    }
    console.log(`[+] ${jobs.length.toLocaleString()} make/year combinations to walk`);

    let cursor = 0;
    let vehicles = 0;
    let recalls = 0;
    let done = 0;

    async function worker() {
      for (;;) {
        const i = cursor++;
        if (i >= jobs.length) return;
        const res = await processJob(jobs[i]);
        vehicles += res.vehicles;
        recalls += res.recalls;
        done++;
        if (done % 25 === 0) {
          process.stdout.write(
            `\r    ${done}/${jobs.length} combos · ${vehicles.toLocaleString()} vehicles · ${recalls.toLocaleString()} recalls`,
          );
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    return { read: jobs.length, written: vehicles };
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
