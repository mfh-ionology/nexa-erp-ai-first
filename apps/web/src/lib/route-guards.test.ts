import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { ResolvedPermissions } from '@/stores/auth-store';
import { useAuthStore } from '@/stores/auth-store';

import { createModuleBeforeLoad, createAdminModuleBeforeLoad } from './route-guards';

// Mock @tanstack/react-router's redirect
vi.mock('@tanstack/react-router', () => ({
  redirect: (opts: { to: string }) => {
    const err = new Error(`REDIRECT:${opts.to}`);
    (err as unknown as Record<string, unknown>).__redirectTo = opts.to;
    return err;
  },
}));

// --- Fixtures ---

const basePermissions: ResolvedPermissions = {
  userId: 'user-1',
  companyId: 'company-1',
  role: 'ADMIN',
  isSuperAdmin: false,
  accessGroups: [{ id: 'ag-1', code: 'DEFAULT', name: 'Default' }],
  modules: {
    'system.users.list': {
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: true,
      canDelete: false,
    },
  },
  fieldOverrides: {},
  enabledModules: ['system', 'finance'],
};

const superAdminPermissions: ResolvedPermissions = {
  ...basePermissions,
  role: 'SUPER_ADMIN',
  isSuperAdmin: true,
};

const userPermissions: ResolvedPermissions = {
  ...basePermissions,
  role: 'USER',
};

function setPermissions(permissions: ResolvedPermissions | null) {
  useAuthStore.setState({ permissions });
}

function getRedirectTo(fn: () => void): string | null {
  try {
    fn();
    return null; // no redirect thrown
  } catch (err) {
    return (err as Record<string, unknown>).__redirectTo as string;
  }
}

// --- Tests ---

describe('createModuleBeforeLoad', () => {
  beforeEach(() => {
    setPermissions(null);
  });

  it('redirects to /403 when module not in enabledModules', () => {
    setPermissions(basePermissions);
    const beforeLoad = createModuleBeforeLoad('sales'); // sales not in enabledModules

    const redirectTo = getRedirectTo(beforeLoad);
    expect(redirectTo).toBe('/403');
  });

  it('does not redirect for SUPER_ADMIN', () => {
    setPermissions(superAdminPermissions);
    const beforeLoad = createModuleBeforeLoad('manufacturing'); // not in enabledModules

    const redirectTo = getRedirectTo(beforeLoad);
    expect(redirectTo).toBeNull();
  });

  it('redirects to /login when permissions are null', () => {
    setPermissions(null);
    const beforeLoad = createModuleBeforeLoad('system');

    const redirectTo = getRedirectTo(beforeLoad);
    expect(redirectTo).toBe('/login');
  });

  it('does not redirect when module is in enabledModules', () => {
    setPermissions(basePermissions);
    const beforeLoad = createModuleBeforeLoad('system');

    const redirectTo = getRedirectTo(beforeLoad);
    expect(redirectTo).toBeNull();
  });

  it('does not redirect for another enabled module', () => {
    setPermissions(basePermissions);
    const beforeLoad = createModuleBeforeLoad('finance');

    const redirectTo = getRedirectTo(beforeLoad);
    expect(redirectTo).toBeNull();
  });
});

describe('createAdminModuleBeforeLoad', () => {
  beforeEach(() => {
    setPermissions(null);
  });

  it('redirects to /login when permissions are null', () => {
    setPermissions(null);
    const beforeLoad = createAdminModuleBeforeLoad('system');

    const redirectTo = getRedirectTo(beforeLoad);
    expect(redirectTo).toBe('/login');
  });

  it('does not redirect for SUPER_ADMIN', () => {
    setPermissions(superAdminPermissions);
    const beforeLoad = createAdminModuleBeforeLoad('system');

    const redirectTo = getRedirectTo(beforeLoad);
    expect(redirectTo).toBeNull();
  });

  it('does not redirect for ADMIN with enabled module', () => {
    setPermissions(basePermissions); // role is ADMIN, system is enabled
    const beforeLoad = createAdminModuleBeforeLoad('system');

    const redirectTo = getRedirectTo(beforeLoad);
    expect(redirectTo).toBeNull();
  });

  it('redirects to /403 for non-ADMIN role', () => {
    setPermissions(userPermissions); // role is USER
    const beforeLoad = createAdminModuleBeforeLoad('system');

    const redirectTo = getRedirectTo(beforeLoad);
    expect(redirectTo).toBe('/403');
  });

  it('redirects to /403 when ADMIN but module not enabled', () => {
    setPermissions(basePermissions); // ADMIN but sales not in enabledModules
    const beforeLoad = createAdminModuleBeforeLoad('sales');

    const redirectTo = getRedirectTo(beforeLoad);
    expect(redirectTo).toBe('/403');
  });
});
