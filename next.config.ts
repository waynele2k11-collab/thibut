import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/api/print-master": ["./assets/fonts/**/*"],
    "/api/download": ["./assets/fonts/**/*"],
    "/api/inngest": ["./assets/fonts/**/*"],
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
