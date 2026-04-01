import type { PrismaClient } from '@nexa/db';
import { SettingCategory, SettingValueType } from '@nexa/db';

import type { FinanceSettings, UpdateFinanceSettingsInput } from './settings.schema.js';

// ---------------------------------------------------------------------------
// Default values for all 12 finance settings tabs
// ---------------------------------------------------------------------------

export const FINANCE_DEFAULTS: FinanceSettings = {
  general: {
    fiscalYearStartMonth: 1,
    baseCurrency: 'GBP',
    defaultPaymentTerms: 30,
    retainedEarningsAccount: undefined,
  },
  vat: {
    vatScheme: 'STANDARD',
    vatRegistrationNumber: undefined,
    mtdEnabled: false,
    flatRatePercentage: undefined,
  },
  subSystems: {
    arEnabled: true,
    apEnabled: true,
    stockEnabled: true,
    payrollEnabled: false,
  },
  tags: {
    enableDepartments: false,
    enableCostCentres: false,
    enableProjects: false,
  },
  dimensions: {
    enableDimensions: false,
    requireDimensionsOnManualJournals: false,
    defaultDimensionBehavior: 'NONE',
    maxDimensionTypes: 10,
  },
  dataEntry: {
    requireDescription: false,
    autoPopulateVat: true,
    defaultSource: 'MANUAL',
    warnUnbalanced: true,
  },
  approvals: {
    journalApprovalEnabled: false,
    journalApprovalThreshold: 10000,
    budgetApprovalRequired: true,
    yearEndApprovalRequired: true,
  },
  reconciliation: {
    autoMatchEnabled: true,
    autoMatchThreshold: 95,
    suggestThreshold: 60,
  },
  multiCurrency: {
    multiCurrencyEnabled: false,
    autoFetchRates: false,
    rateSource: 'BOE',
  },
  numberSeries: {
    journalPrefix: 'JNL',
    journalPadding: 5,
    simulationPrefix: 'SIM',
    simulationPadding: 5,
    budgetPrefix: 'BDG',
    budgetPadding: 5,
  },
  rounding: {
    currencyRoundingMethod: 'HALF_UP',
    displayDecimals: 2,
    internalDecimals: 4,
  },
  reporting: {
    defaultReportFormat: 'PDF',
    includeZeroBalances: false,
    showAccountCodes: true,
  },
};

// ---------------------------------------------------------------------------
// Tab names (used as key prefixes in SystemSetting)
// ---------------------------------------------------------------------------

const TAB_NAMES = [
  'general',
  'vat',
  'subSystems',
  'tags',
  'dimensions',
  'dataEntry',
  'approvals',
  'reconciliation',
  'multiCurrency',
  'numberSeries',
  'rounding',
  'reporting',
] as const;

type TabName = (typeof TAB_NAMES)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Serialise a JS value to its string representation for storage.
 * Numbers and booleans are stored as JSON strings; strings stored as-is.
 */
function serialiseValue(value: unknown): { value: string; valueType: SettingValueType } {
  if (typeof value === 'boolean') {
    return { value: String(value), valueType: SettingValueType.BOOLEAN };
  }
  if (typeof value === 'number') {
    return { value: String(value), valueType: SettingValueType.NUMBER };
  }
  return { value: String(value), valueType: SettingValueType.STRING };
}

/**
 * Deserialise a string value from SystemSetting back to its typed JS value.
 */
function deserialiseValue(value: string, valueType: string): unknown {
  switch (valueType) {
    case 'BOOLEAN':
      return value === 'true';
    case 'NUMBER':
      return Number(value);
    default:
      return value;
  }
}

/**
 * Build a flat key-value map from a tab-grouped settings object.
 * Keys are in the format `tab.field`, e.g. `general.baseCurrency`.
 */
function flattenSettings(
  settings: UpdateFinanceSettingsInput,
): Array<{ key: string; value: unknown }> {
  const result: Array<{ key: string; value: unknown }> = [];

  for (const tab of TAB_NAMES) {
    const tabData = settings[tab];
    if (!tabData) continue;
    for (const [field, value] of Object.entries(tabData)) {
      if (value !== undefined) {
        result.push({ key: `${tab}.${field}`, value });
      }
    }
  }

  return result;
}

/**
 * Reassemble flat SystemSetting rows into the tab-grouped FinanceSettings shape.
 * Missing keys are filled from FINANCE_DEFAULTS.
 */
function assembleSettings(
  rows: Array<{ key: string; value: string; valueType: string }>,
): FinanceSettings {
  // Start from a deep copy of defaults
  const result: FinanceSettings = JSON.parse(JSON.stringify(FINANCE_DEFAULTS));

  for (const row of rows) {
    const dotIdx = row.key.indexOf('.');
    if (dotIdx === -1) continue;

    const tab = row.key.substring(0, dotIdx) as TabName;
    const field = row.key.substring(dotIdx + 1);

    if (tab in result) {
      const tabObj = result[tab] as Record<string, unknown>;
      if (field in tabObj || Object.prototype.hasOwnProperty.call(FINANCE_DEFAULTS[tab], field)) {
        tabObj[field] = deserialiseValue(row.value, row.valueType);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Get all finance settings for a company (AC-1).
 * Returns structured JSON grouped by tab, with defaults for any missing keys.
 */
export async function getFinanceSettings(
  prisma: PrismaClient,
  companyId: string,
): Promise<FinanceSettings> {
  const rows = await prisma.systemSetting.findMany({
    where: { companyId, category: SettingCategory.FINANCE },
    select: { key: true, value: true, valueType: true },
  });

  return assembleSettings(rows);
}

/**
 * Update finance settings for a company (AC-2).
 * Accepts a partial tab-grouped payload; only provided fields are upserted.
 * Returns the full settings after update.
 */
export async function updateFinanceSettings(
  prisma: PrismaClient,
  companyId: string,
  input: UpdateFinanceSettingsInput,
  _userId: string,
): Promise<FinanceSettings> {
  const pairs = flattenSettings(input);

  if (pairs.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const { key, value } of pairs) {
        const { value: serialised, valueType } = serialiseValue(value);
        await tx.systemSetting.upsert({
          where: {
            companyId_key: {
              companyId,
              key,
            },
          },
          create: {
            companyId,
            key,
            value: serialised,
            valueType,
            category: SettingCategory.FINANCE,
          },
          update: {
            value: serialised,
            valueType,
          },
        });
      }
    });
  }

  return getFinanceSettings(prisma, companyId);
}

/**
 * Reset all finance settings to defaults for a company (AC-3).
 * Deletes all FINANCE category SystemSetting rows, so getFinanceSettings
 * returns pure defaults.
 */
export async function resetFinanceSettings(
  prisma: PrismaClient,
  companyId: string,
): Promise<FinanceSettings> {
  await prisma.systemSetting.deleteMany({
    where: { companyId, category: SettingCategory.FINANCE },
  });

  // After deletion, getFinanceSettings returns pure defaults
  return { ...JSON.parse(JSON.stringify(FINANCE_DEFAULTS)) };
}
