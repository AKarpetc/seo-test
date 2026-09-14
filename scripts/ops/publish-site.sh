#!/usr/bin/env bash
# Builds one section as a static site and deploys it to Cloudflare Pages.
#
# The domain has to be known at build time: statically rendered pages bake their
# canonical URL and site name into the HTML, so building with the wrong origin
# ships the wrong canonicals.
#
# Usage:  ./scripts/ops/publish-site.sh frost
#         ./scripts/ops/publish-site.sh recalls --dry-run

set -euo pipefail

SECTION="${1:?usage: publish-site.sh <frost|recalls> [--dry-run]}"
DRY_RUN="${2:-}"
PORT=3100

case "$SECTION" in
  frost)
    export NEXT_PUBLIC_SITE_URL="https://frostdatefinder.com"
    export NEXT_PUBLIC_SITE_NAME="Frost Date Finder"
    PROJECT="frost-date-finder"
    ;;
  recalls)
    export NEXT_PUBLIC_SITE_URL="https://checkcarrecalls.com"
    export NEXT_PUBLIC_SITE_NAME="Check Car Recalls"
    PROJECT="check-car-recalls"
    ;;
  *)
    echo "Unknown section: $SECTION (expected frost or recalls)"; exit 1 ;;
esac

export NEXT_PUBLIC_SITE_SECTION="$SECTION"
export NEXT_PUBLIC_ALLOW_INDEXING=true

echo "==> Section : $SECTION"
echo "==> Domain  : $NEXT_PUBLIC_SITE_URL"
echo "==> Project : $PROJECT"
echo

cleanup() { pkill -f "next start -p $PORT" 2>/dev/null || true; }
trap cleanup EXIT

echo "==> Building the app with the production origin baked in"
npm run build

echo "==> Starting a local server to render from"
cleanup
PORT=$PORT npx next start -p $PORT > logs/publish-$SECTION.log 2>&1 &
until curl -sf "http://localhost:$PORT/api/health" >/dev/null 2>&1; do sleep 2; done

echo "==> Rendering static pages"
npx tsx scripts/build_static_site.ts --section "$SECTION" --origin "http://localhost:$PORT"

HOST="${NEXT_PUBLIC_SITE_URL#https://}"

# IndexNow verifies ownership by fetching this file, so it has to ship with the
# site rather than be uploaded afterwards.
if [ -n "${INDEXNOW_KEY:-}" ]; then
  printf '%s' "$INDEXNOW_KEY" > "static/$SECTION/$INDEXNOW_KEY.txt"
  echo "==> IndexNow key file written for $HOST"
fi

FILES=$(find "static/$SECTION" -type f | wc -l | tr -d ' ')
if [ "$FILES" -gt 20000 ]; then
  echo "!! $FILES files exceeds the 20,000 Cloudflare Pages free-tier limit. Aborting."
  exit 1
fi

if [ "$DRY_RUN" = "--dry-run" ]; then
  echo
  echo "==> Dry run: built static/$SECTION ($FILES files), nothing deployed."
  exit 0
fi

echo "==> Deploying to Cloudflare Pages"
npx wrangler pages deploy "static/$SECTION" --project-name "$PROJECT" --commit-dirty=true

echo
echo "==> Telling IndexNow what changed"
npx tsx scripts/ops/indexnow.ts --dir "static/$SECTION" --host "$HOST"

echo
echo "Done. If this is the first deploy, attach the domain once:"
echo "  Cloudflare dashboard -> Workers & Pages -> $PROJECT -> Custom domains -> Set up a custom domain"
echo "  Then submit ${NEXT_PUBLIC_SITE_URL}/sitemap.xml in Google Search Console."
