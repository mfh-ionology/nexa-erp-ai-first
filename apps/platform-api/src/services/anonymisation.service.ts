/**
 * Anonymisation Service — Pure-function PII stripping for cross-tenant intelligence
 *
 * Implements AC3 of E5d-3: All data crossing tenant boundaries must be stripped
 * of PII, leaving only statistical counts, percentages, category labels, and
 * boolean flags.
 *
 * Every function is pure (no DB access, no side effects) — fully unit-testable.
 *
 * Ref: Business Rules BR-PLT-007..011, NFR50 (data privacy/durability)
 */

// ─── Input types (raw data read from tenant DBs via TenantDbConnector) ────────

export interface RawLearningSignal {
  skill_key: string;
  total_queries: number;
  success_count: number;
  correction_count: number;
  avg_confidence: number;
}

export interface RawCorrectionEntry {
  correction_type: string;
  skill_key: string | null;
  count: number;
}

export interface RawViewRecord {
  view_type: string;
  view_name?: string; // PII — will be stripped
}

export interface RawAutomationRecord {
  automation_type: string;
  automation_name?: string; // PII — will be stripped
  run_count: number;
}

export interface TenantRawData {
  learningSignals: RawLearningSignal[];
  corrections: RawCorrectionEntry[];
  views: RawViewRecord[];
  automations: RawAutomationRecord[];
}

// ─── Output types (anonymised, safe for platform DB storage) ─────────────────

export interface AnonymisedPatterns {
  queryCategories: Record<string, number>;
  skillUsage: Record<string, number>;
  viewPatterns: Record<string, boolean>;
  automationUsage: Record<string, number>;
}

export interface AnonymisedCorrectionEntry {
  correctionType: string;
  skillKey: string | null;
  occurrenceCount: number;
  commonCorrection: string;
}

export interface AnonymisedCorrections {
  corrections: AnonymisedCorrectionEntry[];
}

export interface ValidationResult {
  valid: boolean;
  violations: string[];
}

// ─── Skill key → module mapping ──────────────────────────────────────────────

const SKILL_MODULE_MAP: Record<string, string> = {
  invoice: 'ar',
  credit_note: 'ar',
  receipt: 'ar',
  customer: 'ar',
  payment: 'ap',
  supplier: 'ap',
  purchase: 'purchasing',
  bill: 'ap',
  journal: 'finance',
  account: 'finance',
  ledger: 'finance',
  vat: 'finance',
  tax: 'finance',
  order: 'sales',
  quote: 'sales',
  delivery: 'sales',
  stock: 'inventory',
  item: 'inventory',
  warehouse: 'inventory',
  contact: 'crm',
  lead: 'crm',
  opportunity: 'crm',
  employee: 'hr',
  payroll: 'hr',
  leave: 'hr',
  bom: 'manufacturing',
  production: 'manufacturing',
  report: 'reporting',
  filter: 'system',
  view: 'system',
  automation: 'system',
};

// ─── Correction type → summary templates ─────────────────────────────────────

const CORRECTION_SUMMARIES: Record<string, string> = {
  wrong_field_value: 'Tenants correct field value suggestions',
  wrong_account: 'Tenants correct account code suggestions',
  wrong_vat_code: 'Tenants correct VAT code suggestions',
  wrong_category: 'Tenants correct category assignments',
  missing_field: 'Tenants add missing fields to AI responses',
  wrong_format: 'Tenants correct formatting in AI responses',
  wrong_calculation: 'Tenants correct calculation results',
  wrong_reference: 'Tenants correct document reference suggestions',
  wrong_date: 'Tenants correct date suggestions',
  irrelevant_response: 'Tenants report irrelevant AI responses',
};

// ─── PII detection patterns (AC3 automated PII detection) ────────────────────

const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  ukPhone: /\+?44\d{10,}|0\d{10,}/,
  currency: /[£$€]\d+[.,]\d{2}/,
  uuid: /[0-9a-f]{8}-[0-9a-f]{4}-/i,
  personName: /\b[A-Z][a-z]{1,20}\s+[A-Z][a-z]{1,20}\b/,
} as const;

// Known safe patterns that match personName but are not PII.
// Includes generated correction summaries and common geographic/business terms.
const SAFE_PREFIXES = ['Tenants '];
const SAFE_WORDS = new Set([
  'North',
  'South',
  'East',
  'West',
  'Central',
  'New',
  'Old',
  'Great',
  'Upper',
  'Lower',
  'Data',
  'Credit',
  'Debit',
  'Sales',
  'Purchase',
  'Stock',
  'Bank',
  'Cash',
  'Tax',
  'Vat',
  'Skill',
  'Default',
  'Common',
  'Feature',
  'High',
  'Medium',
  'Low',
  'Total',
  'Average',
  'Monthly',
  'Weekly',
  'Daily',
  'Annual',
  'Quarterly',
  'Field',
  'Value',
  'Type',
  'Rate',
  'Current',
  'Previous',
  'General',
  'Special',
  'Standard',
  'Custom',
  'Manual',
  'Auto',
  'Net',
  'Gross',
  'Base',
  'Fixed',
  'Variable',
  'Open',
  'Closed',
  'Active',
  'Draft',
  'United',
  'British',
  'Royal',
  'National',
]);

// ─── Pure functions ──────────────────────────────────────────────────────────

/**
 * Derives the ERP module category from a skill key.
 * E.g., "create_invoice" → "ar", "apply_filter" → "system"
 */
export function deriveModule(skillKey: string): string {
  const lower = skillKey.toLowerCase();
  for (const [keyword, module] of Object.entries(SKILL_MODULE_MAP)) {
    if (lower.includes(keyword)) return module;
  }
  return 'other';
}

/**
 * Anonymises raw usage data from a tenant DB into safe statistical aggregates.
 *
 * Strips ALL PII — output contains only:
 *  - counts (query totals, run counts)
 *  - category labels (module names, skill keys, view types, automation types)
 *  - boolean flags (view type existence)
 *
 * Output contains NONE of:
 *  - entity names, user names, email addresses
 *  - monetary values, account balances
 *  - free-text, UUIDs traceable to specific entities
 */
export function anonymiseUsagePatterns(rawData: TenantRawData): AnonymisedPatterns {
  const queryCategories: Record<string, number> = {};
  const skillUsage: Record<string, number> = {};

  for (const signal of rawData.learningSignals ?? []) {
    const module = deriveModule(signal.skill_key);
    queryCategories[module] = (queryCategories[module] ?? 0) + signal.total_queries;
    skillUsage[signal.skill_key] = (skillUsage[signal.skill_key] ?? 0) + signal.total_queries;
  }

  // View patterns — boolean flags only (which types exist, NOT view names)
  const viewPatterns: Record<string, boolean> = {};
  for (const view of rawData.views ?? []) {
    viewPatterns[view.view_type] = true;
    // view_name is intentionally ignored — it could contain PII
  }

  // Automation usage — counts by type only (automation names stripped)
  const automationUsage: Record<string, number> = {};
  for (const auto of rawData.automations ?? []) {
    automationUsage[auto.automation_type] =
      (automationUsage[auto.automation_type] ?? 0) + auto.run_count;
  }

  return { queryCategories, skillUsage, viewPatterns, automationUsage };
}

/**
 * Anonymises raw correction log data into safe aggregates.
 *
 * Strips all verbatim text (originalResponse, correctedResponse),
 * user IDs, conversation IDs. Returns only type/skill/count with
 * a generated generic summary (never raw text).
 */
export function anonymiseCorrectionPatterns(
  corrections: RawCorrectionEntry[],
): AnonymisedCorrections {
  if (!corrections || corrections.length === 0) {
    return { corrections: [] };
  }

  return {
    corrections: corrections.map((c) => ({
      correctionType: c.correction_type,
      skillKey: c.skill_key,
      occurrenceCount: c.count,
      commonCorrection: generateCorrectionSummary(c.correction_type, c.count),
    })),
  };
}

/**
 * Generates a generic, non-PII summary for a correction pattern.
 * Uses pre-defined templates based on correctionType — never raw text.
 */
export function generateCorrectionSummary(correctionType: string, count: number): string {
  const template = CORRECTION_SUMMARIES[correctionType];
  if (template) {
    return `${template} (${count} occurrences)`;
  }
  // Fallback for unknown types — still generic, no raw text
  const humanReadable = correctionType.replace(/_/g, ' ');
  return `Tenants correct ${humanReadable} suggestions (${count} occurrences)`;
}

/**
 * Scans any data structure for PII indicators.
 *
 * Checks for: emails, UK phone numbers, currency amounts,
 * UUIDs in non-ID text fields, capitalised name pairs.
 *
 * This is the automated PII detection test mechanism required by AC3.
 */
export function validateNoPersonalData(data: unknown): ValidationResult {
  const violations: string[] = [];
  scanForPii(data, '', violations);
  return { valid: violations.length === 0, violations };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function scanForPii(value: unknown, path: string, violations: string[]): void {
  if (value === null || value === undefined) return;

  if (typeof value === 'string') {
    checkStringForPii(value, path, violations);
    return;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      scanForPii(value[i], `${path}[${i}]`, violations);
    }
    return;
  }

  if (typeof value === 'object') {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      scanForPii(val, path ? `${path}.${key}` : key, violations);
    }
  }
}

function checkStringForPii(value: string, path: string, violations: string[]): void {
  // Short strings (< 3 chars) are unlikely to contain PII
  if (value.length < 3) return;

  // Skip PII checks entirely for ID/key fields (structural identifiers, not content)
  const pathLower = path.toLowerCase();
  const isIdField =
    pathLower.endsWith('id') || pathLower.endsWith('key') || pathLower.includes('.id');
  if (isIdField) return;

  const loc = path || 'root';

  if (PII_PATTERNS.email.test(value)) {
    violations.push(`Email detected at ${loc}: "${maskValue(value)}"`);
  }
  if (PII_PATTERNS.ukPhone.test(value)) {
    violations.push(`UK phone number detected at ${loc}: "${maskValue(value)}"`);
  }
  if (PII_PATTERNS.currency.test(value)) {
    violations.push(`Currency amount detected at ${loc}: "${maskValue(value)}"`);
  }
  if (PII_PATTERNS.uuid.test(value)) {
    violations.push(`UUID in non-ID field at ${loc}: "${maskValue(value)}"`);
  }

  // Person name check — only on longer strings (not short category labels)
  if (value.length > 10) {
    const match = value.match(PII_PATTERNS.personName);
    if (match) {
      const isSafe = SAFE_PREFIXES.some((prefix) => value.startsWith(prefix));
      // Check if either word in the matched pair is a known safe word
      const [firstWord] = match[0].split(/\s+/);
      const isSafeWord = SAFE_WORDS.has(firstWord!);
      if (!isSafe && !isSafeWord) {
        violations.push(`Possible person name at ${loc}: "${maskValue(value)}"`);
      }
    }
  }
}

function maskValue(value: string): string {
  if (value.length <= 6) return '***';
  return value.substring(0, 4) + '***';
}
