import {
  PrismaClient,
  TenantStatus,
  BillingStatus,
  EnforcementAction,
  PlatformRole,
} from '../generated/platform-prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
// Seed uses PLATFORM_DATABASE_URL directly (no PgBouncer for platform DB).
const connectionString = process.env.PLATFORM_DATABASE_URL;
if (!connectionString) {
  throw new Error('PLATFORM_DATABASE_URL environment variable is not set');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Well-known deterministic UUIDs for seed data (used as upsert keys)
// ---------------------------------------------------------------------------
const PLAN_CORE_ID = '00000000-0000-4000-b000-000000000001';
const PLAN_PRO_ID = '00000000-0000-4000-b000-000000000002';
const PLAN_ENTERPRISE_ID = '00000000-0000-4000-b000-000000000003';
const DEV_TENANT_ID = '00000000-0000-4000-b000-000000000010';
const PLATFORM_ADMIN_ID = '00000000-0000-4000-b000-000000000020';

// ---------------------------------------------------------------------------
// Seed Data
// ---------------------------------------------------------------------------

const ALL_MVP_MODULES = [
  'finance',
  'ar',
  'ap',
  'sales',
  'purchasing',
  'inventory',
  'crm',
  'hr',
  'manufacturing',
  'reporting',
  'system',
];

const DEFAULT_PLANS = [
  {
    id: PLAN_CORE_ID,
    code: 'core',
    displayName: 'Core',
    maxUsers: 5,
    maxCompanies: 1,
    monthlyAiTokenAllowance: BigInt(100_000),
    aiHardLimit: true,
    enabledModules: ['finance', 'ar', 'ap', 'sales', 'purchasing', 'inventory'],
    apiRateLimit: 500,
  },
  {
    id: PLAN_PRO_ID,
    code: 'pro',
    displayName: 'Pro',
    maxUsers: 25,
    maxCompanies: 3,
    monthlyAiTokenAllowance: BigInt(500_000),
    aiHardLimit: true,
    enabledModules: ALL_MVP_MODULES,
    apiRateLimit: 1000,
  },
  {
    id: PLAN_ENTERPRISE_ID,
    code: 'enterprise',
    displayName: 'Enterprise',
    maxUsers: 100,
    maxCompanies: 10,
    monthlyAiTokenAllowance: BigInt(2_000_000),
    aiHardLimit: false,
    enabledModules: [...ALL_MVP_MODULES, 'pos', 'projects', 'contracts', 'warehouse', 'service'],
    apiRateLimit: 5000,
  },
];

// ---------------------------------------------------------------------------
// Seed Functions (idempotent upsert pattern)
// ---------------------------------------------------------------------------

async function seedPlans() {
  for (const plan of DEFAULT_PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        displayName: plan.displayName,
        maxUsers: plan.maxUsers,
        maxCompanies: plan.maxCompanies,
        monthlyAiTokenAllowance: plan.monthlyAiTokenAllowance,
        aiHardLimit: plan.aiHardLimit,
        enabledModules: plan.enabledModules,
        apiRateLimit: plan.apiRateLimit,
        isActive: true,
      },
      create: plan,
    });
  }
  console.log(`Seeded ${DEFAULT_PLANS.length} plans`);
}

async function seedDevTenant() {
  await prisma.tenant.upsert({
    where: { code: 'dev-tenant' },
    update: {
      displayName: 'Development Tenant',
      status: TenantStatus.ACTIVE,
      planId: PLAN_PRO_ID,
      billingStatus: BillingStatus.CURRENT,
      region: 'uk-south',
      dbHost: 'localhost',
      dbName: 'nexa_dev',
      dbPort: 5432,
    },
    create: {
      id: DEV_TENANT_ID,
      code: 'dev-tenant',
      displayName: 'Development Tenant',
      status: TenantStatus.ACTIVE,
      planId: PLAN_PRO_ID,
      billingStatus: BillingStatus.CURRENT,
      region: 'uk-south',
      dbHost: 'localhost',
      dbName: 'nexa_dev',
      dbPort: 5432,
    },
  });
  console.log('Seeded dev-tenant (ACTIVE, Pro plan)');
}

async function seedDevTenantBilling() {
  // Look up the tenant to get its current ID (handles both fresh create and re-run)
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { code: 'dev-tenant' },
  });

  await prisma.tenantBilling.upsert({
    where: { tenantId: tenant.id },
    update: {
      enforcementAction: EnforcementAction.NONE,
      dunningLevel: 0,
      gracePeriodDays: 14,
    },
    create: {
      tenantId: tenant.id,
      enforcementAction: EnforcementAction.NONE,
      dunningLevel: 0,
      gracePeriodDays: 14,
    },
  });
  console.log('Seeded TenantBilling for dev-tenant');
}

async function seedDevTenantAiQuota() {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { code: 'dev-tenant' },
  });

  // Period: current calendar month
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of month

  await prisma.tenantAiQuota.upsert({
    where: { tenantId: tenant.id },
    update: {
      periodStart,
      periodEnd,
      tokensUsed: BigInt(0),
      tokenAllowance: BigInt(500_000), // Pro plan allowance
    },
    create: {
      tenantId: tenant.id,
      periodStart,
      periodEnd,
      tokensUsed: BigInt(0),
      tokenAllowance: BigInt(500_000),
    },
  });
  console.log('Seeded TenantAiQuota for dev-tenant');
}

// Pre-computed Argon2id hash of "platform-admin-dev" with fixed salt for deterministic seeds.
// Generated via: argon2.hash("platform-admin-dev", { type: argon2.argon2id, salt: Buffer.from("nexa-platform-dev-salt-v1") })
const DEV_ADMIN_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$bmV4YS1wbGF0Zm9ybS1kZXYtc2FsdC12MQ$y2iFxa7ZBxlAoIFsZFphBCCzqsiameuNwap5hc4i65I';

async function seedPlatformAdmin() {
  await prisma.platformUser.upsert({
    where: { email: 'admin@nexa-platform.local' },
    update: {
      displayName: 'Platform Admin',
      role: PlatformRole.PLATFORM_ADMIN,
      isActive: true,
      mfaEnabled: false,
    },
    create: {
      id: PLATFORM_ADMIN_ID,
      email: 'admin@nexa-platform.local',
      passwordHash: DEV_ADMIN_PASSWORD_HASH,
      displayName: 'Platform Admin',
      role: PlatformRole.PLATFORM_ADMIN,
      isActive: true,
      mfaEnabled: false,
      createdBy: 'SYSTEM',
      updatedBy: 'SYSTEM',
    },
  });
  console.log('Seeded platform admin (admin@nexa-platform.local)');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding platform database...');
  await seedPlans();
  await seedDevTenant();
  await seedDevTenantBilling();
  await seedDevTenantAiQuota();
  await seedPlatformAdmin();
  console.log('Platform seeding complete.');
}

main()
  .catch((e: unknown) => {
    console.error('Platform seed failed:', e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
