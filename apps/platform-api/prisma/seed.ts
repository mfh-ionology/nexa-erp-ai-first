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

// Well-known TOTP secret for dev seed user — BR-PLT-018 requires MFA for PLATFORM_ADMIN.
// Base32 of "Hello!" — standard test secret. E2E tests generate codes from this.
const DEV_MFA_SECRET = 'JBSWY3DPEHPK3PXP';

async function seedPlatformAdmin() {
  await prisma.platformUser.upsert({
    where: { email: 'admin@nexa-platform.local' },
    update: {
      displayName: 'Platform Admin',
      role: PlatformRole.PLATFORM_ADMIN,
      isActive: true,
      mfaEnabled: true,
      mfaSecret: DEV_MFA_SECRET,
    },
    create: {
      id: PLATFORM_ADMIN_ID,
      email: 'admin@nexa-platform.local',
      passwordHash: DEV_ADMIN_PASSWORD_HASH,
      displayName: 'Platform Admin',
      role: PlatformRole.PLATFORM_ADMIN,
      isActive: true,
      mfaEnabled: true,
      mfaSecret: DEV_MFA_SECRET,
    },
  });
  console.log('Seeded platform admin (admin@nexa-platform.local, MFA enabled)');
}

async function seedDefaultFeatureFlags() {
  const activeTenants = await prisma.tenant.findMany({
    where: { status: TenantStatus.ACTIVE },
    select: { id: true, code: true },
  });

  for (const tenant of activeTenants) {
    await prisma.tenantFeatureFlag.upsert({
      where: {
        tenantId_featureKey: {
          tenantId: tenant.id,
          featureKey: 'share_anonymised_ai_patterns',
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        featureKey: 'share_anonymised_ai_patterns',
        enabled: true,
        changedBy: 'system',
      },
    });
  }
  console.log(
    `Seeded share_anonymised_ai_patterns feature flag for ${activeTenants.length} active tenant(s)`,
  );
}

// ---------------------------------------------------------------------------
// E5d-4 Task 8.3: Example platform knowledge articles (seeded as DRAFT)
// ---------------------------------------------------------------------------

const KNOWLEDGE_ARTICLE_IDS = {
  bestPractice: '00000000-0000-4000-b000-000000000030',
  defaultConfig: '00000000-0000-4000-b000-000000000031',
  skillUpdate: '00000000-0000-4000-b000-000000000032',
};

const EXAMPLE_KNOWLEDGE_ARTICLES = [
  {
    id: KNOWLEDGE_ARTICLE_IDS.bestPractice,
    title: 'Construction Industry: Invoice Approval Best Practices',
    content: `## Best Practice: Multi-Stage Invoice Approval for Construction

Construction companies benefit from a structured invoice approval workflow:

1. **Site Manager Review** — Verify quantities and rates match the subcontractor agreement
2. **Quantity Surveyor Sign-off** — Cross-reference with valuations and retention schedules
3. **Finance Approval** — Check against budget allocations and CIS deductions
4. **Director Authorisation** — Final approval for invoices above the defined threshold

### Key Recommendations
- Set approval thresholds per project value (e.g. <£5k auto-approve if QS signed off)
- Require photo evidence for material deliveries before goods-received matching
- Integrate CIS deduction calculations into the AP workflow to avoid manual errors
- Use retention tracking to automatically hold the agreed percentage until practical completion`,
    category: 'BEST_PRACTICE',
    targetIndustries: ['construction'],
    targetPlanTiers: [] as string[],
  },
  {
    id: KNOWLEDGE_ARTICLE_IDS.defaultConfig,
    title: 'Recommended Default Chart of Accounts — UK SME',
    content: `## Default Chart of Accounts Setup

Recommended nominal code structure for UK SMEs following FRS 102 Section 1A:

### Sales (4000-4999)
- 4000 Sales — Goods
- 4100 Sales — Services
- 4200 Sales — Other Income

### Cost of Sales (5000-5999)
- 5000 Purchases — Materials
- 5100 Purchases — Subcontractors
- 5200 Direct Labour Costs

### Overheads (6000-7999)
- 6000 Staff Costs
- 6100 Premises Costs
- 6200 Administrative Expenses
- 6300 Motor & Travel Expenses

### Balance Sheet (0000-3999, 8000-9999)
- 1100 Trade Debtors
- 2100 Trade Creditors
- 3000 Share Capital
- 3200 Retained Earnings

This structure aligns with Making Tax Digital requirements and standard UK accounting software exports.`,
    category: 'DEFAULT_CONFIG',
    targetIndustries: [] as string[],
    targetPlanTiers: [] as string[],
  },
  {
    id: KNOWLEDGE_ARTICLE_IDS.skillUpdate,
    title: 'Skill Update: invoice_categorisation — improved guidance',
    content: `## Skill Update: invoice_categorisation

### Problem
The invoice_categorisation skill has shown a below-average success rate when handling invoices with ambiguous line items (e.g. "Professional Services" that could map to multiple nominal codes).

### Improved Guidance
1. **Context priority** — Always check the supplier's previous invoice history before categorising. If 80%+ of their invoices map to the same nominal, use that as the default.
2. **Multi-line handling** — When an invoice has mixed line items, categorise each line independently rather than applying one category to the whole invoice.
3. **Confidence thresholds** — Set confidence below 0.7 when the description is generic (fewer than 3 words). This triggers human review rather than auto-posting.
4. **Industry context** — Construction invoices with "labour" should check CIS status. Retail invoices with "stock" should use the purchase-for-resale nominal, not consumables.

### Expected Improvement
These corrections address the top 3 failure modes identified across tenants. Expected success rate improvement: 45% → 70%+.`,
    category: 'SKILL_UPDATE',
    targetIndustries: [] as string[],
    targetPlanTiers: [] as string[],
  },
];

async function seedExampleKnowledgeArticles() {
  for (const article of EXAMPLE_KNOWLEDGE_ARTICLES) {
    await prisma.platformKnowledgeArticle.upsert({
      where: { id: article.id },
      update: {
        title: article.title,
        content: article.content,
        category: article.category,
        targetIndustries: article.targetIndustries,
        targetPlanTiers: article.targetPlanTiers,
      },
      create: {
        ...article,
        status: 'DRAFT',
        version: 1,
        createdById: PLATFORM_ADMIN_ID,
      },
    });
  }
  console.log(
    `Seeded ${EXAMPLE_KNOWLEDGE_ARTICLES.length} example platform knowledge articles (DRAFT)`,
  );
}

async function verifyIntelligenceTables() {
  const tables = [
    { name: 'TenantAiPattern', fn: () => prisma.tenantAiPattern.count() },
    { name: 'TenantAiCorrection', fn: () => prisma.tenantAiCorrection.count() },
    { name: 'PlatformKnowledgeArticle', fn: () => prisma.platformKnowledgeArticle.count() },
    { name: 'AiSkillEffectiveness', fn: () => prisma.aiSkillEffectiveness.count() },
    { name: 'PlatformAiInsight', fn: () => prisma.platformAiInsight.count() },
  ] as const;

  for (const table of tables) {
    const count = await table.fn();
    console.log(`  ✓ ${table.name} — queryable (${count} rows)`);
  }
  console.log('All 5 cross-tenant intelligence tables verified.');
}

// ---------------------------------------------------------------------------
// E13b-4 Task 8.5: Default vendor provider credentials
// ---------------------------------------------------------------------------

const DEFAULT_VENDOR_PROVIDERS = [
  {
    providerId: 'anthropic',
    displayName: 'Anthropic (Claude)',
  },
  {
    providerId: 'openai',
    displayName: 'OpenAI (GPT)',
  },
  {
    providerId: 'google',
    displayName: 'Google (Gemini)',
  },
];

// Empty string means no key configured — in production, real keys are set via
// the admin UI which encrypts them using AES-256-GCM with AI_KEY_ENCRYPTION_SECRET.
const PLACEHOLDER_ENCRYPTED_KEY = '';

async function seedVendorProviders() {
  for (const provider of DEFAULT_VENDOR_PROVIDERS) {
    await prisma.vendorProviderCredential.upsert({
      where: { providerId: provider.providerId },
      update: {
        displayName: provider.displayName,
      },
      create: {
        providerId: provider.providerId,
        displayName: provider.displayName,
        encryptedKey: PLACEHOLDER_ENCRYPTED_KEY,
        isActive: false, // inactive until a real key is configured
      },
    });
  }
  console.log(
    `Seeded ${DEFAULT_VENDOR_PROVIDERS.length} default vendor providers (inactive — configure keys via admin UI)`,
  );
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
  await seedDefaultFeatureFlags();
  await seedExampleKnowledgeArticles();
  await seedVendorProviders();
  await verifyIntelligenceTables();
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
