import type { TenantEntitlements } from '../types/index.js';

export interface EntitlementCache {
  get(tenantId: string): Promise<TenantEntitlements | null>;
  set(tenantId: string, data: TenantEntitlements, ttlMs: number): Promise<void>;
  delete(tenantId: string): Promise<void>;
  /** Gracefully close the underlying connection (no-op for in-memory). */
  destroy(): Promise<void>;
}
