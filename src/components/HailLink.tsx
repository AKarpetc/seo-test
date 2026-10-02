import { Card } from '@/components/Layout';

/** A pointer to the place's radar hail history on myhailmap.com. */
export function HailLink({ href, place }: { href: string; place: string }) {
  return (
    <section className="mt-10">
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold tracking-tight text-fg">Hail in {place}</h2>
        <p className="mt-2 text-muted">
          Tornado season brings hail too. Radar-estimated hail days for {place} since 2019, with sizes and a map of each storm&apos;s swath.
        </p>
        <p className="mt-3">
          <a href={href} className="inline-flex min-h-11 items-center font-semibold text-accent hover:underline">
            Hail history in {place} →
          </a>
        </p>
      </Card>
    </section>
  );
}
