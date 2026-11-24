import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://logistics-portal-ten.vercel.app';

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
          '/login',
          '/forgot-password',
          '/update-password',
          '/thank-you',
          '/track/',
        ],
      },
    ],
    sitemap: `${siteUrl.replace(/\/+$/, '')}/sitemap.xml`,
    host: siteUrl,
  };
}
