import { describe, it, expect } from 'vitest';

import { canPerformAction, ADMIN_ONLY_ACTIONS } from '../platform-rbac';

describe('canPerformAction', () => {
  it('returns true for PLATFORM_ADMIN on all admin-only actions', () => {
    for (const action of ADMIN_ONLY_ACTIONS) {
      expect(canPerformAction('PLATFORM_ADMIN', action)).toBe(true);
    }
  });

  it('returns false for PLATFORM_VIEWER on all admin-only actions', () => {
    for (const action of ADMIN_ONLY_ACTIONS) {
      expect(canPerformAction('PLATFORM_VIEWER', action)).toBe(false);
    }
  });

  it('returns true for PLATFORM_VIEWER on non-admin actions', () => {
    expect(canPerformAction('PLATFORM_VIEWER', 'view_tenants')).toBe(true);
    expect(canPerformAction('PLATFORM_VIEWER', 'view_dashboard')).toBe(true);
    expect(canPerformAction('PLATFORM_VIEWER', 'view_audit_log')).toBe(true);
  });

  it('returns false for PLATFORM_SUPPORT on all admin-only actions', () => {
    for (const action of ADMIN_ONLY_ACTIONS) {
      expect(canPerformAction('PLATFORM_SUPPORT', action)).toBe(false);
    }
  });

  it('returns true for PLATFORM_SUPPORT on non-admin actions', () => {
    expect(canPerformAction('PLATFORM_SUPPORT', 'view_tenants')).toBe(true);
    expect(canPerformAction('PLATFORM_SUPPORT', 'view_dashboard')).toBe(true);
  });

  it('returns true for PLATFORM_ADMIN on non-admin actions', () => {
    expect(canPerformAction('PLATFORM_ADMIN', 'view_tenants')).toBe(true);
    expect(canPerformAction('PLATFORM_ADMIN', 'view_dashboard')).toBe(true);
  });

  it('ADMIN_ONLY_ACTIONS contains expected actions', () => {
    expect(ADMIN_ONLY_ACTIONS).toContain('suspend_tenant');
    expect(ADMIN_ONLY_ACTIONS).toContain('reactivate_tenant');
    expect(ADMIN_ONLY_ACTIONS).toContain('archive_tenant');
    expect(ADMIN_ONLY_ACTIONS).toContain('impersonate');
    expect(ADMIN_ONLY_ACTIONS).toContain('create_tenant');
    expect(ADMIN_ONLY_ACTIONS).toContain('change_plan');
    expect(ADMIN_ONLY_ACTIONS).toContain('modify_billing_enforcement');
    expect(ADMIN_ONLY_ACTIONS).toContain('create_platform_user');
    expect(ADMIN_ONLY_ACTIONS).toContain('edit_platform_user');
    expect(ADMIN_ONLY_ACTIONS).toContain('modify_quotas');
  });
});
