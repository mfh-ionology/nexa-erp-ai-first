// ---------------------------------------------------------------------------
// Redis Connection Utilities — shared helpers for BullMQ connection setup
// E3-3 Task 4
// ---------------------------------------------------------------------------

import type { ConnectionOptions } from 'bullmq';

/**
 * Parse a Redis URL into BullMQ-compatible connection options.
 *
 * Supports:
 * - Standard redis:// URLs
 * - redis:// with database number (e.g. redis://localhost:6379/2)
 * - rediss:// for TLS connections
 * - Username/password authentication
 *
 * Passing options (not an ioredis instance) to BullMQ lets BullMQ
 * manage its own connection lifecycle and avoids unhandled rejections on close.
 */
export function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);

  const opts: Record<string, unknown> = {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port || '6379', 10),
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false, // BullMQ recommendation
    lazyConnect: true, // Only connect when first operation is attempted
  };

  if (parsed.password) {
    opts.password = decodeURIComponent(parsed.password);
  }

  if (parsed.username && parsed.username !== 'default') {
    opts.username = decodeURIComponent(parsed.username);
  }

  // Database number from URL path (e.g. redis://localhost:6379/2 → db: 2)
  if (parsed.pathname && parsed.pathname.length > 1) {
    const db = parseInt(parsed.pathname.slice(1), 10);
    if (!Number.isNaN(db)) {
      opts.db = db;
    }
  }

  // TLS support for rediss:// protocol
  if (parsed.protocol === 'rediss:') {
    opts.tls = {};
  }

  return opts as ConnectionOptions;
}
