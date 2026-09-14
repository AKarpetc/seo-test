import { MetadataRoute } from 'next';
import { absoluteUrl, siteUrl } from '@/lib/site';

// The indexing flag and origin are runtime environment, not build-time constants.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  // Staging and preview hosts must never be indexed.
  const isProduction = process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true';

  if (!isProduction) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // State-filtered and paginated listings are the site's own browse path and
        // carry self-referencing canonicals, so only the API is kept out.
        disallow: ['/api/'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: siteUrl(),
  };
}
