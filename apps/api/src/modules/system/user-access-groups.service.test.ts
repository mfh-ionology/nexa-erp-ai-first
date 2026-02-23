import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockEventBus } = vi.hoisted(() => ({
  mockPrisma: {
    userCompanyRole: { findFirst: vi.fn() },
    userAccessGroup: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    accessGroup: { findMany: vi.fn() },
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
  ResourceType: {
    PAGE: 'PAGE',
    REPORT: 'REPORT',
    SETTING: 'SETTING',
    MAINTENANCE: 'MAINTENANCE',
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
  getUserAccessGroups,
  assignUserAccessGroups,
} from './user-access-groups.service.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_USER_ID = '00000000-0000-4000-a000-000000000001';
const TEST_ADMIN_ID = '00000000-0000-4000-a000-000000000099';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_GROUP_ID_1 = 'aaaaaaaa-0000-4000-a000-000000000001';
const TEST_GROUP_ID_2 = 'aaaaaaaa-0000-4000-a000-000000000002';

const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

function sampleUserAccessGroupResult(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bbbbbbbb-0000-4000-b000-000000000001',
    userId: TEST_USER_ID,
    accessGroupId: TEST_GROUP_ID_1,
    companyId: TEST_COMPANY_ID,
    assignedBy: TEST_ADMIN_ID,
    createdAt: CREATED_AT,
    accessGroup: {
      id: TEST_GROUP_ID_1,
      code: 'FULL_ACCESS',
      name: 'Full Access',
      description: 'All permissions on all resources',
      isSystem: true,
    },
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
// getUserAccessGroups
// ---------------------------------------------------------------------------

describe('getUserAccessGroups', () => {
  it('returns assigned groups for valid user in company', async () => {
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    mockPrisma.userAccessGroup.findMany.mockResolvedValue([
      sampleUserAccessGroupResult(),
      sampleUserAccessGroupResult({
        id: 'bbbbbbbb-0000-4000-b000-000000000002',
        accessGroupId: TEST_GROUP_ID_2,
        accessGroup: {
          id: TEST_GROUP_ID_2,
          code: 'REPORT_VIEWER',
          name: 'Report Viewer',
          description: null,
          isSystem: false,
        },
      }),
    ]);

    const result = await getUserAccessGroups(mockPrisma as never, TEST_COMPANY_ID, TEST_USER_ID);

    expect(result.userId).toBe(TEST_USER_ID);
    expect(result.companyId).toBe(TEST_COMPANY_ID);
    expect(result.accessGroups).toHaveLength(2);
    expect(result.accessGroups[0]).toEqual({
      id: TEST_GROUP_ID_1,
      code: 'FULL_ACCESS',
      name: 'Full Access',
      description: 'All permissions on all resources',
      isSystem: true,
      assignedBy: TEST_ADMIN_ID,
      assignedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.accessGroups[1]).toEqual({
      id: TEST_GROUP_ID_2,
      code: 'REPORT_VIEWER',
      name: 'Report Viewer',
      description: null,
      isSystem: false,
      assignedBy: TEST_ADMIN_ID,
      assignedAt: '2026-01-01T00:00:00.000Z',
    });

    // Verify companyId is in WHERE clause
    expect(mockPrisma.userAccessGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER_ID, companyId: TEST_COMPANY_ID },
      }),
    );
  });

  it('throws NotFoundError for user not in company', async () => {
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue(null);

    await expect(
      getUserAccessGroups(mockPrisma as never, TEST_COMPANY_ID, TEST_USER_ID),
    ).rejects.toThrow(
      expect.objectContaining({ name: 'NotFoundError', code: 'USER_NOT_FOUND' }),
    );
  });

  it('returns empty array when user has no groups assigned', async () => {
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    mockPrisma.userAccessGroup.findMany.mockResolvedValue([]);

    const result = await getUserAccessGroups(mockPrisma as never, TEST_COMPANY_ID, TEST_USER_ID);

    expect(result.userId).toBe(TEST_USER_ID);
    expect(result.companyId).toBe(TEST_COMPANY_ID);
    expect(result.accessGroups).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// assignUserAccessGroups
// ---------------------------------------------------------------------------

describe('assignUserAccessGroups', () => {
  it('replaces all existing assignments', async () => {
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    mockPrisma.accessGroup.findMany.mockResolvedValue([
      { id: TEST_GROUP_ID_1 },
      { id: TEST_GROUP_ID_2 },
    ]);
    mockPrisma.userAccessGroup.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.userAccessGroup.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.userAccessGroup.findMany.mockResolvedValue([
      sampleUserAccessGroupResult(),
      sampleUserAccessGroupResult({
        id: 'bbbbbbbb-0000-4000-b000-000000000002',
        accessGroupId: TEST_GROUP_ID_2,
        accessGroup: {
          id: TEST_GROUP_ID_2,
          code: 'REPORT_VIEWER',
          name: 'Report Viewer',
          description: null,
          isSystem: false,
        },
      }),
    ]);

    const result = await assignUserAccessGroups(
      mockPrisma as never,
      mockEventBus as never,
      TEST_COMPANY_ID,
      TEST_USER_ID,
      [TEST_GROUP_ID_1, TEST_GROUP_ID_2],
      TEST_ADMIN_ID,
    );

    // Verify transaction was used
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    // Verify deleteMany with companyId
    expect(mockPrisma.userAccessGroup.deleteMany).toHaveBeenCalledWith({
      where: { userId: TEST_USER_ID, companyId: TEST_COMPANY_ID },
    });

    // Verify createMany with correct data
    expect(mockPrisma.userAccessGroup.createMany).toHaveBeenCalledWith({
      data: [
        { userId: TEST_USER_ID, accessGroupId: TEST_GROUP_ID_1, companyId: TEST_COMPANY_ID, assignedBy: TEST_ADMIN_ID },
        { userId: TEST_USER_ID, accessGroupId: TEST_GROUP_ID_2, companyId: TEST_COMPANY_ID, assignedBy: TEST_ADMIN_ID },
      ],
    });

    expect(result.accessGroups).toHaveLength(2);
    expect(result.userId).toBe(TEST_USER_ID);
    expect(result.companyId).toBe(TEST_COMPANY_ID);
  });

  it('throws NotFoundError for user not in company', async () => {
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue(null);

    await expect(
      assignUserAccessGroups(
        mockPrisma as never,
        mockEventBus as never,
        TEST_COMPANY_ID,
        TEST_USER_ID,
        [TEST_GROUP_ID_1],
        TEST_ADMIN_ID,
      ),
    ).rejects.toThrow(
      expect.objectContaining({ name: 'NotFoundError', code: 'USER_NOT_FOUND' }),
    );
  });

  it('throws AppError 400 when accessGroupId from different company', async () => {
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    // Only one group found (the other belongs to a different company)
    mockPrisma.accessGroup.findMany.mockResolvedValue([{ id: TEST_GROUP_ID_1 }]);

    await expect(
      assignUserAccessGroups(
        mockPrisma as never,
        mockEventBus as never,
        TEST_COMPANY_ID,
        TEST_USER_ID,
        [TEST_GROUP_ID_1, TEST_GROUP_ID_2],
        TEST_ADMIN_ID,
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        name: 'AppError',
        code: 'INVALID_ACCESS_GROUP',
        statusCode: 400,
      }),
    );
  });

  it('throws AppError 400 when accessGroupId is inactive', async () => {
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    // findMany with isActive: true returns empty for inactive group
    mockPrisma.accessGroup.findMany.mockResolvedValue([]);

    await expect(
      assignUserAccessGroups(
        mockPrisma as never,
        mockEventBus as never,
        TEST_COMPANY_ID,
        TEST_USER_ID,
        [TEST_GROUP_ID_1],
        TEST_ADMIN_ID,
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        code: 'INVALID_ACCESS_GROUP',
        statusCode: 400,
      }),
    );
  });

  it('throws AppError 400 when accessGroupId does not exist', async () => {
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    mockPrisma.accessGroup.findMany.mockResolvedValue([]);

    const nonExistentId = 'ffffffff-0000-4000-f000-000000000001';
    await expect(
      assignUserAccessGroups(
        mockPrisma as never,
        mockEventBus as never,
        TEST_COMPANY_ID,
        TEST_USER_ID,
        [nonExistentId],
        TEST_ADMIN_ID,
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        code: 'INVALID_ACCESS_GROUP',
        statusCode: 400,
      }),
    );

    // Transaction was called but aborted due to validation error inside it
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    // deleteMany should NOT have been called since validation failed first
    expect(mockPrisma.userAccessGroup.deleteMany).not.toHaveBeenCalled();
  });

  it('emits user.accessGroups.assigned event with correct payload', async () => {
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    mockPrisma.accessGroup.findMany.mockResolvedValue([{ id: TEST_GROUP_ID_1 }]);
    mockPrisma.userAccessGroup.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.userAccessGroup.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.userAccessGroup.findMany.mockResolvedValue([sampleUserAccessGroupResult()]);

    await assignUserAccessGroups(
      mockPrisma as never,
      mockEventBus as never,
      TEST_COMPANY_ID,
      TEST_USER_ID,
      [TEST_GROUP_ID_1],
      TEST_ADMIN_ID,
    );

    expect(mockEventBus.emit).toHaveBeenCalledWith('user.accessGroups.assigned', {
      userId: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      groupIds: [TEST_GROUP_ID_1],
      assignedBy: TEST_ADMIN_ID,
    });
  });

  it('records correct assignedBy value', async () => {
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ id: 'ucr-1' });
    mockPrisma.accessGroup.findMany.mockResolvedValue([{ id: TEST_GROUP_ID_1 }]);
    mockPrisma.userAccessGroup.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.userAccessGroup.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.userAccessGroup.findMany.mockResolvedValue([sampleUserAccessGroupResult()]);

    await assignUserAccessGroups(
      mockPrisma as never,
      mockEventBus as never,
      TEST_COMPANY_ID,
      TEST_USER_ID,
      [TEST_GROUP_ID_1],
      TEST_ADMIN_ID,
    );

    expect(mockPrisma.userAccessGroup.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ assignedBy: TEST_ADMIN_ID }),
      ],
    });
  });
});
