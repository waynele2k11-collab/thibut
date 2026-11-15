import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/create/', '/api/', '/admin/'],
      },
      {
        userAgent: 'OAI-SearchBot',
        allow: '/',
        disallow: ['/create/', '/api/', '/admin/'],
      },
      {
        userAgent: 'GPTBot',
        allow: '/', // Can be changed later if the user wants to block training
        disallow: ['/create/', '/api/', '/admin/'],
      }
    ],
    sitemap: 'https://thibut.com/sitemap.xml',
  };
}
