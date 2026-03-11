import type { PlatformRole } from '@/stores/auth-store';

/**
 * Admin-only actions that PLATFORM_VIEWER users cannot perform.
 */
export const ADMIN_ONLY_ACTIONS = [
  'suspend_tenant',
  'reactivate_tenant',
  'archive_tenant',
  'impersonate',
  'create_tenant',
  'change_plan',
  'modify_billing_enforcement',
  'create_platform_user',
  'edit_platform_user',
  'modify_quotas',
  'modify_tenant_modules',
  'modify_tenant_feature_flags',
  'create_plan',
  'update_plan',
  'assign_plan',
] as const;

export type AdminOnlyAction = (typeof ADMIN_ONLY_ACTIONS)[number];

/**
 * Returns whether a given platform role can perform the specified action.
 * PLATFORM_ADMIN can do everything. PLATFORM_VIEWER and PLATFORM_SUPPORT
 * cannot perform admin-only actions (PLATFORM_SUPPORT is treated as
 * PLATFORM_VIEWER for now — will be differentiated in a future epic).
 */
export function canPerformAction(role: PlatformRole, action: string): boolean {
  if (role === 'PLATFORM_ADMIN') return true;

  return !(ADMIN_ONLY_ACTIONS as readonly string[]).includes(action);
}
