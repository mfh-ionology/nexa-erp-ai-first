import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'crypto';

let prisma: PrismaClient;

// Track created entity IDs for cleanup (delete in FK-safe order)
let refreshTokenIds: string[] = [];
let roleIds: string[] = [];
let userIds: string[] = [];
let companyIds: string[] = [];

beforeAll(async () => {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set for tests');
  }
  const adapter = new PrismaPg({ connectionString });
  prisma = new PrismaClient({ adapter });
});

async function cleanup() {
  if (refreshTokenIds.length > 0) {
    await prisma.refreshToken.deleteMany({ where: { id: { in: refreshTokenIds } } });
    refreshTokenIds = [];
  }
  if (roleIds.length > 0) {
    await prisma.userCompanyRole.deleteMany({ where: { id: { in: roleIds } } });
    roleIds = [];
  }
  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    userIds = [];
  }
  if (companyIds.length > 0) {
    await prisma.companyProfile.deleteMany({ where: { id: { in: companyIds } } });
    companyIds = [];
  }
}

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

async function createCompany(name: string): Promise<string> {
  const company = await prisma.companyProfile.create({
    data: {
      name,
      baseCurrencyCode: 'GBP',
      countryCode: 'GB',
      createdBy: 'test',
      updatedBy: 'test',
    },
  });
  companyIds.push(company.id);
  return company.id;
}

async function createUser(companyId: string, emailSuffix?: string): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `test-${emailSuffix ?? Date.now() + '-' + Math.random().toString(36).slice(2)}@test.dev`,
      passwordHash: 'test-hash-not-real',
      firstName: 'Test',
      lastName: 'User',
      companyId,
      createdBy: 'test',
      updatedBy: 'test',
    },
  });
  userIds.push(user.id);
  return user.id;
}

// ---------------------------------------------------------------------------
// User Model
// ---------------------------------------------------------------------------

describe('User model', () => {
  it('creates a user with all required fields', async () => {
    const companyId = await createCompany('User CRUD test');
    const userId = await createUser(companyId);

    const user = await prisma.user.findUnique({ where: { id: userId } });

    expect(user).not.toBeNull();
    expect(user!.companyId).toBe(companyId);
    expect(user!.mfaEnabled).toBe(false);
    expect(user!.isActive).toBe(true);
    expect(user!.enabledModules).toEqual([]);
  });

  it('enforces unique email constraint', async () => {
    const companyId = await createCompany('Unique email test');
    const uniqueEmail = `unique-${Date.now()}@test.dev`;

    await createUser(companyId, uniqueEmail.replace('@test.dev', ''));

    // Second user with same email should fail
    await expect(
      prisma.user.create({
        data: {
          email: `test-${uniqueEmail.replace('@test.dev', '')}@test.dev`,
          passwordHash: 'another-hash',
          firstName: 'Duplicate',
          lastName: 'Email',
          companyId,
          createdBy: 'test',
          updatedBy: 'test',
        },
      }),
    ).rejects.toThrow();
  });

  it("onDelete Restrict: cannot delete company that is a user's default", async () => {
    const companyId = await createCompany('Restrict delete test');
    await createUser(companyId);

    // Attempting to delete the company should fail (user references it)
    await expect(prisma.companyProfile.delete({ where: { id: companyId } })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// RefreshToken Model
// ---------------------------------------------------------------------------

describe('RefreshToken model', () => {
  it('creates a refresh token linked to a user', async () => {
    const companyId = await createCompany('RefreshToken CRUD test');
    const userId = await createUser(companyId);
    const tokenHash = randomUUID(); // fake hash for testing

    const token = await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    refreshTokenIds.push(token.id);

    expect(token.userId).toBe(userId);
    expect(token.tokenHash).toBe(tokenHash);
    expect(token.revokedAt).toBeNull();
  });

  it('enforces unique tokenHash constraint', async () => {
    const companyId = await createCompany('Token unique test');
    const userId = await createUser(companyId);
    const tokenHash = `unique-hash-${Date.now()}`;

    const token1 = await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    refreshTokenIds.push(token1.id);

    // Duplicate tokenHash should fail
    await expect(
      prisma.refreshToken.create({
        data: {
          userId,
          tokenHash, // same hash
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ).rejects.toThrow();
  });

  it('onDelete Cascade: deleting user cascades to refresh tokens', async () => {
    const companyId = await createCompany('Cascade delete test');
    const userId = await createUser(companyId);

    const token = await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: `cascade-test-${Date.now()}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    // Don't track in refreshTokenIds — cascade should handle it

    // Delete the user — tokens should be cascade-deleted
    await prisma.user.delete({ where: { id: userId } });
    // Remove from userIds since we already deleted
    userIds = userIds.filter((id) => id !== userId);

    const found = await prisma.refreshToken.findUnique({ where: { id: token.id } });
    expect(found).toBeNull();
  });

  it('supports revoking a token by setting revokedAt', async () => {
    const companyId = await createCompany('Revoke token test');
    const userId = await createUser(companyId);

    const token = await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: `revoke-test-${Date.now()}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    refreshTokenIds.push(token.id);

    const revoked = await prisma.refreshToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });

    expect(revoked.revokedAt).not.toBeNull();
  });
});
