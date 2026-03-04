import { describe, it, expect } from 'vitest';
import {
  anonymiseUsagePatterns,
  anonymiseCorrectionPatterns,
  generateCorrectionSummary,
  validateNoPersonalData,
  deriveModule,
  type TenantRawData,
  type RawCorrectionEntry,
} from '../services/anonymisation.service.js';

// ─── Test data factories ─────────────────────────────────────────────────────

function makeTenantRawData(overrides: Partial<TenantRawData> = {}): TenantRawData {
  return {
    learningSignals: [
      {
        skill_key: 'create_invoice',
        total_queries: 45,
        success_count: 40,
        correction_count: 5,
        avg_confidence: 0.88,
      },
      {
        skill_key: 'apply_filter',
        total_queries: 89,
        success_count: 85,
        correction_count: 4,
        avg_confidence: 0.92,
      },
      {
        skill_key: 'journal_entry',
        total_queries: 30,
        success_count: 25,
        correction_count: 5,
        avg_confidence: 0.75,
      },
    ],
    corrections: [
      { correction_type: 'wrong_vat_code', skill_key: 'create_invoice', count: 5 },
      { correction_type: 'wrong_account', skill_key: 'journal_entry', count: 3 },
    ],
    views: [
      { view_type: 'list', view_name: 'John Overdue Invoices' },
      { view_type: 'kanban', view_name: 'Sales Pipeline Q1' },
    ],
    automations: [
      {
        automation_type: 'scheduled',
        automation_name: 'Weekly VAT Report for Acme Ltd',
        run_count: 12,
      },
      {
        automation_type: 'event_driven',
        automation_name: 'Send Invoice to Customer',
        run_count: 45,
      },
    ],
    ...overrides,
  };
}

function makeRawDataWithPii(): TenantRawData {
  return {
    learningSignals: [
      {
        skill_key: 'create_invoice',
        total_queries: 10,
        success_count: 8,
        correction_count: 2,
        avg_confidence: 0.85,
      },
    ],
    corrections: [{ correction_type: 'wrong_field_value', skill_key: 'create_invoice', count: 2 }],
    views: [{ view_type: 'list', view_name: 'John Smith Outstanding Invoices' }],
    automations: [
      {
        automation_type: 'scheduled',
        automation_name: 'Email john.smith@acme.co.uk daily',
        run_count: 5,
      },
    ],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AnonymisationService', () => {
  // ── deriveModule ─────────────────────────────────────────────────────────

  describe('deriveModule', () => {
    it.each([
      ['create_invoice', 'ar'],
      ['apply_credit_note', 'ar'],
      ['create_customer', 'ar'],
      ['process_payment', 'ap'],
      ['create_supplier', 'ap'],
      ['create_purchase_order', 'purchasing'],
      ['journal_entry', 'finance'],
      ['post_journal', 'finance'],
      ['account_lookup', 'finance'],
      ['vat_return', 'finance'],
      ['create_order', 'sales'],
      ['create_quote', 'sales'],
      ['check_stock', 'inventory'],
      ['add_contact', 'crm'],
      ['employee_report', 'hr'],
      ['create_bom', 'manufacturing'],
      ['generate_report', 'reporting'],
      ['apply_filter', 'system'],
      ['save_view', 'system'],
    ])('maps "%s" → "%s"', (skillKey, expectedModule) => {
      expect(deriveModule(skillKey)).toBe(expectedModule);
    });

    it('returns "other" for unknown skill keys', () => {
      expect(deriveModule('custom_workflow')).toBe('other');
      expect(deriveModule('unknown_skill')).toBe('other');
    });
  });

  // ── anonymiseUsagePatterns ───────────────────────────────────────────────

  describe('anonymiseUsagePatterns', () => {
    it('produces correct queryCategories from learning signals', () => {
      const raw = makeTenantRawData();
      const result = anonymiseUsagePatterns(raw);

      // create_invoice → ar (45), apply_filter → system (89), journal_entry → finance (30)
      expect(result.queryCategories).toEqual({
        ar: 45,
        system: 89,
        finance: 30,
      });
    });

    it('produces correct skillUsage counts', () => {
      const raw = makeTenantRawData();
      const result = anonymiseUsagePatterns(raw);

      expect(result.skillUsage).toEqual({
        create_invoice: 45,
        apply_filter: 89,
        journal_entry: 30,
      });
    });

    it('aggregates duplicate skill keys', () => {
      const raw = makeTenantRawData({
        learningSignals: [
          {
            skill_key: 'create_invoice',
            total_queries: 20,
            success_count: 18,
            correction_count: 2,
            avg_confidence: 0.9,
          },
          {
            skill_key: 'create_invoice',
            total_queries: 25,
            success_count: 22,
            correction_count: 3,
            avg_confidence: 0.88,
          },
        ],
      });
      const result = anonymiseUsagePatterns(raw);

      expect(result.skillUsage).toEqual({ create_invoice: 45 });
      expect(result.queryCategories).toEqual({ ar: 45 });
    });

    it('strips view names — only keeps boolean type flags', () => {
      const raw = makeTenantRawData();
      const result = anonymiseUsagePatterns(raw);

      // Only types as boolean flags, no view names
      expect(result.viewPatterns).toEqual({
        list: true,
        kanban: true,
      });

      // Verify no PII leaked into output
      const output = JSON.stringify(result.viewPatterns);
      expect(output).not.toContain('John');
      expect(output).not.toContain('Sales Pipeline');
    });

    it('strips automation names — only keeps type counts', () => {
      const raw = makeTenantRawData();
      const result = anonymiseUsagePatterns(raw);

      expect(result.automationUsage).toEqual({
        scheduled: 12,
        event_driven: 45,
      });

      // Verify no PII leaked into output
      const output = JSON.stringify(result.automationUsage);
      expect(output).not.toContain('Acme');
      expect(output).not.toContain('VAT Report');
      expect(output).not.toContain('Customer');
    });

    it('handles empty data gracefully', () => {
      const raw: TenantRawData = {
        learningSignals: [],
        corrections: [],
        views: [],
        automations: [],
      };
      const result = anonymiseUsagePatterns(raw);

      expect(result.queryCategories).toEqual({});
      expect(result.skillUsage).toEqual({});
      expect(result.viewPatterns).toEqual({});
      expect(result.automationUsage).toEqual({});
    });

    it('handles undefined arrays gracefully', () => {
      const raw = {} as TenantRawData;
      const result = anonymiseUsagePatterns(raw);

      expect(result.queryCategories).toEqual({});
      expect(result.skillUsage).toEqual({});
      expect(result.viewPatterns).toEqual({});
      expect(result.automationUsage).toEqual({});
    });

    it('PII from raw data never appears in anonymised output', () => {
      const raw = makeRawDataWithPii();
      const result = anonymiseUsagePatterns(raw);

      const output = JSON.stringify(result);
      // No entity names
      expect(output).not.toContain('John Smith');
      expect(output).not.toContain('john.smith');
      expect(output).not.toContain('acme');
      // No email addresses
      expect(output).not.toContain('@');
      // No free-text automation descriptions
      expect(output).not.toContain('Email');
      expect(output).not.toContain('daily');
    });

    it('handles large datasets without error', () => {
      const signals = Array.from({ length: 10_000 }, (_, i) => ({
        skill_key: `skill_${i % 50}`,
        total_queries: i + 1,
        success_count: i,
        correction_count: 1,
        avg_confidence: 0.85,
      }));
      const raw = makeTenantRawData({ learningSignals: signals });
      const result = anonymiseUsagePatterns(raw);

      // Should produce 50 unique skill keys
      expect(Object.keys(result.skillUsage)).toHaveLength(50);
    });
  });

  // ── anonymiseCorrectionPatterns ─────────────────────────────────────────

  describe('anonymiseCorrectionPatterns', () => {
    it('strips verbatim text and returns only type/skill/count', () => {
      const corrections: RawCorrectionEntry[] = [
        { correction_type: 'wrong_vat_code', skill_key: 'create_invoice', count: 5 },
        { correction_type: 'wrong_account', skill_key: 'journal_entry', count: 3 },
      ];
      const result = anonymiseCorrectionPatterns(corrections);

      expect(result.corrections).toHaveLength(2);
      expect(result.corrections[0]).toEqual({
        correctionType: 'wrong_vat_code',
        skillKey: 'create_invoice',
        occurrenceCount: 5,
        commonCorrection: 'Tenants correct VAT code suggestions (5 occurrences)',
      });
      expect(result.corrections[1]).toEqual({
        correctionType: 'wrong_account',
        skillKey: 'journal_entry',
        occurrenceCount: 3,
        commonCorrection: 'Tenants correct account code suggestions (3 occurrences)',
      });
    });

    it('handles null skill_key', () => {
      const corrections: RawCorrectionEntry[] = [
        { correction_type: 'irrelevant_response', skill_key: null, count: 7 },
      ];
      const result = anonymiseCorrectionPatterns(corrections);

      expect(result.corrections[0]!.skillKey).toBeNull();
      expect(result.corrections[0]!.correctionType).toBe('irrelevant_response');
    });

    it('returns empty array for empty input', () => {
      expect(anonymiseCorrectionPatterns([])).toEqual({ corrections: [] });
    });

    it('returns empty array for null/undefined input', () => {
      expect(anonymiseCorrectionPatterns(null as unknown as RawCorrectionEntry[])).toEqual({
        corrections: [],
      });
      expect(anonymiseCorrectionPatterns(undefined as unknown as RawCorrectionEntry[])).toEqual({
        corrections: [],
      });
    });

    it('never contains raw correction text in output', () => {
      const corrections: RawCorrectionEntry[] = [
        { correction_type: 'wrong_vat_code', skill_key: 'create_invoice', count: 5 },
      ];
      const result = anonymiseCorrectionPatterns(corrections);
      const output = JSON.stringify(result);

      // The commonCorrection should be a generated template, not raw text
      expect(output).toContain('Tenants correct VAT code suggestions');
      expect(output).not.toContain('originalResponse');
      expect(output).not.toContain('correctedResponse');
    });
  });

  // ── generateCorrectionSummary ──────────────────────────────────────────

  describe('generateCorrectionSummary', () => {
    it('uses known template for recognised correction types', () => {
      expect(generateCorrectionSummary('wrong_vat_code', 10)).toBe(
        'Tenants correct VAT code suggestions (10 occurrences)',
      );
      expect(generateCorrectionSummary('wrong_account', 3)).toBe(
        'Tenants correct account code suggestions (3 occurrences)',
      );
      expect(generateCorrectionSummary('missing_field', 7)).toBe(
        'Tenants add missing fields to AI responses (7 occurrences)',
      );
    });

    it('generates a fallback for unknown correction types', () => {
      const result = generateCorrectionSummary('custom_error_type', 15);
      expect(result).toBe('Tenants correct custom error type suggestions (15 occurrences)');
    });

    it('never contains raw text — always uses templates', () => {
      const knownTypes = [
        'wrong_field_value',
        'wrong_account',
        'wrong_vat_code',
        'wrong_category',
        'missing_field',
        'wrong_format',
        'wrong_calculation',
        'wrong_reference',
        'wrong_date',
        'irrelevant_response',
      ];

      for (const type of knownTypes) {
        const summary = generateCorrectionSummary(type, 1);
        expect(summary).toMatch(/^Tenants /);
        expect(summary).toContain('(1 occurrences)');
      }
    });
  });

  // ── validateNoPersonalData ─────────────────────────────────────────────

  describe('validateNoPersonalData', () => {
    it('returns valid for clean anonymised data', () => {
      const cleanData = {
        queryCategories: { ar: 45, finance: 30 },
        skillUsage: { create_invoice: 45 },
        viewPatterns: { list: true, kanban: true },
        automationUsage: { scheduled: 12 },
      };
      const result = validateNoPersonalData(cleanData);
      expect(result.valid).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it('detects email addresses', () => {
      const data = {
        description: 'Contact john.smith@example.com for details',
      };
      const result = validateNoPersonalData(data);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toContain('Email detected');
    });

    it('detects UK phone numbers with +44 prefix', () => {
      const data = { phone: '+442012345678' };
      const result = validateNoPersonalData(data);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('UK phone'))).toBe(true);
    });

    it('detects UK phone numbers with 0 prefix', () => {
      const data = { phone: '02012345678' };
      const result = validateNoPersonalData(data);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('UK phone'))).toBe(true);
    });

    it('detects GBP currency amounts', () => {
      const data = { amount: 'Total: £1,234.56' };
      const result = validateNoPersonalData(data);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('Currency amount'))).toBe(true);
    });

    it('detects USD currency amounts', () => {
      const data = { price: 'Price: $99.99' };
      const result = validateNoPersonalData(data);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('Currency amount'))).toBe(true);
    });

    it('detects EUR currency amounts', () => {
      const data = { value: 'Value: €500.00' };
      const result = validateNoPersonalData(data);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('Currency amount'))).toBe(true);
    });

    it('detects UUIDs in non-ID text fields', () => {
      const data = {
        description: 'Linked to entity 550e8400-e29b-41d4-a716-446655440000',
      };
      const result = validateNoPersonalData(data);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('UUID in non-ID'))).toBe(true);
    });

    it('allows UUIDs in ID fields', () => {
      const data = {
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        skillKey: 'create_invoice',
      };
      const result = validateNoPersonalData(data);
      expect(result.valid).toBe(true);
    });

    it('detects capitalised name pairs (person names)', () => {
      const data = {
        note: 'Approved by John Smith for processing',
      };
      const result = validateNoPersonalData(data);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('person name'))).toBe(true);
    });

    it('allows safe patterns starting with "Tenants "', () => {
      const data = {
        commonCorrection: 'Tenants correct VAT code suggestions (5 occurrences)',
      };
      const result = validateNoPersonalData(data);
      // "Tenants correct" would match the person name pattern, but is safe
      expect(result.valid).toBe(true);
    });

    it('detects multiple violations in nested structures', () => {
      const data = {
        corrections: [
          { text: 'Email: user@company.co.uk' },
          { text: 'Call +442071234567 for help' },
          { amount: 'Invoice total: £5,000.00' },
        ],
      };
      const result = validateNoPersonalData(data);
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(3);
    });

    it('handles null and undefined values safely', () => {
      const result1 = validateNoPersonalData(null);
      expect(result1.valid).toBe(true);

      const result2 = validateNoPersonalData(undefined);
      expect(result2.valid).toBe(true);

      const result3 = validateNoPersonalData({ a: null, b: undefined, c: 'ok' });
      expect(result3.valid).toBe(true);
    });

    it('handles deeply nested objects', () => {
      const data = {
        level1: {
          level2: {
            level3: {
              email: 'hidden@deep.com',
            },
          },
        },
      };
      const result = validateNoPersonalData(data);
      expect(result.valid).toBe(false);
      expect(result.violations[0]).toContain('level1.level2.level3.email');
    });

    it('handles arrays with PII', () => {
      const data = {
        items: ['clean text', 'user@example.com', 'more clean text'],
      };
      const result = validateNoPersonalData(data);
      expect(result.valid).toBe(false);
      expect(result.violations[0]).toContain('items[1]');
    });

    it('ignores short strings (< 3 chars)', () => {
      const data = { code: 'UK', tier: 'P1', flag: 'Y' };
      const result = validateNoPersonalData(data);
      expect(result.valid).toBe(true);
    });

    it('masks PII values in violation messages', () => {
      const data = { email: 'john.smith@example.com' };
      const result = validateNoPersonalData(data);
      expect(result.valid).toBe(false);
      // Should NOT contain the full email in the violation message
      expect(result.violations[0]).not.toContain('john.smith@example.com');
      // Should contain a masked version
      expect(result.violations[0]).toContain('john***');
    });
  });

  // ── End-to-end: anonymise then validate ────────────────────────────────

  describe('end-to-end: anonymise → validate', () => {
    it('anonymised usage patterns pass PII validation', () => {
      const raw = makeRawDataWithPii();
      const anonymised = anonymiseUsagePatterns(raw);
      const validation = validateNoPersonalData(anonymised);

      expect(validation.valid).toBe(true);
      expect(validation.violations).toEqual([]);
    });

    it('anonymised corrections pass PII validation', () => {
      const corrections: RawCorrectionEntry[] = [
        { correction_type: 'wrong_vat_code', skill_key: 'create_invoice', count: 5 },
        { correction_type: 'wrong_account', skill_key: null, count: 3 },
      ];
      const anonymised = anonymiseCorrectionPatterns(corrections);
      const validation = validateNoPersonalData(anonymised);

      expect(validation.valid).toBe(true);
      expect(validation.violations).toEqual([]);
    });

    it('raw data with PII fails validation if not anonymised', () => {
      const raw = makeRawDataWithPii();
      // Pass raw data directly to validation (without anonymisation)
      const validation = validateNoPersonalData(raw);

      // Should detect PII in the raw view_name and automation_name fields
      expect(validation.valid).toBe(false);
      expect(validation.violations.length).toBeGreaterThan(0);
    });

    it('full pipeline: raw → anonymise → validate for all data types', () => {
      const raw = makeTenantRawData();
      const patterns = anonymiseUsagePatterns(raw);
      const corrections = anonymiseCorrectionPatterns(raw.corrections);

      const patternsValidation = validateNoPersonalData(patterns);
      const correctionsValidation = validateNoPersonalData(corrections);

      expect(patternsValidation.valid).toBe(true);
      expect(correctionsValidation.valid).toBe(true);
    });
  });
});
