import type { Metadata } from 'next';
import Link from 'next/link';
import { absoluteUrl, SITE_NAME } from '@/lib/site';
import { Page, Breadcrumbs, PageHeader, Prose, SectionHeading } from '@/components/Layout';

export const revalidate = 86400;

const title = 'Contact';
const description = `How to reach ${SITE_NAME} about a correction, a question or a data source.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl('/contact') },
  openGraph: { title, description },
};

export default function ContactPage() {
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

  return (
    <Page>
      <Breadcrumbs items={[{ label: 'Contact' }]} />
      <PageHeader title="Contact" subtitle="One person maintains this site. Email is the only channel." />

      <Prose className="space-y-8">
        <section>
          <SectionHeading id="email">Email</SectionHeading>
          {contact ? (
            <p>
              <a
                href={`mailto:${contact}`}
                className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-accent-fg transition-opacity hover:opacity-90"
              >
                {contact}
              </a>
            </p>
          ) : (
            <p>
              The contact address is not published yet. It will appear here once set.
            </p>
          )}
          <p>
            Expect a reply in a few days rather than a few hours. There is no support team behind
            this address.
          </p>
        </section>

        <section>
          <SectionHeading id="useful">What is worth writing about</SectionHeading>
          <p>
            A page that contradicts the official federal source, a figure that looks wrong, a ZIP
            code or vehicle that is missing, or a public dataset you think belongs here. Corrections
            are the most useful mail we get.
          </p>
        </section>

        <section>
          <SectionHeading id="not-useful">What we cannot help with</SectionHeading>
          <p>
            We are not the NHTSA, NOAA or the USDA, and we cannot change what those agencies publish,
            look up your VIN for you, or act on a recall. For anything that needs the agency itself,
            go to the official source linked from the page in question.
          </p>
          <p>
            We do not accept guest posts, link exchanges or paid placements, and mail offering them
            is deleted unread.
          </p>
        </section>

        <section>
          <SectionHeading id="privacy">Privacy</SectionHeading>
          <p>
            Mail sent to this address is used to answer it and nothing else. See the{' '}
            <Link href="/privacy" className="text-accent hover:underline">privacy policy</Link>.
          </p>
        </section>
      </Prose>
    </Page>
  );
}
