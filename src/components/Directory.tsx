import Link from 'next/link';
import { Card } from '@/components/Layout';
import { formatNumber } from '@/lib/site';

export type DirectoryRow = {
  slug: string;
  primary: string;
  secondary?: string | null;
  tertiary?: string | null;
};

/** Shared table used by every directory index so the markup stays consistent. */
export function DirectoryTable({
  rows,
  basePath,
  headers,
}: {
  rows: DirectoryRow[];
  basePath: string;
  headers: [string, string?, string?];
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-edge text-sm">
          <thead className="bg-sunk">
            <tr>
              {headers.filter(Boolean).map((h) => (
                <th key={h} scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-faint">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {rows.map((r) => (
              <tr key={r.slug} className="hover:bg-sunk">
                <td className="px-4 py-3">
                  <Link href={`${basePath}/${r.slug}`} className="font-medium text-accent hover:underline">
                    {r.primary}
                  </Link>
                </td>
                {headers[1] ? <td className="px-4 py-3 text-muted">{r.secondary || '—'}</td> : null}
                {headers[2] ? <td className="px-4 py-3 text-muted">{r.tertiary || '—'}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function GroupLinks({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string; count?: number }[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-fg mb-4">{title}</h2>
      <Card className="p-6">
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-y-2 gap-x-4">
          {items.map((i) => (
            <li key={i.href}>
              <Link href={i.href} className="text-accent hover:underline">
                {i.label}
              </Link>
              {i.count !== undefined ? (
                <span className="text-faint text-sm ml-1">({formatNumber(i.count)})</span>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
