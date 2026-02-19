import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePermissions, hasPermission, getFieldVisibility } from './permission.service.js';
import { permissionCache } from './permission-cache.js';

// Mock Prisma client
function createMockPrisma(data: {
  userAccessGroups?: Array<{ accessGroupId: string }>;
  permissions?: Array<{
    accessGroupId: string;
    resourceCode: string;
    canAccess: boolean;
    canNew: boolean;
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>;
  fieldOverrides?: Array<{
    accessGroupId: string;
    resourceCode: string;
    fieldPath: string;
    visibility: string;
  }>;
  resources?: Array<{ code: string; module: string }>;
}) {
  return {
    userAccessGroup: {
      findMany: vi.fn().mockResolvedValue(data.userAccessGroups ?? []),
    },
    accessGroupPermission: {
      findMany: vi.fn().mockResolvedValue(data.permissions ?? []),
    },
    accessGroupFieldOverride: {
      findMany: vi.fn().mockResolvedValue(data.fieldOverrides ?? []),
    },
    resource: {
      findMany: vi.fn().mockResolvedValue(data.resources ?? []),
    },
  } as unknown as Parameters<typeof resolvePermissions>[0];
}

describe('resolvePermissions', () => {
  beforeEach(() => {
    permissionCache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty permissions when user has no access groups', async () => {
    const prisma = createMockPrisma({});
    const result = await resolvePermissions(prisma, 'user1', 'company1');
    expect(result.permissions).toEqual({});
    expect(result.fieldOverrides).toEqual({});
    expect(result.enabledModules).toEqual([]);
  });

  it('returns permissions for a single access group', async () => {
    const prisma = createMockPrisma({
      userAccessGroups: [{ accessGroupId: 'group1' }],
      permissions: [
        {
          accessGroupId: 'group1',
          resourceCode: 'sales.orders.list',
          canAccess: true,
          canNew: true,
          canView: true,
          canEdit: true,
          canDelete: false,
        },
      ],
      resources: [{ code: 'sales.orders.list', module: 'sales' }],
    });

    const result = await resolvePermissions(prisma, 'user1', 'company1');
    expect(result.permissions['sales.orders.list']).toEqual({
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: true,
      canDelete: false,
    });
    expect(result.enabledModules).toContain('sales');
  });

  it('merges permissions from multiple groups using most-permissive-wins', async () => {
    const prisma = createMockPrisma({
      userAccessGroups: [{ accessGroupId: 'group1' }, { accessGroupId: 'group2' }],
      permissions: [
        {
          accessGroupId: 'group1',
          resourceCode: 'sales.orders.list',
          canAccess: true,
          canNew: false,
          canView: true,
          canEdit: false,
          canDelete: false,
        },
        {
          accessGroupId: 'group2',
          resourceCode: 'sales.orders.list',
          canAccess: true,
          canNew: true,
          canView: true,
          canEdit: true,
          canDelete: false,
        },
      ],
      resources: [{ code: 'sales.orders.list', module: 'sales' }],
    });

    const result = await resolvePermissions(prisma, 'user1', 'company1');
    expect(result.permissions['sales.orders.list']).toEqual({
      canAccess: true,
      canNew: true, // group2 wins
      canView: true,
      canEdit: true, // group2 wins
      canDelete: false,
    });
  });

  it('merges field overrides using most-permissive-wins', async () => {
    const prisma = createMockPrisma({
      userAccessGroups: [{ accessGroupId: 'group1' }, { accessGroupId: 'group2' }],
      permissions: [
        {
          accessGroupId: 'group1',
          resourceCode: 'sales.orders.detail',
          canAccess: true,
          canNew: false,
          canView: true,
          canEdit: false,
          canDelete: false,
        },
      ],
      fieldOverrides: [
        {
          accessGroupId: 'group1',
          resourceCode: 'sales.orders.detail',
          fieldPath: 'costPrice',
          visibility: 'HIDDEN',
        },
        {
          accessGroupId: 'group2',
          resourceCode: 'sales.orders.detail',
          fieldPath: 'costPrice',
          visibility: 'READ_ONLY',
        },
      ],
      resources: [{ code: 'sales.orders.detail', module: 'sales' }],
    });

    const result = await resolvePermissions(prisma, 'user1', 'company1');
    expect(result.fieldOverrides['sales.orders.detail']!['costPrice']).toBe('READ_ONLY'); // more permissive wins
  });

  it('uses cached result on second call', async () => {
    const prisma = createMockPrisma({
      userAccessGroups: [{ accessGroupId: 'group1' }],
      permissions: [
        {
          accessGroupId: 'group1',
          resourceCode: 'system.dashboard',
          canAccess: true,
          canNew: false,
          canView: true,
          canEdit: false,
          canDelete: false,
        },
      ],
      resources: [{ code: 'system.dashboard', module: 'system' }],
    });

    await resolvePermissions(prisma, 'user1', 'company1');
    await resolvePermissions(prisma, 'user1', 'company1');

    // DB should only be queried once
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.fn() mock, safe to reference
    expect(prisma.userAccessGroup.findMany).toHaveBeenCalledTimes(1);
  });

  it('derives enabledModules from accessible resources', async () => {
    const prisma = createMockPrisma({
      userAccessGroups: [{ accessGroupId: 'group1' }],
      permissions: [
        {
          accessGroupId: 'group1',
          resourceCode: 'sales.orders.list',
          canAccess: true,
          canNew: false,
          canView: true,
          canEdit: false,
          canDelete: false,
        },
        {
          accessGroupId: 'group1',
          resourceCode: 'finance.gl.list',
          canAccess: true,
          canNew: false,
          canView: true,
          canEdit: false,
          canDelete: false,
        },
        {
          accessGroupId: 'group1',
          resourceCode: 'hr.employees.list',
          canAccess: false,
          canNew: false,
          canView: false,
          canEdit: false,
          canDelete: false,
        },
      ],
      resources: [
        { code: 'sales.orders.list', module: 'sales' },
        { code: 'finance.gl.list', module: 'finance' },
      ],
    });

    const result = await resolvePermissions(prisma, 'user1', 'company1');
    expect(result.enabledModules).toContain('sales');
    expect(result.enabledModules).toContain('finance');
    expect(result.enabledModules).not.toContain('hr');
  });
});

describe('hasPermission', () => {
  beforeEach(() => {
    permissionCache.clear();
  });

  it('returns false when user has no access groups', async () => {
    const prisma = createMockPrisma({});
    const result = await hasPermission(prisma, 'user1', 'company1', 'sales.orders.list');
    expect(result).toBe(false);
  });

  it('returns true when resource has canAccess and no action specified', async () => {
    const prisma = createMockPrisma({
      userAccessGroups: [{ accessGroupId: 'group1' }],
      permissions: [
        {
          accessGroupId: 'group1',
          resourceCode: 'sales.orders.list',
          canAccess: true,
          canNew: false,
          canView: true,
          canEdit: false,
          canDelete: false,
        },
      ],
      resources: [{ code: 'sales.orders.list', module: 'sales' }],
    });

    expect(await hasPermission(prisma, 'user1', 'company1', 'sales.orders.list')).toBe(true);
  });

  it('returns false when canAccess is false', async () => {
    const prisma = createMockPrisma({
      userAccessGroups: [{ accessGroupId: 'group1' }],
      permissions: [
        {
          accessGroupId: 'group1',
          resourceCode: 'sales.orders.list',
          canAccess: false,
          canNew: true,
          canView: true,
          canEdit: true,
          canDelete: true,
        },
      ],
      resources: [],
    });

    expect(await hasPermission(prisma, 'user1', 'company1', 'sales.orders.list', 'new')).toBe(
      false,
    );
  });

  it('checks specific action flag', async () => {
    const prisma = createMockPrisma({
      userAccessGroups: [{ accessGroupId: 'group1' }],
      permissions: [
        {
          accessGroupId: 'group1',
          resourceCode: 'sales.orders.list',
          canAccess: true,
          canNew: false,
          canView: true,
          canEdit: true,
          canDelete: false,
        },
      ],
      resources: [{ code: 'sales.orders.list', module: 'sales' }],
    });

    expect(await hasPermission(prisma, 'user1', 'company1', 'sales.orders.list', 'view')).toBe(
      true,
    );
    expect(await hasPermission(prisma, 'user1', 'company1', 'sales.orders.list', 'new')).toBe(
      false,
    );
    expect(await hasPermission(prisma, 'user1', 'company1', 'sales.orders.list', 'delete')).toBe(
      false,
    );
  });
});

describe('getFieldVisibility', () => {
  beforeEach(() => {
    permissionCache.clear();
  });

  it('returns VISIBLE when no overrides exist', async () => {
    const prisma = createMockPrisma({
      userAccessGroups: [{ accessGroupId: 'group1' }],
      permissions: [],
      resources: [],
    });

    const result = await getFieldVisibility(
      prisma,
      'user1',
      'company1',
      'sales.orders.detail',
      'costPrice',
    );
    expect(result).toBe('VISIBLE');
  });

  it('returns the override visibility when set', async () => {
    const prisma = createMockPrisma({
      userAccessGroups: [{ accessGroupId: 'group1' }],
      permissions: [],
      fieldOverrides: [
        {
          accessGroupId: 'group1',
          resourceCode: 'sales.orders.detail',
          fieldPath: 'costPrice',
          visibility: 'HIDDEN',
        },
      ],
      resources: [],
    });

    const result = await getFieldVisibility(
      prisma,
      'user1',
      'company1',
      'sales.orders.detail',
      'costPrice',
    );
    expect(result).toBe('HIDDEN');
  });
});
