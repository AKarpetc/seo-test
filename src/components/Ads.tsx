import Script from 'next/script';

/**
 * Google AdSense, switched on by configuration rather than by code changes.
 *
 * The publisher id does not exist until the account is approved, so every piece
 * here renders nothing while NEXT_PUBLIC_ADSENSE_CLIENT is unset. Approval then
 * needs one environment variable and a redeploy, not an edit to 30,000 pages.
 *
 * Placement is manual rather than Auto ads: Auto ads decide for themselves where
 * to inject, which moves content while the reader is already reading it. That
 * costs Cumulative Layout Shift, which Google measures, and it costs the reader
 * their place, which matters more.
 */

export function AdSenseScript() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  if (!client) return null;

  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}

/**
 * One ad placement. The box keeps its height whether or not an ad fills it, so
 * nothing below it moves when the slot loads.
 */
export function AdSlot({ slot, className = '' }: { slot?: string; className?: string }) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  if (!client || !slot) return null;

  return (
    <aside
      aria-label="Advertisement"
      className={`no-print my-8 flex min-h-[280px] items-center justify-center overflow-hidden rounded-2xl border border-edge bg-sunk ${className}`}
    >
      <ins
        className="adsbygoogle block w-full"
        style={{ display: 'block', minHeight: 280 }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
      <Script id={`ad-${slot}`} strategy="afterInteractive">
        {`(adsbygoogle = window.adsbygoogle || []).push({});`}
      </Script>
    </aside>
  );
}
