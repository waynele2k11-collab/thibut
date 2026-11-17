import crypto from "node:crypto";

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

/**
 * Pluggable distributed sliding-window store interface (R-300).
 * Allows Upstash Redis REST in production and multi-instance shared stores in tests.
 */
export interface DistributedRateLimitStore {
  consume(options: RateLimitOptions): Promise<RateLimitResult>;
}

const slidingWindowStore = new Map<string, number[]>();

export function checkRateLimitWithMap(
  store: Map<string, number[]>,
  options: RateLimitOptions
): RateLimitResult {
  const { bucket, key, limit, windowMs } = options;
  const now = Date.now();
  const windowStart = now - windowMs;
  const compositeKey = `${bucket}:${key}`;

  const existing = store.get(compositeKey) ?? [];
  const active = existing.filter((ts) => ts > windowStart);

  if (active.length >= limit) {
    const oldest = active[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000)
    );
    store.set(compositeKey, active);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  active.push(now);
  store.set(compositeKey, active);

  // Opportunistic bound so memory cannot grow unbounded
  if (store.size > 10_000) {
    for (const [k, timestamps] of store.entries()) {
      if (timestamps.every((ts) => ts <= windowStart)) {
        store.delete(k);
      }
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - active.length),
    retryAfterSeconds: 0,
  };
}

export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  return checkRateLimitWithMap(slidingWindowStore, options);
}

export function enforceRateLimit(options: RateLimitOptions): RateLimitResult {
  const result = checkRateLimit(options);
  if (!result.allowed) {
    throw new RateLimitError(result.retryAfterSeconds);
  }
  return result;
}

/**
 * Creates a distributed rate-limit store backed by Upstash Redis REST pipeline
 * (`ZREMRANGEBYSCORE` + `ZCARD` + `ZADD` + `PEXPIRE`) with zero extra npm deps.
 */
export function createUpstashRestRateLimitStore(
  restUrl: string,
  restToken: string,
  fetchImpl: typeof fetch = fetch
): DistributedRateLimitStore {
  const cleanBaseUrl = restUrl.replace(/\/+$/, "");

  return {
    async consume(options: RateLimitOptions): Promise<RateLimitResult> {
      const { bucket, key, limit, windowMs } = options;
      const now = Date.now();
      const windowStart = now - windowMs;
      const redisKey = `tb:rl:${bucket}:${key}`;
      const member = `${now}:${crypto.randomUUID()}`;

      const commands = [
        ["ZREMRANGEBYSCORE", redisKey, "0", String(windowStart)],
        ["ZADD", redisKey, String(now), member],
        ["ZCARD", redisKey],
        ["ZRANGE", redisKey, "0", "0", "WITHSCORES"],
        ["PEXPIRE", redisKey, String(windowMs)],
      ];

      const response = await fetchImpl(`${cleanBaseUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${restToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commands),
        signal: AbortSignal.timeout(3_000),
      });

      if (!response.ok) {
        throw new Error(`Upstash rate-limit HTTP ${response.status}`);
      }

      const payload = (await response.json()) as Array<{ result?: unknown }>;
      const countRaw = Number(payload[2]?.result ?? 1);
      const oldestArr = Array.isArray(payload[3]?.result)
        ? (payload[3]?.result as unknown[])
        : [];
      const oldestScore = Number(oldestArr[1] ?? now);

      if (countRaw > limit) {
        // Roll back the optimistic ZADD so blocked attempts don't extend lockout indefinitely
        await fetchImpl(`${cleanBaseUrl}/pipeline`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${restToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([["ZREM", redisKey, member]]),
          signal: AbortSignal.timeout(2_000),
        }).catch(() => undefined);

        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((oldestScore + windowMs - now) / 1000)
        );
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds,
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, limit - countRaw),
        retryAfterSeconds: 0,
      };
    },
  };
}

/**
 * Creates a shared in-memory `DistributedRateLimitStore` (useful for multi-instance unit tests).
 */
export function createSharedMemoryRateLimitStore(
  sharedMap: Map<string, number[]> = slidingWindowStore
): DistributedRateLimitStore {
  return {
    async consume(options: RateLimitOptions): Promise<RateLimitResult> {
      return checkRateLimitWithMap(sharedMap, options);
    },
  };
}

let activeDistributedOverride: DistributedRateLimitStore | null = null;

export function setDistributedRateLimitStoreForTests(
  store: DistributedRateLimitStore | null
): void {
  activeDistributedOverride = store;
}

function resolveDefaultDistributedStore(): DistributedRateLimitStore {
  if (activeDistributedOverride) {
    return activeDistributedOverride;
  }
  const restUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (restUrl && restToken) {
    return createUpstashRestRateLimitStore(restUrl, restToken);
  }
  return createSharedMemoryRateLimitStore(slidingWindowStore);
}

export async function checkDistributedRateLimit(
  options: RateLimitOptions,
  customStore?: DistributedRateLimitStore
): Promise<RateLimitResult> {
  const store = customStore ?? resolveDefaultDistributedStore();
  try {
    return await store.consume(options);
  } catch {
    // Fail gracefully to in-process sliding window if Redis is transiently unreachable
    return checkRateLimit(options);
  }
}

export async function enforceDistributedRateLimit(
  options: RateLimitOptions,
  customStore?: DistributedRateLimitStore
): Promise<RateLimitResult> {
  const result = await checkDistributedRateLimit(options, customStore);
  if (!result.allowed) {
    throw new RateLimitError(result.retryAfterSeconds);
  }
  return result;
}

/**
 * Extracts client IP preferring platform-verified forwarding headers (`x-vercel-forwarded-for`).
 * Never collapses all headerless clients into a single `"127.0.0.1"` bucket (R-300):
 * falls back to `fallbackIdentity` or a request header fingerprint hash.
 */
export function getClientIpFromHeaders(
  headers: Headers,
  fallbackIdentity?: string | null
): string {
  const vercelForwarded = headers.get("x-vercel-forwarded-for");
  if (vercelForwarded) {
    const first = vercelForwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  if (fallbackIdentity && fallbackIdentity.trim().length > 0) {
    return `id:${fallbackIdentity.trim()}`;
  }

  const ua = headers.get("user-agent") ?? "";
  const acceptLang = headers.get("accept-language") ?? "";
  if (ua || acceptLang) {
    const digest = crypto
      .createHash("sha256")
      .update(`${ua}|${acceptLang}`)
      .digest("hex")
      .slice(0, 16);
    return `fp:${digest}`;
  }

  return `ephemeral:${crypto.randomUUID()}`;
}

export function resetRateLimitStore(): void {
  slidingWindowStore.clear();
  activeDistributedOverride = null;
}
