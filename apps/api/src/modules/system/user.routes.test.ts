import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole } = vi.hoisted(() => ({
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
    companyProfile: { findUnique: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
  mockResolveUserRole: vi.fn(),
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  resolveUserRole: mockResolveUserRole,
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

// Mock argon2 for speed (no real Argon2id hashing in tests)
vi.mock('argon2', () => ({
  default: {
    verify: vi.fn(),
    hash: vi.fn().mockResolvedValue('$argon2id$hashed-password'),
    argon2id: 2,
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../core/validation/index.js';
import { userRoutesPlugin } from './user.routes.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_USER_ID,
  TEST_COMPANY_ID,
} from '../../test-utils/jwt.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TARGET_USER_ID = '22222222-2222-4000-a000-222222222222';
const NONEXISTENT_USER_ID = '99999999-9999-4000-a000-999999999999';

const now = new Date();

/** Sample user matching the Prisma select shape (userSelect in user.service.ts). */
function sampleUser(overrides: Record<string, unknown> = {}) {
  return {
    id: TARGET_USER_ID,
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

/** Build a minimal Fastify app with jwt-verify + company-context + user routes. */
async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);
  await app.register(userRoutesPlugin, { prefix: '/system' });
  await app.ready();
  return app;
}

/**
 * Configure argument-based mocks for the company-context middleware and
 * common Prisma operations. Uses mockImplementation to handle multiple
 * callers (company-context + service) inspecting different user IDs.
 */
function setupMocks(
  config: {
    role?: string;
    targetUserResult?: Record<string, unknown> | null;
  } = {},
) {
  const resolvedRole = config.role ?? 'ADMIN';

  // Company-context: look up requesting user (TEST_USER_ID) → active
  // Service methods may also look up TARGET_USER_ID
  mockPrisma.user.findUnique.mockImplementation((args: { where: { id: string } }) => {
    if (args.where.id === TEST_USER_ID) {
      return Promise.resolve({ companyId: TEST_COMPANY_ID, isActive: true });
    }
    if (args.where.id === TARGET_USER_ID && config.targetUserResult !== undefined) {
      return Promise.resolve(config.targetUserResult);
    }
    if (args.where.id === TARGET_USER_ID) {
      return Promise.resolve(sampleUser());
    }
    return Promise.resolve(null);
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
  mockResolveUserRole.mockResolvedValue(resolvedRole);

  // $transaction: call the callback with mockPrisma as the tx object
  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let testJwt: string;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  testJwt = await makeTestJwt();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('User CRUD routes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  const validCreatePayload = {
    email: 'john@example.com',
    password: 'SecureP@ss1',
    firstName: 'John',
    lastName: 'Doe',
    role: 'ADMIN',
    enabledModules: ['FINANCE'],
  };

  // =========================================================================
  // POST /system/users
  // =========================================================================

  describe('POST /system/users', () => {
    // 9.2 — Valid data → 201, user created with hashed password
    it('creates a user with valid data and returns 201 (9.2)', async () => {
      setupMocks();
      mockPrisma.user.create.mockResolvedValue(sampleUser());
      mockPrisma.userCompanyRole.create.mockResolvedValue({});

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/system/users',
        headers: authHeaders(testJwt),
        payload: validCreatePayload,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.email).toBe('john@example.com');
      expect(body.data.firstName).toBe('John');
      expect(body.data.lastName).toBe('Doe');
      expect(body.data.role).toBe('ADMIN');
      // Verify sensitive fields are NOT exposed
      expect(body.data).not.toHaveProperty('passwordHash');
      expect(body.data).not.toHaveProperty('mfaSecret');
      // Verify password was hashed via argon2
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: '$argon2id$hashed-password',
          }),
        }),
      );
    });

    // 9.3 — ADMIN role → success; STAFF role → 403
    it('allows ADMIN role to create users (9.3)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockPrisma.user.create.mockResolvedValue(sampleUser());
      mockPrisma.userCompanyRole.create.mockResolvedValue({});

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/system/users',
        headers: authHeaders(testJwt),
        payload: validCreatePayload,
      });

      expect(res.statusCode).toBe(201);
    });

    it('denies STAFF role with 403 FORBIDDEN (9.3)', async () => {
      setupMocks({ role: 'STAFF' });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/system/users',
        headers: authHeaders(testJwt),
        payload: validCreatePayload,
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    // 9.4 — Duplicate email → 409 CONFLICT
    it('returns 409 DUPLICATE_EMAIL for duplicate email (9.4)', async () => {
      setupMocks();
      const p2002Error = new Error('Unique constraint failed') as Error & { code: string };
      p2002Error.code = 'P2002';
      mockPrisma.user.create.mockRejectedValue(p2002Error);

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/system/users',
        headers: authHeaders(testJwt),
        payload: validCreatePayload,
      });

      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('DUPLICATE_EMAIL');
    });

    // 9.5 — Invalid email → 400 VALIDATION_ERROR
    it('returns 400 VALIDATION_ERROR for invalid email (9.5)', async () => {
      setupMocks();

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/system/users',
        headers: authHeaders(testJwt),
        payload: { ...validCreatePayload, email: 'not-an-email' },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // GET /system/users
  // =========================================================================

  describe('GET /system/users', () => {
    // 9.6 — 200 with paginated list, no sensitive fields
    it('returns 200 with paginated list, no passwordHash or mfaSecret exposed (9.6)', async () => {
      setupMocks();
      const users = [
        {
          ...sampleUser({ id: 'aaaaaaaa-0000-4000-a000-000000000001' }),
          companyRoles: [{ role: 'ADMIN' }],
        },
        {
          ...sampleUser({
            id: 'bbbbbbbb-0000-4000-a000-000000000002',
            email: 'jane@example.com',
            firstName: 'Jane',
          }),
          companyRoles: [{ role: 'STAFF' }],
        },
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.user.count.mockResolvedValue(2);

      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/system/users',
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.meta.hasMore).toBe(false);
      expect(body.meta.total).toBe(2);

      // Verify response shape — no sensitive fields
      for (const user of body.data) {
        expect(user).not.toHaveProperty('passwordHash');
        expect(user).not.toHaveProperty('mfaSecret');
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('firstName');
        expect(user).toHaveProperty('lastName');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('isActive');
        expect(user).toHaveProperty('enabledModules');
      }
    });

    // 9.7 — Cursor pagination → correct hasMore/cursor
    it('returns correct hasMore and cursor with pagination (9.7)', async () => {
      setupMocks();
      // Return limit + 1 items (21 for default limit of 20) to trigger hasMore
      const users = Array.from({ length: 21 }, (_, i) => ({
        ...sampleUser({
          id: `${String(i + 1).padStart(8, '0')}-0000-4000-a000-000000000000`,
          email: `user${i}@example.com`,
        }),
        companyRoles: [{ role: 'STAFF' }],
      }));
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.user.count.mockResolvedValue(50);

      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/system/users?limit=20',
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(20);
      expect(body.meta.hasMore).toBe(true);
      expect(body.meta.cursor).toBeDefined();
      // Cursor should be the ID of the last item in the returned (trimmed) data
      expect(body.meta.cursor).toBe('00000020-0000-4000-a000-000000000000');
      expect(body.meta.total).toBe(50);
    });

    // 9.8 — Search filter → matching results only
    it('returns matching results with search filter (9.8)', async () => {
      setupMocks();
      mockPrisma.user.findMany.mockResolvedValue([
        {
          ...sampleUser({ email: 'john@example.com' }),
          companyRoles: [{ role: 'ADMIN' }],
        },
      ]);
      mockPrisma.user.count.mockResolvedValue(1);

      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/system/users?search=john',
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].email).toBe('john@example.com');

      // Verify search filters were passed to Prisma
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                email: expect.objectContaining({ contains: 'john' }),
              }),
            ]),
          }),
        }),
      );
    });

    // 9.9 — isActive filter → only matching records
    it('filters by isActive=true when provided (9.9)', async () => {
      setupMocks();
      mockPrisma.user.findMany.mockResolvedValue([
        {
          ...sampleUser({ isActive: true }),
          companyRoles: [{ role: 'STAFF' }],
        },
      ]);
      mockPrisma.user.count.mockResolvedValue(1);

      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/system/users?isActive=true',
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].isActive).toBe(true);

      // Verify isActive filter was passed to Prisma
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('filters by isActive=false correctly (9.9)', async () => {
      setupMocks();
      mockPrisma.user.findMany.mockResolvedValue([
        {
          ...sampleUser({ isActive: false }),
          companyRoles: [{ role: 'STAFF' }],
        },
      ]);
      mockPrisma.user.count.mockResolvedValue(1);

      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/system/users?isActive=false',
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].isActive).toBe(false);

      // Verify isActive=false was correctly passed to Prisma
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: false }),
        }),
      );
    });
  });

  // =========================================================================
  // GET /system/users/:id
  // =========================================================================

  describe('GET /system/users/:id', () => {
    // 9.10 — 200 with user data
    it('returns 200 with user data (9.10)', async () => {
      setupMocks();
      // Override findUnique to also return target user with companyRoles
      mockPrisma.user.findUnique.mockImplementation((args: { where: { id: string } }) => {
        if (args.where.id === TEST_USER_ID) {
          return Promise.resolve({ companyId: TEST_COMPANY_ID, isActive: true });
        }
        if (args.where.id === TARGET_USER_ID) {
          return Promise.resolve({
            ...sampleUser(),
            companyRoles: [{ role: 'ADMIN' }],
          });
        }
        return Promise.resolve(null);
      });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: `/system/users/${TARGET_USER_ID}`,
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(TARGET_USER_ID);
      expect(body.data.email).toBe('john@example.com');
      expect(body.data.role).toBe('ADMIN');
    });

    // 9.11 — nonexistent user → 404 NOT_FOUND
    it('returns 404 NOT_FOUND for nonexistent user (9.11)', async () => {
      setupMocks();
      // Override to return null for the nonexistent user
      mockPrisma.user.findUnique.mockImplementation((args: { where: { id: string } }) => {
        if (args.where.id === TEST_USER_ID) {
          return Promise.resolve({ companyId: TEST_COMPANY_ID, isActive: true });
        }
        return Promise.resolve(null);
      });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: `/system/users/${NONEXISTENT_USER_ID}`,
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // =========================================================================
  // PATCH /system/users/:id
  // =========================================================================

  describe('PATCH /system/users/:id', () => {
    // 9.12 — Valid update → 200
    it('updates user with valid data and returns 200 (9.12)', async () => {
      setupMocks();
      // findUnique for existence check in service
      mockPrisma.user.findUnique.mockImplementation((args: { where: { id: string } }) => {
        if (args.where.id === TEST_USER_ID) {
          return Promise.resolve({ companyId: TEST_COMPANY_ID, isActive: true });
        }
        if (args.where.id === TARGET_USER_ID) {
          return Promise.resolve({ id: TARGET_USER_ID, companyId: TEST_COMPANY_ID });
        }
        return Promise.resolve(null);
      });
      mockPrisma.user.update.mockResolvedValue({
        ...sampleUser({ firstName: 'Jane' }),
        companyRoles: [{ role: 'ADMIN' }],
      });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/system/users/${TARGET_USER_ID}`,
        headers: authHeaders(testJwt),
        payload: { firstName: 'Jane' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.firstName).toBe('Jane');
    });
  });

  // =========================================================================
  // PATCH /system/users/:id/role
  // =========================================================================

  describe('PATCH /system/users/:id/role', () => {
    // 9.13 — Update global role → 200
    it('updates global UserCompanyRole and returns 200 (9.13)', async () => {
      setupMocks();
      mockPrisma.user.findUnique.mockImplementation((args: { where: { id: string } }) => {
        if (args.where.id === TEST_USER_ID) {
          return Promise.resolve({ companyId: TEST_COMPANY_ID, isActive: true });
        }
        if (args.where.id === TARGET_USER_ID) {
          return Promise.resolve({ id: TARGET_USER_ID, companyId: TEST_COMPANY_ID });
        }
        return Promise.resolve(null);
      });
      mockPrisma.userCompanyRole.updateMany.mockResolvedValue({ count: 1 });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/system/users/${TARGET_USER_ID}/role`,
        headers: authHeaders(testJwt),
        payload: { role: 'MANAGER' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.userId).toBe(TARGET_USER_ID);
      expect(body.data.role).toBe('MANAGER');

      // Verify the global role (companyId=null) was updated
      expect(mockPrisma.userCompanyRole.updateMany).toHaveBeenCalledWith({
        where: { userId: TARGET_USER_ID, companyId: null },
        data: { role: 'MANAGER' },
      });
    });
  });

  // =========================================================================
  // PATCH /system/users/:id/modules
  // =========================================================================

  describe('PATCH /system/users/:id/modules', () => {
    // 9.14 — Update enabledModules → 200
    it('updates enabledModules and returns 200 (9.14)', async () => {
      setupMocks();
      mockPrisma.user.findUnique.mockImplementation((args: { where: { id: string } }) => {
        if (args.where.id === TEST_USER_ID) {
          return Promise.resolve({ companyId: TEST_COMPANY_ID, isActive: true });
        }
        if (args.where.id === TARGET_USER_ID) {
          return Promise.resolve({ id: TARGET_USER_ID, companyId: TEST_COMPANY_ID });
        }
        return Promise.resolve(null);
      });
      mockPrisma.user.update.mockResolvedValue({
        ...sampleUser({ enabledModules: ['FINANCE', 'SALES'] }),
        companyRoles: [{ role: 'ADMIN' }],
      });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/system/users/${TARGET_USER_ID}/modules`,
        headers: authHeaders(testJwt),
        payload: { enabledModules: ['FINANCE', 'SALES'] },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.enabledModules).toEqual(['FINANCE', 'SALES']);
      expect(body.data.role).toBe('ADMIN');
    });
  });

  // =========================================================================
  // DELETE /system/users/:id
  // =========================================================================

  describe('DELETE /system/users/:id', () => {
    // 9.15 — Soft-delete → 200, isActive=false
    it('soft-deletes user (isActive=false) and returns 200 (9.15)', async () => {
      setupMocks();
      mockPrisma.user.findUnique.mockImplementation((args: { where: { id: string } }) => {
        if (args.where.id === TEST_USER_ID) {
          return Promise.resolve({ companyId: TEST_COMPANY_ID, isActive: true });
        }
        if (args.where.id === TARGET_USER_ID) {
          return Promise.resolve({ id: TARGET_USER_ID, companyId: TEST_COMPANY_ID });
        }
        return Promise.resolve(null);
      });
      mockPrisma.user.update.mockResolvedValue({
        ...sampleUser({ isActive: false }),
        companyRoles: [{ role: 'ADMIN' }],
      });
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'DELETE',
        url: `/system/users/${TARGET_USER_ID}`,
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.isActive).toBe(false);

      // Verify refresh tokens were revoked for the deactivated user
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: TARGET_USER_ID, revokedAt: null },
        }),
      );
    });
  });

  // =========================================================================
  // Unauthenticated requests
  // =========================================================================

  describe('Unauthenticated requests', () => {
    // 9.16 — No auth → 401
    it('returns 401 UNAUTHORIZED without Authorization header (9.16)', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/system/users',
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 UNAUTHORIZED with invalid Bearer token (9.16)', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/system/users',
        headers: { authorization: 'Bearer invalid-token' },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
