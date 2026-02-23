import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedisCache } from '../../cache/redis-cache.js';
import type { TenantEntitlements } from '../../types/index.js';

// ─── Mock ioredis ───────────────────────────────────────────────────────

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

const SAMPLE_ENTITLEMENTS: TenantEntitlements = {
  status: 'ACTIVE',
  planCode: 'pro',
  billingStatus: 'CURRENT',
  enforcementAction: 'NONE',
  maxUsers: 50,
  maxCompanies: 5,
  enabledModules: ['finance', 'ar', 'ap'],
  featureFlags: { ai_forecasting: true },
};

describe('RedisCache', () => {
  let cache: RedisCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new RedisCache(mockRedis as any);
  });

  // ─── get ─────────────────────────────────────────────────────────────

  describe('get', () => {
    it('returns parsed TenantEntitlements when key exists', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(SAMPLE_ENTITLEMENTS));

      const result = await cache.get('tenant-001');

      expect(result).toEqual(SAMPLE_ENTITLEMENTS);
      expect(mockRedis.get).toHaveBeenCalledWith('platform:entitlements:tenant-001');
    });

    it('returns null when key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cache.get('tenant-nonexistent');

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith('platform:entitlements:tenant-nonexistent');
    });

    it('correctly deserializes all fields including arrays and objects', async () => {
      const entitlements: TenantEntitlements = {
        status: 'SUSPENDED',
        planCode: 'enterprise',
        billingStatus: 'OVERDUE',
        enforcementAction: 'READ_ONLY',
        maxUsers: 200,
        maxCompanies: 20,
        enabledModules: ['finance', 'ar', 'ap', 'sales', 'purchasing', 'inventory'],
        featureFlags: { ai_forecasting: true, advanced_reporting: true, custom_fields: false },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(entitlements));

      const result = await cache.get('tenant-002');

      expect(result).toEqual(entitlements);
      expect(result!.enabledModules).toHaveLength(6);
      expect(result!.featureFlags.advanced_reporting).toBe(true);
    });
  });

  // ─── set ─────────────────────────────────────────────────────────────

  describe('set', () => {
    it('stores serialized entitlements with PX expiry', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await cache.set('tenant-001', SAMPLE_ENTITLEMENTS, 300_000);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'platform:entitlements:tenant-001',
        JSON.stringify(SAMPLE_ENTITLEMENTS),
        'PX',
        300_000,
      );
    });

    it('uses correct key prefix pattern', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await cache.set('abc-123-def', SAMPLE_ENTITLEMENTS, 60_000);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'platform:entitlements:abc-123-def',
        expect.any(String),
        'PX',
        60_000,
      );
    });

    it('handles custom TTL values', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await cache.set('tenant-001', SAMPLE_ENTITLEMENTS, 1_000);

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'PX',
        1_000,
      );
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes the correct key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await cache.delete('tenant-001');

      expect(mockRedis.del).toHaveBeenCalledWith('platform:entitlements:tenant-001');
    });

    it('does not throw when key does not exist', async () => {
      mockRedis.del.mockResolvedValue(0);

      await expect(cache.delete('tenant-nonexistent')).resolves.toBeUndefined();
    });
  });

  // ─── Key consistency ─────────────────────────────────────────────────

  describe('key consistency (ISSUE #8 prevention)', () => {
    it('uses the same key format for get, set, and delete', async () => {
      const tenantId = 'tenant-xyz';
      const expectedKey = 'platform:entitlements:tenant-xyz';

      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);

      await cache.get(tenantId);
      await cache.set(tenantId, SAMPLE_ENTITLEMENTS, 300_000);
      await cache.delete(tenantId);

      expect(mockRedis.get).toHaveBeenCalledWith(expectedKey);
      expect(mockRedis.set).toHaveBeenCalledWith(expectedKey, expect.any(String), 'PX', 300_000);
      expect(mockRedis.del).toHaveBeenCalledWith(expectedKey);
    });
  });
});
