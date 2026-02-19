import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @nexa/db & argon2 — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockArgon2Hash } = vi.hoisted(() => ({
  mockArgon2Hash: vi.fn().mockResolvedValue('$argon2id$hashed-password'),
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userCompanyRole: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    refreshToken: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock argon2 for speed (no real Argon2id hashing in unit tests)
vi.mock('argon2', () => ({
  default: {
    verify: vi.fn(),
    hash: mockArgon2Hash,
    argon2id: 2,
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
}));

// ---------------------------------------------------------------------------
// Imports (after mocks — vi.mock is hoisted but imports must follow)
// ---------------------------------------------------------------------------

import {
  createUser,
  listUsers,
  getUserById,
  updateUserRole,
  deactivateUser,
} from './user.service.js';
import type { CreateUserRequest } from './user.schema.js';
import type { RequestContext } from '../../core/types/request-context.js';
import { NotFoundError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_USER_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const CREATED_USER_ID = '22222222-2222-4000-a000-222222222222';

const now = new Date();

const ctx: RequestContext = {
  userId: TEST_USER_ID,
  tenantId: TEST_COMPANY_ID,
  companyId: TEST_COMPANY_ID,
  role: 'ADMIN',
  enabledModules: ['SYSTEM'],
};

function sampleCreatedUser(overrides: Record<string, unknown> = {}) {
  return {
    id: CREATED_USER_ID,
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    companyId: TEST_COMPANY_ID,
    enabledModules: ['FINANCE'],
    isActive: true,
    mfaEnabled: false,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
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
// createUser
// ---------------------------------------------------------------------------

describe('createUser', () => {
  const validData: CreateUserRequest & { companyId: string } = {
    email: 'john@example.com',
    password: 'SecureP@ss1',
    firstName: 'John',
    lastName: 'Doe',
    companyId: TEST_COMPANY_ID,
    role: 'ADMIN',
    enabledModules: ['FINANCE'],
  };

  it('hashes password with Argon2id before storing (11.2)', async () => {
    mockPrisma.user.create.mockResolvedValue(sampleCreatedUser());
    mockPrisma.userCompanyRole.create.mockResolvedValue({});

    const result = await createUser(mockPrisma as never, validData, ctx);

    // Verify argon2.hash was called with the raw password and Argon2id params
    expect(mockArgon2Hash).toHaveBeenCalledWith('SecureP@ss1', {
      type: 2, // argon2id
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Verify the hashed password (from mock) was passed to Prisma create
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: '$argon2id$hashed-password',
        }),
      }),
    );

    // Verify raw password is NOT in the result
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('creates UserCompanyRole with global role (companyId=null) (11.3)', async () => {
    mockPrisma.user.create.mockResolvedValue(sampleCreatedUser());
    mockPrisma.userCompanyRole.create.mockResolvedValue({});

    await createUser(mockPrisma as never, validData, ctx);

    expect(mockPrisma.userCompanyRole.create).toHaveBeenCalledWith({
      data: {
        userId: CREATED_USER_ID,
        companyId: null,
        role: 'ADMIN',
      },
    });
  });

  it('sets createdBy and updatedBy from ctx.userId (11.4)', async () => {
    mockPrisma.user.create.mockResolvedValue(sampleCreatedUser());
    mockPrisma.userCompanyRole.create.mockResolvedValue({});

    await createUser(mockPrisma as never, validData, ctx);

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdBy: TEST_USER_ID,
          updatedBy: TEST_USER_ID,
        }),
      }),
    );
  });

  it('wraps user + role creation in a transaction', async () => {
    mockPrisma.user.create.mockResolvedValue(sampleCreatedUser());
    mockPrisma.userCompanyRole.create.mockResolvedValue({});

    await createUser(mockPrisma as never, validData, ctx);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('returns user data with role appended', async () => {
    mockPrisma.user.create.mockResolvedValue(sampleCreatedUser());
    mockPrisma.userCompanyRole.create.mockResolvedValue({});

    const result = await createUser(mockPrisma as never, validData, ctx);

    expect(result.email).toBe('john@example.com');
    expect(result.role).toBe('ADMIN');
    expect(result.id).toBe(CREATED_USER_ID);
  });

  it('converts Prisma P2002 error to DUPLICATE_EMAIL (409)', async () => {
    const p2002Error = new Error('Unique constraint failed') as Error & { code: string };
    p2002Error.code = 'P2002';
    mockPrisma.user.create.mockRejectedValue(p2002Error);

    await expect(createUser(mockPrisma as never, validData, ctx)).rejects.toThrow(
      expect.objectContaining({
        code: 'DUPLICATE_EMAIL',
        statusCode: 409,
      }),
    );
  });

  it('re-throws non-P2002 errors as-is', async () => {
    const genericError = new Error('Some DB error');
    mockPrisma.user.create.mockRejectedValue(genericError);

    await expect(createUser(mockPrisma as never, validData, ctx)).rejects.toThrow('Some DB error');
  });
});

// ---------------------------------------------------------------------------
// listUsers
// ---------------------------------------------------------------------------

describe('listUsers', () => {
  const defaultQuery = {
    limit: 20,
    sort: 'createdAt' as const,
    order: 'asc' as const,
    cursor: undefined,
    search: undefined,
    isActive: undefined,
  };

  it('returns correct pagination meta with hasMore=false (11.5)', async () => {
    const users = [
      { ...sampleCreatedUser({ id: 'aaa' }), companyRoles: [{ role: 'ADMIN' }] },
      {
        ...sampleCreatedUser({ id: 'bbb', email: 'jane@example.com' }),
        companyRoles: [{ role: 'STAFF' }],
      },
    ];
    mockPrisma.user.findMany.mockResolvedValue(users);
    mockPrisma.user.count.mockResolvedValue(2);

    const result = await listUsers(mockPrisma as never, TEST_COMPANY_ID, defaultQuery);

    expect(result.data).toHaveLength(2);
    expect(result.meta.hasMore).toBe(false);
    expect(result.meta.cursor).toBeUndefined();
    expect(result.meta.total).toBe(2);
  });

  it('returns correct pagination meta with hasMore=true (11.5)', async () => {
    // Simulate limit+1 rows returned → hasMore = true
    const users = Array.from({ length: 21 }, (_, i) => ({
      ...sampleCreatedUser({
        id: `id-${String(i).padStart(3, '0')}`,
        email: `user${i}@example.com`,
      }),
      companyRoles: [{ role: 'STAFF' }],
    }));
    mockPrisma.user.findMany.mockResolvedValue(users);
    mockPrisma.user.count.mockResolvedValue(50);

    const result = await listUsers(mockPrisma as never, TEST_COMPANY_ID, defaultQuery);

    expect(result.data).toHaveLength(20);
    expect(result.meta.hasMore).toBe(true);
    expect(result.meta.cursor).toBe('id-019');
    expect(result.meta.total).toBe(50);
  });

  it('maps companyRoles to flat role field', async () => {
    const users = [{ ...sampleCreatedUser(), companyRoles: [{ role: 'MANAGER' }] }];
    mockPrisma.user.findMany.mockResolvedValue(users);
    mockPrisma.user.count.mockResolvedValue(1);

    const result = await listUsers(mockPrisma as never, TEST_COMPANY_ID, defaultQuery);

    expect(result.data[0]!.role).toBe('MANAGER');
    expect(result.data[0]!).not.toHaveProperty('companyRoles');
  });

  it('passes search filter as OR clause to Prisma', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await listUsers(mockPrisma as never, TEST_COMPANY_ID, {
      ...defaultQuery,
      search: 'john',
    });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          OR: [
            { email: { contains: 'john', mode: 'insensitive' } },
            { firstName: { contains: 'john', mode: 'insensitive' } },
            { lastName: { contains: 'john', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('passes isActive filter when provided', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await listUsers(mockPrisma as never, TEST_COMPANY_ID, {
      ...defaultQuery,
      isActive: true,
    });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          isActive: true,
        }),
      }),
    );
  });

  it('applies cursor-based pagination with skip:1 + cursor', async () => {
    const cursorId = 'aaaaaaaa-0000-4000-a000-000000000001';
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await listUsers(mockPrisma as never, TEST_COMPANY_ID, {
      ...defaultQuery,
      cursor: cursorId,
    });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        cursor: { id: cursorId },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// updateUserRole
// ---------------------------------------------------------------------------

describe('updateUserRole', () => {
  it('updates existing global role via updateMany (11.6)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: CREATED_USER_ID,
      companyId: TEST_COMPANY_ID,
    });
    mockPrisma.userCompanyRole.updateMany.mockResolvedValue({ count: 1 });

    const result = await updateUserRole(
      mockPrisma as never,
      CREATED_USER_ID,
      TEST_COMPANY_ID,
      'MANAGER' as never,
      ctx,
    );

    expect(mockPrisma.userCompanyRole.updateMany).toHaveBeenCalledWith({
      where: { userId: CREATED_USER_ID, companyId: null },
      data: { role: 'MANAGER' },
    });
    expect(result).toEqual({ userId: CREATED_USER_ID, role: 'MANAGER' });
  });

  it('creates global role when none exists (updateMany.count=0) (11.6)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: CREATED_USER_ID,
      companyId: TEST_COMPANY_ID,
    });
    mockPrisma.userCompanyRole.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.userCompanyRole.create.mockResolvedValue({});

    const result = await updateUserRole(
      mockPrisma as never,
      CREATED_USER_ID,
      TEST_COMPANY_ID,
      'STAFF' as never,
      ctx,
    );

    // updateMany first (found 0 rows)
    expect(mockPrisma.userCompanyRole.updateMany).toHaveBeenCalledWith({
      where: { userId: CREATED_USER_ID, companyId: null },
      data: { role: 'STAFF' },
    });

    // Then create as fallback
    expect(mockPrisma.userCompanyRole.create).toHaveBeenCalledWith({
      data: { userId: CREATED_USER_ID, companyId: null, role: 'STAFF' },
    });

    expect(result).toEqual({ userId: CREATED_USER_ID, role: 'STAFF' });
  });

  it('throws NotFoundError when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      updateUserRole(mockPrisma as never, 'nonexistent', TEST_COMPANY_ID, 'ADMIN' as never, ctx),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when user belongs to different company', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: CREATED_USER_ID,
      companyId: 'other-company-id',
    });

    await expect(
      updateUserRole(mockPrisma as never, CREATED_USER_ID, TEST_COMPANY_ID, 'ADMIN' as never, ctx),
    ).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// deactivateUser
// ---------------------------------------------------------------------------

describe('deactivateUser', () => {
  it('sets isActive=false and revokes all refresh tokens (11.7)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: CREATED_USER_ID,
      companyId: TEST_COMPANY_ID,
    });
    mockPrisma.user.update.mockResolvedValue({
      ...sampleCreatedUser({ isActive: false }),
      companyRoles: [{ role: 'ADMIN' }],
    });
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

    const result = await deactivateUser(mockPrisma as never, CREATED_USER_ID, TEST_COMPANY_ID, ctx);

    // Wrapped in transaction for atomicity
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    // User deactivated
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CREATED_USER_ID },
        data: expect.objectContaining({
          isActive: false,
          updatedBy: TEST_USER_ID,
        }),
      }),
    );

    // All refresh tokens revoked
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: CREATED_USER_ID, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });

    expect(result.isActive).toBe(false);
  });

  it('throws NotFoundError when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      deactivateUser(mockPrisma as never, 'nonexistent', TEST_COMPANY_ID, ctx),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when user belongs to different company', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: CREATED_USER_ID,
      companyId: 'other-company-id',
    });

    await expect(
      deactivateUser(mockPrisma as never, CREATED_USER_ID, TEST_COMPANY_ID, ctx),
    ).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// getUserById
// ---------------------------------------------------------------------------

describe('getUserById', () => {
  it('returns user with flat role from companyRoles', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...sampleCreatedUser(),
      companyRoles: [{ role: 'ADMIN' }],
    });

    const result = await getUserById(mockPrisma as never, CREATED_USER_ID, TEST_COMPANY_ID);

    expect(result.id).toBe(CREATED_USER_ID);
    expect(result.role).toBe('ADMIN');
    expect(result).not.toHaveProperty('companyRoles');
  });

  it('throws NotFoundError when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(getUserById(mockPrisma as never, 'nonexistent', TEST_COMPANY_ID)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('throws NotFoundError when user belongs to different company', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      sampleCreatedUser({ companyId: 'other-company-id' }),
    );

    await expect(
      getUserById(mockPrisma as never, CREATED_USER_ID, TEST_COMPANY_ID),
    ).rejects.toThrow(NotFoundError);
  });
});
