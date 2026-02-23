// ---------------------------------------------------------------------------
// Login Rate Limiter — In-memory
// ---------------------------------------------------------------------------
// Tracks failed login attempts per key (email or userId). After
// MAX_LOGIN_ATTEMPTS failures within WINDOW_MS, the key is locked.
//
// @limitation This is an in-memory store. It does NOT persist across server
// restarts and is NOT shared across multiple instances. In a horizontally
// scaled deployment, an attacker can distribute brute-force attempts across
// instances. For production hardening, replace with a Redis-backed store
// (e.g. using REDIS_URL) to share rate limit state across all instances.
// TODO: Replace with Redis-backed rate limiter before multi-instance deployment.
// ---------------------------------------------------------------------------

const MAX_LOGIN_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ENTRIES = 10_000;

// Emit a startup warning when REDIS_URL is not configured — operators should
// be aware that rate-limit state is not shared across instances.
if (!process.env.REDIS_URL) {
  // eslint-disable-next-line no-console -- startup warning before logger is available
  console.warn(
    '[nexa-platform] WARNING: Login rate limiter is using in-memory store. ' +
      'Set REDIS_URL to share rate-limit state across instances in production.',
  );
}

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
}

const attempts = new Map<string, AttemptRecord>();

function evictExpired(): void {
  const now = Date.now();
  for (const [key, record] of attempts) {
    if (now - record.firstAttemptAt >= WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

export function recordFailedAttempt(key: string): void {
  const normalised = key.toLowerCase();
  const now = Date.now();
  const existing = attempts.get(normalised);

  if (!existing || now - existing.firstAttemptAt >= WINDOW_MS) {
    if (attempts.size >= MAX_ENTRIES) {
      evictExpired();
    }
    if (attempts.size >= MAX_ENTRIES) {
      const oldest = attempts.keys().next();
      if (!oldest.done) {
        attempts.delete(oldest.value);
      }
    }
    attempts.set(normalised, { count: 1, firstAttemptAt: now });
  } else {
    existing.count += 1;
  }
}

export function isLocked(key: string): boolean {
  const normalised = key.toLowerCase();
  const record = attempts.get(normalised);

  if (!record) return false;

  if (Date.now() - record.firstAttemptAt >= WINDOW_MS) {
    attempts.delete(normalised);
    return false;
  }

  return record.count >= MAX_LOGIN_ATTEMPTS;
}

export function resetAttempts(key: string): void {
  attempts.delete(key.toLowerCase());
}

/** @internal — clear all records; useful in tests */
// eslint-disable-next-line @typescript-eslint/naming-convention -- underscore prefix signals internal/test-only export
export function _clearAll(): void {
  attempts.clear();
}
