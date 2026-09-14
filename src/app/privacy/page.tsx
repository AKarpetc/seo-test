import type { Metadata } from 'next';
import { absoluteUrl, SITE_NAME } from '@/lib/site';
import { Page, Breadcrumbs, PageHeader, Prose, SectionHeading } from '@/components/Layout';

export const revalidate = 86400;

const title = 'Privacy Policy';
const description = `How ${SITE_NAME} handles data: what is collected, by whom, and how to opt out.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl('/privacy') },
  openGraph: { title, description },
};

const UPDATED = '14 September 2026';

export default function PrivacyPage() {
  const adsEnabled = Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);
  const analyticsEnabled = Boolean(process.env.NEXT_PUBLIC_CF_BEACON_TOKEN);
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

  return (
    <Page>
      <Breadcrumbs items={[{ label: 'Privacy Policy' }]} />
      <PageHeader title="Privacy Policy" subtitle={`Last updated ${UPDATED}.`} />

      <Prose className="space-y-8">
        <section>
          <SectionHeading id="collect">What we collect directly</SectionHeading>
          <p>
            Nothing. {SITE_NAME} has no accounts, no sign-up, no newsletter and no forms. We do not
            ask you for your name, your address or your email, and there is nowhere on this site to
            give them to us.
          </p>
        </section>

        <section>
          <SectionHeading id="hosting">Hosting</SectionHeading>
          <p>
            The site is served as static files by Cloudflare Pages. Like any web host, Cloudflare
            processes the technical details of each request — IP address, browser, the page asked
            for — to deliver the page and to protect the service from abuse. That processing is
            covered by{' '}
            <a href="https://www.cloudflare.com/privacypolicy/" rel="nofollow noopener" target="_blank" className="text-accent hover:underline">
              Cloudflare&apos;s privacy policy
            </a>
            .
          </p>
        </section>

        {analyticsEnabled ? (
          <section>
            <SectionHeading id="analytics">Analytics</SectionHeading>
            <p>
              We use Cloudflare Web Analytics to count how many people read which pages. It was
              chosen specifically because it <strong>sets no cookies</strong> and builds no profile
              of you across sites or visits. It records the page, the referrer, the country and the
              broad device type, and nothing that identifies you.
            </p>
          </section>
        ) : null}

        {adsEnabled ? (
          <section>
            <SectionHeading id="advertising">Advertising</SectionHeading>
            <p>
              This site carries advertising from Google AdSense, which is how it pays for itself.
              Google and its partners use cookies to serve ads, and may use them to show ads based
              on your previous visits to this and other sites.
            </p>
            <p>
              You can turn personalised advertising off at{' '}
              <a href="https://myadcenter.google.com/" rel="nofollow noopener" target="_blank" className="text-accent hover:underline">
                Google My Ad Center
              </a>
              , and read how Google uses data from sites that use its services at{' '}
              <a href="https://policies.google.com/technologies/partner-sites" rel="nofollow noopener" target="_blank" className="text-accent hover:underline">
                policies.google.com/technologies/partner-sites
              </a>
              . Readers in the European Economic Area, the United Kingdom and Switzerland are asked
              for consent before personalised ads are shown, and can change that choice at any time.
            </p>
          </section>
        ) : null}

        <section>
          <SectionHeading id="sources">Where the data on this site comes from</SectionHeading>
          <p>
            Every figure published here comes from public United States federal sources — NOAA,
            the USDA and the NHTSA among them. It is public data about places and products, not
            about you, and it is republished as-is for reference. It is not advice, and we make no
            warranty that it is complete or current.
          </p>
        </section>

        <section>
          <SectionHeading id="links">Links to other sites</SectionHeading>
          <p>
            Pages here link to official sources such as nhtsa.gov. Once you follow such a link, that
            site&apos;s own policy applies, not this one.
          </p>
        </section>

        <section>
          <SectionHeading id="children">Children</SectionHeading>
          <p>
            This site is not directed at children under 13 and we do not knowingly collect anything
            from them.
          </p>
        </section>

        <section>
          <SectionHeading id="rights">Your rights</SectionHeading>
          <p>
            Because we hold no personal data of our own, there is nothing here for us to show,
            correct or delete on request. Rights under the GDPR, the UK GDPR and the CCPA that
            relate to data processed by Cloudflare
            {adsEnabled ? ' or Google' : ''} are exercised through those companies, using the links
            above.
          </p>
        </section>

        <section>
          <SectionHeading id="changes">Changes</SectionHeading>
          <p>
            If this policy changes, the date at the top changes with it. There is no mailing list to
            notify, so the date is the only notice.
          </p>
        </section>

        <section>
          <SectionHeading id="contact">Contact</SectionHeading>
          {contact ? (
            <p>
              Questions about this policy: <a href={`mailto:${contact}`} className="text-accent hover:underline">{contact}</a>
            </p>
          ) : (
            <p>
              Contact details are on the <a href="/contact" className="text-accent hover:underline">contact page</a>.
            </p>
          )}
        </section>

        <p className="rounded-xl border border-warn/30 bg-warn-sunk p-4 text-[0.95rem]">
          This policy describes what the site actually does, in plain language. It was not written
          by a lawyer and is not legal advice.
        </p>
      </Prose>
    </Page>
  );
}
