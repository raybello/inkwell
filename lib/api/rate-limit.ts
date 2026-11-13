import type { RateLimitInfo } from "@/lib/api/types";

/**
 * In-memory token bucket, one bucket per API key.
 *
 * NOTE: this limiter is per server instance. On serverless platforms each warm
 * lambda keeps its own bucket, so the effective ceiling is `rpm * instances`.
 * That is acceptable for abuse-damping today; swap the Map for Redis/Upstash if
 * strict global limits are ever required. The public docs say the same thing.
 */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5_000;

function refill(bucket: Bucket, rpm: number, now: number) {
  const perMs = rpm / 60_000;
  const elapsed = Math.max(0, now - bucket.updatedAt);
  bucket.tokens = Math.min(rpm, bucket.tokens + elapsed * perMs);
  bucket.updatedAt = now;
}

export function consumeRateLimit(keyId: string, rpm: number): RateLimitInfo {
  const limit = Math.max(1, Math.floor(rpm) || 100);
  const now = Date.now();
  let bucket = buckets.get(keyId);

  if (!bucket) {
    if (buckets.size >= MAX_KEYS) {
      // Drop the oldest entry so the map cannot grow without bound.
      const oldest = buckets.keys().next().value;
      if (oldest) buckets.delete(oldest);
    }
    bucket = { tokens: limit, updatedAt: now };
    buckets.set(keyId, bucket);
  } else {
    refill(bucket, limit, now);
  }

  const refillPerMs = limit / 60_000;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    const secondsToFull = Math.ceil((limit - bucket.tokens) / (refillPerMs * 1000));
    return {
      limit,
      remaining: Math.floor(bucket.tokens),
      reset: Math.ceil(now / 1000) + Math.max(1, secondsToFull),
      retryAfter: 0,
    };
  }

  const secondsToToken = Math.max(1, Math.ceil((1 - bucket.tokens) / (refillPerMs * 1000)));
  return {
    limit,
    remaining: 0,
    reset: Math.ceil(now / 1000) + secondsToToken,
    retryAfter: secondsToToken,
  };
}

/** Test hook — clears buckets. Not used by routes. */
export function resetRateLimits() {
  buckets.clear();
}
