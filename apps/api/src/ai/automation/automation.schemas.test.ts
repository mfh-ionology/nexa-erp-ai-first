// ---------------------------------------------------------------------------
// Zod schema validation tests for variable CRUD schemas (E5c-2 Task 9.7)
// Tests sourceConfig shape validation per sourceType.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import {
  createVariableSchema,
  updateVariableSchema,
  testResolveSchema,
} from './automation.schemas.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

// Valid v4 UUIDs (Zod 4 enforces RFC 4122 variant/version bits)
const VALID_UUID_1 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

function makeValidVariable(sourceType: string, sourceConfig: Record<string, unknown>) {
  return {
    promptId: VALID_UUID_1,
    variableName: 'testVar',
    displayName: 'Test Variable',
    sourceType,
    sourceConfig,
    isRequired: false,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Variable CRUD Schemas', () => {
  describe('createVariableSchema', () => {
    describe('variableName validation', () => {
      it('accepts valid variable names', () => {
        const valid = ['company.name', 'today', 'currentUser.role', 'my_var', 'a1'];
        for (const name of valid) {
          createVariableSchema.safeParse(makeValidVariable('CONSTANT', { value: 'x' }));
          // Rebuild with specific name
          const res = createVariableSchema.safeParse({
            ...makeValidVariable('CONSTANT', { value: 'x' }),
            variableName: name,
          });
          expect(res.success, `Expected '${name}' to be valid`).toBe(true);
        }
      });

      it('rejects variable names starting with a number', () => {
        const result = createVariableSchema.safeParse({
          ...makeValidVariable('CONSTANT', { value: 'x' }),
          variableName: '1invalid',
        });
        expect(result.success).toBe(false);
      });

      it('rejects variable names with special characters', () => {
        const result = createVariableSchema.safeParse({
          ...makeValidVariable('CONSTANT', { value: 'x' }),
          variableName: 'var-name',
        });
        expect(result.success).toBe(false);
      });

      it('rejects empty variable name', () => {
        const result = createVariableSchema.safeParse({
          ...makeValidVariable('CONSTANT', { value: 'x' }),
          variableName: '',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('DB_FIELD sourceConfig validation', () => {
      it('accepts valid DB_FIELD config with table and field', () => {
        const result = createVariableSchema.safeParse(
          makeValidVariable('DB_FIELD', { table: 'customer', field: 'name' }),
        );
        expect(result.success).toBe(true);
      });

      it('accepts DB_FIELD config with optional relation', () => {
        const result = createVariableSchema.safeParse(
          makeValidVariable('DB_FIELD', {
            table: 'customer',
            field: 'email',
            relation: 'primaryContact',
          }),
        );
        expect(result.success).toBe(true);
      });

      it('rejects DB_FIELD config missing table', () => {
        const result = createVariableSchema.safeParse(
          makeValidVariable('DB_FIELD', { field: 'name' }),
        );
        expect(result.success).toBe(false);
        if (!result.success) {
          const tableIssue = result.error.issues.find((i) => i.path.includes('table'));
          expect(tableIssue).toBeDefined();
        }
      });

      it('rejects DB_FIELD config missing field', () => {
        const result = createVariableSchema.safeParse(
          makeValidVariable('DB_FIELD', { table: 'customer' }),
        );
        expect(result.success).toBe(false);
        if (!result.success) {
          const fieldIssue = result.error.issues.find((i) => i.path.includes('field'));
          expect(fieldIssue).toBeDefined();
        }
      });
    });

    describe('DB_QUERY sourceConfig validation', () => {
      it('accepts valid DB_QUERY config with SELECT query', () => {
        const result = createVariableSchema.safeParse(
          makeValidVariable('DB_QUERY', {
            query: 'SELECT COUNT(*) FROM customers WHERE company_id = :companyId',
          }),
        );
        expect(result.success).toBe(true);
      });

      it('rejects DB_QUERY config missing query', () => {
        const result = createVariableSchema.safeParse(makeValidVariable('DB_QUERY', {}));
        expect(result.success).toBe(false);
      });

      it('rejects DB_QUERY config with non-SELECT query', () => {
        const result = createVariableSchema.safeParse(
          makeValidVariable('DB_QUERY', { query: 'DELETE FROM customers' }),
        );
        expect(result.success).toBe(false);
      });

      it('rejects DB_QUERY with INSERT query', () => {
        const result = createVariableSchema.safeParse(
          makeValidVariable('DB_QUERY', { query: 'INSERT INTO customers VALUES (1)' }),
        );
        expect(result.success).toBe(false);
      });
    });

    describe('PAGE_FIELD sourceConfig validation', () => {
      it('accepts valid PAGE_FIELD config with field', () => {
        const result = createVariableSchema.safeParse(
          makeValidVariable('PAGE_FIELD', { field: 'currentPage.selectedFilters' }),
        );
        expect(result.success).toBe(true);
      });

      it('rejects PAGE_FIELD config missing field', () => {
        const result = createVariableSchema.safeParse(makeValidVariable('PAGE_FIELD', {}));
        expect(result.success).toBe(false);
      });
    });

    describe('SYSTEM sourceConfig validation', () => {
      it('accepts valid SYSTEM config with known key', () => {
        const knownKeys = [
          'today',
          'currentUser.name',
          'currentUser.role',
          'currentUser.id',
          'company.name',
          'company.baseCurrency',
          'company.defaultCurrency',
          'company.id',
        ];

        for (const sysKey of knownKeys) {
          const result = createVariableSchema.safeParse(
            makeValidVariable('SYSTEM', { key: sysKey }),
          );
          expect(result.success, `Expected '${sysKey}' to be accepted`).toBe(true);
        }
      });

      it('rejects SYSTEM config with unknown key', () => {
        const result = createVariableSchema.safeParse(
          makeValidVariable('SYSTEM', { key: 'nonexistent.key' }),
        );
        expect(result.success).toBe(false);
      });

      it('rejects SYSTEM config missing key', () => {
        const result = createVariableSchema.safeParse(makeValidVariable('SYSTEM', {}));
        expect(result.success).toBe(false);
      });
    });

    describe('CONSTANT sourceConfig validation', () => {
      it('accepts valid CONSTANT config with value', () => {
        const result = createVariableSchema.safeParse(
          makeValidVariable('CONSTANT', { value: 'hello world' }),
        );
        expect(result.success).toBe(true);
      });

      it('accepts CONSTANT config with numeric value', () => {
        const result = createVariableSchema.safeParse(makeValidVariable('CONSTANT', { value: 42 }));
        expect(result.success).toBe(true);
      });

      it('rejects CONSTANT config missing value', () => {
        const result = createVariableSchema.safeParse(makeValidVariable('CONSTANT', {}));
        expect(result.success).toBe(false);
      });
    });

    describe('EXPRESSION sourceConfig validation', () => {
      it('accepts valid EXPRESSION config with expression', () => {
        const result = createVariableSchema.safeParse(
          makeValidVariable('EXPRESSION', { expression: 'today - 30 days' }),
        );
        expect(result.success).toBe(true);
      });

      it('rejects EXPRESSION config missing expression', () => {
        const result = createVariableSchema.safeParse(makeValidVariable('EXPRESSION', {}));
        expect(result.success).toBe(false);
      });
    });

    describe('PREVIOUS_STEP sourceConfig validation', () => {
      it('accepts valid PREVIOUS_STEP config with stepOrder', () => {
        const result = createVariableSchema.safeParse(
          makeValidVariable('PREVIOUS_STEP', { stepOrder: 1, jsonPath: 'output.count' }),
        );
        expect(result.success).toBe(true);
      });

      it('rejects PREVIOUS_STEP config with stepOrder < 1', () => {
        const result = createVariableSchema.safeParse(
          makeValidVariable('PREVIOUS_STEP', { stepOrder: 0 }),
        );
        expect(result.success).toBe(false);
      });

      it('rejects PREVIOUS_STEP config missing stepOrder', () => {
        const result = createVariableSchema.safeParse(makeValidVariable('PREVIOUS_STEP', {}));
        expect(result.success).toBe(false);
      });
    });

    describe('general validation', () => {
      it('rejects invalid sourceType', () => {
        const result = createVariableSchema.safeParse(
          makeValidVariable('INVALID_TYPE' as any, { value: 'x' }),
        );
        expect(result.success).toBe(false);
      });

      it('requires promptId to be a UUID', () => {
        const result = createVariableSchema.safeParse({
          ...makeValidVariable('CONSTANT', { value: 'x' }),
          promptId: 'not-a-uuid',
        });
        expect(result.success).toBe(false);
      });

      it('defaults isRequired to false', () => {
        const input = { ...makeValidVariable('CONSTANT', { value: 'x' }) };
        delete (input as any).isRequired;
        const result = createVariableSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.isRequired).toBe(false);
        }
      });
    });
  });

  describe('updateVariableSchema', () => {
    it('accepts partial updates', () => {
      const result = updateVariableSchema.safeParse({
        displayName: 'Updated Name',
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty object (no changes)', () => {
      const result = updateVariableSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts nullable description', () => {
      const result = updateVariableSchema.safeParse({
        description: null,
      });
      expect(result.success).toBe(true);
    });

    it('accepts nullable defaultValue', () => {
      const result = updateVariableSchema.safeParse({
        defaultValue: null,
      });
      expect(result.success).toBe(true);
    });

    it('validates variableName format when provided', () => {
      const result = updateVariableSchema.safeParse({
        variableName: '123invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('testResolveSchema', () => {
    it('accepts empty body (all fields optional, companyId comes from auth context)', () => {
      const result = testResolveSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts full test context with all optional fields', () => {
      const result = testResolveSchema.safeParse({
        userId: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789',
        userName: 'John',
        userRole: 'ADMIN',
        companyName: 'Acme',
        baseCurrency: 'GBP',
        defaultCurrency: 'USD',
        pageContext: { filters: { status: 'ACTIVE' } },
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid userId format', () => {
      const result = testResolveSchema.safeParse({
        userId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });
  });
});
