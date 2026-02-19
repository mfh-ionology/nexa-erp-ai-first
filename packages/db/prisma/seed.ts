import {
  PrismaClient,
  UserRole,
  VatType,
  type ResourceType,
  type FieldVisibility,
} from '../generated/prisma/client';
import { loadDefaultData } from '../src/utils/default-data-loader.js';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';

// Seed uses DIRECT_URL (bypasses PgBouncer) for reliable transactional seeding.
// Runtime client (src/client.ts) uses DATABASE_URL via PgBouncer instead.
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Neither DIRECT_URL nor DATABASE_URL is set — cannot seed');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Seed Data
// ---------------------------------------------------------------------------

// Well-known deterministic UUID for the default company (used as upsert key)
const DEFAULT_COMPANY_ID = '00000000-0000-4000-a000-000000000001';

// Well-known deterministic UUID for the default admin user (used as upsert key)
const DEFAULT_USER_ID = '00000000-0000-4000-a000-000000000002';

const currencies = [
  { code: 'GBP', name: 'British Pound Sterling', symbol: '£', minorUnit: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', minorUnit: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', minorUnit: 2 },
];

const countries = [
  {
    code: 'GB',
    iso3Code: 'GBR',
    name: 'United Kingdom',
    defaultCurrencyCode: 'GBP',
    region: 'UK',
    vatPrefix: 'GB',
  },
];

const vatCodes = [
  { code: 'S', name: 'Standard Rate', rate: 20, type: VatType.STANDARD, isDefault: true },
  { code: 'R', name: 'Reduced Rate', rate: 5, type: VatType.REDUCED, isDefault: false },
  { code: 'Z', name: 'Zero Rate', rate: 0, type: VatType.ZERO, isDefault: false },
  { code: 'E', name: 'Exempt', rate: 0, type: VatType.EXEMPT, isDefault: false },
  { code: 'RC', name: 'Reverse Charge', rate: 0, type: VatType.REVERSE_CHARGE, isDefault: false },
];

const paymentTerms = [
  { code: 'NET30', name: 'Net 30', dueDays: 30, isDefault: true },
  { code: 'NET60', name: 'Net 60', dueDays: 60, isDefault: false },
  { code: 'DOR', name: 'Due on Receipt', dueDays: 0, isDefault: false },
  { code: 'NET14', name: 'Net 14', dueDays: 14, isDefault: false },
];

const numberSeries = [
  { entityType: 'INVOICE', prefix: 'INV-', padding: 5 },
  { entityType: 'CREDIT_NOTE', prefix: 'CN-', padding: 5 },
  { entityType: 'SALES_ORDER', prefix: 'SO-', padding: 5 },
  { entityType: 'SALES_QUOTE', prefix: 'QT-', padding: 5 },
  { entityType: 'PURCHASE_ORDER', prefix: 'PO-', padding: 5 },
  { entityType: 'BILL', prefix: 'BIL-', padding: 5 },
  { entityType: 'JOURNAL', prefix: 'JE-', padding: 5 },
  { entityType: 'PAYMENT', prefix: 'PAY-', padding: 5 },
  { entityType: 'SHIPMENT', prefix: 'SHP-', padding: 5 },
  { entityType: 'GOODS_RECEIPT', prefix: 'GRN-', padding: 5 },
  { entityType: 'EMPLOYEE', prefix: 'EMP-', padding: 4 },
  { entityType: 'CUSTOMER', prefix: 'CUS-', padding: 5 },
  { entityType: 'SUPPLIER', prefix: 'SUP-', padding: 5 },
];

// ---------------------------------------------------------------------------
// Seed Functions (idempotent upsert pattern)
// ---------------------------------------------------------------------------

async function seedCurrencies() {
  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: { name: c.name, symbol: c.symbol, minorUnit: c.minorUnit },
      create: c,
    });
  }
  console.log(`Seeded ${currencies.length} currencies`);
}

async function seedCountries() {
  for (const c of countries) {
    await prisma.country.upsert({
      where: { code: c.code },
      update: {
        iso3Code: c.iso3Code,
        name: c.name,
        defaultCurrencyCode: c.defaultCurrencyCode,
        region: c.region,
        vatPrefix: c.vatPrefix,
      },
      create: c,
    });
  }
  console.log(`Seeded ${countries.length} countries`);
}

async function seedDefaultCompany() {
  await prisma.companyProfile.upsert({
    where: { id: DEFAULT_COMPANY_ID },
    update: {
      name: 'Default Company',
      baseCurrencyCode: 'GBP',
      countryCode: 'GB',
      isDefault: true,
      updatedBy: 'system-seed',
    },
    create: {
      id: DEFAULT_COMPANY_ID,
      name: 'Default Company',
      baseCurrencyCode: 'GBP',
      countryCode: 'GB',
      isDefault: true,
      createdBy: 'system-seed',
      updatedBy: 'system-seed',
    },
  });
  console.log('Seeded default company');
}

async function seedVatCodes() {
  for (const v of vatCodes) {
    await prisma.vatCode.upsert({
      where: {
        companyId_code: { companyId: DEFAULT_COMPANY_ID, code: v.code },
      },
      update: { name: v.name, rate: v.rate, type: v.type, isDefault: v.isDefault },
      create: {
        companyId: DEFAULT_COMPANY_ID,
        code: v.code,
        name: v.name,
        rate: v.rate,
        type: v.type,
        isDefault: v.isDefault,
      },
    });
  }
  console.log(`Seeded ${vatCodes.length} VAT codes`);
}

async function seedPaymentTerms() {
  for (const pt of paymentTerms) {
    await prisma.paymentTerms.upsert({
      where: {
        companyId_code: { companyId: DEFAULT_COMPANY_ID, code: pt.code },
      },
      update: { name: pt.name, dueDays: pt.dueDays, isDefault: pt.isDefault },
      create: {
        companyId: DEFAULT_COMPANY_ID,
        code: pt.code,
        name: pt.name,
        dueDays: pt.dueDays,
        isDefault: pt.isDefault,
      },
    });
  }
  console.log(`Seeded ${paymentTerms.length} payment terms`);
}

async function seedNumberSeries() {
  for (const ns of numberSeries) {
    await prisma.numberSeries.upsert({
      where: {
        companyId_entityType: {
          companyId: DEFAULT_COMPANY_ID,
          entityType: ns.entityType,
        },
      },
      update: { prefix: ns.prefix, padding: ns.padding },
      create: {
        companyId: DEFAULT_COMPANY_ID,
        entityType: ns.entityType,
        prefix: ns.prefix,
        padding: ns.padding,
      },
    });
  }
  console.log(`Seeded ${numberSeries.length} number series`);
}

async function seedDefaultUser() {
  // DEV ONLY — seed password is not a secret.
  // Uses argon2id (matching the API auth layer) so login works against seeded data.
  const passwordHash = await argon2.hash('NexaDev2026', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  await prisma.user.upsert({
    where: { id: DEFAULT_USER_ID },
    update: {
      email: 'admin@nexa-erp.dev',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      isActive: true,
      companyId: DEFAULT_COMPANY_ID,
      updatedBy: 'system-seed',
    },
    create: {
      id: DEFAULT_USER_ID,
      email: 'admin@nexa-erp.dev',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      companyId: DEFAULT_COMPANY_ID,
      isActive: true,
      enabledModules: [],
      createdBy: 'system-seed',
      updatedBy: 'system-seed',
    },
  });

  // Global SUPER_ADMIN role (companyId = null)
  // Cannot use upsert on the compound unique [userId, companyId] when companyId is null
  // (PostgreSQL treats NULLs as distinct in unique constraints). Use findFirst + create/update instead.
  const existingGlobalRole = await prisma.userCompanyRole.findFirst({
    where: { userId: DEFAULT_USER_ID, companyId: null },
  });
  if (existingGlobalRole) {
    await prisma.userCompanyRole.update({
      where: { id: existingGlobalRole.id },
      data: { role: UserRole.SUPER_ADMIN },
    });
  } else {
    await prisma.userCompanyRole.create({
      data: {
        userId: DEFAULT_USER_ID,
        companyId: null,
        role: UserRole.SUPER_ADMIN,
      },
    });
  }

  console.log('Seeded default admin user + global SUPER_ADMIN role');
}

async function seedResources() {
  const defaults = loadDefaultData();
  // Seed resources without parentCode first (to satisfy FK constraints), then update parentCodes
  for (const r of defaults.resources) {
    await prisma.resource.upsert({
      where: { code: r.code },
      update: {
        name: r.name,
        module: r.module,
        type: r.type as ResourceType,
        sortOrder: r.sortOrder,
        icon: r.icon ?? null,
        description: r.description ?? null,
      },
      create: {
        code: r.code,
        name: r.name,
        module: r.module,
        type: r.type as ResourceType,
        parentCode: null, // Set later to avoid FK ordering issues
        sortOrder: r.sortOrder,
        icon: r.icon ?? null,
        description: r.description ?? null,
      },
    });
  }
  // Now set parentCode references
  for (const r of defaults.resources) {
    if (r.parentCode) {
      await prisma.resource.update({
        where: { code: r.code },
        data: { parentCode: r.parentCode },
      });
    }
  }
  console.log(`Seeded ${defaults.resources.length} resources`);
}

async function seedAccessGroups() {
  const defaults = loadDefaultData();
  for (const group of defaults.accessGroups) {
    const ag = await prisma.accessGroup.upsert({
      where: { companyId_code: { companyId: DEFAULT_COMPANY_ID, code: group.code } },
      update: {
        name: group.name,
        description: group.description,
        isSystem: group.isSystem,
        updatedBy: 'system-seed',
      },
      create: {
        companyId: DEFAULT_COMPANY_ID,
        code: group.code,
        name: group.name,
        description: group.description,
        isSystem: group.isSystem,
        createdBy: 'system-seed',
        updatedBy: 'system-seed',
      },
    });

    for (const perm of group.permissions) {
      await prisma.accessGroupPermission.upsert({
        where: {
          accessGroupId_resourceCode: {
            accessGroupId: ag.id,
            resourceCode: perm.resourceCode,
          },
        },
        update: {
          canAccess: perm.canAccess,
          canNew: perm.canNew,
          canView: perm.canView,
          canEdit: perm.canEdit,
          canDelete: perm.canDelete,
        },
        create: {
          accessGroupId: ag.id,
          resourceCode: perm.resourceCode,
          canAccess: perm.canAccess,
          canNew: perm.canNew,
          canView: perm.canView,
          canEdit: perm.canEdit,
          canDelete: perm.canDelete,
        },
      });
    }

    for (const fo of group.fieldOverrides) {
      await prisma.accessGroupFieldOverride.upsert({
        where: {
          accessGroupId_resourceCode_fieldPath: {
            accessGroupId: ag.id,
            resourceCode: fo.resourceCode,
            fieldPath: fo.fieldPath,
          },
        },
        update: { visibility: fo.visibility as FieldVisibility },
        create: {
          accessGroupId: ag.id,
          resourceCode: fo.resourceCode,
          fieldPath: fo.fieldPath,
          visibility: fo.visibility as FieldVisibility,
        },
      });
    }
  }
  console.log(`Seeded ${defaults.accessGroups.length} access groups with permissions`);
}

async function assignDefaultUserAccessGroups() {
  const fullAccessGroup = await prisma.accessGroup.findUnique({
    where: { companyId_code: { companyId: DEFAULT_COMPANY_ID, code: 'FULL_ACCESS' } },
  });
  if (fullAccessGroup) {
    const existing = await prisma.userAccessGroup.findFirst({
      where: {
        userId: DEFAULT_USER_ID,
        accessGroupId: fullAccessGroup.id,
        companyId: DEFAULT_COMPANY_ID,
      },
    });
    if (!existing) {
      await prisma.userAccessGroup.create({
        data: {
          userId: DEFAULT_USER_ID,
          accessGroupId: fullAccessGroup.id,
          companyId: DEFAULT_COMPANY_ID,
          assignedBy: 'system-seed',
        },
      });
    }
  }
  console.log('Assigned FULL_ACCESS group to default admin user');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding database...');
  await seedCurrencies();
  await seedCountries();
  await seedDefaultCompany();
  await seedNumberSeries();
  await seedVatCodes();
  await seedPaymentTerms();
  await seedDefaultUser();
  await seedResources();
  await seedAccessGroups();
  await assignDefaultUserAccessGroups();
  console.log('Seeding complete.');
}

main()
  .catch((e: unknown) => {
    console.error('Seed failed:', e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
