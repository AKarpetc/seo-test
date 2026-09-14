import Link from 'next/link';

export function Pagination({
  basePath,
  page,
  totalPages,
}: {
  basePath: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  // basePath may already carry a filter query, e.g. /banks?state=tx
  const separator = basePath.includes('?') ? '&' : '?';
  const href = (p: number) => (p <= 1 ? basePath : `${basePath}${separator}page=${p}`);
  const window = 2;
  const pages: number[] = [];
  for (let p = Math.max(1, page - window); p <= Math.min(totalPages, page + window); p++) pages.push(p);

  return (
    <nav className="flex items-center justify-center gap-1 mt-8 flex-wrap" aria-label="Pagination">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className="px-3 py-2 text-sm rounded border border-slate-300 bg-white hover:bg-slate-50">
          Previous
        </Link>
      ) : null}
      {pages[0] > 1 ? <span className="px-2 text-slate-400">…</span> : null}
      {pages.map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === page ? 'page' : undefined}
          className={
            p === page
              ? 'px-3 py-2 text-sm rounded bg-blue-600 text-white font-medium'
              : 'px-3 py-2 text-sm rounded border border-slate-300 bg-white hover:bg-slate-50'
          }
        >
          {p}
        </Link>
      ))}
      {pages[pages.length - 1] < totalPages ? <span className="px-2 text-slate-400">…</span> : null}
      {page < totalPages ? (
        <Link href={href(page + 1)} rel="next" className="px-3 py-2 text-sm rounded border border-slate-300 bg-white hover:bg-slate-50">
          Next
        </Link>
      ) : null}
    </nav>
  );
}
