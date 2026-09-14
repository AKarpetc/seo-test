# Superseded scripts

These are the first-iteration ETL scripts. They are kept only for reference and are
excluded from the TypeScript build because they target the pre-migration schema.

| File | Replaced by | Why |
|---|---|---|
| `parse_doctors.ts` | `scripts/load_doctors.ts` | Imported a `./utils` module that never existed, hardcoded the S3 key, capped at 50k rows, and stored raw NUCC codes as the specialty. |
| `seed_banks.ts` | `scripts/load_banks.ts` | Called the retired `banks.data.fdic.gov` host and stored the FDIC certificate in the routing number column; only covered institutions, not the 78k branches. |
| `stream_parser.ts` | `scripts/load_*.ts` | Async handler inside a `data` listener raced the `end` event, and every mapping except doctors used invented column names. |
| `aws_data_ingestion.ts` | `scripts/ingest.ts` | Sent a non-browser user agent, which the FAA rejects with a 403. |
| `download_to_s3.ts`, `init_s3.ts` | `scripts/ingest.ts`, `scripts/setup_aws_buckets.ts` | Superseded by the shared ETL library. |
| `seed_all.ts` | real loaders | Seeded three hardcoded demo rows per niche. |
| `gen_indices.js`, `scaffold_routes.js` | hand-written pages | Generated pages referencing columns that do not exist on the models. |

Safe to delete once the replacements have been running for a while.
