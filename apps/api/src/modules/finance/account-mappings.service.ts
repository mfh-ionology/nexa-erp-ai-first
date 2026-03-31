import type { PrismaClient } from '@nexa/db';

import type { AccountMappingItem, AccountMappingUpdateItem } from './account-mappings.schema.js';
import { MAPPING_TYPES } from './account-mappings.schema.js';
import { AppError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// FRS 102 Default Mappings (inline — not imported from seed)
// ---------------------------------------------------------------------------

export const FRS102_DEFAULT_MAPPINGS: ReadonlyArray<{
  mappingType: string;
  accountCode: string;
  description: string;
}> = [
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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a raw AccountMapping row (with optional joined account) into the API
 * response shape.
 */
function formatMapping(row: {
  id: string;
  mappingType: string;
  accountCode: string;
  departmentCode: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  account?: { name: string } | null;
}): AccountMappingItem {
  return {
    id: row.id,
    mappingType: row.mappingType,
    accountCode: row.accountCode,
    accountName: row.account?.name ?? undefined,
    departmentCode: row.departmentCode,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Validate that all referenced account codes exist and are postable
 * (BR-FIN-007, BR-FIN-013). Returns an object keyed by accountCode with
 * error messages for any invalid accounts.
 */
async function validateAccounts(
  prisma: PrismaClient,
  companyId: string,
  accountCodes: string[],
): Promise<Record<string, string[]>> {
  const uniqueCodes = [...new Set(accountCodes)];
  const errors: Record<string, string[]> = {};

  const accounts = await prisma.chartOfAccount.findMany({
    where: { companyId, code: { in: uniqueCodes } },
    select: { code: true, isPostable: true, isActive: true, name: true },
  });

  const accountMap = new Map(accounts.map((a) => [a.code, a]));

  for (const code of uniqueCodes) {
    const account = accountMap.get(code);
    if (!account) {
      errors[code] = [`Account '${code}' does not exist`];
    } else if (!account.isPostable) {
      errors[code] = [`Account '${code}' (${account.name}) is not postable (BR-FIN-013)`];
    } else if (!account.isActive) {
      errors[code] = [`Account '${code}' (${account.name}) is not active`];
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Get all account mappings for a company (AC-1).
 * Returns all 27 mapping types with their current GL account assignments,
 * including the account name from ChartOfAccount.
 */
export async function listAccountMappings(
  prisma: PrismaClient,
  companyId: string,
): Promise<AccountMappingItem[]> {
  const rows = await prisma.accountMapping.findMany({
    where: { companyId },
    include: { account: { select: { name: true } } },
    orderBy: { mappingType: 'asc' },
  });

  return rows.map(formatMapping);
}

/**
 * Batch update account mappings (AC-2).
 * Validates all referenced accounts exist and are postable before applying.
 * Uses a transaction for atomicity.
 */
export async function batchUpdateAccountMappings(
  prisma: PrismaClient,
  companyId: string,
  items: AccountMappingUpdateItem[],
): Promise<AccountMappingItem[]> {
  // Validate all mapping types are valid
  for (const item of items) {
    if (!MAPPING_TYPES.includes(item.mappingType as (typeof MAPPING_TYPES)[number])) {
      throw new AppError('INVALID_MAPPING_TYPE', `Invalid mapping type: ${item.mappingType}`, 400);
    }
  }

  // Validate all referenced accounts exist and are postable (BR-FIN-007, BR-FIN-013)
  const accountCodes = items.map((i) => i.accountCode);
  const errors = await validateAccounts(prisma, companyId, accountCodes);

  if (Object.keys(errors).length > 0) {
    throw new AppError(
      'ACCOUNT_VALIDATION_FAILED',
      'One or more account codes are invalid or not postable',
      400,
      errors,
    );
  }

  // Apply updates in a transaction
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const departmentCode = item.departmentCode ?? null;
      await tx.accountMapping.upsert({
        where: {
          uq_account_mapping_company_type_dept: {
            companyId,
            mappingType: item.mappingType,
            departmentCode: departmentCode ?? '',
          },
        },
        create: {
          companyId,
          mappingType: item.mappingType,
          accountCode: item.accountCode,
          departmentCode,
          description:
            FRS102_DEFAULT_MAPPINGS.find((m) => m.mappingType === item.mappingType)?.description ??
            null,
        },
        update: {
          accountCode: item.accountCode,
          departmentCode,
        },
      });
    }
  });

  return listAccountMappings(prisma, companyId);
}

/**
 * Reset account mappings to FRS 102 defaults (AC-3).
 * Deletes all mappings for the company, then re-inserts defaults.
 */
export async function resetAccountMappings(
  prisma: PrismaClient,
  companyId: string,
): Promise<AccountMappingItem[]> {
  await prisma.$transaction(async (tx) => {
    // Delete all existing mappings for this company
    await tx.accountMapping.deleteMany({
      where: { companyId },
    });

    // Re-insert FRS 102 defaults
    await tx.accountMapping.createMany({
      data: FRS102_DEFAULT_MAPPINGS.map((m) => ({
        companyId,
        mappingType: m.mappingType,
        accountCode: m.accountCode,
        departmentCode: null,
        description: m.description,
      })),
    });
  });

  return listAccountMappings(prisma, companyId);
}
