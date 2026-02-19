import { afterEach, describe, expect, it, vi } from 'vitest';
import { PermissionCache } from './permission-cache.js';
import type { ResolvedPermissions } from './permission-cache.js';

function makePerms(overrides?: Partial<ResolvedPermissions>): ResolvedPermissions {
  return { permissions: {}, fieldOverrides: {}, enabledModules: [], ...overrides };
}

describe('PermissionCache', () => {
  let cache: PermissionCache;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns undefined for cache miss', () => {
    cache = new PermissionCache();
    expect(cache.get('user1', 'company1')).toBeUndefined();
  });

  it('stores and retrieves cached permissions', () => {
    cache = new PermissionCache();
    const perms = makePerms();
    cache.set('user1', 'company1', perms);
    expect(cache.get('user1', 'company1')).toBe(perms);
  });

  it('isolates entries by userId and companyId', () => {
    cache = new PermissionCache();
    const perms1 = makePerms({ enabledModules: ['sales'] });
    const perms2 = makePerms({ enabledModules: ['finance'] });
    cache.set('user1', 'company1', perms1);
    cache.set('user2', 'company1', perms2);
    expect(cache.get('user1', 'company1')).toBe(perms1);
    expect(cache.get('user2', 'company1')).toBe(perms2);
  });

  it('invalidates by userId + companyId', () => {
    cache = new PermissionCache();
    const perms = makePerms();
    cache.set('user1', 'company1', perms);
    cache.invalidate('user1', 'company1');
    expect(cache.get('user1', 'company1')).toBeUndefined();
  });

  it('invalidates all entries for a company', () => {
    cache = new PermissionCache();
    cache.set('user1', 'company1', makePerms());
    cache.set('user2', 'company1', makePerms());
    cache.set('user1', 'company2', makePerms());
    cache.invalidateCompany('company1');
    expect(cache.get('user1', 'company1')).toBeUndefined();
    expect(cache.get('user2', 'company1')).toBeUndefined();
    // company2 not affected
    expect(cache.get('user1', 'company2')).toBeDefined();
  });

  it('clears all entries', () => {
    cache = new PermissionCache();
    cache.set('user1', 'company1', makePerms());
    cache.set('user2', 'company2', makePerms());
    cache.clear();
    expect(cache.get('user1', 'company1')).toBeUndefined();
    expect(cache.get('user2', 'company2')).toBeUndefined();
  });

  it('auto-expires entries after TTL', () => {
    vi.useFakeTimers();
    cache = new PermissionCache(1000); // 1s TTL
    cache.set('user1', 'company1', makePerms());
    expect(cache.get('user1', 'company1')).toBeDefined();
    vi.advanceTimersByTime(999);
    expect(cache.get('user1', 'company1')).toBeDefined();
    vi.advanceTimersByTime(2);
    expect(cache.get('user1', 'company1')).toBeUndefined();
    vi.useRealTimers();
  });
});
