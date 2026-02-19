export interface ResolvedPermissions {
  permissions: Record<
    string,
    { canAccess: boolean; canNew: boolean; canView: boolean; canEdit: boolean; canDelete: boolean }
  >;
  fieldOverrides: Record<string, Record<string, 'VISIBLE' | 'READ_ONLY' | 'HIDDEN'>>;
  enabledModules: string[];
}

interface CacheEntry {
  data: ResolvedPermissions;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60_000; // 60 seconds

export class PermissionCache {
  private store = new Map<string, CacheEntry>();
  private ttlMs: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  private key(userId: string, companyId: string): string {
    return `permissions:${userId}:${companyId}`;
  }

  get(userId: string, companyId: string): ResolvedPermissions | undefined {
    const entry = this.store.get(this.key(userId, companyId));
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(this.key(userId, companyId));
      return undefined;
    }
    return entry.data;
  }

  set(userId: string, companyId: string, data: ResolvedPermissions): void {
    this.store.set(this.key(userId, companyId), {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  invalidate(userId: string, companyId: string): void {
    this.store.delete(this.key(userId, companyId));
  }

  invalidateCompany(companyId: string): void {
    const suffix = `:${companyId}`;
    for (const key of this.store.keys()) {
      if (key.endsWith(suffix)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}

// Singleton instance
export const permissionCache = new PermissionCache();
