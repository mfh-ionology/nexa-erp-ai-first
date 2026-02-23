import type { FieldVisibility } from '@nexa/db';

// ---------------------------------------------------------------------------
// Permission action types matching the 5 flags on AccessGroupPermission
// ---------------------------------------------------------------------------

export type PermissionAction = 'access' | 'new' | 'view' | 'edit' | 'delete';

// ---------------------------------------------------------------------------
// Resolved permission flags for a single resource
// ---------------------------------------------------------------------------

export interface ResourcePermission {
  canAccess: boolean;
  canNew: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

// ---------------------------------------------------------------------------
// Field-level visibility overrides for a resource
// ---------------------------------------------------------------------------

export type FieldOverrides = Record<string, FieldVisibility>;

// ---------------------------------------------------------------------------
// Complete resolved permissions for a user+company
// ---------------------------------------------------------------------------

export interface EffectivePermissions {
  permissions: Record<string, ResourcePermission>;
  fieldOverrides: Record<string, FieldOverrides>;
  accessGroups: Array<{ id: string; code: string; name: string }>;
  role: string;
  isSuperAdmin: boolean;
  enabledModules: string[];
}

// ---------------------------------------------------------------------------
// Cache entry with TTL
// ---------------------------------------------------------------------------

export interface PermissionCacheEntry {
  data: EffectivePermissions;
  expiresAt: number;
}
