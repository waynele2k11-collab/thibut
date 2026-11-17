import { NextResponse } from "next/server";
import { z } from "zod";
import {
  enforceDistributedRateLimit,
  getClientIpFromHeaders,
  RateLimitError,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const MAX_CSP_REPORT_BYTES = 16_384;

const ALLOWED_CONTENT_TYPES = new Set([
  "application/csp-report",
  "application/reports+json",
  "application/json",
]);

const CSP_KEYWORDS = new Set([
  "inline",
  "eval",
  "self",
  "blob",
  "data",
  "wasm-eval",
  "trusted-types-sink",
  "none",
]);

const LegacyCspReportInnerSchema = z.object({
  "document-uri": z.string().max(2048).optional(),
  referrer: z.string().max(2048).optional(),
  "violated-directive": z.string().max(256).optional(),
  "effective-directive": z.string().max(256).optional(),
  "original-policy": z.string().max(4096).optional(),
  disposition: z.string().max(64).optional(),
  "blocked-uri": z.string().max(2048).optional(),
  "line-number": z.number().int().nonnegative().optional(),
  "column-number": z.number().int().nonnegative().optional(),
  "source-file": z.string().max(2048).optional(),
  "status-code": z.number().int().nonnegative().optional(),
  "script-sample": z.string().max(512).optional(),
});

const ReportingApiBodySchema = z.object({
  documentURL: z.string().max(2048).optional(),
  blockedURL: z.string().max(2048).optional(),
  referrer: z.string().max(2048).optional(),
  effectiveDirective: z.string().max(256).optional(),
  violatedDirective: z.string().max(256).optional(),
  originalPolicy: z.string().max(4096).optional(),
  disposition: z.string().max(64).optional(),
  sourceFile: z.string().max(2048).optional(),
  lineNumber: z.number().int().nonnegative().optional(),
  columnNumber: z.number().int().nonnegative().optional(),
  statusCode: z.number().int().nonnegative().optional(),
  sample: z.string().max(512).optional(),
});

const ReportingApiItemSchema = z.object({
  type: z.string().max(128).optional(),
  age: z.number().nonnegative().optional(),
  url: z.string().max(2048).optional(),
  user_agent: z.string().max(512).optional(),
  body: ReportingApiBodySchema,
});

const CspReportPayloadSchema = z.union([
  z.object({ "csp-report": LegacyCspReportInnerSchema }).strict(),
  z.array(ReportingApiItemSchema).min(1).max(20),
  ReportingApiItemSchema,
]);

interface SanitizedCspSummary {
  documentUri: string;
  blockedUri: string;
  effectiveDirective: string;
  disposition: string;
  sourceFile?: string;
  lineNumber?: number;
}

function sanitizeReportedUri(rawUri: string | undefined): string {
  if (!rawUri) return "";
  const trimmed = rawUri.trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  if (CSP_KEYWORDS.has(lower)) {
    return lower;
  }

  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}`.slice(0, 512);
  } catch {
    return (trimmed.split(/[?#]/)[0] ?? "").slice(0, 512);
  }
}

function summarizeReport(
  parsed: z.infer<typeof CspReportPayloadSchema>
): SanitizedCspSummary[] {
  if (Array.isArray(parsed)) {
    return parsed.map((entry) => ({
      documentUri: sanitizeReportedUri(entry.body.documentURL ?? entry.url),
      blockedUri: sanitizeReportedUri(entry.body.blockedURL),
      effectiveDirective: (
        entry.body.effectiveDirective ??
        entry.body.violatedDirective ??
        "unknown"
      ).slice(0, 128),
      disposition: (entry.body.disposition ?? "enforce").slice(0, 32),
      ...(entry.body.sourceFile
        ? { sourceFile: sanitizeReportedUri(entry.body.sourceFile) }
        : {}),
      ...(entry.body.lineNumber !== undefined
        ? { lineNumber: entry.body.lineNumber }
        : {}),
    }));
  }

  if ("csp-report" in parsed) {
    const report = parsed["csp-report"];
    return [
      {
        documentUri: sanitizeReportedUri(report["document-uri"]),
        blockedUri: sanitizeReportedUri(report["blocked-uri"]),
        effectiveDirective: (
          report["effective-directive"] ??
          report["violated-directive"] ??
          "unknown"
        ).slice(0, 128),
        disposition: (report.disposition ?? "enforce").slice(0, 32),
        ...(report["source-file"]
          ? { sourceFile: sanitizeReportedUri(report["source-file"]) }
          : {}),
        ...(report["line-number"] !== undefined
          ? { lineNumber: report["line-number"] }
          : {}),
      },
    ];
  }

  return [
    {
      documentUri: sanitizeReportedUri(parsed.body.documentURL ?? parsed.url),
      blockedUri: sanitizeReportedUri(parsed.body.blockedURL),
      effectiveDirective: (
        parsed.body.effectiveDirective ??
        parsed.body.violatedDirective ??
        "unknown"
      ).slice(0, 128),
      disposition: (parsed.body.disposition ?? "enforce").slice(0, 32),
      ...(parsed.body.sourceFile
        ? { sourceFile: sanitizeReportedUri(parsed.body.sourceFile) }
        : {}),
      ...(parsed.body.lineNumber !== undefined
        ? { lineNumber: parsed.body.lineNumber }
        : {}),
    },
  ];
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const clientIp = getClientIpFromHeaders(request.headers);
    await enforceDistributedRateLimit({
      bucket: "csp-report",
      key: clientIp,
      limit: 30,
      windowMs: 60_000,
    });
  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Too many CSP reports" },
        {
          status: 429,
          headers: { "Retry-After": String(err.retryAfterSeconds) },
        }
      );
    }
    return NextResponse.json({ error: "Rate limit unavailable" }, { status: 503 });
  }

  const rawContentType = request.headers.get("content-type");
  if (rawContentType) {
    const mediaType = rawContentType.split(";")[0]?.trim().toLowerCase() ?? "";
    if (mediaType && !ALLOWED_CONTENT_TYPES.has(mediaType)) {
      return NextResponse.json(
        { error: "Unsupported CSP report content-type" },
        { status: 415 }
      );
    }
  }

  let rawBodyText: string;
  try {
    rawBodyText = await request.text();
  } catch {
    return NextResponse.json({ error: "Unreadable request body" }, { status: 400 });
  }

  if (!rawBodyText || Buffer.byteLength(rawBodyText, "utf8") > MAX_CSP_REPORT_BYTES) {
    return NextResponse.json(
      { error: "CSP report payload empty or too large" },
      { status: 400 }
    );
  }

  let jsonPayload: unknown;
  try {
    jsonPayload = JSON.parse(rawBodyText);
  } catch {
    return NextResponse.json(
      { error: "CSP report must be valid JSON" },
      { status: 400 }
    );
  }

  const validated = CspReportPayloadSchema.safeParse(jsonPayload);
  if (!validated.success) {
    return NextResponse.json(
      { error: "Invalid CSP report schema" },
      { status: 400 }
    );
  }

  const summaries = summarizeReport(validated.data);
  for (const item of summaries) {
    console.warn("[CSP Violation]", JSON.stringify(item));
  }

  return new NextResponse(null, { status: 204 });
}
