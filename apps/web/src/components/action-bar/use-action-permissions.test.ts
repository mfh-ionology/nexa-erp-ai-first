import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useAuthStore } from '@/stores/auth-store';
import type { ResolvedPermissions } from '@/stores/auth-store';
import type { ActionDefinition } from './types';
import { useActionPermissions } from './use-action-permissions';

// Helper to set auth store permissions
function setPermissions(perms: ResolvedPermissions | null) {
  useAuthStore.setState({ permissions: perms });
}

const basePerm: ResolvedPermissions = {
  userId: 'u1',
  companyId: 'c1',
  role: 'USER',
  isSuperAdmin: false,
  accessGroups: [{ id: 'ag1', code: 'sales', name: 'Sales' }],
  modules: {
    'finance.invoices.detail': {
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: true,
      canDelete: false,
    },
    'sales.orders.detail': {
      canAccess: true,
      canNew: false,
      canView: true,
      canEdit: true,
      canDelete: true,
    },
  },
  fieldOverrides: {},
  enabledModules: ['finance', 'sales'],
};

const sampleActions: ActionDefinition[] = [
  {
    key: 'approve',
    labelKey: 'actionBar.approve',
    onAction: vi.fn(),
    permissionResource: 'finance.invoices.detail',
    permissionAction: 'canEdit',
  },
  {
    key: 'delete',
    labelKey: 'actionBar.delete',
    onAction: vi.fn(),
    permissionResource: 'finance.invoices.detail',
    permissionAction: 'canDelete',
  },
  {
    key: 'save',
    labelKey: 'actionBar.save',
    onAction: vi.fn(),
    // No permission requirements — should always pass through
  },
  {
    key: 'createDispatch',
    labelKey: 'actionBar.createDispatch',
    onAction: vi.fn(),
    permissionResource: 'sales.orders.detail',
    permissionAction: 'canDelete',
  },
];

describe('useActionPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SUPER_ADMIN role returns all actions unfiltered', () => {
    setPermissions({
      ...basePerm,
      isSuperAdmin: true,
      role: 'SUPER_ADMIN',
    });

    const { result } = renderHook(() => useActionPermissions(sampleActions));
    expect(result.current).toHaveLength(sampleActions.length);
    expect(result.current.map((a) => a.key)).toEqual(['approve', 'delete', 'save', 'createDispatch']);
  });

  it('actions without permission requirements pass through', () => {
    setPermissions(basePerm);

    const actionsWithoutPerms: ActionDefinition[] = [
      { key: 'a1', labelKey: 'x', onAction: vi.fn() },
      { key: 'a2', labelKey: 'y', onAction: vi.fn() },
    ];

    const { result } = renderHook(() => useActionPermissions(actionsWithoutPerms));
    expect(result.current).toHaveLength(2);
  });

  it('filters out actions where user lacks the required permission', () => {
    setPermissions(basePerm);

    const { result } = renderHook(() => useActionPermissions(sampleActions));
    const keys = result.current.map((a) => a.key);

    // approve (canEdit=true) => included
    expect(keys).toContain('approve');
    // delete (canDelete=false for finance.invoices.detail) => excluded
    expect(keys).not.toContain('delete');
    // save (no permission requirement) => included
    expect(keys).toContain('save');
    // createDispatch (canDelete=true for sales.orders.detail) => included
    expect(keys).toContain('createDispatch');
  });

  it('actions requiring canDelete are hidden when user lacks delete permission', () => {
    setPermissions({
      ...basePerm,
      modules: {
        'finance.invoices.detail': {
          canAccess: true,
          canNew: true,
          canView: true,
          canEdit: true,
          canDelete: false,
        },
      },
    });

    const deleteAction: ActionDefinition[] = [
      {
        key: 'delete',
        labelKey: 'actionBar.delete',
        onAction: vi.fn(),
        permissionResource: 'finance.invoices.detail',
        permissionAction: 'canDelete',
      },
    ];

    const { result } = renderHook(() => useActionPermissions(deleteAction));
    expect(result.current).toHaveLength(0);
  });

  it('returns empty array when permissions are null', () => {
    setPermissions(null);

    const { result } = renderHook(() => useActionPermissions(sampleActions));
    expect(result.current).toHaveLength(0);
  });

  it('filters out actions referencing unknown permission resource', () => {
    setPermissions(basePerm);

    const unknownAction: ActionDefinition[] = [
      {
        key: 'something',
        labelKey: 'actionBar.something',
        onAction: vi.fn(),
        permissionResource: 'unknown.resource.detail',
        permissionAction: 'canEdit',
      },
    ];

    const { result } = renderHook(() => useActionPermissions(unknownAction));
    expect(result.current).toHaveLength(0);
  });

  it('most-permissive-wins: action visible if any granted permission matches', () => {
    // User has canEdit=true for sales.orders.detail
    setPermissions({
      ...basePerm,
      accessGroups: [
        { id: 'ag1', code: 'sales', name: 'Sales' },
        { id: 'ag2', code: 'admin', name: 'Admin' },
      ],
      modules: {
        'sales.orders.detail': {
          canAccess: true,
          canNew: true,
          canView: true,
          canEdit: true,
          canDelete: true,
        },
      },
    });

    const actions: ActionDefinition[] = [
      {
        key: 'cancel',
        labelKey: 'actionBar.cancel',
        onAction: vi.fn(),
        permissionResource: 'sales.orders.detail',
        permissionAction: 'canEdit',
      },
      {
        key: 'delete',
        labelKey: 'actionBar.delete',
        onAction: vi.fn(),
        permissionResource: 'sales.orders.detail',
        permissionAction: 'canDelete',
      },
    ];

    const { result } = renderHook(() => useActionPermissions(actions));
    expect(result.current).toHaveLength(2);
    expect(result.current.map((a) => a.key)).toEqual(['cancel', 'delete']);
  });
});
