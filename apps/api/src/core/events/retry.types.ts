// ---------------------------------------------------------------------------
// Retry & Dead-Letter Types — E3-3
// ---------------------------------------------------------------------------

export interface RetryConfig {
  maxRetries: number;
  backoffBaseMs: number;
  /** Fraction of jitter to apply (0 = none, 0.25 = ±25%). Default 0 (deterministic). */
  jitterFraction: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoffBaseMs: 1000,
  // Default: deterministic backoff (1s, 2s, 4s) per story AC #1.
  // The dead-letter plugin explicitly sets jitterFraction: 0.25 in production
  // to prevent thundering herd on coordinated failures.
  jitterFraction: 0,
};

export interface DeadLetterEntry {
  id: string;
  eventName: string;
  payload: unknown;
  error: string;
  stack?: string;
  retryCount: number;
  originalTimestamp: string;
  createdAt: string;
  reprocessed: boolean;
  reprocessedAt?: string;
}

export interface HandlerExecutionResult {
  success: boolean;
  error?: Error;
  retryCount: number;
}
