import { MetadataRoute } from 'next';

// The admin area is deliberately not mentioned here: this file is public, and a Disallow line
// would only advertise where admin lives. Admin pages are marked noindex instead (their own
// metadata, and an X-Robots-Tag header in next.config.ts).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/create/', '/api/'],
      },
      {
        userAgent: 'OAI-SearchBot',
        allow: '/',
        disallow: ['/create/', '/api/'],
      },
      {
        userAgent: 'GPTBot',
        allow: '/', // Can be changed later if the user wants to block training
        disallow: ['/create/', '/api/'],
      }
    ],
    sitemap: 'https://thibut.com/sitemap.xml',
  };
}
