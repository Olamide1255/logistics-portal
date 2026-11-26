import type { MetadataRoute } from 'next';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://logistics-portal-ten.vercel.app').replace(/\/+$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: [
          '/dashboard',
          '/platform',
          '/api',
        ],
      },
    ],
    sitemap: siteUrl + '/sitemap.xml',
    host: siteUrl,
  };
}
