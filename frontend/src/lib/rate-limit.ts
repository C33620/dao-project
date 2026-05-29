type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
let lastPruneAt = 0;

export class RateLimitExceededError extends Error {
  limit: number;
  resetAt: number;
  remaining: number;

  constructor(input: { limit: number; resetAt: number; remaining?: number }) {
    super("RATE_LIMITED");
    this.name = "RateLimitExceededError";
    this.limit = input.limit;
    this.resetAt = input.resetAt;
    this.remaining = input.remaining ?? 0;
  }
}

export function getRateLimitKey(
  parts: Array<string | null | undefined>,
): string {
  return parts.filter(Boolean).join(":");
}

function pruneExpiredBuckets(now: number) {
  if (now - lastPruneAt < 60_000) {
    return;
  }

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }

  lastPruneAt = now;
}

export function assertRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): { success: true; remaining: number; resetAt: number; limit: number } {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + options.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return {
      success: true,
      remaining: options.limit - 1,
      resetAt,
      limit: options.limit,
    };
  }

  if (current.count >= options.limit) {
    throw new RateLimitExceededError({
      limit: options.limit,
      resetAt: current.resetAt,
      remaining: 0,
    });
  }

  current.count += 1;
  buckets.set(key, current);

  return {
    success: true,
    remaining: options.limit - current.count,
    resetAt: current.resetAt,
    limit: options.limit,
  };
}
