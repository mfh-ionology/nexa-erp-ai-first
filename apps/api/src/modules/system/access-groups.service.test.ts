import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockEventBus } = vi.hoisted(() => ({
  mockPrisma: {
    accessGroup: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    accessGroupPermission: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    userAccessGroup: {
      count: vi.fn(),
    },
    resource: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockEventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
    setLogger: vi.fn(),
  },
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
  FieldVisibility: {
    VISIBLE: 'VISIBLE',
    READ_ONLY: 'READ_ONLY',
    HIDDEN: 'HIDDEN',
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  createAccessGroup,
  listAccessGroups,
  getAccessGroupById,
  updateAccessGroup,
  deleteAccessGroup,
  setAccessGroupPermissions,
} from './access-groups.service.js';
import { DomainError, NotFoundError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_USER_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const GROUP_ID = 'aaaaaaaa-0000-4000-a000-000000000001';

const now = new Date('2026-01-01');

function sampleAccessGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: GROUP_ID,
    companyId: TEST_COMPANY_ID,
    code: 'CUSTOM_ROLE',
    name: 'Custom Role',
    description: 'A custom access group',
    isSystem: false,
    isActive: true,
    createdBy: TEST_USER_ID,
    updatedBy: TEST_USER_ID,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function samplePermission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bbbbbbbb-0000-4000-a000-000000000001',
    accessGroupId: GROUP_ID,
    resourceCode: 'system.users.list',
    canAccess: true,
    canNew: false,
    canView: true,
    canEdit: false,
    canDelete: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default $transaction: pass mockPrisma as the tx object
  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
  );
});

// ---------------------------------------------------------------------------
// createAccessGroup
// ---------------------------------------------------------------------------

describe('createAccessGroup', () => {
  it('creates group with correct companyId and audit fields', async () => {
    mockPrisma.accessGroup.create.mockResolvedValue({
      ...sampleAccessGroup(),
      permissions: [],
      fieldOverrides: [],
      _count: { userAccessGroups: 0 },
    });

    const result = await createAccessGroup(
      mockPrisma as never,
      mockEventBus as never,
      TEST_COMPANY_ID,
      { code: 'CUSTOM_ROLE', name: 'Custom Role', description: 'A custom access group' },
      TEST_USER_ID,
    );

    expect(mockPrisma.accessGroup.create).toHaveBeenCalledWith({
      data: {
        companyId: TEST_COMPANY_ID,
        code: 'CUSTOM_ROLE',
        name: 'Custom Role',
        description: 'A custom access group',
        createdBy: TEST_USER_ID,
        updatedBy: TEST_USER_ID,
      },
      select: expect.objectContaining({
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        permissions: { select: { resourceCode: true, canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true } },
        fieldOverrides: { select: { resourceCode: true, fieldPath: true, visibility: true } },
        _count: { select: { userAccessGroups: { where: { user: { isActive: true } } } } },
      }),
    });

    expect(result.id).toBe(GROUP_ID);
    expect(result.userCount).toBe(0);
    expect(result.userCount).toBe(0);
    expect(result.permissions).toEqual([]);
    expect(result.fieldOverrides).toEqual([]);
  });

  it('emits accessGroup.created event', async () => {
    mockPrisma.accessGroup.create.mockResolvedValue({
      ...sampleAccessGroup(),
      permissions: [],
      fieldOverrides: [],
      _count: { userAccessGroups: 0 },
    });

    await createAccessGroup(
      mockPrisma as never,
      mockEventBus as never,
      TEST_COMPANY_ID,
      { code: 'CUSTOM_ROLE', name: 'Custom Role' },
      TEST_USER_ID,
    );

    expect(mockEventBus.emit).toHaveBeenCalledWith('accessGroup.created', {
      groupId: GROUP_ID,
      companyId: TEST_COMPANY_ID,
      code: 'CUSTOM_ROLE',
      name: 'Custom Role',
      createdBy: TEST_USER_ID,
    });
  });

  it('throws 409 on duplicate code (P2002)', async () => {
    const p2002Error = new Error('Unique constraint failed') as Error & { code: string };
    p2002Error.code = 'P2002';
    mockPrisma.accessGroup.create.mockRejectedValue(p2002Error);

    await expect(
      createAccessGroup(
        mockPrisma as never,
        mockEventBus as never,
        TEST_COMPANY_ID,
        { code: 'DUPLICATE', name: 'Dup' },
        TEST_USER_ID,
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        code: 'DUPLICATE_CODE',
        statusCode: 409,
      }),
    );
  });

  it('re-throws non-P2002 errors as-is', async () => {
    const genericError = new Error('Some DB error');
    mockPrisma.accessGroup.create.mockRejectedValue(genericError);

    await expect(
      createAccessGroup(
        mockPrisma as never,
        mockEventBus as never,
        TEST_COMPANY_ID,
        { code: 'TEST', name: 'Test' },
        TEST_USER_ID,
      ),
    ).rejects.toThrow('Some DB error');
  });

  it('sets description to null when not provided', async () => {
    mockPrisma.accessGroup.create.mockResolvedValue({
      ...sampleAccessGroup({ description: null }),
      permissions: [],
      fieldOverrides: [],
      _count: { userAccessGroups: 0 },
    });

    await createAccessGroup(
      mockPrisma as never,
      mockEventBus as never,
      TEST_COMPANY_ID,
      { code: 'NO_DESC', name: 'No Desc' },
      TEST_USER_ID,
    );

    expect(mockPrisma.accessGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: null }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// listAccessGroups
// ---------------------------------------------------------------------------

describe('listAccessGroups', () => {
  const defaultQuery = {
    limit: 20,
    search: undefined as string | undefined,
    isActive: true,
    cursor: undefined as string | undefined,
  };

  it('returns paginated results with userCount', async () => {
    const groups = [
      { ...sampleAccessGroup(), _count: { userAccessGroups: 3 } },
      {
        ...sampleAccessGroup({ id: 'aaaaaaaa-0000-4000-a000-000000000002', code: 'OTHER' }),
        _count: { userAccessGroups: 1 },
      },
    ];
    mockPrisma.accessGroup.findMany.mockResolvedValue(groups);
    mockPrisma.accessGroup.count.mockResolvedValue(2);

    const result = await listAccessGroups(mockPrisma as never, TEST_COMPANY_ID, defaultQuery);

    expect(result.data).toHaveLength(2);
    expect(result.data[0]!.userCount).toBe(3);
    expect(result.data[1]!.userCount).toBe(1);
    expect(result.meta.hasMore).toBe(false);
    expect(result.meta.total).toBe(2);
  });

  it('filters by search (case-insensitive on code/name/description)', async () => {
    mockPrisma.accessGroup.findMany.mockResolvedValue([]);
    mockPrisma.accessGroup.count.mockResolvedValue(0);

    await listAccessGroups(mockPrisma as never, TEST_COMPANY_ID, {
      ...defaultQuery,
      search: 'manager',
    });

    expect(mockPrisma.accessGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          OR: [
            { code: { contains: 'manager', mode: 'insensitive' } },
            { name: { contains: 'manager', mode: 'insensitive' } },
            { description: { contains: 'manager', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('filters by isActive when provided', async () => {
    mockPrisma.accessGroup.findMany.mockResolvedValue([]);
    mockPrisma.accessGroup.count.mockResolvedValue(0);

    await listAccessGroups(mockPrisma as never, TEST_COMPANY_ID, {
      ...defaultQuery,
      isActive: false,
    });

    expect(mockPrisma.accessGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          isActive: false,
        }),
      }),
    );
  });

  it('omits isActive from WHERE when undefined (returns all groups)', async () => {
    mockPrisma.accessGroup.findMany.mockResolvedValue([]);
    mockPrisma.accessGroup.count.mockResolvedValue(0);

    await listAccessGroups(mockPrisma as never, TEST_COMPANY_ID, {
      ...defaultQuery,
      isActive: undefined,
    });

    const callArgs = mockPrisma.accessGroup.findMany.mock.calls[0]![0];
    expect(callArgs.where).toEqual({ companyId: TEST_COMPANY_ID });
    expect(callArgs.where).not.toHaveProperty('isActive');
  });

  it('cursor pagination — hasMore and nextCursor', async () => {
    // Simulate limit+1 rows → hasMore = true
    const groups = Array.from({ length: 21 }, (_, i) => ({
      ...sampleAccessGroup({
        id: `id-${String(i).padStart(3, '0')}`,
        code: `CODE_${i}`,
      }),
      _count: { userAccessGroups: 0 },
    }));
    mockPrisma.accessGroup.findMany.mockResolvedValue(groups);
    mockPrisma.accessGroup.count.mockResolvedValue(50);

    const result = await listAccessGroups(mockPrisma as never, TEST_COMPANY_ID, defaultQuery);

    expect(result.data).toHaveLength(20);
    expect(result.meta.hasMore).toBe(true);
    expect(result.meta.cursor).toBe('id-019');
    expect(result.meta.total).toBe(50);
  });

  it('applies cursor with skip:1 when provided', async () => {
    const cursorId = 'aaaaaaaa-0000-4000-a000-000000000099';
    mockPrisma.accessGroup.findMany.mockResolvedValue([]);
    mockPrisma.accessGroup.count.mockResolvedValue(0);

    await listAccessGroups(mockPrisma as never, TEST_COMPANY_ID, {
      ...defaultQuery,
      cursor: cursorId,
    });

    expect(mockPrisma.accessGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        cursor: { id: cursorId },
      }),
    );
  });

  it('always includes companyId in WHERE clause', async () => {
    mockPrisma.accessGroup.findMany.mockResolvedValue([]);
    mockPrisma.accessGroup.count.mockResolvedValue(0);

    await listAccessGroups(mockPrisma as never, TEST_COMPANY_ID, defaultQuery);

    expect(mockPrisma.accessGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: TEST_COMPANY_ID }),
      }),
    );
    expect(mockPrisma.accessGroup.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ companyId: TEST_COMPANY_ID }),
    });
  });
});

// ---------------------------------------------------------------------------
// getAccessGroupById
// ---------------------------------------------------------------------------

describe('getAccessGroupById', () => {
  it('returns full detail with permissions and fieldOverrides', async () => {
    const permissions = [samplePermission()];
    const fieldOverrides = [
      {
        id: 'cccccccc-0000-4000-a000-000000000001',
        accessGroupId: GROUP_ID,
        resourceCode: 'system.users.list',
        fieldPath: 'email',
        visibility: 'READ_ONLY',
      },
    ];

    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      ...sampleAccessGroup(),
      permissions,
      fieldOverrides,
      _count: { userAccessGroups: 5 },
    });

    const result = await getAccessGroupById(mockPrisma as never, TEST_COMPANY_ID, GROUP_ID);

    expect(mockPrisma.accessGroup.findFirst).toHaveBeenCalledWith({
      where: { id: GROUP_ID, companyId: TEST_COMPANY_ID },
      select: expect.objectContaining({
        id: true,
        code: true,
        permissions: { select: { resourceCode: true, canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true } },
        fieldOverrides: { select: { resourceCode: true, fieldPath: true, visibility: true } },
        _count: { select: { userAccessGroups: { where: { user: { isActive: true } } } } },
      }),
    });
    expect(result.id).toBe(GROUP_ID);
    expect(result.permissions).toEqual(permissions);
    expect(result.fieldOverrides).toEqual(fieldOverrides);
    expect(result.userCount).toBe(5);
    expect(result).not.toHaveProperty('_count');
  });

  it('throws NotFoundError when group does not exist', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue(null);

    await expect(
      getAccessGroupById(mockPrisma as never, TEST_COMPANY_ID, 'nonexistent'),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError for wrong company (findFirst returns null)', async () => {
    // findFirst with { id, companyId } returns null when companyId doesn't match
    mockPrisma.accessGroup.findFirst.mockResolvedValue(null);

    await expect(
      getAccessGroupById(mockPrisma as never, TEST_COMPANY_ID, GROUP_ID),
    ).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// updateAccessGroup
// ---------------------------------------------------------------------------

describe('updateAccessGroup', () => {
  it('updates metadata and returns full detail', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
      isSystem: false,
    });

    mockPrisma.accessGroup.update.mockResolvedValue({
      ...sampleAccessGroup({ name: 'Updated Name' }),
      permissions: [],
      fieldOverrides: [],
      _count: { userAccessGroups: 2 },
    });

    const result = await updateAccessGroup(
      mockPrisma as never,
      mockEventBus as never,
      TEST_COMPANY_ID,
      GROUP_ID,
      { name: 'Updated Name' },
      TEST_USER_ID,
    );

    expect(mockPrisma.accessGroup.findFirst).toHaveBeenCalledWith({
      where: { id: GROUP_ID, companyId: TEST_COMPANY_ID },
      select: { id: true },
    });
    expect(mockPrisma.accessGroup.update).toHaveBeenCalledWith({
      where: { id: GROUP_ID },
      data: {
        name: 'Updated Name',
        updatedBy: TEST_USER_ID,
      },
      select: expect.objectContaining({
        id: true,
        code: true,
        permissions: { select: { resourceCode: true, canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true } },
        fieldOverrides: { select: { resourceCode: true, fieldPath: true, visibility: true } },
        _count: { select: { userAccessGroups: { where: { user: { isActive: true } } } } },
      }),
    });

    expect(result.name).toBe('Updated Name');
    expect(result.userCount).toBe(2);
  });

  it('emits accessGroup.updated event', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
      isSystem: false,
    });
    mockPrisma.accessGroup.update.mockResolvedValue({
      ...sampleAccessGroup(),
      permissions: [],
      fieldOverrides: [],
      _count: { userAccessGroups: 0 },
    });

    await updateAccessGroup(
      mockPrisma as never,
      mockEventBus as never,
      TEST_COMPANY_ID,
      GROUP_ID,
      { name: 'New Name' },
      TEST_USER_ID,
    );

    expect(mockEventBus.emit).toHaveBeenCalledWith('accessGroup.updated', {
      groupId: GROUP_ID,
      companyId: TEST_COMPANY_ID,
      changedBy: TEST_USER_ID,
    });
  });

  it('allows name/description update on system groups (E2b-2 AC#4)', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
    });
    mockPrisma.accessGroup.update.mockResolvedValue({
      ...sampleAccessGroup({ isSystem: true }),
      name: 'Updated System Name',
      permissions: [],
      fieldOverrides: [],
      _count: { userAccessGroups: 5 },
    });

    const result = await updateAccessGroup(
      mockPrisma as never,
      mockEventBus as never,
      TEST_COMPANY_ID,
      GROUP_ID,
      { name: 'Updated System Name' },
      TEST_USER_ID,
    );

    expect(result.name).toBe('Updated System Name');
    expect(mockPrisma.accessGroup.update).toHaveBeenCalled();
  });

  it('throws NotFoundError when group does not exist', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue(null);

    await expect(
      updateAccessGroup(
        mockPrisma as never,
        mockEventBus as never,
        TEST_COMPANY_ID,
        'nonexistent',
        { name: 'X' },
        TEST_USER_ID,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError for wrong company (findFirst returns null)', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue(null);

    await expect(
      updateAccessGroup(
        mockPrisma as never,
        mockEventBus as never,
        TEST_COMPANY_ID,
        GROUP_ID,
        { name: 'X' },
        TEST_USER_ID,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// deleteAccessGroup
// ---------------------------------------------------------------------------

describe('deleteAccessGroup', () => {
  it('throws DomainError for system group', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
      isSystem: true,
    });

    await expect(
      deleteAccessGroup(mockPrisma as never, mockEventBus as never, TEST_COMPANY_ID, GROUP_ID, TEST_USER_ID),
    ).rejects.toThrow(DomainError);

    await expect(
      deleteAccessGroup(mockPrisma as never, mockEventBus as never, TEST_COMPANY_ID, GROUP_ID, TEST_USER_ID),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'SYSTEM_GROUP_PROTECTED' }),
    );
  });

  it('throws DomainError when users assigned', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
      isSystem: false,
    });
    mockPrisma.userAccessGroup.count.mockResolvedValue(3);

    await expect(
      deleteAccessGroup(mockPrisma as never, mockEventBus as never, TEST_COMPANY_ID, GROUP_ID, TEST_USER_ID),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'GROUP_HAS_USERS' }),
    );
  });

  it('soft-deletes when custom and no users', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
      isSystem: false,
    });
    mockPrisma.userAccessGroup.count.mockResolvedValue(0);
    mockPrisma.accessGroup.update.mockResolvedValue({});

    await deleteAccessGroup(mockPrisma as never, mockEventBus as never, TEST_COMPANY_ID, GROUP_ID, TEST_USER_ID);

    expect(mockPrisma.accessGroup.findFirst).toHaveBeenCalledWith({
      where: { id: GROUP_ID, companyId: TEST_COMPANY_ID, isActive: true },
      select: { id: true, isSystem: true },
    });
    expect(mockPrisma.accessGroup.update).toHaveBeenCalledWith({
      where: { id: GROUP_ID },
      data: { isActive: false, updatedBy: TEST_USER_ID },
    });
  });

  it('emits accessGroup.deleted event on successful delete', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
      isSystem: false,
    });
    mockPrisma.userAccessGroup.count.mockResolvedValue(0);
    mockPrisma.accessGroup.update.mockResolvedValue({});

    await deleteAccessGroup(mockPrisma as never, mockEventBus as never, TEST_COMPANY_ID, GROUP_ID, TEST_USER_ID);

    expect(mockEventBus.emit).toHaveBeenCalledWith('accessGroup.deleted', {
      groupId: GROUP_ID,
      companyId: TEST_COMPANY_ID,
      deletedBy: TEST_USER_ID,
    });
  });

  it('throws NotFoundError when group does not exist', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue(null);

    await expect(
      deleteAccessGroup(mockPrisma as never, mockEventBus as never, TEST_COMPANY_ID, 'nonexistent', TEST_USER_ID),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError for wrong company (findFirst returns null)', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue(null);

    await expect(
      deleteAccessGroup(mockPrisma as never, mockEventBus as never, TEST_COMPANY_ID, GROUP_ID, TEST_USER_ID),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when group is already soft-deleted (isActive: false)', async () => {
    // findFirst with isActive: true returns null for a soft-deleted group
    mockPrisma.accessGroup.findFirst.mockResolvedValue(null);

    await expect(
      deleteAccessGroup(mockPrisma as never, mockEventBus as never, TEST_COMPANY_ID, GROUP_ID, TEST_USER_ID),
    ).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// setAccessGroupPermissions
// ---------------------------------------------------------------------------

describe('setAccessGroupPermissions', () => {
  it('replaces all permissions', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
      isActive: true,
      isSystem: false,
    });

    const newPermissions = [
      { resourceCode: 'system.users.list', canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: false },
      { resourceCode: 'system.company-profile.detail', canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false },
    ];

    mockPrisma.resource.findMany.mockResolvedValue([
      { code: 'system.users.list' },
      { code: 'system.company-profile.detail' },
    ]);

    const expectedResult = newPermissions.map((p, i) => ({
      id: `perm-${i}`,
      accessGroupId: GROUP_ID,
      ...p,
    }));
    mockPrisma.accessGroupPermission.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.accessGroupPermission.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.accessGroupPermission.findMany.mockResolvedValue(expectedResult);

    const result = await setAccessGroupPermissions(
      mockPrisma as never,
      mockEventBus as never,
      TEST_COMPANY_ID,
      GROUP_ID,
      newPermissions,
      TEST_USER_ID,
    );

    // Verify delete then createMany inside transaction
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.accessGroupPermission.deleteMany).toHaveBeenCalledWith({
      where: { accessGroupId: GROUP_ID },
    });
    expect(mockPrisma.accessGroupPermission.createMany).toHaveBeenCalledWith({
      data: [
        { accessGroupId: GROUP_ID, resourceCode: 'system.users.list', canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: false },
        { accessGroupId: GROUP_ID, resourceCode: 'system.company-profile.detail', canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false },
      ],
    });

    expect(result).toEqual(expectedResult);
  });

  it('emits accessGroup.updated event after permission change', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
      isActive: true,
      isSystem: false,
    });
    mockPrisma.resource.findMany.mockResolvedValue([{ code: 'system.users.list' }]);
    mockPrisma.accessGroupPermission.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.accessGroupPermission.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.accessGroupPermission.findMany.mockResolvedValue([]);

    await setAccessGroupPermissions(
      mockPrisma as never,
      mockEventBus as never,
      TEST_COMPANY_ID,
      GROUP_ID,
      [{ resourceCode: 'system.users.list', canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false }],
      TEST_USER_ID,
    );

    expect(mockEventBus.emit).toHaveBeenCalledWith('accessGroup.updated', {
      groupId: GROUP_ID,
      companyId: TEST_COMPANY_ID,
      changedBy: TEST_USER_ID,
    });
  });

  it('throws DomainError for system group (isSystem protection)', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
      isActive: true,
      isSystem: true,
    });

    await expect(
      setAccessGroupPermissions(
        mockPrisma as never,
        mockEventBus as never,
        TEST_COMPANY_ID,
        GROUP_ID,
        [{ resourceCode: 'system.users.list', canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false }],
        TEST_USER_ID,
      ),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'SYSTEM_GROUP_PROTECTED' }),
    );
  });

  it('throws DomainError for inactive group', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
      isActive: false,
      isSystem: false,
    });

    await expect(
      setAccessGroupPermissions(
        mockPrisma as never,
        mockEventBus as never,
        TEST_COMPANY_ID,
        GROUP_ID,
        [],
        TEST_USER_ID,
      ),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'GROUP_INACTIVE' }),
    );
  });

  it('throws on invalid resourceCode', async () => {
    // Only one of two codes is valid
    mockPrisma.resource.findMany.mockResolvedValue([{ code: 'system.users.list' }]);

    await expect(
      setAccessGroupPermissions(
        mockPrisma as never,
        mockEventBus as never,
        TEST_COMPANY_ID,
        GROUP_ID,
        [
          { resourceCode: 'system.users.list', canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false },
          { resourceCode: 'nonexistent.resource', canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false },
        ],
        TEST_USER_ID,
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        code: 'INVALID_RESOURCE',
        statusCode: 400,
      }),
    );

    // Transaction should NOT have been called since validation failed first
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when group does not exist', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue(null);

    await expect(
      setAccessGroupPermissions(
        mockPrisma as never,
        mockEventBus as never,
        TEST_COMPANY_ID,
        'nonexistent',
        [],
        TEST_USER_ID,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError for wrong company (findFirst returns null)', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue(null);

    await expect(
      setAccessGroupPermissions(
        mockPrisma as never,
        mockEventBus as never,
        TEST_COMPANY_ID,
        GROUP_ID,
        [],
        TEST_USER_ID,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('handles empty permissions array (clears all permissions)', async () => {
    mockPrisma.accessGroup.findFirst.mockResolvedValue({
      id: GROUP_ID,
      isActive: true,
      isSystem: false,
    });
    mockPrisma.accessGroupPermission.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.accessGroupPermission.findMany.mockResolvedValue([]);

    const result = await setAccessGroupPermissions(
      mockPrisma as never,
      mockEventBus as never,
      TEST_COMPANY_ID,
      GROUP_ID,
      [],
      TEST_USER_ID,
    );

    expect(mockPrisma.accessGroupPermission.deleteMany).toHaveBeenCalledWith({
      where: { accessGroupId: GROUP_ID },
    });
    // createMany should NOT have been called for empty array
    expect(mockPrisma.accessGroupPermission.createMany).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
