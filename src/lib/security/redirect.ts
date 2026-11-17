/**
 * Validates untrusted redirect parameters to prevent Open Redirect attacks (T-104).
 * Only single-slash relative paths on the same origin are permitted.
 */
export function safeRedirectPath(
  raw: string | null | undefined,
  fallback = "/studio"
): string {
  if (!raw || typeof raw !== "string") {
    return fallback;
  }

  const trimmed = raw.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    /[\u0000-\u001F\u007F]/.test(trimmed)
  ) {
    return fallback;
  }

  try {
    const base = new URL("https://thibut.internal");
    const parsed = new URL(trimmed, base);
    if (parsed.origin !== base.origin || parsed.username || parsed.password) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function getAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    const parsed = new URL(configured);
    return parsed.origin;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL must be configured in production");
  }
  return "http://localhost:3000";
}
