import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/api/print-master": ["./assets/fonts/**/*"],
    "/api/download": ["./assets/fonts/**/*"],
    "/api/inngest": ["./assets/fonts/**/*"],
    // Keepsake editor: the page reads the fonts to list the eligible ones, and the admin-only
    // font route streams them. Keys are route globs, so the dynamic segment is written as "*".
    // The admin address is written out here because this file cannot rely on importing from
    // src/. It must match ADMIN_BASE_PATH in src/lib/admin-path.ts; a test checks that.
    "/adm/admin/keepsake-editor": ["./assets/fonts/**/*"],
    "/adm/admin/keepsake-editor/fonts/*": ["./assets/fonts/**/*"],
  },
  outputFileTracingExcludes: {
    "/checkout": ["./assets/fonts/**/*"],
    "/api/!(print-master|download|inngest)": ["./assets/fonts/**/*"],
    "/api/*/**": ["./assets/fonts/**/*"],
  },
  // MVP: the calligraphy Studio and its gallery product pages are paused.
  // Temporary redirects keep every existing link working; remove to restore.
  async redirects() {
    return [
      { source: "/create", destination: "/custom", permanent: false },
      { source: "/create/:path*", destination: "/custom", permanent: false },
      { source: "/gallery", destination: "/personal", permanent: false },
      { source: "/gallery/:slug", destination: "/personal", permanent: false },
      // The Creator Studio is paused and there are no creator accounts.
      { source: "/studio", destination: "/custom", permanent: false },
      { source: "/studio/:path*", destination: "/custom", permanent: false },
      // Pages that only feed the paused Studio.
      ...[
        "/vietnamese-thu-phap",
        "/japanese-shodo",
        "/korean-seoye",
        "/chinese-shufa",
      ].map((source) => ({ source, destination: "/custom", permanent: false })),
    ];
  },
  async headers() {
    return [
      // Admin pages must never be indexed. (They are not listed in robots.txt on purpose:
      // that file is public.) Must match ADMIN_BASE_PATH in src/lib/admin-path.ts.
      {
        source: "/adm/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "files.cdn.printful.com",
      },
    ],
  },
};

export default nextConfig;
