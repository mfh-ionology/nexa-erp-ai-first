import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';

import { getFieldProps } from '@/lib/form-utils';
import type { ResolvedPermissions } from '@/stores/auth-store';
import { useAuthStore } from '@/stores/auth-store';

import { usePermission, useModuleAccess } from './use-permissions';
import { useFieldVisibility } from './use-field-visibility';

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
      canEdit: false,
      canDelete: false,
    },
    'sales.orders.list': {
      canAccess: true,
      canNew: false,
      canView: true,
      canEdit: true,
      canDelete: false,
    },
  },
  fieldOverrides: {
    'sales.orders.detail': {
      costPrice: 'HIDDEN',
      discountPercent: 'READ_ONLY',
    },
  },
  enabledModules: ['system', 'sales'],
};

const superAdminPermissions: ResolvedPermissions = {
  ...basePermissions,
  role: 'SUPER_ADMIN',
  isSuperAdmin: true,
};

function setPermissions(permissions: ResolvedPermissions | null) {
  useAuthStore.setState({ permissions });
}

// --- Tests ---

describe('usePermission', () => {
  beforeEach(() => {
    setPermissions(null);
  });

  it('returns all flags from store for given resource code', () => {
    setPermissions(basePermissions);
    const { result } = renderHook(() => usePermission('system.users.list'));

    expect(result.current).toEqual({
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: false,
      canDelete: false,
      isSuperAdmin: false,
    });
  });

  it('returns correct flags for a different resource code', () => {
    setPermissions(basePermissions);
    const { result } = renderHook(() => usePermission('sales.orders.list'));

    expect(result.current).toEqual({
      canAccess: true,
      canNew: false,
      canView: true,
      canEdit: true,
      canDelete: false,
      isSuperAdmin: false,
    });
  });

  it('returns all true for SUPER_ADMIN', () => {
    setPermissions(superAdminPermissions);
    const { result } = renderHook(() => usePermission('system.users.list'));

    expect(result.current).toEqual({
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: true,
      canDelete: true,
      isSuperAdmin: true,
    });
  });

  it('returns all false when permissions are null', () => {
    setPermissions(null);
    const { result } = renderHook(() => usePermission('system.users.list'));

    expect(result.current).toEqual({
      canAccess: false,
      canNew: false,
      canView: false,
      canEdit: false,
      canDelete: false,
      isSuperAdmin: false,
    });
  });

  it('returns all false for unknown resource codes', () => {
    setPermissions(basePermissions);
    const { result } = renderHook(() => usePermission('nonexistent.resource.code'));

    expect(result.current).toEqual({
      canAccess: false,
      canNew: false,
      canView: false,
      canEdit: false,
      canDelete: false,
      isSuperAdmin: false,
    });
  });
});

describe('useFieldVisibility (from use-field-visibility)', () => {
  beforeEach(() => {
    setPermissions(null);
  });

  it('returns field overrides from store for given resource code', () => {
    setPermissions(basePermissions);
    const { result } = renderHook(() =>
      useFieldVisibility('sales.orders.detail'),
    );

    expect(result.current).toEqual({
      costPrice: 'HIDDEN',
      discountPercent: 'READ_ONLY',
    });
  });

  it('returns empty map for SUPER_ADMIN even with fieldMeta', () => {
    setPermissions(superAdminPermissions);
    const fieldMeta = { costPrice: 'HIDDEN' };
    const { result } = renderHook(() =>
      useFieldVisibility('sales.orders.detail', fieldMeta),
    );

    expect(result.current).toEqual({});
  });

  it('merges _fieldMeta with store overrides (API authoritative for VISIBLE fields)', () => {
    setPermissions(basePermissions);
    // Store has costPrice: HIDDEN, discountPercent: READ_ONLY
    // API says newField: READ_ONLY
    const fieldMeta = { newField: 'READ_ONLY' };
    const { result } = renderHook(() =>
      useFieldVisibility('sales.orders.detail', fieldMeta),
    );

    expect(result.current).toEqual({
      costPrice: 'HIDDEN',
      discountPercent: 'READ_ONLY',
      newField: 'READ_ONLY',
    });
  });

  it('API _fieldMeta overrides VISIBLE fields from store', () => {
    // Set up permissions where a field is implicitly VISIBLE (not in overrides)
    const permsWithPartialOverrides: ResolvedPermissions = {
      ...basePermissions,
      fieldOverrides: {
        'sales.orders.detail': {
          existingField: 'VISIBLE',
          costPrice: 'HIDDEN',
        },
      },
    };
    setPermissions(permsWithPartialOverrides);

    // API says existingField should be READ_ONLY
    const fieldMeta = { existingField: 'READ_ONLY' };
    const { result } = renderHook(() =>
      useFieldVisibility('sales.orders.detail', fieldMeta),
    );

    // API wins for VISIBLE → READ_ONLY
    expect(result.current.existingField).toBe('READ_ONLY');
    // HIDDEN from store is preserved (not overridden by API)
    expect(result.current.costPrice).toBe('HIDDEN');
  });

  it('store HIDDEN/READ_ONLY not overridden by API VISIBLE', () => {
    setPermissions(basePermissions);
    // Store has costPrice: HIDDEN, discountPercent: READ_ONLY
    // API says costPrice: VISIBLE and discountPercent: VISIBLE
    const fieldMeta = { costPrice: 'VISIBLE', discountPercent: 'VISIBLE' };
    const { result } = renderHook(() =>
      useFieldVisibility('sales.orders.detail', fieldMeta),
    );

    // Store HIDDEN/READ_ONLY should NOT be overridden by API VISIBLE
    expect(result.current.costPrice).toBe('HIDDEN');
    expect(result.current.discountPercent).toBe('READ_ONLY');
  });

  it('returns empty map for unknown resource codes without fieldMeta', () => {
    setPermissions(basePermissions);
    const { result } = renderHook(() =>
      useFieldVisibility('nonexistent.resource'),
    );

    expect(result.current).toEqual({});
  });

  it('returns fieldMeta values for unknown resource codes when fieldMeta provided', () => {
    setPermissions(basePermissions);
    const fieldMeta = { someField: 'READ_ONLY' };
    const { result } = renderHook(() =>
      useFieldVisibility('nonexistent.resource', fieldMeta),
    );

    expect(result.current).toEqual({ someField: 'READ_ONLY' });
  });

  it('returns empty map when permissions are null', () => {
    setPermissions(null);
    const { result } = renderHook(() =>
      useFieldVisibility('sales.orders.detail'),
    );

    expect(result.current).toEqual({});
  });
});

describe('useModuleAccess', () => {
  beforeEach(() => {
    setPermissions(null);
  });

  it('returns canAccess: true when module is in enabledModules', () => {
    setPermissions(basePermissions);
    const { result } = renderHook(() => useModuleAccess('system'));

    expect(result.current).toEqual({
      canAccess: true,
      isSuperAdmin: false,
    });
  });

  it('returns canAccess: false when module is not in enabledModules', () => {
    setPermissions(basePermissions);
    const { result } = renderHook(() => useModuleAccess('finance'));

    expect(result.current).toEqual({
      canAccess: false,
      isSuperAdmin: false,
    });
  });

  it('returns canAccess: true for SUPER_ADMIN regardless of enabledModules', () => {
    setPermissions(superAdminPermissions);
    const { result } = renderHook(() => useModuleAccess('manufacturing'));

    expect(result.current).toEqual({
      canAccess: true,
      isSuperAdmin: true,
    });
  });

  it('returns canAccess: false when permissions are null', () => {
    setPermissions(null);
    const { result } = renderHook(() => useModuleAccess('system'));

    expect(result.current).toEqual({
      canAccess: false,
      isSuperAdmin: false,
    });
  });

  it('returns canAccess: false for unknown module keys', () => {
    setPermissions(basePermissions);
    const { result } = renderHook(() => useModuleAccess('nonexistent'));

    expect(result.current).toEqual({
      canAccess: false,
      isSuperAdmin: false,
    });
  });
});

describe('getFieldProps', () => {
  it('returns hidden: true for HIDDEN fields', () => {
    const visibility = { costPrice: 'HIDDEN' as const };
    const result = getFieldProps('costPrice', visibility);

    expect(result).toEqual({
      hidden: true,
      disabled: false,
      ariaReadOnly: undefined,
    });
  });

  it('returns disabled: true for READ_ONLY fields', () => {
    const visibility = { discountPercent: 'READ_ONLY' as const };
    const result = getFieldProps('discountPercent', visibility);

    expect(result).toEqual({
      hidden: false,
      disabled: true,
      ariaReadOnly: true,
    });
  });

  it('returns hidden: false, disabled: false for VISIBLE fields', () => {
    const visibility = { amount: 'VISIBLE' as const };
    const result = getFieldProps('amount', visibility);

    expect(result).toEqual({
      hidden: false,
      disabled: false,
      ariaReadOnly: undefined,
    });
  });

  it('defaults to VISIBLE for fields not in the map', () => {
    const visibility = { otherField: 'HIDDEN' as const };
    const result = getFieldProps('unlisted', visibility);

    expect(result).toEqual({
      hidden: false,
      disabled: false,
      ariaReadOnly: undefined,
    });
  });

  it('defaults to VISIBLE for empty map', () => {
    const result = getFieldProps('anyField', {});

    expect(result).toEqual({
      hidden: false,
      disabled: false,
      ariaReadOnly: undefined,
    });
  });
});
