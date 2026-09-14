import Script from 'next/script';

/**
 * Cloudflare Web Analytics.
 *
 * Chosen over GA4 deliberately: it sets no cookies, so 32,000 pages do not need
 * a consent banner, and the beacon is a fraction of the weight. It reports the
 * only things this project needs to answer in February — pageviews, visitors,
 * which pages, where from.
 *
 * Renders nothing until NEXT_PUBLIC_CF_BEACON_TOKEN is set, so a build without
 * the token ships clean pages rather than a broken script tag.
 */
export function Analytics() {
  const token = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;
  if (!token) return null;

  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={`{"token": "${token}"}`}
      strategy="afterInteractive"
    />
  );
}
