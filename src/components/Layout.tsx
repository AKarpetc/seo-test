import Link from 'next/link';
import { SITE_NAME, navLinks } from '@/lib/site';

export type Crumb = { label: string; href?: string };

/** The footer should credit the sources actually used on the deployed site. */
const SOURCE_NOTE: Record<string, string> = {
  frost:
    'Climate normals from NOAA (1991-2020) and plant hardiness zones from the USDA. ' +
    'Figures are thirty-year averages, not a forecast, and are provided as-is.',
  recalls:
    'Recall data from the National Highway Traffic Safety Administration. ' +
    'A recall covers a range of VINs, not every vehicle of a model - always confirm with your VIN.',
  all:
    'Data compiled from public US federal sources (CMS NPPES, FDIC, FAA, FMCSA, USDA, NOAA, SEC). ' +
    'Figures are provided as-is for reference and are not professional advice.',
};

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 text-sm text-faint">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <Link href="/" className="hover:text-accent">
            Home
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-x-2">
            <span aria-hidden className="text-edge-strong">
              ›
            </span>
            {item.href ? (
              <Link href={item.href} className="hover:text-accent">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-muted">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-fg"
      >
        Skip to content
      </a>
      <header className="no-print sticky top-0 z-40 border-b border-edge bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="text-[0.95rem] font-bold tracking-tight text-fg">
            {SITE_NAME}
          </Link>
          <nav aria-label="Sections" className="flex gap-1 overflow-x-auto text-sm">
            {navLinks().map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap rounded-full px-3 py-1.5 text-muted transition-colors hover:bg-sunk hover:text-fg"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main id="content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
      <footer className="no-print mt-12 border-t border-edge bg-surface">
        <div className="mx-auto max-w-5xl space-y-2 px-4 py-8 text-sm text-faint sm:px-6">
          <p className="max-w-2xl">{SOURCE_NOTE[process.env.NEXT_PUBLIC_SITE_SECTION || 'all'] ?? SOURCE_NOTE.all}</p>
          <nav aria-label="Site information" className="flex flex-wrap gap-x-5 gap-y-1 pt-1">
            <Link href="/about" className="hover:text-accent">About</Link>
            <Link href="/contact" className="hover:text-accent">Contact</Link>
            <Link href="/privacy" className="hover:text-accent">Privacy</Link>
          </nav>
          <p>
            © {new Date().getFullYear()} {SITE_NAME}
          </p>
        </div>
      </footer>
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-edge bg-surface ${className}`}>{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-edge bg-sunk p-4">
      <dt className="text-xs font-semibold uppercase tracking-wider text-faint">{label}</dt>
      <dd className="mt-1 text-xl font-bold leading-tight text-fg break-words sm:text-2xl">{value}</dd>
      {hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6">
      {eyebrow ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">{eyebrow}</p>
      ) : null}
      <h1 className="text-[1.75rem] font-extrabold leading-[1.15] tracking-tight text-fg sm:text-4xl">{title}</h1>
      {subtitle ? <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-muted sm:text-lg">{subtitle}</p> : null}
    </div>
  );
}

/**
 * The answer a search visitor arrived for, stated before anything else.
 *
 * Someone landing from a results page has one question and little patience; the
 * page has to answer it above the fold or lose them.
 */
export function AnswerBox({ children, tone = 'accent' }: { children: React.ReactNode; tone?: 'accent' | 'danger' | 'ok' }) {
  const tones = {
    accent: 'border-accent/30 bg-accent-sunk',
    danger: 'border-danger/30 bg-danger-sunk',
    ok: 'border-ok/30 bg-ok-sunk',
  };
  return (
    <div className={`rounded-2xl border p-5 text-[1.05rem] leading-relaxed text-fg sm:p-6 ${tones[tone]}`}>
      {children}
    </div>
  );
}

/** Body copy held to a comfortable measure, whatever the container width. */
export function Prose({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`max-w-[68ch] text-[1.0625rem] leading-[1.7] text-muted [&_strong]:font-semibold [&_strong]:text-fg ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-4 text-xl font-bold tracking-tight text-fg sm:text-2xl">
      {children}
    </h2>
  );
}

/**
 * A phone number that dials on a phone and stays copyable everywhere else.
 * The visible text keeps its human formatting; only the href is normalised.
 */
export function CallLink({ number, label }: { number: string; label?: string }) {
  const dialable = number.replace(/[^0-9+]/g, '');
  return (
    <a
      href={`tel:${dialable}`}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-edge bg-surface px-4 font-semibold text-accent transition-colors hover:border-accent"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .3 1.9.6 2.8a2 2 0 01-.5 2.1L8.1 9.7a16 16 0 006 6l1.1-1.1a2 2 0 012.1-.5c.9.3 1.8.5 2.8.6a2 2 0 011.7 2z" />
      </svg>
      {label ?? number}
    </a>
  );
}

export function EmptyState({ dataset }: { dataset: string }) {
  return (
    <Card className="p-10 text-center">
      <p className="text-muted">
        No {dataset} records loaded yet. Run the ingestion pipeline to populate this directory.
      </p>
      <code className="mt-3 inline-block rounded bg-sunk px-3 py-1.5 text-xs text-muted">npm run load:{dataset}</code>
    </Card>
  );
}

/** Emits JSON-LD. Search engines read this; it is what earns rich results. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
