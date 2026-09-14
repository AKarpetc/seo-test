# Programmatic SEO Platform

One indexable page per record, built from US federal open data. 12.5 million rows across
nine live directories: doctors, motor carriers, aircraft, bank branches, weather stations,
foods, public companies, ZIP-code demographics and state electricity rates.

**Read [АНАЛИЗ_ПРИБЫЛЬНОСТИ.md](docs/АНАЛИЗ_ПРИБЫЛЬНОСТИ.md) before investing more in the
SEO side.** The short version: restating a federal registry is what Google's scaled
content abuse policy targets, and the commercially valuable asset here is the FMCSA
new-authority feed, not the page count.

## Requirements

- Node 22
- Docker (PostgreSQL 16)
- AWS credentials with read/write on the `seo-pr-*` buckets

## Setup

```bash
npm install
cp .env.example .env      # then fill in AWS credentials
docker compose up -d postgres
npm run db:deploy         # applies prisma/migrations
```

## Loading data

```bash
npm run ingest                 # every upstream bulk file -> S3 (skips what is present)
npm run ingest aircraft        # or one dataset

npm run load:doctors           # S3 / API -> PostgreSQL
npm run load:banks
npm run load:aircraft
npm run load:trucking
npm run load:nutrition
npm run load:climate
npm run load:executives
npm run load:demographics      # needs CENSUS_API_KEY
npm run load:energy            # needs EIA_API_KEY

npm run aggregates             # materialise specialty x city pages
npm run status                 # row counts and ingestion history
```

`ETL_LIMIT=5000 npm run load:doctors` caps a run for a quick check.
Loaders are idempotent — re-running adds new records without duplicating existing ones.

## Running

```bash
npm run dev                    # http://localhost:3000
npm run build && npm start
docker compose up -d --build   # full stack
```

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | S3 access for the ETL |
| `AWS_BUCKET_*` | One bucket per dataset, written by `npm run aws:buckets` |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for metadata and sitemaps |
| `NEXT_PUBLIC_SITE_NAME` | Site name in titles and JSON-LD |
| `NEXT_PUBLIC_ALLOW_INDEXING` | **Must be `true` in production.** Defaults to `false`, and `robots.txt` disallows everything while it is |
| `SEC_CONTACT` | Contact string SEC requires in the user agent |
| `NUTRITION_BRANDED_LIMIT` | Branded foods to include; `0` (default) keeps only curated USDA entries |
| `AGG_MIN_PROVIDERS` | Minimum providers for a specialty × city page; default `3` |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — layers, data model decisions, rejected approaches
- [Data sources](docs/DATA_SOURCES.md) — what is loaded, what is blocked, endpoint changes
- [Deploying to AWS](docs/DEPLOY.md) — CloudFormation stacks, costs, post-deploy checklist
- **[Что осталось сделать вам](docs/ОСТАЛОСЬ_МНЕ.md)** — текущий план, начните отсюда
- [Как получить API-ключи](docs/API_KEYS.md)
- [Анализ прибыльности](docs/АНАЛИЗ_ПРИБЫЛЬНОСТИ.md) — честная оценка, с источниками
- [Прогноз дохода и масштабирование](docs/ПРОГНОЗ_ДОХОДА.md)
- [Домен](docs/ДОМЕН.md) · [Что делать завтра](docs/ЗАВТРА.md)

## Publishing one section as a static site

The SEO track needs 17 MB of data, not the full 5.3 GB database, so it ships as flat
HTML with no server and no production database:

```bash
npm run build
npx next start -p 3100 &
npm run static -- --section climate --origin http://localhost:3100
npx wrangler pages deploy static/climate --project-name frost-dates
```

15,545 pages in ~21 seconds, 15,574 files — under the 20,000-file Cloudflare Pages free
limit, which permits commercial use (Vercel's Hobby plan does not).

## Selling the carrier feed

```bash
npx tsx scripts/export_new_carriers.ts --days 30 --state TX
```

Exports carriers granted operating authority in the window. Every new authority must
file proof of insurance before it activates, which is what makes the recent slice
saleable where the full 2.2M-row table is not.
