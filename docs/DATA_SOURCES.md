# Data sources — status

Checked 2026-09-13 against live endpoints.

## Loaded

| Dataset | Rows | Source | Access | Refresh |
|---|---:|---|---|---|
| Doctors | 9,196,760 | CMS NPPES full replacement | Open, no key | Monthly |
| Carriers | ~2,000,000 | FMCSA motor carrier census | Open, no key | Nightly |
| Aircraft | 316,583 | FAA releasable aircraft registry | Open, **browser user agent required** | Daily |
| Bank branches | 78,075 | FDIC BankFind `locations` | Open, no key | Weekly |
| Weather stations | 15,493 | NOAA 1991–2020 annual/seasonal normals | Open, no key | Decennial |
| Foods | 13,824 | USDA FoodData Central CSV | Open, no key | Twice yearly |
| Public companies | 10,426 | SEC `company_tickers.json` + Financial Statement Data Sets | Open, **contact in user agent required** | Quarterly |

| Vehicle recalls | ~8,100 vehicles | NHTSA recalls API | Open, no key; "no recalls" arrives as HTTP 400 | Nightly |
| Owner complaints, NCAP ratings | per vehicle | NHTSA complaints + SafetyRatings APIs | Open, no key | Monthly |
| First/last snow dates | per station | GHCN-daily `ghcnd_all.tar.gz` (3.7 GB, streamed) | Open, no key | Yearly |

## Blocked — need a credential

| Dataset | Source | What is needed | Effort |
|---|---|---|---|
| Demographics | Census ACS API | Free API key. `api.census.gov` now redirects keyless requests to `missing_key.html`, and `www2.census.gov` bulk files return 403. | 2 min signup |
| Electricity rates | EIA Open Data v2 | Free registration key. | 2 min signup |
| Trademarks | USPTO Open Data Portal | API key. `bulkdata.uspto.gov` no longer resolves; the replacement portal is `data.uspto.gov`. | Account + key request |
| Broadband | FCC Broadband Data Collection | Authenticated FCC account; the public download requires login. | Account registration |

## Endpoint changes found during this work

- **FDIC** moved from `banks.data.fdic.gov` to `api.fdic.gov`. The old host 301s, so a
  redirect-following client still worked but the earlier seed stored the FDIC certificate
  in the routing-number column. The `locations` endpoint carries 78,075 branch offices,
  not the ~4,500 institutions the old seed used.
- **FAA** returns `403` to non-browser user agents. This is why the first aircraft
  ingestion produced an empty bucket with no error surfaced.
- **USPTO** retired `bulkdata.uspto.gov`; the hostname no longer resolves at all.
- **Census** now enforces API keys on `api.census.gov` and blocks `www2.census.gov`
  bulk downloads by user agent.

## Refresh

Each loader is idempotent — `createMany` with `skipDuplicates`, keyed on the upstream
identifier — so re-running adds new records without duplicating existing ones. A monthly
`npm run ingest && npm run load:<dataset>` keeps the set current. Every run is recorded
in the `IngestionRun` table; `npm run status` prints the history.
