import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TransactionClient } from '../number-series.service';

// ---------------------------------------------------------------------------
// Mock fs (sync) — readFileSync is called at module load time to cache JSON
// ---------------------------------------------------------------------------

const validDefaults = {
  _meta: {
    version: '1.0.0',
    generatedAt: '2026-02-20',
    description: 'Test defaults',
  },
  resources: [
    {
      code: 'system.users.list',
      name: 'User Management',
      module: 'system',
      type: 'PAGE',
      parentCode: null,
      sortOrder: 100,
      icon: null,
      description: 'User list view',
    },
    {
      code: 'system.users.detail',
      name: 'User Detail',
      module: 'system',
      type: 'PAGE',
      parentCode: 'system.users.list',
      sortOrder: 101,
      icon: null,
      description: 'User detail view',
    },
    {
      code: 'system.company-profile.detail',
      name: 'Company Profile',
      module: 'system',
      type: 'SETTING',
      parentCode: null,
      sortOrder: 200,
      icon: null,
      description: 'Company profile settings',
    },
  ],
  accessGroups: [
    {
      code: 'FULL_ACCESS',
      name: 'Full Access',
      description: 'Complete access to all resources',
      isSystem: true,
      permissions: [
        {
          resourceCode: 'system.users.list',
          canAccess: true,
          canNew: true,
          canView: true,
          canEdit: true,
          canDelete: true,
        },
        {
          resourceCode: 'system.users.detail',
          canAccess: true,
          canNew: true,
          canView: true,
          canEdit: true,
          canDelete: true,
        },
      ],
    },
    {
      code: 'READ_ONLY',
      name: 'Read Only',
      description: 'View-only access',
      isSystem: true,
      permissions: [
        {
          resourceCode: 'system.users.list',
          canAccess: true,
          canNew: false,
          canView: true,
          canEdit: false,
          canDelete: false,
        },
      ],
    },
  ],
};

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue(JSON.stringify(validDefaults)),
}));

// ---------------------------------------------------------------------------
// Mock PrismaClient
// ---------------------------------------------------------------------------
const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();

const mockAccessGroupFindUnique = vi.fn();
const mockAccessGroupUpsert = vi.fn();
const mockAccessGroupPermissionDeleteMany = vi.fn();
const mockAccessGroupPermissionCreateMany = vi.fn();
const mockUserAccessGroupUpsert = vi.fn();

const mockPrisma = {
  resource: {
    findUnique: mockFindUnique,
    upsert: mockUpsert,
  },
  accessGroup: {
    findUnique: mockAccessGroupFindUnique,
    upsert: mockAccessGroupUpsert,
  },
  accessGroupPermission: {
    deleteMany: mockAccessGroupPermissionDeleteMany,
    createMany: mockAccessGroupPermissionCreateMany,
  },
  userAccessGroup: {
    upsert: mockUserAccessGroupUpsert,
  },
} as unknown as TransactionClient;

// Import AFTER mocks are set up
const { loadDefaultResources, loadDefaultAccessGroups, assignFullAccessGroup } = await import(
  '../default-data-loader.service.js'
);

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = 'aaaaaaaa-0000-4000-a000-000000000001';
const TEST_USER_ID = 'bbbbbbbb-0000-4000-a000-000000000001';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Suppress console.log/error during tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('loadDefaultResources', () => {
  it('loads all resources from cached JSON and creates them when none exist', async () => {
    mockFindUnique.mockResolvedValue(null); // None exist
    mockUpsert.mockResolvedValue({ id: 'uuid' });

    const result = await loadDefaultResources(mockPrisma);

    expect(result.created).toBe(3);
    expect(result.updated).toBe(0);
    expect(mockUpsert).toHaveBeenCalledTimes(3);

    // Verify first upsert was called with correct args
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: 'system.users.list' },
        create: expect.objectContaining({
          code: 'system.users.list',
          name: 'User Management',
          module: 'system',
          type: 'PAGE',
          parentCode: null,
          sortOrder: 100,
        }),
        update: expect.objectContaining({
          name: 'User Management',
          module: 'system',
          type: 'PAGE',
        }),
      }),
    );
  });

  it('handles duplicate codes via upsert (reports as updated, no error)', async () => {
    // All three already exist
    mockFindUnique.mockResolvedValue({ id: 'existing-uuid' });
    mockUpsert.mockResolvedValue({ id: 'existing-uuid' });

    const result = await loadDefaultResources(mockPrisma);

    expect(result.created).toBe(0);
    expect(result.updated).toBe(3);
    expect(mockUpsert).toHaveBeenCalledTimes(3);
  });

  it('returns correct mixed created/updated counts', async () => {
    // First exists, second and third are new
    mockFindUnique
      .mockResolvedValueOnce({ id: 'existing-uuid' }) // system.users.list exists
      .mockResolvedValueOnce(null) // system.users.detail is new
      .mockResolvedValueOnce(null); // system.company-profile.detail is new
    mockUpsert.mockResolvedValue({ id: 'uuid' });

    const result = await loadDefaultResources(mockPrisma);

    expect(result.created).toBe(2);
    expect(result.updated).toBe(1);
  });

  it('handles individual resource failures gracefully, continues, then throws aggregate error', async () => {
    mockFindUnique.mockResolvedValue(null);
    // First upsert succeeds, second fails, third succeeds
    mockUpsert
      .mockResolvedValueOnce({ id: 'uuid-1' })
      .mockRejectedValueOnce(new Error('DB connection error'))
      .mockResolvedValueOnce({ id: 'uuid-3' });

    // Function logs individual failures then throws aggregate error
    await expect(loadDefaultResources(mockPrisma)).rejects.toThrow(
      'Failed to load 1 default resources',
    );

    expect(mockUpsert).toHaveBeenCalledTimes(3);
    // Topological sort processes parents (parentCode === null) first:
    // 1. system.users.list, 2. system.company-profile.detail, 3. system.users.detail
    // The second mock call rejects, so company-profile.detail is the failing resource
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('system.company-profile.detail'),
    );
  });
});

// ---------------------------------------------------------------------------
// loadDefaultAccessGroups tests
// ---------------------------------------------------------------------------

describe('loadDefaultAccessGroups', () => {
  it('loads all groups and permissions successfully when none exist', async () => {
    mockAccessGroupFindUnique.mockResolvedValue(null); // None exist
    mockAccessGroupUpsert
      .mockResolvedValueOnce({ id: 'group-1' })
      .mockResolvedValueOnce({ id: 'group-2' });
    mockAccessGroupPermissionDeleteMany.mockResolvedValue({ count: 0 });
    mockAccessGroupPermissionCreateMany.mockResolvedValue({ count: 2 });

    const result = await loadDefaultAccessGroups(mockPrisma, TEST_COMPANY_ID, TEST_USER_ID);

    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(mockAccessGroupUpsert).toHaveBeenCalledTimes(2);

    // Verify first group upsert
    expect(mockAccessGroupUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId_code: { companyId: TEST_COMPANY_ID, code: 'FULL_ACCESS' } },
        create: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          code: 'FULL_ACCESS',
          name: 'Full Access',
          isSystem: true,
          createdBy: TEST_USER_ID,
          updatedBy: TEST_USER_ID,
        }),
        update: expect.objectContaining({
          name: 'Full Access',
          description: 'Complete access to all resources',
          updatedBy: TEST_USER_ID,
        }),
      }),
    );

    // Verify permissions were deleted then recreated for first group
    expect(mockAccessGroupPermissionDeleteMany).toHaveBeenCalledWith({
      where: { accessGroupId: 'group-1' },
    });
    expect(mockAccessGroupPermissionCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          accessGroupId: 'group-1',
          resourceCode: 'system.users.list',
          canAccess: true,
          canNew: true,
          canView: true,
          canEdit: true,
          canDelete: true,
        }),
      ]),
    });
  });

  it('handles duplicate codes via upsert (no error)', async () => {
    // Both groups already exist
    mockAccessGroupFindUnique
      .mockResolvedValueOnce({ id: 'existing-group-1' })
      .mockResolvedValueOnce({ id: 'existing-group-2' });
    mockAccessGroupUpsert
      .mockResolvedValueOnce({ id: 'existing-group-1' })
      .mockResolvedValueOnce({ id: 'existing-group-2' });
    mockAccessGroupPermissionDeleteMany.mockResolvedValue({ count: 0 });
    mockAccessGroupPermissionCreateMany.mockResolvedValue({ count: 0 });

    const result = await loadDefaultAccessGroups(mockPrisma, TEST_COMPANY_ID, TEST_USER_ID);

    expect(result.created).toBe(0);
    expect(result.updated).toBe(2);
    expect(mockAccessGroupUpsert).toHaveBeenCalledTimes(2);
  });

  it('returns correct created/updated counts', async () => {
    // First exists, second is new
    mockAccessGroupFindUnique
      .mockResolvedValueOnce({ id: 'existing-group-1' })
      .mockResolvedValueOnce(null);
    mockAccessGroupUpsert
      .mockResolvedValueOnce({ id: 'existing-group-1' })
      .mockResolvedValueOnce({ id: 'group-2' });
    mockAccessGroupPermissionDeleteMany.mockResolvedValue({ count: 0 });
    mockAccessGroupPermissionCreateMany.mockResolvedValue({ count: 0 });

    const result = await loadDefaultAccessGroups(mockPrisma, TEST_COMPANY_ID, TEST_USER_ID);

    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);
  });

  it('handles individual group failures gracefully, continues, then throws aggregate error', async () => {
    mockAccessGroupFindUnique.mockResolvedValue(null);
    // First group upsert fails, second succeeds
    mockAccessGroupUpsert
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({ id: 'group-2' });
    mockAccessGroupPermissionDeleteMany.mockResolvedValue({ count: 0 });
    mockAccessGroupPermissionCreateMany.mockResolvedValue({ count: 0 });

    // Function logs individual failures then throws aggregate error
    await expect(
      loadDefaultAccessGroups(mockPrisma, TEST_COMPANY_ID, TEST_USER_ID),
    ).rejects.toThrow('Failed to load 1 default access groups');

    // Production code uses single template literal: `Failed to upsert access group "${code}": ${msg}`
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('FULL_ACCESS'),
    );
  });
});

// ---------------------------------------------------------------------------
// assignFullAccessGroup tests
// ---------------------------------------------------------------------------

describe('assignFullAccessGroup', () => {
  it('upserts UserAccessGroup record for FULL_ACCESS group', async () => {
    mockAccessGroupFindUnique.mockResolvedValue({ id: 'full-access-id' });
    mockUserAccessGroupUpsert.mockResolvedValue({ id: 'assignment-id' });

    await assignFullAccessGroup(mockPrisma, TEST_COMPANY_ID, TEST_USER_ID);

    expect(mockAccessGroupFindUnique).toHaveBeenCalledWith({
      where: { companyId_code: { companyId: TEST_COMPANY_ID, code: 'FULL_ACCESS' } },
      select: { id: true },
    });
    expect(mockUserAccessGroupUpsert).toHaveBeenCalledWith({
      where: {
        userId_accessGroupId_companyId: {
          userId: TEST_USER_ID,
          accessGroupId: 'full-access-id',
          companyId: TEST_COMPANY_ID,
        },
      },
      create: {
        userId: TEST_USER_ID,
        accessGroupId: 'full-access-id',
        companyId: TEST_COMPANY_ID,
        assignedBy: TEST_USER_ID,
      },
      update: {
        assignedBy: TEST_USER_ID,
      },
    });
  });

  it('is idempotent — second call succeeds without error', async () => {
    mockAccessGroupFindUnique.mockResolvedValue({ id: 'full-access-id' });
    mockUserAccessGroupUpsert.mockResolvedValue({ id: 'assignment-id' });

    // Call twice to verify idempotency
    await assignFullAccessGroup(mockPrisma, TEST_COMPANY_ID, TEST_USER_ID);
    await assignFullAccessGroup(mockPrisma, TEST_COMPANY_ID, TEST_USER_ID);

    expect(mockUserAccessGroupUpsert).toHaveBeenCalledTimes(2);
  });

  it('logs error and skips if FULL_ACCESS group not found', async () => {
    mockAccessGroupFindUnique.mockResolvedValue(null);

    await assignFullAccessGroup(mockPrisma, TEST_COMPANY_ID, TEST_USER_ID);

    expect(mockUserAccessGroupUpsert).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('FULL_ACCESS group not found'),
    );
  });
});
