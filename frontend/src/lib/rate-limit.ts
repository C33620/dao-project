type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function getRateLimitKey(
  parts: Array<string | null | undefined>,
): string {
  return parts.filter(Boolean).join(":");
}

export function assertRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): { success: true; remaining: number; resetAt: number } {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + options.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { success: true, remaining: options.limit - 1, resetAt };
  }

  if (current.count >= options.limit) {
    throw new Error("RATE_LIMITED");
  }

  current.count += 1;
  buckets.set(key, current);

  return {
    success: true,
    remaining: options.limit - current.count,
    resetAt: current.resetAt,
  };
}
