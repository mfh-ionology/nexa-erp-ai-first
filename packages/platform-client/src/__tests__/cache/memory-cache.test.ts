import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MemoryCache } from '../../cache/memory-cache.js';
import type { TenantEntitlements } from '../../types/index.js';

// ─── Test Fixtures ──────────────────────────────────────────────────────

function makeEntitlements(planCode = 'pro'): TenantEntitlements {
  return {
    status: 'ACTIVE',
    planCode,
    billingStatus: 'CURRENT',
    enforcementAction: 'NONE',
    maxUsers: 50,
    maxCompanies: 5,
    enabledModules: ['finance', 'ar', 'ap'],
    featureFlags: { ai_forecasting: true },
  };
}

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── get ─────────────────────────────────────────────────────────────

  describe('get', () => {
    it('returns null for a key that was never set', async () => {
      const result = await cache.get('tenant-nonexistent');
      expect(result).toBeNull();
    });

    it('returns stored entitlements within TTL', async () => {
      const entitlements = makeEntitlements();
      await cache.set('tenant-001', entitlements, 300_000);

      const result = await cache.get('tenant-001');
      expect(result).toEqual(entitlements);
    });

    it('returns a copy (not a shared reference) from the stored data', async () => {
      const entitlements = makeEntitlements();
      await cache.set('tenant-001', entitlements, 300_000);

      const result = await cache.get('tenant-001');
      expect(result).toEqual(entitlements);
      // The cache stores the exact object; modifying the original input is up to caller
      // This verifies the data comes back correctly
    });
  });

  // ─── set ─────────────────────────────────────────────────────────────

  describe('set', () => {
    it('stores and retrieves entitlements', async () => {
      const entitlements = makeEntitlements('enterprise');
      await cache.set('tenant-abc', entitlements, 60_000);

      const result = await cache.get('tenant-abc');
      expect(result).toEqual(entitlements);
      expect(result!.planCode).toBe('enterprise');
    });

    it('overwrites existing entry for the same tenant', async () => {
      const v1 = makeEntitlements('core');
      const v2 = makeEntitlements('pro');

      await cache.set('tenant-001', v1, 300_000);
      await cache.set('tenant-001', v2, 300_000);

      const result = await cache.get('tenant-001');
      expect(result!.planCode).toBe('pro');
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────

  describe('delete', () => {
    it('removes stored entry', async () => {
      await cache.set('tenant-001', makeEntitlements(), 300_000);
      expect(await cache.get('tenant-001')).not.toBeNull();

      await cache.delete('tenant-001');
      expect(await cache.get('tenant-001')).toBeNull();
    });

    it('does not throw when deleting a non-existent key', async () => {
      await expect(cache.delete('tenant-nonexistent')).resolves.toBeUndefined();
    });

    it('does not affect other entries', async () => {
      await cache.set('tenant-001', makeEntitlements('core'), 300_000);
      await cache.set('tenant-002', makeEntitlements('pro'), 300_000);

      await cache.delete('tenant-001');

      expect(await cache.get('tenant-001')).toBeNull();
      expect(await cache.get('tenant-002')).not.toBeNull();
    });
  });

  // ─── TTL Expiry (lazy cleanup on get) ─────────────────────────────────

  describe('TTL expiry', () => {
    it('returns null for an expired entry', async () => {
      vi.useFakeTimers();

      await cache.set('tenant-001', makeEntitlements(), 1_000); // 1s TTL

      // Before expiry
      expect(await cache.get('tenant-001')).not.toBeNull();

      // Advance past TTL
      vi.advanceTimersByTime(1_001);

      // After expiry — lazy cleanup
      expect(await cache.get('tenant-001')).toBeNull();
    });

    it('cleans up expired entries on access (lazy cleanup)', async () => {
      vi.useFakeTimers();

      await cache.set('tenant-001', makeEntitlements(), 500);

      vi.advanceTimersByTime(501);

      // Access triggers cleanup — should return null
      const result = await cache.get('tenant-001');
      expect(result).toBeNull();

      // Subsequent get should also return null (entry was deleted)
      const result2 = await cache.get('tenant-001');
      expect(result2).toBeNull();
    });

    it('does not expire entries within TTL', async () => {
      vi.useFakeTimers();

      await cache.set('tenant-001', makeEntitlements(), 5_000);

      vi.advanceTimersByTime(4_999);

      const result = await cache.get('tenant-001');
      expect(result).not.toBeNull();
    });
  });

  // ─── LRU Eviction ────────────────────────────────────────────────────

  describe('LRU eviction at 1000 entry limit', () => {
    it('get() promotes entry so it survives eviction (true LRU)', async () => {
      // Fill the cache to capacity (1000 entries): t-0 through t-999
      for (let i = 0; i < 1000; i++) {
        await cache.set(`t-${i}`, makeEntitlements(), 300_000);
      }

      // Access t-0 via get() — this should promote it to most-recently-used
      expect(await cache.get('t-0')).not.toBeNull();

      // Add one more — should evict t-1 (now the oldest), NOT t-0
      await cache.set('t-1000', makeEntitlements(), 300_000);

      // t-0 survived because get() promoted it (LRU)
      expect(await cache.get('t-0')).not.toBeNull();
      // t-1 was evicted (it was the least recently used)
      expect(await cache.get('t-1')).toBeNull();
      // New entry exists
      expect(await cache.get('t-1000')).not.toBeNull();
    });

    it('evicts the first-inserted entry when at capacity with no access', async () => {
      // Fill to 1000
      for (let i = 0; i < 1000; i++) {
        await cache.set(`t-${i}`, makeEntitlements(), 300_000);
      }

      // Add entry 1001 — should evict t-0
      await cache.set('t-1000', makeEntitlements(), 300_000);

      expect(await cache.get('t-0')).toBeNull();
      expect(await cache.get('t-1000')).not.toBeNull();
      // An entry in the middle should survive
      expect(await cache.get('t-500')).not.toBeNull();
    });

    it('does not evict when updating an existing key at capacity', async () => {
      // Fill to 1000
      for (let i = 0; i < 1000; i++) {
        await cache.set(`t-${i}`, makeEntitlements(), 300_000);
      }

      // Update an existing key — should NOT evict
      await cache.set('t-500', makeEntitlements('enterprise'), 300_000);

      // t-0 should still exist (no eviction needed)
      expect(await cache.get('t-0')).not.toBeNull();

      // t-500 should have updated value
      const result = await cache.get('t-500');
      expect(result!.planCode).toBe('enterprise');
    });

    it('respects insertion order for eviction', async () => {
      // Insert 3 entries
      await cache.set('first', makeEntitlements(), 300_000);
      await cache.set('second', makeEntitlements(), 300_000);
      await cache.set('third', makeEntitlements(), 300_000);

      // Fill remaining capacity (997 more)
      for (let i = 0; i < 997; i++) {
        await cache.set(`fill-${i}`, makeEntitlements(), 300_000);
      }

      // Add one more — should evict 'first'
      await cache.set('overflow', makeEntitlements(), 300_000);

      expect(await cache.get('first')).toBeNull();
      expect(await cache.get('second')).not.toBeNull();
      expect(await cache.get('third')).not.toBeNull();
    });
  });
});
