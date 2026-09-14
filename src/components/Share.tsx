'use client';

import { useEffect, useState } from 'react';

type Props = { title: string; summary?: string };

/**
 * Sharing, adapted to the device rather than duplicated for it.
 *
 * Phones get the OS share sheet, which already knows every app the reader has.
 * Everything else gets explicit links plus copy-to-clipboard. The fallback is
 * what renders on the server, so the markup is useful even before hydration
 * and with JavaScript disabled.
 */
export function ShareBar({ title, summary }: Props) {
  const [canShareNatively, setCanShareNatively] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');

  useEffect(() => {
    setUrl(window.location.href);
    setCanShareNatively(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  async function shareNatively() {
    try {
      await navigator.share({ title, text: summary, url: window.location.href });
    } catch {
      /* The reader dismissed the sheet. Nothing to report. */
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const encoded = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  if (canShareNatively) {
    return (
      <div className="no-print">
        <button
          type="button"
          onClick={shareNatively}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90"
        >
          <ShareIcon />
          Share this page
        </button>
      </div>
    );
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-faint">Share</span>
      <ShareLink
        href={`https://x.com/intent/tweet?text=${encodedTitle}&url=${encoded}`}
        label="Share on X"
      >
        X
      </ShareLink>
      <ShareLink href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`} label="Share on Facebook">
        Facebook
      </ShareLink>
      <ShareLink href={`https://api.whatsapp.com/send?text=${encodedTitle}%20${encoded}`} label="Share on WhatsApp">
        WhatsApp
      </ShareLink>
      <ShareLink href={`mailto:?subject=${encodedTitle}&body=${encoded}`} label="Share by email">
        Email
      </ShareLink>
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex min-h-11 items-center rounded-full border border-edge bg-surface px-4 text-sm font-medium text-fg transition-colors hover:border-edge-strong"
      >
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </div>
  );
}

function ShareLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex min-h-11 items-center rounded-full border border-edge bg-surface px-4 text-sm font-medium text-fg transition-colors hover:border-edge-strong"
    >
      {children}
    </a>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}
