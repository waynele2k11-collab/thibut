import "server-only";
import { z } from "zod";
import { isPlaceholderSecret } from "@/lib/security/placeholder";

export class EnvValidationError extends Error {
  public readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(
      `[EnvValidationError] Invalid or missing server environment configuration: ${issues.join("; ")}`
    );
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

const BaseEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  DATABASE_URL: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_TAX_ENABLED: z.enum(["true", "false"]).optional(),
  ADMIN_SESSION_SECRET: z.string().optional(),
  DEVICE_TRUST_SECRET: z.string().optional(),
  DOWNLOAD_TOKEN_SECRET: z.string().optional(),
  ANON_SESSION_SECRET: z.string().optional(),
  FULFILLMENT_SECRET_KEY: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  VERCEL_BLOB_READ_WRITE_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  INNGEST_EVENT_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  FAL_KEY: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal("")),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  INDEXNOW_API_KEY: z.string().optional(),
});

export type ValidatedServerEnv = z.infer<typeof BaseEnvSchema>;

const MIN_SECRET_LENGTH_KEYS = [
  "ADMIN_SESSION_SECRET",
  "DEVICE_TRUST_SECRET",
  "DOWNLOAD_TOKEN_SECRET",
  "ANON_SESSION_SECRET",
  "FULFILLMENT_SECRET_KEY",
] as const;

const REQUIRED_PRODUCTION_KEYS = [
  "DATABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "INNGEST_SIGNING_KEY",
] as const;

/** What a Vercel preview deployment must have. See `validateServerEnv`. */
const PREVIEW_REQUIRED_KEYS = ["DATABASE_URL"] as const;

export interface ValidateEnvOptions {
  /** Force strict production validation even during build or test runs. */
  forceProduction?: boolean;
}

/**
 * Parses and validates server environment variables with Zod (R-002, R-303).
 * In production runtime (or when `forceProduction: true`), enforces all required
 * secrets and minimum 32-character lengths on cryptographic signing keys.
 */
export function validateServerEnv(
  rawEnv: Record<string, string | undefined> = process.env,
  options: ValidateEnvOptions = {}
): ValidatedServerEnv {
  const parsed = BaseEnvSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const formatted = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "env"}: ${issue.message}`
    );
    throw new EnvValidationError(formatted);
  }

  const data = parsed.data;
  const isNextBuildPhase =
    rawEnv.NEXT_PHASE === "phase-production-build" && !options.forceProduction;
  const enforceProdRules =
    options.forceProduction === true ||
    (data.NODE_ENV === "production" && !isNextBuildPhase);

  if (enforceProdRules) {
    const issues: string[] = [];

    // A Vercel preview deployment is for testing before every outside service is set up.
    // It still needs its database and its signing secrets; the outside services (payments,
    // fulfilment, jobs, file storage) are checked on the live site only.
    const isPreviewDeployment =
      rawEnv.VERCEL_ENV === "preview" && !options.forceProduction;
    const requiredKeys: readonly string[] = isPreviewDeployment
      ? PREVIEW_REQUIRED_KEYS
      : REQUIRED_PRODUCTION_KEYS;

    for (const key of requiredKeys) {
      const val = rawEnv[key]?.trim();
      if (!val) {
        issues.push(`${key} is required in production`);
      }
    }

    for (const secretKey of MIN_SECRET_LENGTH_KEYS) {
      const val = rawEnv[secretKey]?.trim();
      if (!val || val.length < 32) {
        issues.push(
          `${secretKey} must be at least 32 characters in production`
        );
      } else if (isPlaceholderSecret(val)) {
        issues.push(
          `${secretKey} is still the placeholder from .env.example; set a random value`
        );
      }
    }

    const blobToken =
      rawEnv.BLOB_READ_WRITE_TOKEN?.trim() ||
      rawEnv.VERCEL_BLOB_READ_WRITE_TOKEN?.trim();
    if (!blobToken && !isPreviewDeployment) {
      issues.push(
        "BLOB_READ_WRITE_TOKEN (or VERCEL_BLOB_READ_WRITE_TOKEN) is required in production"
      );
    }

    if (
      rawEnv.STRIPE_SECRET_KEY?.includes("placeholder") ||
      rawEnv.STRIPE_SECRET_KEY === "sk_test_replace_me"
    ) {
      issues.push("STRIPE_SECRET_KEY must not be a placeholder in production");
    }

    if (issues.length > 0) {
      throw new EnvValidationError(issues);
    }
  }

  return data;
}

let cachedEnv: ValidatedServerEnv | null = null;

export function getServerEnv(): ValidatedServerEnv {
  if (!cachedEnv) {
    cachedEnv = validateServerEnv(process.env);
  }
  return cachedEnv;
}
