import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { prisma } from './lib/etl';

/**
 * Renders one section of the app to plain HTML files for a static host.
 *
 * Why a crawl instead of Next's `output: 'export'`: export is a whole-project
 * switch, and several routes in this app legitimately need request-time features
 * (search params, the sitemap route). Crawling the already-built server keeps
 * those routes working while still producing a fully static tree for the one
 * section that is being published.
 *
 * Cloudflare Pages allows 20,000 files per deployment on the free tier, which is
 * why only one section ships at a time.
 *
 * Usage:
 *   npm run build && npx next start -p 3100 &
 *   npx tsx scripts/build_static_site.ts --section climate --origin http://localhost:3100
 */

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const CONCURRENCY = parseInt(arg('concurrency', '16')!, 10);
const FILE_LIMIT = 20_000;

type Section = { root: string; paths: () => Promise<string[]> };

/**
 * ZIPs below this population produce pages nobody searches for, and the whole set
 * would overflow the 20,000-file deployment limit. 2,000 keeps 18,659 of 31,617.
 */
const MIN_ZIP_POPULATION = parseInt(process.env.FROST_MIN_POPULATION || '2000', 10);

/** Mirrors slugify in src/lib/site.ts; the two must agree or the crawl 404s. */
function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const SECTIONS: Record<string, Section> = {
  frost: {
    root: '/frost',
    paths: async () => {
      const zips = await prisma.zipClimate.findMany({
        where: { population: { gte: MIN_ZIP_POPULATION } },
        select: { slug: true },
      });
      const zones = await prisma.zipClimate.findMany({
        where: { zone: { not: null } },
        select: { zone: true },
        distinct: ['zone'],
      });
      return [
        '/frost',
        ...zones.map((z) => `/frost/zone/${z.zone}`),
        ...zips.map((z) => `/frost/${z.slug}`),
      ];
    },
  },
  climate: {
    root: '/climate',
    paths: async () => {
      const rows = await prisma.climateData.findMany({ select: { slug: true, state: true } });
      const states = [...new Set(rows.map((r) => r.state).filter(Boolean))] as string[];
      return [
        '/climate',
        ...states.map((s) => `/climate?state=${s.toLowerCase()}`),
        ...rows.map((r) => `/climate/${r.slug}`),
      ];
    },
  },
  recalls: {
    root: '/recalls',
    paths: async () => {
      const vehicles = await prisma.vehicle.findMany({ select: { slug: true, make: true, model: true } });
      const campaigns = await prisma.vehicleRecall.findMany({
        select: { campaignNumber: true },
        distinct: ['campaignNumber'],
      });
      const makes = [...new Set(vehicles.map((v) => v.make))];
      const models = [...new Set(vehicles.map((v) => `${v.make}-${v.model}`))];
      return [
        '/recalls',
        ...makes.map((m) => `/recalls/make/${slug(m)}`),
        ...models.map((m) => `/recalls/model/${slug(m)}`),
        ...campaigns.map((c) => `/recalls/campaign/${c.campaignNumber.toLowerCase()}`),
        ...vehicles.map((v) => `/recalls/${v.slug}`),
      ];
    },
  },
  energy: {
    root: '/energy',
    paths: async () => {
      const rows = await prisma.utilityRate.findMany({ select: { slug: true } });
      return ['/energy', ...rows.map((r) => `/energy/${r.slug}`)];
    },
  },
};

/** A URL path becomes path.html, which the host serves at the slashless URL the
 * canonical tag and the sitemap both declare. Writing dir/index.html instead costs
 * a 308 redirect on every page. */
function outputFile(outDir: string, urlPath: string): string {
  const [clean, query] = urlPath.split('?');
  const base = clean.replace(/\/+$/, '');
  const name = query ? `${base}/${query.replace(/[^a-z0-9=]/gi, '-')}` : base;
  const rel = name === '' ? 'index.html' : `${name.replace(/^\//, '')}.html`;
  return path.join(outDir, rel);
}

async function fetchPage(origin: string, urlPath: string): Promise<string | null> {
  try {
    const res = await fetch(`${origin}${urlPath}`, { redirect: 'follow' });
    if (!res.ok) {
      console.warn(`\n[!] ${res.status} ${urlPath}`);
      return null;
    }
    return await res.text();
  } catch (err: any) {
    console.warn(`\n[!] ${urlPath}: ${err.message}`);
    return null;
  }
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );
}

const SITEMAP_CHUNK = 45_000;

/** Emits sitemap.xml (plus chunks when needed) and robots.txt for the deployed set. */
function writeSiteFiles(outDir: string, paths: string[], origin: string, root: string) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/$/, '');
  const now = new Date().toISOString();

  // Query-string variants are alternate views of a page that is already listed.
  const canonical = paths.filter((p) => !p.includes('?'));
  const urls = canonical.map((p) => `${site}${p === '/' ? '' : p}`);

  const chunks: string[][] = [];
  for (let i = 0; i < urls.length; i += SITEMAP_CHUNK) chunks.push(urls.slice(i, i + SITEMAP_CHUNK));

  if (chunks.length === 1) {
    const body = chunks[0]
      .map((u) => `<url><loc>${escapeXml(u)}</loc><lastmod>${now}</lastmod><changefreq>monthly</changefreq></url>`)
      .join('');
    fs.writeFileSync(
      path.join(outDir, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`,
    );
  } else {
    chunks.forEach((chunk, i) => {
      const body = chunk
        .map((u) => `<url><loc>${escapeXml(u)}</loc><lastmod>${now}</lastmod><changefreq>monthly</changefreq></url>`)
        .join('');
      fs.writeFileSync(
        path.join(outDir, `sitemap-${i}.xml`),
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`,
      );
    });
    const index = chunks
      .map((_, i) => `<sitemap><loc>${escapeXml(`${site}/sitemap-${i}.xml`)}</loc><lastmod>${now}</lastmod></sitemap>`)
      .join('');
    fs.writeFileSync(
      path.join(outDir, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${index}</sitemapindex>`,
    );
  }

  fs.writeFileSync(
    path.join(outDir, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`,
  );

  // The shared homepage lists every dataset in the project, most of which are not
  // deployed here, so the bare domain is sent to this site's own index instead.
  fs.writeFileSync(path.join(outDir, '_redirects'), `/ ${root} 301\n`);

  console.log(`[+] sitemap.xml (${urls.length.toLocaleString()} URLs, ${chunks.length} file(s)) and robots.txt written`);
}

async function main() {
  const sectionName = arg('section', 'climate')!;
  const origin = (arg('origin', 'http://localhost:3100')!).replace(/\/$/, '');
  const outDir = path.resolve(arg('out', `static/${sectionName}`)!);

  const section = SECTIONS[sectionName];
  if (!section) throw new Error(`Unknown section "${sectionName}". Available: ${Object.keys(SECTIONS).join(', ')}`);

  const probe = await fetchPage(origin, '/api/health');
  if (!probe) throw new Error(`No server responding at ${origin}. Run "npx next start -p 3100" first.`);

  const paths = await section.paths();
  console.log(`[+] ${sectionName}: ${paths.length.toLocaleString()} pages -> ${outDir}`);

  if (paths.length > FILE_LIMIT) {
    console.warn(
      `[!] ${paths.length.toLocaleString()} pages exceeds the ${FILE_LIMIT.toLocaleString()}-file ` +
        `Cloudflare Pages free limit. Split the section or use a paid plan.`,
    );
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  let done = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= paths.length) return;
      const urlPath = paths[i];
      const html = await fetchPage(origin, urlPath);
      if (html === null) {
        failed++;
      } else {
        const file = outputFile(outDir, urlPath);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, html);
      }
      done++;
      if (done % 250 === 0) {
        process.stdout.write(`\r    ${done.toLocaleString()} / ${paths.length.toLocaleString()}`);
      }
    }
  }

  const started = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // A per-site sitemap built from the paths actually deployed. The app's own
  // sitemap route lists every dataset in the database, most of which do not exist
  // on this domain, so crawling it would publish a sitemap full of 404s.
  writeSiteFiles(outDir, paths, origin, section.root);

  // The static tree needs the compiled assets Next serves from /_next.
  const nextStatic = path.join(process.cwd(), '.next', 'static');
  if (fs.existsSync(nextStatic)) {
    fs.cpSync(nextStatic, path.join(outDir, '_next', 'static'), { recursive: true });
  }
  const publicDir = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    fs.cpSync(publicDir, outDir, { recursive: true });
  }

  const files = parseInt(
    execSync(`find ${JSON.stringify(outDir)} -type f | wc -l`).toString().trim(),
    10,
  );

  console.log(`\n[+] ${done - failed} pages written, ${failed} failed, in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  console.log(`[+] ${files.toLocaleString()} files total (Cloudflare Pages free limit: ${FILE_LIMIT.toLocaleString()})`);
  console.log(`[+] Deploy with:  npx wrangler pages deploy ${outDir}\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
