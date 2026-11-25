/**
 * Per-request security headers: the nonce, the Content-Security-Policy and HSTS.
 * Called by src/proxy.ts for every page request.
 *
 * It no longer refreshes any sign-in session. Admin access is checked in each page and action
 * (src/utils/admin/auth.ts); customers are guests. The proxy is not a security boundary.
 */
import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

const HSTS_HEADER_VALUE = "max-age=63072000; includeSubDomains; preload";

export const CSP_REPORT_TO_HEADER_VALUE = JSON.stringify({
  group: "csp-endpoint",
  max_age: 10886400,
  endpoints: [{ url: "/api/csp-report" }],
});

export function buildCspHeader(
  nonce: string,
  isDev = process.env.NODE_ENV === "development"
): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://files.cdn.printful.com https://*.public.blob.vercel-storage.com https://*.blob.vercel-storage.com",
    "font-src 'self' data:",
    `connect-src 'self' https://api.stripe.com${isDev ? " ws: http:" : ""}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ];

  if (!isDev) {
    directives.push("upgrade-insecure-requests");
  }

  directives.push("report-uri /api/csp-report", "report-to csp-endpoint");

  return directives.join("; ");
}

export function applySecurityHeaders(
  response: NextResponse,
  cspHeaderValue: string
): NextResponse {
  response.headers.set("Content-Security-Policy", cspHeaderValue);
  response.headers.set("Report-To", CSP_REPORT_TO_HEADER_VALUE);
  response.headers.set("Reporting-Endpoints", 'csp-endpoint="/api/csp-report"');
  response.headers.set("Strict-Transport-Security", HSTS_HEADER_VALUE);
  return response;
}

/** Passes the request on with a fresh nonce and the security headers attached. */
export function withSecurityHeaders(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeaderValue = buildCspHeader(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeaderValue);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  return applySecurityHeaders(response, cspHeaderValue);
}
