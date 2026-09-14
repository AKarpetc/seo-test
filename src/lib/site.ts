/** Canonical origin for absolute URLs in metadata, sitemaps and JSON-LD. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'US Open Data Directory';

/**
 * When a single section is published to its own domain, the shared header must not
 * link to sections that are not deployed there — every one of those links would 404.
 * Unset means the full multi-section site.
 */
export const SITE_SECTION = process.env.NEXT_PUBLIC_SITE_SECTION || '';

type NavLink = { href: string; label: string };

const SECTION_NAV: Record<string, NavLink[]> = {
  frost: [
    { href: '/frost', label: 'By ZIP code' },
    { href: '/frost/zone/7b', label: 'By zone' },
  ],
  recalls: [
    { href: '/recalls', label: 'All recalls' },
    { href: '/recalls/make/toyota', label: 'By make' },
  ],
};

const FULL_NAV: NavLink[] = [
  { href: '/doctors', label: 'Doctors' },
  { href: '/banks', label: 'Banks' },
  { href: '/aircraft', label: 'Aircraft' },
  { href: '/trucking', label: 'Carriers' },
  { href: '/frost', label: 'Frost dates' },
  { href: '/recalls', label: 'Recalls' },
];

export function navLinks(): NavLink[] {
  return SITE_SECTION ? SECTION_NAV[SITE_SECTION] ?? [] : FULL_NAV;
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  PR: 'Puerto Rico', VI: 'Virgin Islands', GU: 'Guam', AS: 'American Samoa', MP: 'Northern Mariana Islands',
};

export function stateName(code: string | null | undefined): string {
  if (!code) return '';
  return US_STATES[code.toUpperCase()] || code;
}

export function formatMoney(v: number | bigint | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const n = typeof v === 'bigint' ? Number(v) : v;
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString('en-US')}`;
}

export function formatNumber(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('en-US');
}

export function formatPhone(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = v.replace(/[^0-9]/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return v;
}

/** URL-safe slug from free text. Used for make and model hub routes. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** NHTSA's public vehicle safety hotline, the one number every recall page needs. */
export const NHTSA_HOTLINE = '1-888-327-4236';
