import type { Metadata } from 'next';
import Link from 'next/link';
import { absoluteUrl, SITE_NAME, SITE_SECTION } from '@/lib/site';
import { Page, Breadcrumbs, PageHeader, Prose, SectionHeading } from '@/components/Layout';

export const revalidate = 86400;

const title = 'About';
const description = `What ${SITE_NAME} publishes, where the figures come from, and what they are not.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl('/about') },
  openGraph: { title, description },
};

/** Each published site describes its own dataset; the shared copy would be wrong on both. */
const SECTIONS: Record<string, { what: string; source: string; caveat: string }> = {
  frost: {
    what:
      'Frost dates and planting windows for every US ZIP code with a population above 2,000 — ' +
      'the last spring freeze, the first autumn freeze, the length of the growing season and the ' +
      'USDA hardiness zone, turned into a calendar of what to do when.',
    source:
      'Climate normals published by NOAA for 1991-2020, matched to each ZIP code by the nearest ' +
      'reporting station, and plant hardiness zones from the USDA.',
    caveat:
      'A normal is a thirty-year average, not a forecast. Any individual year can freeze two to ' +
      'three weeks either side of these dates, so check the actual forecast before planting out.',
  },
  recalls: {
    what:
      'Every NHTSA safety recall on mainstream passenger vehicles from 2000 onward, and on RVs, ' +
      'motorcycles, powersports and trailers from 2010, readable three ' +
      'ways: by year, make and model; by model across all its years; and by recall campaign, ' +
      'listing every vehicle that campaign covers.',
    source: 'The National Highway Traffic Safety Administration, the US federal vehicle safety regulator.',
    caveat:
      'A recall covers a range of VINs, not every vehicle of a model. Only your own 17-character ' +
      'VIN, checked against NHTSA, tells you whether a particular vehicle is affected. Owner ' +
      'complaints and NCAP crash-test ratings come from the same agency.',
  },
};

export default function AboutPage() {
  const section = SECTIONS[SITE_SECTION] ?? null;

  return (
    <Page>
      <Breadcrumbs items={[{ label: 'About' }]} />
      <PageHeader
        title={`About ${SITE_NAME}`}
        subtitle="Public federal data, one page per record, free to read."
      />

      <Prose className="space-y-8">
        <section>
          <SectionHeading id="what">What this site publishes</SectionHeading>
          <p>
            {section?.what ??
              'Records from public United States federal datasets, one page per record, organised so ' +
                'a single question can be answered without downloading a spreadsheet.'}
          </p>
        </section>

        <section>
          <SectionHeading id="why">Why it exists</SectionHeading>
          <p>
            The underlying data is public and free, but it is published for analysts rather than for
            readers: bulk files, codebooks, and lookup tools that expect you to know the identifier
            already. This site does the matching and the arithmetic, then states the answer in a
            sentence at the top of the page.
          </p>
        </section>

        <section>
          <SectionHeading id="source">Where the figures come from</SectionHeading>
          <p>
            {section?.source ??
              'Public federal sources, credited in the footer of every page and linked from the ' +
                'page that uses them.'}
          </p>
          <p>Nothing here is estimated, modelled or generated. Every number traces to a published federal record.</p>
        </section>

        <section>
          <SectionHeading id="limits">What it is not</SectionHeading>
          <p>{section?.caveat ?? 'Reference material, provided as-is. It is not professional advice.'}</p>
        </section>

        <section>
          <SectionHeading id="corrections">Corrections</SectionHeading>
          <p>
            If a page contradicts the official source, the official source is right and we want to
            know. Write to us from the <Link href="/contact" className="text-accent hover:underline">contact page</Link>.
          </p>
        </section>
      </Prose>
    </Page>
  );
}
