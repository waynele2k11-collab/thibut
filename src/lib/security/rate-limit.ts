export class RateLimitError extends Error {
  public readonly retryAfterSeconds: number;
  public readonly status = 429;

  constructor(retryAfterSeconds: number, message = "Too many requests") {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds));
  }
}

export interface RateLimitOptions {
  bucket: string;
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const slidingWindowStore = new Map<string, number[]>();

export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const { bucket, key, limit, windowMs } = options;
  const now = Date.now();
  const windowStart = now - windowMs;
  const compositeKey = `${bucket}:${key}`;

  const existing = slidingWindowStore.get(compositeKey) ?? [];
  const active = existing.filter((ts) => ts > windowStart);

  if (active.length >= limit) {
    const oldest = active[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    slidingWindowStore.set(compositeKey, active);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  active.push(now);
  slidingWindowStore.set(compositeKey, active);

  // Opportunistic bound so memory cannot grow unbounded
  if (slidingWindowStore.size > 10_000) {
    for (const [k, timestamps] of slidingWindowStore.entries()) {
      if (timestamps.every((ts) => ts <= windowStart)) {
        slidingWindowStore.delete(k);
      }
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - active.length),
    retryAfterSeconds: 0,
  };
}

export function enforceRateLimit(options: RateLimitOptions): RateLimitResult {
  const result = checkRateLimit(options);
  if (!result.allowed) {
    throw new RateLimitError(result.retryAfterSeconds);
  }
  return result;
}

export function getClientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "127.0.0.1";
}

export function resetRateLimitStore(): void {
  slidingWindowStore.clear();
}
