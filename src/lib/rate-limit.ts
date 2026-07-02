/**
 * In-memory login rate limiter + temporary lockout.
 *
 * This is intentionally simple (a Map in the Node process) because the
 * deployment target is a single VPS container. If this is ever scaled to
 * multiple app instances behind a load balancer, replace the Map with a
 * shared store (e.g. Redis) so limits are enforced across all instances.
 *
 * Why this exists: usernames and passwords in this system are compared
 * case-insensitively (a product requirement), which reduces the effective
 * keyspace an attacker has to guess compared to a case-sensitive password.
 * This limiter is what actually keeps brute-forcing impractical.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

type Bucket = {
  failures: number;
  windowStart: number;
  lockedUntil: number | null;
};

const buckets = new Map<string, Bucket>();

// Periodically clear stale buckets so this Map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    const expired = (bucket.lockedUntil ?? 0) < now && now - bucket.windowStart > WINDOW_MS;
    if (expired) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

export type RateLimitStatus = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/** Call before attempting to authenticate a given key (e.g. `ip:username`). */
export function checkLoginRateLimit(key: string): RateLimitStatus {
  const bucket = buckets.get(key);
  if (!bucket) return { allowed: true };

  const now = Date.now();
  if (bucket.lockedUntil && bucket.lockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.lockedUntil - now) / 1000) };
  }
  return { allowed: true };
}

/** Call after a failed login attempt for the given key. */
export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { failures: 0, windowStart: now, lockedUntil: null };

  if (now - bucket.windowStart > WINDOW_MS) {
    bucket.failures = 0;
    bucket.windowStart = now;
    bucket.lockedUntil = null;
  }

  bucket.failures += 1;
  if (bucket.failures >= MAX_ATTEMPTS) {
    bucket.lockedUntil = now + LOCKOUT_MS;
  }
  buckets.set(key, bucket);
}

/** Call after a successful login to clear any accumulated failure count. */
export function clearLoginFailures(key: string): void {
  buckets.delete(key);
}
