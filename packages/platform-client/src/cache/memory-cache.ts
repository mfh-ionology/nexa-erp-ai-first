import type { TenantEntitlements } from '../types/index.js';
import type { EntitlementCache } from './cache.interface.js';

interface CacheEntry {
  data: TenantEntitlements;
  expiresAt: number;
}

const MAX_ENTRIES = 1000;

export class MemoryCache implements EntitlementCache {
  private readonly store = new Map<string, CacheEntry>();

  async get(tenantId: string): Promise<TenantEntitlements | null> {
    const entry = this.store.get(tenantId);
    if (!entry) return null;

    // Lazy cleanup: remove expired entries on access
    if (Date.now() > entry.expiresAt) {
      this.store.delete(tenantId);
      return null;
    }

    // LRU: re-insert to move to end of Map iteration order (most-recently-used)
    this.store.delete(tenantId);
    this.store.set(tenantId, entry);

    // Return a deep copy to match RedisCache behaviour (JSON round-trip isolation)
    // and prevent callers from mutating cached data
    return JSON.parse(JSON.stringify(entry.data)) as TenantEntitlements;
  }

  async set(tenantId: string, data: TenantEntitlements, ttlMs: number): Promise<void> {
    // LRU eviction: if at capacity and this is a new key, evict oldest entry
    if (this.store.size >= MAX_ENTRIES && !this.store.has(tenantId)) {
      const oldestKey = this.store.keys().next().value as string;
      this.store.delete(oldestKey);
    }

    // Delete first to ensure Map insertion order reflects most-recent access
    this.store.delete(tenantId);
    // Store a deep copy to prevent external mutations from corrupting cached data
    this.store.set(tenantId, {
      data: JSON.parse(JSON.stringify(data)) as TenantEntitlements,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async delete(tenantId: string): Promise<void> {
    this.store.delete(tenantId);
  }

  async destroy(): Promise<void> {
    this.store.clear();
  }
}
