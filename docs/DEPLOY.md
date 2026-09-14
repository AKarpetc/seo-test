# Deploying to AWS

Three CloudFormation stacks, deployed in order. Every template is validated against the
CloudFormation API but **none has been applied** — applying them creates billable
resources and needs the domain decision first.

Account in use: `<AWS_ACCOUNT_ID>`, region `us-east-1`.

## Prerequisites

1. **AWS CLI** — not currently installed on this machine:
   ```bash
   brew install awscli
   aws configure   # key, secret and us-east-1 from .env
   ```

2. **IAM permissions — already sufficient.** `docs/aws-iam-policy.json` describes an
   inline policy, but it is not what governs this user: `seo_user` belongs to the
   **Admins** group carrying `AdministratorAccess`. Nothing needs to be added.
   Verify with `aws iam list-groups-for-user --user-name seo_user`.

3. **A domain in Route 53.** Either register one in Route 53, or create a hosted zone
   and point the registrar's nameservers at it. You need the hosted zone ID.

## Stack 1 — network

```bash
aws cloudformation deploy \
  --template-file infra/network.yaml \
  --stack-name seo-platform-network \
  --parameter-overrides ProjectName=seo-platform
```

VPC across two AZs, public and private subnets, one NAT gateway, an S3 gateway endpoint
so ETL traffic skips NAT charges, and three security groups chained
ALB → app → database.

## Stack 2 — database

```bash
aws cloudformation deploy \
  --template-file infra/database.yaml \
  --stack-name seo-platform-database \
  --parameter-overrides \
      ProjectName=seo-platform \
      DbPassword='<generate a 32-char password>' \
      DbInstanceClass=db.t4g.large \
      DbAllocatedStorage=200
```

Postgres 16 on gp3, encrypted, private, 7-day backups, deletion protection on, tuned for
a read-mostly directory workload. Takes 10–15 minutes.

**`db.t4g.large` is chosen deliberately.** The database is 5.3 GB today and the doctor
indexes alone are ~1.5 GB; 8 GB of RAM keeps the working set in memory. `db.t4g.medium`
works but will hit disk on cold specialty queries.

## Stack 3 — application

Build and push the image first:

```bash
aws ecr create-repository --repository-name seo-platform
aws ecr get-login-password | docker login --username AWS --password-stdin \
  <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# The domain MUST be passed at build time. Statically prerendered hub pages bake
# their canonical URL into the HTML; building without it ships localhost canonicals.
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SITE_URL=https://<your-domain.com> \
  --build-arg NEXT_PUBLIC_ALLOW_INDEXING=true \
  -t seo-platform .

docker tag seo-platform:latest <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/seo-platform:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/seo-platform:latest
```

A domain change means a rebuild, not just a redeploy.

Then:

```bash
aws cloudformation deploy \
  --template-file infra/app.yaml \
  --stack-name seo-platform-app \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
      ProjectName=seo-platform \
      DomainName=<your-domain.com> \
      HostedZoneId=<Z...> \
      ImageUri=<AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/seo-platform:latest \
      DbPassword='<same password as stack 2>'
```

ACM certificate with DNS validation, ALB with HTTP→HTTPS redirect and TLS 1.3, ECS
Fargate service on two tasks with CPU target-tracking autoscaling to ten, Route 53 alias
records for apex and `www`, CloudWatch logs with 30-day retention.

The certificate blocks stack creation until DNS validation completes — a few minutes when
the hosted zone is in the same account.

## Loading data into RDS

The local database holds 5.3 GB. Dump and restore rather than re-running every ETL:

```bash
docker exec seo-postgres-1 pg_dump -U seo_user -d seo_db -Fc -Z6 -f /tmp/seo.dump
docker cp seo-postgres-1:/tmp/seo.dump ./seo.dump

# RDS is private, so restore from a bastion or from an ECS exec session in the VPC.
pg_restore -h <rds-endpoint> -U seo_user -d seo_db -j 4 --no-owner seo.dump
```

Alternatively run `npm run db:deploy` against RDS to create the schema, then run each
loader from inside the VPC — the S3 gateway endpoint makes that path free of NAT charges.

## Cost

Rough monthly figures at `us-east-1` on-demand pricing:

| Item | Approx / month |
|---|---:|
| RDS `db.t4g.large`, 200 GB gp3, single-AZ | $135 |
| Fargate, 2 × 1 vCPU / 2 GB | $70 |
| ALB | $20 |
| NAT gateway + data | $35 |
| S3 storage (~3 GB raw dumps) | $1 |
| Route 53 hosted zone | $1 |
| **Total** | **~$260** |

Cheaper first step: one `t4g.large` EC2 running `docker-compose.yml` with the database on
the same box is roughly $50/month and the compose file is ready for it. That is the
sensible option until traffic justifies the split.

## After deploy

1. Confirm `curl https://<domain>/robots.txt` shows `Allow: /` and not `Disallow: /`.
2. Confirm a hub page carries the right canonical:
   `curl -s https://<domain>/doctors | grep canonical` must show your domain, not localhost.
3. Submit `https://<domain>/sitemap.xml` in Google Search Console.
4. Expect indexing of a site this size to take months. Google will not crawl 11M URLs
   quickly; internal linking through the state and city hubs is what paces it.
