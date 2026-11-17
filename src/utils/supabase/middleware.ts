import crypto from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  DEVICE_TRUST_COOKIE,
  verifyDeviceTrustToken,
} from "@/lib/security/tokens";
import { safeRedirectPath } from "@/lib/security/redirect";

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
    "img-src 'self' blob: data: https://files.cdn.printful.com https://*.public.blob.vercel-storage.com https://*.blob.vercel-storage.com https://*.supabase.co",
    "font-src 'self' data:",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com${isDev ? " ws: http:" : ""}`,
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

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeaderValue = buildCspHeader(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeaderValue);

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let user: { id: string } | null = null;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          requestHeaders.set("cookie", request.cookies.toString());
          supabaseResponse = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  const safeCallback = safeRedirectPath(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    "/studio"
  );

  if (!user && request.nextUrl.pathname.startsWith("/studio")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    url.searchParams.set("next", safeCallback);
    url.searchParams.set("callbackUrl", safeCallback);
    return applySecurityHeaders(NextResponse.redirect(url), cspHeaderValue);
  }

  // Enforce cryptographically signed Device Trust token bound to user.id for /studio routes (T-103)
  if (user && request.nextUrl.pathname.startsWith("/studio")) {
    const rawDeviceToken = request.cookies.get(DEVICE_TRUST_COOKIE)?.value;
    const verifiedDevice = await verifyDeviceTrustToken(rawDeviceToken, user.id);
    if (!verifiedDevice) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/verify-device";
      url.search = "";
      url.searchParams.set("callbackUrl", safeCallback);
      const redirectResponse = NextResponse.redirect(url);
      if (request.cookies.has("device_trust")) {
        redirectResponse.cookies.delete("device_trust");
      }
      return applySecurityHeaders(redirectResponse, cspHeaderValue);
    }
  }

  return applySecurityHeaders(supabaseResponse, cspHeaderValue);
}
