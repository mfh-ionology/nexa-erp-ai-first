/* eslint-disable no-console -- seed scripts use console for progress logging */
// ---------------------------------------------------------------------------
// E14-S2 — Finance Module Seed Data
//
// Seeds:
//   1. 11 Account Classifications (FRS 102)
//   2. ~65 Chart of Account records (FRS 102 hierarchy)
//   3. 27 Account Mapping records
//   4. NumberSeries JOURNAL (JE-00001) + SIMULATION (SIM-00001)
//   5. 3 DimensionType records (DEPT, CC, PROJ)
//   6. 3 Budget Keys (Even Split, Seasonal, Q1 Heavy)
//
// All upserts are idempotent — safe to re-run.
// ---------------------------------------------------------------------------

import type { PrismaClient } from '../../generated/prisma/client';

// Well-known company ID from main seed
const DEFAULT_COMPANY_ID = '00000000-0000-4000-a000-000000000001';
const DEFAULT_USER_ID = '00000000-0000-4000-a000-000000000002';

// ---------------------------------------------------------------------------
// 11 FRS 102 Account Classifications
// ---------------------------------------------------------------------------

const CLASSIFICATIONS = [
  {
    code: 'FA',
    name: 'Fixed Assets',
    accountType: 'ASSET' as const,
    sortOrder: 1,
    reportSection: 'BALANCE_SHEET',
  },
  {
    code: 'CA',
    name: 'Current Assets',
    accountType: 'ASSET' as const,
    sortOrder: 2,
    reportSection: 'BALANCE_SHEET',
  },
  {
    code: 'CL',
    name: 'Current Liabilities',
    accountType: 'LIABILITY' as const,
    sortOrder: 3,
    reportSection: 'BALANCE_SHEET',
  },
  {
    code: 'LTL',
    name: 'Long-Term Liabilities',
    accountType: 'LIABILITY' as const,
    sortOrder: 4,
    reportSection: 'BALANCE_SHEET',
  },
  {
    code: 'EQ',
    name: 'Equity',
    accountType: 'EQUITY' as const,
    sortOrder: 5,
    reportSection: 'BALANCE_SHEET',
  },
  {
    code: 'REV',
    name: 'Revenue',
    accountType: 'REVENUE' as const,
    sortOrder: 6,
    reportSection: 'PROFIT_AND_LOSS',
  },
  {
    code: 'COGS',
    name: 'Cost of Goods Sold',
    accountType: 'EXPENSE' as const,
    sortOrder: 7,
    reportSection: 'PROFIT_AND_LOSS',
  },
  {
    code: 'OPEX',
    name: 'Operating Expenses',
    accountType: 'EXPENSE' as const,
    sortOrder: 8,
    reportSection: 'PROFIT_AND_LOSS',
  },
  {
    code: 'OI',
    name: 'Other Income',
    accountType: 'REVENUE' as const,
    sortOrder: 9,
    reportSection: 'PROFIT_AND_LOSS',
  },
  {
    code: 'FIN',
    name: 'Finance Costs',
    accountType: 'EXPENSE' as const,
    sortOrder: 10,
    reportSection: 'PROFIT_AND_LOSS',
  },
  {
    code: 'TAX',
    name: 'Taxation',
    accountType: 'EXPENSE' as const,
    sortOrder: 11,
    reportSection: 'PROFIT_AND_LOSS',
  },
];

// ---------------------------------------------------------------------------
// FRS 102 Chart of Accounts (~65 accounts)
// ---------------------------------------------------------------------------

const ACCOUNTS: Array<{
  code: string;
  name: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  normalBalance: 'DEBIT' | 'CREDIT';
  classification: string;
  isPostable: boolean;
  isControl?: boolean;
  isBankAccount?: boolean;
  isSystemAccount?: boolean;
}> = [
  // Fixed Assets
  {
    code: '0010',
    name: 'Freehold Property',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    classification: 'FA',
    isPostable: true,
  },
  {
    code: '0020',
    name: 'Leasehold Property',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    classification: 'FA',
    isPostable: true,
  },
  {
    code: '0030',
    name: 'Plant and Machinery',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    classification: 'FA',
    isPostable: true,
  },
  {
    code: '0040',
    name: 'Fixtures and Fittings',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    classification: 'FA',
    isPostable: true,
  },
  {
    code: '0050',
    name: 'Motor Vehicles',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    classification: 'FA',
    isPostable: true,
  },
  {
    code: '0060',
    name: 'Computer Equipment',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    classification: 'FA',
    isPostable: true,
  },
  // Depreciation
  {
    code: '0110',
    name: 'Freehold Depreciation',
    accountType: 'ASSET',
    normalBalance: 'CREDIT',
    classification: 'FA',
    isPostable: true,
  },
  {
    code: '0120',
    name: 'Leasehold Depreciation',
    accountType: 'ASSET',
    normalBalance: 'CREDIT',
    classification: 'FA',
    isPostable: true,
  },
  {
    code: '0130',
    name: 'Plant Depreciation',
    accountType: 'ASSET',
    normalBalance: 'CREDIT',
    classification: 'FA',
    isPostable: true,
  },
  {
    code: '0140',
    name: 'Fixtures Depreciation',
    accountType: 'ASSET',
    normalBalance: 'CREDIT',
    classification: 'FA',
    isPostable: true,
  },
  {
    code: '0150',
    name: 'Motor Vehicles Depreciation',
    accountType: 'ASSET',
    normalBalance: 'CREDIT',
    classification: 'FA',
    isPostable: true,
  },
  {
    code: '0160',
    name: 'Computer Depreciation',
    accountType: 'ASSET',
    normalBalance: 'CREDIT',
    classification: 'FA',
    isPostable: true,
  },
  // Current Assets
  {
    code: '1100',
    name: 'Trade Debtors',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    classification: 'CA',
    isPostable: true,
    isControl: true,
  },
  {
    code: '1200',
    name: 'Current Account',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    classification: 'CA',
    isPostable: true,
    isBankAccount: true,
  },
  {
    code: '1210',
    name: 'Deposit Account',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    classification: 'CA',
    isPostable: true,
    isBankAccount: true,
  },
  {
    code: '1220',
    name: 'Petty Cash',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    classification: 'CA',
    isPostable: true,
    isBankAccount: true,
  },
  {
    code: '1300',
    name: 'Prepayments',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    classification: 'CA',
    isPostable: true,
  },
  {
    code: '1400',
    name: 'Other Debtors',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    classification: 'CA',
    isPostable: true,
  },
  {
    code: '1500',
    name: 'VAT Input',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    classification: 'CA',
    isPostable: true,
  },
  // Current Liabilities
  {
    code: '2100',
    name: 'Trade Creditors',
    accountType: 'LIABILITY',
    normalBalance: 'CREDIT',
    classification: 'CL',
    isPostable: true,
    isControl: true,
  },
  {
    code: '2200',
    name: 'VAT Output',
    accountType: 'LIABILITY',
    normalBalance: 'CREDIT',
    classification: 'CL',
    isPostable: true,
  },
  {
    code: '2210',
    name: 'VAT Liability',
    accountType: 'LIABILITY',
    normalBalance: 'CREDIT',
    classification: 'CL',
    isPostable: true,
  },
  {
    code: '2300',
    name: 'PAYE & NI',
    accountType: 'LIABILITY',
    normalBalance: 'CREDIT',
    classification: 'CL',
    isPostable: true,
  },
  {
    code: '2310',
    name: 'Pension Fund',
    accountType: 'LIABILITY',
    normalBalance: 'CREDIT',
    classification: 'CL',
    isPostable: true,
  },
  {
    code: '2400',
    name: 'Accruals',
    accountType: 'LIABILITY',
    normalBalance: 'CREDIT',
    classification: 'CL',
    isPostable: true,
  },
  {
    code: '2500',
    name: 'Corporation Tax',
    accountType: 'LIABILITY',
    normalBalance: 'CREDIT',
    classification: 'CL',
    isPostable: true,
  },
  // Long-Term Liabilities
  {
    code: '2600',
    name: 'Bank Loan',
    accountType: 'LIABILITY',
    normalBalance: 'CREDIT',
    classification: 'LTL',
    isPostable: true,
  },
  {
    code: '2700',
    name: 'Director Loan Account',
    accountType: 'LIABILITY',
    normalBalance: 'CREDIT',
    classification: 'LTL',
    isPostable: true,
  },
  // Equity
  {
    code: '3000',
    name: 'Share Capital',
    accountType: 'EQUITY',
    normalBalance: 'CREDIT',
    classification: 'EQ',
    isPostable: true,
    isSystemAccount: true,
  },
  {
    code: '3100',
    name: 'Share Premium',
    accountType: 'EQUITY',
    normalBalance: 'CREDIT',
    classification: 'EQ',
    isPostable: true,
  },
  {
    code: '3200',
    name: 'Retained Earnings',
    accountType: 'EQUITY',
    normalBalance: 'CREDIT',
    classification: 'EQ',
    isPostable: true,
    isSystemAccount: true,
  },
  {
    code: '3300',
    name: 'Dividends',
    accountType: 'EQUITY',
    normalBalance: 'DEBIT',
    classification: 'EQ',
    isPostable: true,
  },
  // Revenue
  {
    code: '4000',
    name: 'Sales Revenue',
    accountType: 'REVENUE',
    normalBalance: 'CREDIT',
    classification: 'REV',
    isPostable: true,
  },
  {
    code: '4100',
    name: 'Sales - Services',
    accountType: 'REVENUE',
    normalBalance: 'CREDIT',
    classification: 'REV',
    isPostable: true,
  },
  {
    code: '4200',
    name: 'Sales - Products',
    accountType: 'REVENUE',
    normalBalance: 'CREDIT',
    classification: 'REV',
    isPostable: true,
  },
  {
    code: '4900',
    name: 'Sales Discounts',
    accountType: 'REVENUE',
    normalBalance: 'DEBIT',
    classification: 'REV',
    isPostable: true,
  },
  // Cost of Goods Sold
  {
    code: '5000',
    name: 'Cost of Sales',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'COGS',
    isPostable: true,
  },
  {
    code: '5100',
    name: 'Materials Purchased',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'COGS',
    isPostable: true,
  },
  {
    code: '5200',
    name: 'Direct Labour',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'COGS',
    isPostable: true,
  },
  // Operating Expenses
  {
    code: '6000',
    name: 'Rent',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  {
    code: '6100',
    name: 'Rates',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  {
    code: '6200',
    name: 'Insurance',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  {
    code: '6300',
    name: 'Light and Heat',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  {
    code: '6400',
    name: 'Travelling',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  {
    code: '6500',
    name: 'Motor Expenses',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  {
    code: '6600',
    name: 'Telephone',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  {
    code: '6700',
    name: 'Printing and Stationery',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  {
    code: '6800',
    name: 'Professional Fees',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  {
    code: '6900',
    name: 'Depreciation',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  {
    code: '7000',
    name: 'Salaries',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  {
    code: '7100',
    name: 'Employer NI',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  {
    code: '7200',
    name: 'Employer Pension',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  {
    code: '7300',
    name: 'Staff Welfare',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  {
    code: '7400',
    name: 'Entertainment',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  {
    code: '7500',
    name: 'Bad Debts',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  {
    code: '7600',
    name: 'Bank Charges',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  {
    code: '7700',
    name: 'Sundry Expenses',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'OPEX',
    isPostable: true,
  },
  // Other Income
  {
    code: '4300',
    name: 'Other Income',
    accountType: 'REVENUE',
    normalBalance: 'CREDIT',
    classification: 'OI',
    isPostable: true,
  },
  {
    code: '4400',
    name: 'Rental Income',
    accountType: 'REVENUE',
    normalBalance: 'CREDIT',
    classification: 'OI',
    isPostable: true,
  },
  // Finance Costs
  {
    code: '8000',
    name: 'Interest Payable',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'FIN',
    isPostable: true,
  },
  {
    code: '8100',
    name: 'Interest Receivable',
    accountType: 'REVENUE',
    normalBalance: 'CREDIT',
    classification: 'FIN',
    isPostable: true,
  },
  {
    code: '8200',
    name: 'Exchange Rate Gains',
    accountType: 'REVENUE',
    normalBalance: 'CREDIT',
    classification: 'FIN',
    isPostable: true,
  },
  {
    code: '8300',
    name: 'Exchange Rate Losses',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'FIN',
    isPostable: true,
  },
  // Taxation
  {
    code: '9000',
    name: 'Corporation Tax',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    classification: 'TAX',
    isPostable: true,
  },
  // Suspense
  {
    code: '9999',
    name: 'Suspense Account',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    classification: 'CA',
    isPostable: true,
  },
];

// ---------------------------------------------------------------------------
// 27 Account Mapping types
// ---------------------------------------------------------------------------

const MAPPINGS = [
  { mappingType: 'AR_CONTROL', accountCode: '1100', description: 'Accounts Receivable Control' },
  { mappingType: 'AP_CONTROL', accountCode: '2100', description: 'Accounts Payable Control' },
  { mappingType: 'SALES_REVENUE', accountCode: '4000', description: 'Default Sales Revenue' },
  { mappingType: 'SALES_SERVICES', accountCode: '4100', description: 'Sales - Services' },
  { mappingType: 'SALES_PRODUCTS', accountCode: '4200', description: 'Sales - Products' },
  { mappingType: 'COST_OF_SALES', accountCode: '5000', description: 'Cost of Goods Sold' },
  { mappingType: 'PURCHASE_EXPENSE', accountCode: '5100', description: 'Default Purchase Expense' },
  { mappingType: 'VAT_INPUT', accountCode: '1500', description: 'VAT Input (Reclaimable)' },
  { mappingType: 'VAT_OUTPUT', accountCode: '2200', description: 'VAT Output (Payable)' },
  { mappingType: 'VAT_LIABILITY', accountCode: '2210', description: 'VAT Liability to HMRC' },
  { mappingType: 'BANK_CHARGES', accountCode: '7600', description: 'Bank Charges' },
  { mappingType: 'EXCHANGE_GAIN', accountCode: '8200', description: 'Exchange Rate Gains' },
  { mappingType: 'EXCHANGE_LOSS', accountCode: '8300', description: 'Exchange Rate Losses' },
  { mappingType: 'RETAINED_EARNINGS', accountCode: '3200', description: 'Retained Earnings' },
  { mappingType: 'SHARE_CAPITAL', accountCode: '3000', description: 'Share Capital' },
  { mappingType: 'PAYE_NI', accountCode: '2300', description: 'PAYE & NI Liability' },
  { mappingType: 'PENSION', accountCode: '2310', description: 'Pension Fund Liability' },
  { mappingType: 'CORPORATION_TAX', accountCode: '2500', description: 'Corporation Tax Liability' },
  { mappingType: 'INTEREST_PAYABLE', accountCode: '8000', description: 'Interest Payable' },
  { mappingType: 'INTEREST_RECEIVABLE', accountCode: '8100', description: 'Interest Receivable' },
  { mappingType: 'BAD_DEBTS', accountCode: '7500', description: 'Bad Debts Written Off' },
  { mappingType: 'DEPRECIATION_EXPENSE', accountCode: '6900', description: 'Depreciation Expense' },
  { mappingType: 'SALARIES', accountCode: '7000', description: 'Salaries' },
  { mappingType: 'EMPLOYER_NI', accountCode: '7100', description: 'Employer NI Contributions' },
  {
    mappingType: 'EMPLOYER_PENSION',
    accountCode: '7200',
    description: 'Employer Pension Contributions',
  },
  { mappingType: 'SUSPENSE', accountCode: '9999', description: 'Suspense Account' },
  { mappingType: 'ROUNDING', accountCode: '7700', description: 'Rounding Differences' },
];

// ---------------------------------------------------------------------------
// 3 Default Dimension Types
// ---------------------------------------------------------------------------

const DIMENSION_TYPES = [
  {
    code: 'DEPT',
    name: 'Department',
    description: 'Organisational department',
    sortOrder: 1,
    isSingleSelect: true,
  },
  {
    code: 'CC',
    name: 'Cost Centre',
    description: 'Cost centre for expense tracking',
    sortOrder: 2,
    isSingleSelect: true,
  },
  {
    code: 'PROJ',
    name: 'Project',
    description: 'Project or job tracking',
    sortOrder: 3,
    isSingleSelect: false,
  },
];

// ---------------------------------------------------------------------------
// Default Budget Keys (allocation patterns)
// ---------------------------------------------------------------------------

const BUDGET_KEYS = [
  {
    name: 'Even Split',
    pct1: 8.3333,
    pct2: 8.3333,
    pct3: 8.3333,
    pct4: 8.3333,
    pct5: 8.3333,
    pct6: 8.3333,
    pct7: 8.3333,
    pct8: 8.3333,
    pct9: 8.3333,
    pct10: 8.3333,
    pct11: 8.3333,
    pct12: 8.3337, // last period absorbs rounding: 8.3333 * 11 + 8.3337 = 100.0000
  },
  {
    name: 'Seasonal (Retail)',
    pct1: 5.0, // Jan
    pct2: 5.0, // Feb
    pct3: 7.0, // Mar
    pct4: 8.0, // Apr
    pct5: 8.0, // May
    pct6: 8.0, // Jun
    pct7: 7.0, // Jul
    pct8: 7.0, // Aug
    pct9: 8.0, // Sep
    pct10: 7.0, // Oct
    pct11: 15.0, // Nov
    pct12: 15.0, // Dec -- total = 100.0000
  },
  {
    name: 'Q1 Heavy',
    pct1: 15.0,
    pct2: 15.0,
    pct3: 15.0,
    pct4: 6.1111,
    pct5: 6.1111,
    pct6: 6.1111,
    pct7: 6.1111,
    pct8: 6.1111,
    pct9: 6.1111,
    pct10: 6.1111,
    pct11: 6.1111,
    pct12: 6.1112, // last period absorbs rounding -- total = 100.0000
  },
];

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

export async function seedFinanceData(prisma: PrismaClient): Promise<void> {
  console.log('  Seeding Finance module data...');

  // 1. Account Classifications (11 records)
  for (const c of CLASSIFICATIONS) {
    await prisma.accountClassification.upsert({
      where: {
        uq_account_classification_company_code: { companyId: DEFAULT_COMPANY_ID, code: c.code },
      },
      update: {
        name: c.name,
        accountType: c.accountType,
        sortOrder: c.sortOrder,
        reportSection: c.reportSection,
      },
      create: { companyId: DEFAULT_COMPANY_ID, ...c },
    });
  }
  console.log(`    ${CLASSIFICATIONS.length} Account Classifications seeded`);

  // 2. Chart of Accounts (~65 records — need classification IDs first)
  const classMap = new Map<string, string>();
  const classifications = await prisma.accountClassification.findMany({
    where: { companyId: DEFAULT_COMPANY_ID },
  });
  for (const cl of classifications) classMap.set(cl.code, cl.id);

  for (const a of ACCOUNTS) {
    const classId = classMap.get(a.classification);
    await prisma.chartOfAccount.upsert({
      where: { uq_chart_of_account_company_code: { companyId: DEFAULT_COMPANY_ID, code: a.code } },
      update: {
        name: a.name,
        accountType: a.accountType,
        normalBalance: a.normalBalance,
        classificationId: classId,
        isPostable: a.isPostable,
        isControl: a.isControl ?? false,
        isBankAccount: a.isBankAccount ?? false,
        isSystemAccount: a.isSystemAccount ?? false,
        updatedBy: DEFAULT_USER_ID,
      },
      create: {
        companyId: DEFAULT_COMPANY_ID,
        code: a.code,
        name: a.name,
        accountType: a.accountType,
        normalBalance: a.normalBalance,
        classificationId: classId,
        isPostable: a.isPostable,
        isControl: a.isControl ?? false,
        isBankAccount: a.isBankAccount ?? false,
        isSystemAccount: a.isSystemAccount ?? false,
        createdBy: DEFAULT_USER_ID,
        updatedBy: DEFAULT_USER_ID,
      },
    });
  }
  console.log(`    ${ACCOUNTS.length} Chart of Accounts seeded`);

  // 3. Account Mappings (27 records)
  // departmentCode is nullable in the unique constraint — Prisma cannot upsert when
  // a compound unique contains a nullable field (PostgreSQL treats NULLs as distinct).
  // Use findFirst + create/update pattern instead.
  for (const m of MAPPINGS) {
    const existing = await prisma.accountMapping.findFirst({
      where: {
        companyId: DEFAULT_COMPANY_ID,
        mappingType: m.mappingType,
        departmentCode: null,
      },
    });
    if (existing) {
      await prisma.accountMapping.update({
        where: { id: existing.id },
        data: { accountCode: m.accountCode, description: m.description },
      });
    } else {
      await prisma.accountMapping.create({
        data: {
          companyId: DEFAULT_COMPANY_ID,
          mappingType: m.mappingType,
          accountCode: m.accountCode,
          departmentCode: null,
          description: m.description,
        },
      });
    }
  }
  console.log(`    ${MAPPINGS.length} Account Mappings seeded`);

  // 4. Number Series for JOURNAL
  // NumberSeries uses partial unique indexes (not a Prisma @@unique), so we use
  // findFirst + create/update — same pattern as the main seed.ts.
  const existingJournalSeries = await prisma.numberSeries.findFirst({
    where: {
      companyId: DEFAULT_COMPANY_ID,
      entityType: 'JOURNAL',
      validFrom: null,
    },
  });
  if (existingJournalSeries) {
    await prisma.numberSeries.update({
      where: { id: existingJournalSeries.id },
      data: { prefix: 'JE-', padding: 5 },
    });
  } else {
    await prisma.numberSeries.create({
      data: {
        companyId: DEFAULT_COMPANY_ID,
        entityType: 'JOURNAL',
        prefix: 'JE-',
        nextValue: 1,
        padding: 5,
        isActive: true,
      },
    });
  }
  console.log('    NumberSeries JOURNAL seeded');

  // 4b. Number Series for SIMULATION
  const existingSimSeries = await prisma.numberSeries.findFirst({
    where: {
      companyId: DEFAULT_COMPANY_ID,
      entityType: 'SIMULATION',
      validFrom: null,
    },
  });
  if (existingSimSeries) {
    await prisma.numberSeries.update({
      where: { id: existingSimSeries.id },
      data: { prefix: 'SIM-', padding: 5 },
    });
  } else {
    await prisma.numberSeries.create({
      data: {
        companyId: DEFAULT_COMPANY_ID,
        entityType: 'SIMULATION',
        prefix: 'SIM-',
        nextValue: 1,
        padding: 5,
        isActive: true,
      },
    });
  }
  console.log('    NumberSeries SIMULATION seeded');

  // 5. Dimension Types (3 records)
  for (const dt of DIMENSION_TYPES) {
    await prisma.dimensionType.upsert({
      where: { uq_dimension_type_company_code: { companyId: DEFAULT_COMPANY_ID, code: dt.code } },
      update: {
        name: dt.name,
        description: dt.description,
        sortOrder: dt.sortOrder,
        isSingleSelect: dt.isSingleSelect,
      },
      create: {
        companyId: DEFAULT_COMPANY_ID,
        code: dt.code,
        name: dt.name,
        description: dt.description,
        sortOrder: dt.sortOrder,
        isSingleSelect: dt.isSingleSelect,
        allowManualEntry: false,
        isActive: true,
      },
    });
  }
  console.log(`    ${DIMENSION_TYPES.length} Dimension Types seeded`);

  // 6. Budget Keys (3 default allocation patterns)
  for (const bk of BUDGET_KEYS) {
    await prisma.budgetKey.upsert({
      where: { uq_budget_key_company_name: { companyId: DEFAULT_COMPANY_ID, name: bk.name } },
      update: {
        pct1: bk.pct1,
        pct2: bk.pct2,
        pct3: bk.pct3,
        pct4: bk.pct4,
        pct5: bk.pct5,
        pct6: bk.pct6,
        pct7: bk.pct7,
        pct8: bk.pct8,
        pct9: bk.pct9,
        pct10: bk.pct10,
        pct11: bk.pct11,
        pct12: bk.pct12,
      },
      create: {
        companyId: DEFAULT_COMPANY_ID,
        name: bk.name,
        pct1: bk.pct1,
        pct2: bk.pct2,
        pct3: bk.pct3,
        pct4: bk.pct4,
        pct5: bk.pct5,
        pct6: bk.pct6,
        pct7: bk.pct7,
        pct8: bk.pct8,
        pct9: bk.pct9,
        pct10: bk.pct10,
        pct11: bk.pct11,
        pct12: bk.pct12,
        isActive: true,
        createdBy: DEFAULT_USER_ID,
      },
    });
  }
  console.log(`    ${BUDGET_KEYS.length} Budget Keys seeded`);

  console.log('  Finance module data seeded successfully.');
}
