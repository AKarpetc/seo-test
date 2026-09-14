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
    <nav aria-label="Breadcrumb" className="text-sm text-slate-500 mb-6">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-x-2">
            <span aria-hidden className="text-slate-300">
              /
            </span>
            {item.href ? (
              <Link href={item.href} className="hover:text-blue-600 transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-slate-700 font-medium">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-slate-900 tracking-tight">
            {SITE_NAME}
          </Link>
          <nav className="hidden sm:flex gap-5 text-sm text-slate-600">
            {navLinks().map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-blue-600">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">{children}</main>
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-sm text-slate-500 space-y-2">
          <p>
            {SOURCE_NOTE[process.env.NEXT_PUBLIC_SITE_SECTION || 'all'] ?? SOURCE_NOTE.all}
          </p>
          <p>
            © {new Date().getFullYear()} {SITE_NAME}
          </p>
        </div>
      </footer>
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>{children}</div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-slate-900 break-words">{value}</dd>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
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
    <div className="mb-8">
      {eyebrow ? (
        <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-2">{eyebrow}</p>
      ) : null}
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      {subtitle ? <p className="mt-3 text-lg text-slate-600 max-w-3xl">{subtitle}</p> : null}
    </div>
  );
}

export function EmptyState({ dataset }: { dataset: string }) {
  return (
    <Card className="p-10 text-center">
      <p className="text-slate-600">
        No {dataset} records loaded yet. Run the ingestion pipeline to populate this directory.
      </p>
      <code className="mt-3 inline-block text-xs bg-slate-100 px-3 py-1.5 rounded text-slate-700">
        npm run load:{dataset}
      </code>
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
