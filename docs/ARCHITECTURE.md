# Architecture

## What this is

A programmatic SEO platform: one indexable page per record, built from US federal
open data. The data volume (roughly 11 million rows) is the product — the pages are
thin wrappers whose value comes from the record being correct, findable and marked up.

## Layers

```
Upstream federal source        S3 (raw, one bucket per dataset)        PostgreSQL        Next.js
    HTTPS bulk file       -->      seo-pr-<dataset>-f40558       -->    seo_db     -->   ISR pages
```

**Why S3 in the middle.** The NPPES archive is 1.1 GB compressed and 8+ GB expanded;
FMCSA is a 1.4 GB CSV. Landing the raw file in S3 first means a parser bug costs one
re-parse instead of one re-download, and the ingest runs with zero local disk by piping
the HTTP response straight into a multipart upload.

## Directory layout

| Path | Purpose |
|---|---|
| `scripts/lib/etl.ts` | Shared ETL primitives: S3 streaming, batch writer, slugs, type coercion, run tracking |
| `scripts/ingest.ts` | Upstream bulk file → S3. Idempotent; skips objects already present |
| `scripts/load_*.ts` | S3 or API → PostgreSQL, one per dataset |
| `scripts/build_aggregates.ts` | Materialises specialty × city combinations |
| `scripts/status.ts` | Row counts and recent ingestion runs |
| `src/lib/datasets.ts` | Registry of every directory: labels, source, blocked reason |
| `src/app/<niche>/` | Index page plus `[slug]` detail page per dataset |
| `infra/*.yaml` | CloudFormation: network, database, application |

## Data model decisions

**Slugs are generated at load time, not derived at request time.** Every table has a
unique `slug` column with an index, so a detail page is a single index lookup regardless
of table size. A doctor page resolves in ~15 ms against 9.2M rows.

**Specialties are stored as readable names.** NPPES only carries the NUCC taxonomy code
(`207RC0000X`). `data/nucc_taxonomy.json` maps those to "Cardiovascular Disease
Physician" at load time, because nobody searches for the code.

**Aggregates are materialised.** `DoctorSpecialtyCity` pre-computes every specialty ×
city combination with at least three providers. Running that `GROUP BY` over 9.2M rows
per request would not work; as a table it is one indexed read.

**Deactivated records are dropped at load time.** NPPES rows with a deactivation date and
FMCSA carriers without active status never reach the database, so they can never become
a live page.

## SEO structure

- **Sitemaps are an index.** `/sitemap.xml` lists chunk files under
  `/sitemaps/<dataset>/<n>.xml`, 45,000 URLs each — Google's per-file cap is 50,000.
- **`robots.ts` defaults to disallow.** Indexing turns on only when
  `NEXT_PUBLIC_ALLOW_INDEXING=true`, so preview and staging hosts stay out of the index.
- **Every page declares a canonical** and JSON-LD typed to its subject (`Physician`,
  `BankOrCreditUnion`, `Vehicle`, `NutritionInformation`).
- **Datasets without data are `noindex`.** An empty directory is thin content; the
  placeholder says what is missing instead of pretending to be a page.
- **Pages are ISR** with `revalidate = 86400`. The first request after a deploy renders
  from the database; the rest are served from cache.

## Rejected approaches

- **Per-record `generateStaticParams`.** Pre-rendering 9.2M pages at build time is hours
  of build and tens of GB of output. On-demand ISR gives the same cached HTML.
- **Branded foods.** USDA carries 1.9M branded barcodes with sparse nutrient coverage.
  Publishing them would be 1.9M near-duplicate pages; the loader defaults to the 13,824
  curated entries that carry real macros. `NUTRITION_BRANDED_LIMIT` raises the cap.
- **USDA hardiness zones.** The first version derived them from NOAA's mean annual
  minimum temperature, which produced zone 12a for Alabama. USDA zones use the *extreme*
  annual minimum, which is not in this dataset, so the field was removed rather than
  shipped wrong.
