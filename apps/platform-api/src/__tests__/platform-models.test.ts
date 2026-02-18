import {
  PrismaClient,
  TenantStatus,
  BillingStatus,
  PlatformRole,
} from '../../generated/platform-prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'crypto';

let prisma: PrismaClient;

// Track created entity IDs for cleanup (delete in FK-safe order)
let auditLogIds: string[] = [];
let impersonationIds: string[] = [];
let aiUsageIds: string[] = [];
let aiQuotaIds: string[] = [];
let billingIds: string[] = [];
let featureFlagIds: string[] = [];
let moduleOverrideIds: string[] = [];
let tenantIds: string[] = [];
let planIds: string[] = [];
let platformUserIds: string[] = [];

beforeAll(async () => {
  const connectionString = process.env.PLATFORM_DATABASE_URL;
  if (!connectionString) {
    throw new Error('PLATFORM_DATABASE_URL must be set for tests');
  }
  const adapter = new PrismaPg({ connectionString });
  prisma = new PrismaClient({ adapter });
});

async function cleanup() {
  // Delete in FK-safe order (children before parents)
  if (auditLogIds.length > 0) {
    await prisma.platformAuditLog.deleteMany({ where: { id: { in: auditLogIds } } });
    auditLogIds = [];
  }
  if (impersonationIds.length > 0) {
    await prisma.impersonationSession.deleteMany({ where: { id: { in: impersonationIds } } });
    impersonationIds = [];
  }
  if (aiUsageIds.length > 0) {
    await prisma.tenantAiUsage.deleteMany({ where: { id: { in: aiUsageIds } } });
    aiUsageIds = [];
  }
  if (aiQuotaIds.length > 0) {
    await prisma.tenantAiQuota.deleteMany({ where: { id: { in: aiQuotaIds } } });
    aiQuotaIds = [];
  }
  if (billingIds.length > 0) {
    await prisma.tenantBilling.deleteMany({ where: { id: { in: billingIds } } });
    billingIds = [];
  }
  if (featureFlagIds.length > 0) {
    await prisma.tenantFeatureFlag.deleteMany({ where: { id: { in: featureFlagIds } } });
    featureFlagIds = [];
  }
  if (moduleOverrideIds.length > 0) {
    await prisma.tenantModuleOverride.deleteMany({ where: { id: { in: moduleOverrideIds } } });
    moduleOverrideIds = [];
  }
  if (tenantIds.length > 0) {
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    tenantIds = [];
  }
  if (planIds.length > 0) {
    await prisma.plan.deleteMany({ where: { id: { in: planIds } } });
    planIds = [];
  }
  if (platformUserIds.length > 0) {
    await prisma.platformUser.deleteMany({ where: { id: { in: platformUserIds } } });
    platformUserIds = [];
  }
}

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createPlan(code?: string): Promise<string> {
  const plan = await prisma.plan.create({
    data: {
      code: code ?? `tp-${Math.random().toString(36).slice(2, 10)}`,
      displayName: 'Test Plan',
      maxUsers: 10,
      maxCompanies: 2,
      monthlyAiTokenAllowance: BigInt(100_000),
      aiHardLimit: true,
      enabledModules: ['finance', 'ar', 'ap'],
      apiRateLimit: 500,
    },
  });
  planIds.push(plan.id);
  return plan.id;
}

async function createTenant(planId: string, code?: string): Promise<string> {
  const tenant = await prisma.tenant.create({
    data: {
      code: code ?? `tt-${Math.random().toString(36).slice(2, 10)}`,
      displayName: 'Test Tenant',
      status: TenantStatus.ACTIVE,
      planId,
      billingStatus: BillingStatus.CURRENT,
      region: 'uk-south',
      dbHost: 'localhost',
      dbName: 'test_db',
      dbPort: 5432,
    },
  });
  tenantIds.push(tenant.id);
  return tenant.id;
}

async function createPlatformUser(email?: string): Promise<string> {
  const user = await prisma.platformUser.create({
    data: {
      email: email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.dev`,
      // Pre-computed Argon2id hash of "test-password" (matches architecture AC #4)
      passwordHash:
        '$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHQxMjM0NTY$YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo',
      displayName: 'Test Admin',
      role: PlatformRole.PLATFORM_ADMIN,
    },
  });
  platformUserIds.push(user.id);
  return user.id;
}

// ---------------------------------------------------------------------------
// 14.2 — PlatformPrismaClient connectivity
// ---------------------------------------------------------------------------

describe('PlatformPrismaClient connectivity', () => {
  it('can connect and execute a basic query', async () => {
    // Simple raw query to verify connectivity
    const result = await prisma.$queryRawUnsafe<{ now: Date }[]>('SELECT NOW() as now');
    expect(result).toHaveLength(1);
    expect(result[0]!.now).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// 14.3 — Tenant with Plan FK and relations
// ---------------------------------------------------------------------------

describe('Tenant model with Plan relation', () => {
  it('creates a Tenant with Plan FK and loads relations correctly', async () => {
    const planId = await createPlan();
    const tenantId = await createTenant(planId);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: true,
        moduleOverrides: true,
        featureFlags: true,
        aiQuota: true,
        aiUsageRecords: true,
        billing: true,
        impersonations: true,
      },
    });

    expect(tenant).not.toBeNull();
    expect(tenant!.planId).toBe(planId);
    expect(tenant!.plan.id).toBe(planId);
    expect(tenant!.status).toBe(TenantStatus.ACTIVE);
    expect(tenant!.billingStatus).toBe(BillingStatus.CURRENT);
    expect(tenant!.region).toBe('uk-south');
    expect(tenant!.sandboxEnabled).toBe(false);
    expect(tenant!.lastActivityAt).toBeNull();

    // Empty relations
    expect(tenant!.moduleOverrides).toEqual([]);
    expect(tenant!.featureFlags).toEqual([]);
    expect(tenant!.aiQuota).toBeNull();
    expect(tenant!.aiUsageRecords).toEqual([]);
    expect(tenant!.billing).toBeNull();
    expect(tenant!.impersonations).toEqual([]);
  });

  it('loads Plan with tenants relation', async () => {
    const planId = await createPlan();
    await createTenant(planId);

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: { tenants: true },
    });

    expect(plan).not.toBeNull();
    expect(plan!.tenants).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 14.4 — PlatformAuditLog append-only (no updatedAt)
// ---------------------------------------------------------------------------

describe('PlatformAuditLog append-only enforcement', () => {
  it('has no updatedAt field — only createdAt and timestamp', async () => {
    const userId = await createPlatformUser();

    const log = await prisma.platformAuditLog.create({
      data: {
        platformUserId: userId,
        action: 'test.action',
        targetType: 'tenant',
        targetId: randomUUID(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      },
    });
    auditLogIds.push(log.id);

    // Verify the returned record has createdAt and timestamp but NOT updatedAt
    const keys = Object.keys(log);
    expect(keys).toContain('createdAt');
    expect(keys).toContain('timestamp');
    expect(keys).not.toContain('updatedAt');
  });

  it('creates audit log entries with correct fields', async () => {
    const userId = await createPlatformUser();
    const details = { reason: 'test', extra: 42 };

    const log = await prisma.platformAuditLog.create({
      data: {
        platformUserId: userId,
        action: 'tenant.suspend',
        targetType: 'tenant',
        targetId: 'some-tenant-id',
        details,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      },
    });
    auditLogIds.push(log.id);

    expect(log.action).toBe('tenant.suspend');
    expect(log.targetType).toBe('tenant');
    expect(log.details).toEqual(details);
    expect(log.ipAddress).toBe('192.168.1.1');
    expect(log.userAgent).toBe('Mozilla/5.0');
    expect(log.timestamp).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// 14.5 — TenantStatus enum values match spec
// ---------------------------------------------------------------------------

describe('TenantStatus enum values', () => {
  it('contains exactly PROVISIONING, ACTIVE, SUSPENDED, READ_ONLY, ARCHIVED', () => {
    const expectedValues = ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'READ_ONLY', 'ARCHIVED'];
    const actualValues = Object.values(TenantStatus);

    expect(actualValues).toHaveLength(expectedValues.length);
    for (const v of expectedValues) {
      expect(actualValues).toContain(v);
    }
  });

  it('can create a tenant with each status value', async () => {
    const planId = await createPlan();

    for (const status of Object.values(TenantStatus)) {
      const tenant = await prisma.tenant.create({
        data: {
          code: `st-${status.toLowerCase().slice(0, 6)}-${Math.random().toString(36).slice(2, 8)}`,
          displayName: `Tenant ${status}`,
          status,
          planId,
          billingStatus: BillingStatus.CURRENT,
          region: 'uk-south',
          dbHost: 'localhost',
          dbName: 'test_db',
          dbPort: 5432,
        },
      });
      tenantIds.push(tenant.id);
      expect(tenant.status).toBe(status);
    }
  });
});

// ---------------------------------------------------------------------------
// 14.6 — Unique constraints
// ---------------------------------------------------------------------------

describe('Unique constraints', () => {
  it('rejects duplicate Plan.code', async () => {
    const uniqueCode = `up-${Math.random().toString(36).slice(2, 10)}`;
    await createPlan(uniqueCode);

    await expect(createPlan(uniqueCode)).rejects.toThrow();
  });

  it('rejects duplicate Tenant.code', async () => {
    const planId = await createPlan();
    const uniqueCode = `ut-${Math.random().toString(36).slice(2, 10)}`;
    await createTenant(planId, uniqueCode);

    await expect(createTenant(planId, uniqueCode)).rejects.toThrow();
  });

  it('rejects duplicate PlatformUser.email', async () => {
    const uniqueEmail = `ue-${Math.random().toString(36).slice(2, 10)}@test.dev`;
    await createPlatformUser(uniqueEmail);

    await expect(createPlatformUser(uniqueEmail)).rejects.toThrow();
  });

  it('rejects duplicate TenantAiUsage.requestId', async () => {
    const planId = await createPlan();
    const tenantId = await createTenant(planId);
    const requestId = `req-${randomUUID()}`;

    const usage1 = await prisma.tenantAiUsage.create({
      data: {
        tenantId,
        userId: 'user-1',
        featureKey: 'chat',
        model: 'claude-opus-4-6',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        costEstimate: 0.001,
        requestId,
      },
    });
    aiUsageIds.push(usage1.id);

    await expect(
      prisma.tenantAiUsage.create({
        data: {
          tenantId,
          userId: 'user-2',
          featureKey: 'chat',
          model: 'claude-opus-4-6',
          promptTokens: 200,
          completionTokens: 100,
          totalTokens: 300,
          costEstimate: 0.002,
          requestId, // duplicate
        },
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 14.7 — Seed data verification
// ---------------------------------------------------------------------------

describe('Seed data verification', () => {
  it('has 3 seeded plans (Core, Pro, Enterprise)', async () => {
    const plans = await prisma.plan.findMany({
      where: { code: { in: ['core', 'pro', 'enterprise'] } },
      orderBy: { code: 'asc' },
    });

    expect(plans).toHaveLength(3);

    const core = plans.find((p) => p.code === 'core')!;
    expect(core.displayName).toBe('Core');
    expect(core.maxUsers).toBe(5);
    expect(core.maxCompanies).toBe(1);
    expect(core.monthlyAiTokenAllowance).toBe(BigInt(100_000));
    expect(core.apiRateLimit).toBe(500);

    const pro = plans.find((p) => p.code === 'pro')!;
    expect(pro.displayName).toBe('Pro');
    expect(pro.maxUsers).toBe(25);
    expect(pro.maxCompanies).toBe(3);
    expect(pro.monthlyAiTokenAllowance).toBe(BigInt(500_000));
    expect(pro.apiRateLimit).toBe(1000);

    const enterprise = plans.find((p) => p.code === 'enterprise')!;
    expect(enterprise.displayName).toBe('Enterprise');
    expect(enterprise.maxUsers).toBe(100);
    expect(enterprise.maxCompanies).toBe(10);
    expect(enterprise.monthlyAiTokenAllowance).toBe(BigInt(2_000_000));
    expect(enterprise.apiRateLimit).toBe(5000);
  });

  it('has 1 seeded tenant (dev-tenant, ACTIVE, Pro plan)', async () => {
    const tenant = await prisma.tenant.findUnique({
      where: { code: 'dev-tenant' },
      include: { plan: true },
    });

    expect(tenant).not.toBeNull();
    expect(tenant!.displayName).toBe('Development Tenant');
    expect(tenant!.status).toBe(TenantStatus.ACTIVE);
    expect(tenant!.plan.code).toBe('pro');
    expect(tenant!.billingStatus).toBe(BillingStatus.CURRENT);
    expect(tenant!.region).toBe('uk-south');
  });

  it('has 1 seeded platform admin user', async () => {
    const admin = await prisma.platformUser.findUnique({
      where: { email: 'admin@nexa-platform.local' },
    });

    expect(admin).not.toBeNull();
    expect(admin!.displayName).toBe('Platform Admin');
    expect(admin!.role).toBe(PlatformRole.PLATFORM_ADMIN);
    expect(admin!.isActive).toBe(true);
    expect(admin!.mfaEnabled).toBe(false);
    expect(admin!.passwordHash).toBeTruthy();
  });
});
