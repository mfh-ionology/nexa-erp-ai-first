// ---------------------------------------------------------------------------
// Login Rate Limiter — In-memory (upgrade to Redis in E3)
// ---------------------------------------------------------------------------
// Tracks failed login attempts per email. After MAX_LOGIN_ATTEMPTS failures
// within WINDOW_MS, the account is considered locked.
// ---------------------------------------------------------------------------

const MAX_LOGIN_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ENTRIES = 10_000; // Cap to prevent unbounded memory growth

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
}

const attempts = new Map<string, AttemptRecord>();

// ---------------------------------------------------------------------------
// Internal: evict expired entries when Map exceeds size cap
// ---------------------------------------------------------------------------

function evictExpired(): void {
  const now = Date.now();
  for (const [key, record] of attempts) {
    if (now - record.firstAttemptAt >= WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a failed login attempt for the given email.
 * Starts a new window if the previous one has expired.
 */
export function recordFailedAttempt(email: string): void {
  const key = email.toLowerCase();
  const now = Date.now();
  const existing = attempts.get(key);

  if (!existing || now - existing.firstAttemptAt >= WINDOW_MS) {
    // First attempt or window expired — start fresh
    // Evict stale entries if we've hit the cap
    if (attempts.size >= MAX_ENTRIES) {
      evictExpired();
    }
    // If still at cap after eviction, evict the oldest entry to make room.
    // Never fail open — an attacker filling the map must not disable limiting.
    if (attempts.size >= MAX_ENTRIES) {
      const oldest = attempts.keys().next();
      if (!oldest.done) {
        attempts.delete(oldest.value);
      }
    }
    attempts.set(key, { count: 1, firstAttemptAt: now });
  } else {
    existing.count += 1;
  }
}

/**
 * Check whether the email is currently locked out.
 * Returns `true` if there have been >= MAX_LOGIN_ATTEMPTS failures within the
 * 15-minute window. Auto-expires stale entries.
 */
export function isLocked(email: string): boolean {
  const key = email.toLowerCase();
  const record = attempts.get(key);

  if (!record) return false;

  // Window expired — clean up and report unlocked
  if (Date.now() - record.firstAttemptAt >= WINDOW_MS) {
    attempts.delete(key);
    return false;
  }

  return record.count >= MAX_LOGIN_ATTEMPTS;
}

/**
 * Reset attempts on successful login.
 */
export function resetAttempts(email: string): void {
  attempts.delete(email.toLowerCase());
}

// ---------------------------------------------------------------------------
// Test helpers (not exported at runtime boundaries)
// ---------------------------------------------------------------------------

/** @internal — clear all records; useful in tests */
// eslint-disable-next-line @typescript-eslint/naming-convention -- underscore prefix signals internal/test-only export
export function _clearAll(): void {
  attempts.clear();
}
