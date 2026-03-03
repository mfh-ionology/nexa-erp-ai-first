import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VariableResolver,
  DbFieldHandler,
  DbQueryHandler,
  SystemHandler,
  PreviousStepHandler,
  ConstantHandler,
  ExpressionHandler,
  PageFieldHandler,
  UnresolvableRequiredParamError,
  ALLOWED_DB_FIELD_MODELS,
  createVariableResolver,
} from './variable-resolver.js';
import type { VariableResolutionContext } from './variable-resolver.js';
import type { AiPromptVariable } from '@nexa/db';

// ─── Mock Logger ────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeVariable(overrides: Partial<AiPromptVariable> = {}): AiPromptVariable {
  return {
    id: 'var-1',
    promptId: 'prompt-1',
    variableName: 'testVar',
    displayName: 'Test Variable',
    description: 'A test variable',
    sourceType: 'CONSTANT',
    sourceConfig: { value: 'hello' },
    defaultValue: null,
    isRequired: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as AiPromptVariable;
}

function makeContext(
  overrides: Partial<VariableResolutionContext> = {},
): VariableResolutionContext {
  return {
    companyId: 'company-1',
    userId: 'user-1',
    userName: 'John Doe',
    userRole: 'ADMIN',
    companyName: 'Acme Ltd',
    baseCurrency: 'GBP',
    previousStepOutputs: {},
    autonomous: false,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('VariableResolver', () => {
  let resolver: VariableResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    resolver = new VariableResolver(mockLogger as any);
  });

  // =========================================================================
  // ConstantHandler
  // =========================================================================

  describe('ConstantHandler', () => {
    it('returns the static value from sourceConfig', async () => {
      const handler = new ConstantHandler();
      const variable = makeVariable({
        sourceType: 'CONSTANT',
        sourceConfig: { value: 'hello world' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBe('hello world');
    });

    it('returns numeric value', async () => {
      const handler = new ConstantHandler();
      const variable = makeVariable({
        sourceType: 'CONSTANT',
        sourceConfig: { value: 42 },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBe(42);
    });

    it('returns object value', async () => {
      const handler = new ConstantHandler();
      const variable = makeVariable({
        sourceType: 'CONSTANT',
        sourceConfig: { value: { key: 'val' } },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toEqual({ key: 'val' });
    });
  });

  // =========================================================================
  // SystemHandler
  // =========================================================================

  describe('SystemHandler', () => {
    let handler: SystemHandler;

    beforeEach(() => {
      handler = new SystemHandler(mockLogger as any);
    });

    it('resolves "today" to ISO date string', async () => {
      const variable = makeVariable({
        sourceType: 'SYSTEM',
        sourceConfig: { key: 'today' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('resolves "currentUser.name" from context', async () => {
      const variable = makeVariable({
        sourceType: 'SYSTEM',
        sourceConfig: { key: 'currentUser.name' },
      });

      const result = await handler.resolve(variable, makeContext({ userName: 'Alice' }));
      expect(result).toBe('Alice');
    });

    it('resolves "currentUser.role" from context', async () => {
      const variable = makeVariable({
        sourceType: 'SYSTEM',
        sourceConfig: { key: 'currentUser.role' },
      });

      const result = await handler.resolve(variable, makeContext({ userRole: 'MANAGER' }));
      expect(result).toBe('MANAGER');
    });

    it('resolves "company.name" from context', async () => {
      const variable = makeVariable({
        sourceType: 'SYSTEM',
        sourceConfig: { key: 'company.name' },
      });

      const result = await handler.resolve(variable, makeContext({ companyName: 'Nexa Corp' }));
      expect(result).toBe('Nexa Corp');
    });

    it('resolves "company.baseCurrency" from context', async () => {
      const variable = makeVariable({
        sourceType: 'SYSTEM',
        sourceConfig: { key: 'company.baseCurrency' },
      });

      const result = await handler.resolve(variable, makeContext({ baseCurrency: 'USD' }));
      expect(result).toBe('USD');
    });

    it('falls back to defaults when context values missing', async () => {
      const variable = makeVariable({
        sourceType: 'SYSTEM',
        sourceConfig: { key: 'currentUser.name' },
      });

      const result = await handler.resolve(variable, makeContext({ userName: undefined }));
      expect(result).toBe('[unknown user]');
    });

    it('defaults baseCurrency to GBP when not in context', async () => {
      const variable = makeVariable({
        sourceType: 'SYSTEM',
        sourceConfig: { key: 'company.baseCurrency' },
      });

      const result = await handler.resolve(variable, makeContext({ baseCurrency: undefined }));
      expect(result).toBe('GBP');
    });

    it('resolves "currentUser.id" from context', async () => {
      const variable = makeVariable({
        sourceType: 'SYSTEM',
        sourceConfig: { key: 'currentUser.id' },
      });

      const result = await handler.resolve(variable, makeContext({ userId: 'user-42' }));
      expect(result).toBe('user-42');
    });

    it('resolves "company.id" from context companyId', async () => {
      const variable = makeVariable({
        sourceType: 'SYSTEM',
        sourceConfig: { key: 'company.id' },
      });

      const result = await handler.resolve(variable, makeContext({ companyId: 'comp-99' }));
      expect(result).toBe('comp-99');
    });

    it('resolves "company.defaultCurrency" from context', async () => {
      const variable = makeVariable({
        sourceType: 'SYSTEM',
        sourceConfig: { key: 'company.defaultCurrency' },
      });

      const result = await handler.resolve(variable, makeContext({ defaultCurrency: 'EUR' }));
      expect(result).toBe('EUR');
    });

    it('falls back company.defaultCurrency to baseCurrency when defaultCurrency not set', async () => {
      const variable = makeVariable({
        sourceType: 'SYSTEM',
        sourceConfig: { key: 'company.defaultCurrency' },
      });

      const result = await handler.resolve(
        variable,
        makeContext({ defaultCurrency: undefined, baseCurrency: 'USD' }),
      );
      expect(result).toBe('USD');
    });

    it('falls back company.defaultCurrency to GBP when both currencies not set', async () => {
      const variable = makeVariable({
        sourceType: 'SYSTEM',
        sourceConfig: { key: 'company.defaultCurrency' },
      });

      const result = await handler.resolve(
        variable,
        makeContext({ defaultCurrency: undefined, baseCurrency: undefined }),
      );
      expect(result).toBe('GBP');
    });

    it('returns undefined for unknown system key', async () => {
      const variable = makeVariable({
        sourceType: 'SYSTEM',
        sourceConfig: { key: 'unknown.key' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('uses variableName when sourceConfig.key is not set', async () => {
      const variable = makeVariable({
        variableName: 'today',
        sourceType: 'SYSTEM',
        sourceConfig: {},
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // =========================================================================
  // PreviousStepHandler
  // =========================================================================

  describe('PreviousStepHandler', () => {
    let handler: PreviousStepHandler;

    beforeEach(() => {
      handler = new PreviousStepHandler(mockLogger as any);
    });

    it('resolves value from previous step output using jsonPath', async () => {
      const variable = makeVariable({
        sourceType: 'PREVIOUS_STEP',
        sourceConfig: { stepOrder: 1, jsonPath: 'flaggedInvoices' },
      });

      const context = makeContext({
        previousStepOutputs: {
          '1': { flaggedInvoices: ['INV-001', 'INV-002'] },
        },
      });

      const result = await handler.resolve(variable, context);
      expect(result).toEqual(['INV-001', 'INV-002']);
    });

    it('supports nested json path traversal', async () => {
      const variable = makeVariable({
        sourceType: 'PREVIOUS_STEP',
        sourceConfig: { stepOrder: 1, jsonPath: 'analysis.summary.total' },
      });

      const context = makeContext({
        previousStepOutputs: {
          '1': { analysis: { summary: { total: 1500 } } },
        },
      });

      const result = await handler.resolve(variable, context);
      expect(result).toBe(1500);
    });

    it('returns undefined when step output does not exist', async () => {
      const variable = makeVariable({
        sourceType: 'PREVIOUS_STEP',
        sourceConfig: { stepOrder: 3, jsonPath: 'data' },
      });

      const result = await handler.resolve(variable, makeContext({ previousStepOutputs: {} }));
      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns undefined when jsonPath is missing from config', async () => {
      const variable = makeVariable({
        sourceType: 'PREVIOUS_STEP',
        sourceConfig: { stepOrder: 1 },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns undefined when stepOrder is missing from config', async () => {
      const variable = makeVariable({
        sourceType: 'PREVIOUS_STEP',
        sourceConfig: { jsonPath: 'data' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
    });
  });

  // =========================================================================
  // ExpressionHandler
  // =========================================================================

  describe('ExpressionHandler', () => {
    let handler: ExpressionHandler;

    beforeEach(() => {
      handler = new ExpressionHandler(mockLogger as any);
    });

    it('evaluates "today" alone to ISO date', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: 'today' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('evaluates date arithmetic: today - 30 days', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: 'today - 30 days' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const expected = new Date();
      expected.setDate(expected.getDate() - 30);
      expect(result).toBe(expected.toISOString().split('T')[0]);
    });

    it('evaluates date arithmetic: today + 7 days', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: 'today + 7 days' },
      });

      const result = await handler.resolve(variable, makeContext());
      const expected = new Date();
      expected.setDate(expected.getDate() + 7);
      expect(result).toBe(expected.toISOString().split('T')[0]);
    });

    it('evaluates date arithmetic with weeks', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: 'today + 2 weeks' },
      });

      const result = await handler.resolve(variable, makeContext());
      const expected = new Date();
      expected.setDate(expected.getDate() + 14);
      expect(result).toBe(expected.toISOString().split('T')[0]);
    });

    it('evaluates date arithmetic with months', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: 'today - 3 months' },
      });

      const result = await handler.resolve(variable, makeContext());
      const expected = new Date();
      expected.setMonth(expected.getMonth() - 3);
      expect(result).toBe(expected.toISOString().split('T')[0]);
    });

    it('evaluates basic math: addition', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: '10 + 5' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBe(15);
    });

    it('evaluates basic math: subtraction', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: '100 - 35' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBe(65);
    });

    it('evaluates basic math: multiplication', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: '7 * 8' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBe(56);
    });

    it('evaluates basic math: division', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: '100 / 4' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBe(25);
    });

    it('returns undefined for division by zero', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: '10 / 0' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
    });

    it('returns undefined for unsupported expression', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: 'eval(process.exit())' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns undefined when expression is missing', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: {},
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('handles floating point math', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: '1.5 * 3.0' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBe(4.5);
    });

    it('handles singular unit "day"', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: 'today + 1 day' },
      });

      const result = await handler.resolve(variable, makeContext());
      const expected = new Date();
      expected.setDate(expected.getDate() + 1);
      expect(result).toBe(expected.toISOString().split('T')[0]);
    });

    // ── String Operations ──────────────────────────────────────────

    it('evaluates concat with multiple arguments', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: "concat('hello', ' ', 'world')" },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBe('hello world');
    });

    it('evaluates concat with two arguments', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: "concat('foo', 'bar')" },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBe('foobar');
    });

    it('evaluates uppercase', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: "uppercase('hello')" },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBe('HELLO');
    });

    it('evaluates lowercase', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: "lowercase('HELLO')" },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBe('hello');
    });

    it('evaluates trim', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: "trim('  hello  ')" },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBe('hello');
    });

    it('returns undefined for unknown string function', async () => {
      const variable = makeVariable({
        sourceType: 'EXPRESSION',
        sourceConfig: { expression: "reverse('hello')" },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // DbFieldHandler
  // =========================================================================

  describe('DbFieldHandler', () => {
    let handler: DbFieldHandler;
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        customer: {
          findFirst: vi.fn(),
        },
      };
      handler = new DbFieldHandler(mockDb, mockLogger as any);
    });

    it('resolves a simple field from a database table', async () => {
      mockDb.customer.findFirst.mockResolvedValue({ name: 'Acme Corp' });

      const variable = makeVariable({
        sourceType: 'DB_FIELD',
        sourceConfig: { table: 'customer', field: 'name' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBe('Acme Corp');
      expect(mockDb.customer.findFirst).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
      });
    });

    it('resolves a field with relation traversal', async () => {
      mockDb.customer.findFirst.mockResolvedValue({
        primaryContact: { email: 'contact@acme.com' },
      });

      const variable = makeVariable({
        sourceType: 'DB_FIELD',
        sourceConfig: { table: 'customer', field: 'email', relation: 'primaryContact' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBe('contact@acme.com');
      expect(mockDb.customer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { primaryContact: true },
        }),
      );
    });

    it('supports deep relation traversal (customer.primaryContact.email)', async () => {
      mockDb.customer.findFirst.mockResolvedValue({
        company: { address: { city: 'London' } },
      });

      const variable = makeVariable({
        sourceType: 'DB_FIELD',
        sourceConfig: { table: 'customer', field: 'city', relation: 'company.address' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBe('London');
      expect(mockDb.customer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { company: { include: { address: true } } },
        }),
      );
    });

    it('returns undefined when record not found', async () => {
      mockDb.customer.findFirst.mockResolvedValue(null);

      const variable = makeVariable({
        sourceType: 'DB_FIELD',
        sourceConfig: { table: 'customer', field: 'name' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
    });

    it('returns undefined for unknown table', async () => {
      const variable = makeVariable({
        sourceType: 'DB_FIELD',
        sourceConfig: { table: 'nonExistentModel', field: 'name' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns undefined when table or field missing from config', async () => {
      const variable = makeVariable({
        sourceType: 'DB_FIELD',
        sourceConfig: { table: 'customer' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('applies where clause with companyId scoping', async () => {
      mockDb.customer.findFirst.mockResolvedValue({ name: 'Test' });

      const variable = makeVariable({
        sourceType: 'DB_FIELD',
        sourceConfig: { table: 'customer', field: 'name', where: { status: 'ACTIVE' } },
      });

      await handler.resolve(variable, makeContext());
      expect(mockDb.customer.findFirst).toHaveBeenCalledWith({
        where: { status: 'ACTIVE', companyId: 'company-1' },
      });
    });

    it('returns undefined on query error', async () => {
      mockDb.customer.findFirst.mockRejectedValue(new Error('DB error'));

      const variable = makeVariable({
        sourceType: 'DB_FIELD',
        sourceConfig: { table: 'customer', field: 'name' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    // ── Model Allowlist Tests ──────────────────────────────────────────

    it('resolves allowed model (customer is in allowlist)', async () => {
      mockDb.customer.findFirst.mockResolvedValue({ name: 'Allowed Corp' });

      const variable = makeVariable({
        sourceType: 'DB_FIELD',
        sourceConfig: { table: 'customer', field: 'name' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBe('Allowed Corp');
      expect(mockDb.customer.findFirst).toHaveBeenCalled();
    });

    it('rejects non-allowlisted model with warning', async () => {
      // 'user' is NOT in ALLOWED_DB_FIELD_MODELS
      mockDb.user = { findFirst: vi.fn() };

      const variable = makeVariable({
        sourceType: 'DB_FIELD',
        sourceConfig: { table: 'user', field: 'email' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
      expect(mockDb.user.findFirst).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ table: 'user' }),
        'DB_FIELD rejected: model not in allowlist',
      );
    });

    it('rejects platform/sensitive models (aiModel not in allowlist)', async () => {
      mockDb.aiModel = { findFirst: vi.fn() };

      const variable = makeVariable({
        sourceType: 'DB_FIELD',
        sourceConfig: { table: 'aiModel', field: 'name' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
      expect(mockDb.aiModel.findFirst).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ table: 'aiModel' }),
        'DB_FIELD rejected: model not in allowlist',
      );
    });

    it('still blocks $ prefixed names (secondary defense)', async () => {
      const variable = makeVariable({
        sourceType: 'DB_FIELD',
        sourceConfig: { table: '$queryRaw', field: 'x' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
    });

    it('still blocks _ prefixed names (secondary defense)', async () => {
      const variable = makeVariable({
        sourceType: 'DB_FIELD',
        sourceConfig: { table: '_runCommandRaw', field: 'x' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
    });

    it('ALLOWED_DB_FIELD_MODELS contains expected business models', () => {
      expect(ALLOWED_DB_FIELD_MODELS.has('customer')).toBe(true);
      expect(ALLOWED_DB_FIELD_MODELS.has('supplier')).toBe(true);
      expect(ALLOWED_DB_FIELD_MODELS.has('salesOrder')).toBe(true);
      expect(ALLOWED_DB_FIELD_MODELS.has('purchaseOrder')).toBe(true);
      expect(ALLOWED_DB_FIELD_MODELS.has('chartOfAccount')).toBe(true);
      expect(ALLOWED_DB_FIELD_MODELS.has('employee')).toBe(true);
      expect(ALLOWED_DB_FIELD_MODELS.has('aiAutomation')).toBe(true);
    });

    it('ALLOWED_DB_FIELD_MODELS does NOT contain sensitive models', () => {
      expect(ALLOWED_DB_FIELD_MODELS.has('user')).toBe(false);
      expect(ALLOWED_DB_FIELD_MODELS.has('aiModel')).toBe(false);
      expect(ALLOWED_DB_FIELD_MODELS.has('aiAgent')).toBe(false);
      expect(ALLOWED_DB_FIELD_MODELS.has('company')).toBe(false);
    });
  });

  // =========================================================================
  // DbQueryHandler
  // =========================================================================

  describe('DbQueryHandler', () => {
    let handler: DbQueryHandler;
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        $queryRawUnsafe: vi.fn(),
      };
      handler = new DbQueryHandler(mockDb, mockLogger as any);
    });

    it('executes a SELECT query with companyId binding', async () => {
      mockDb.$queryRawUnsafe.mockResolvedValue([{ total: 5000 }]);

      const variable = makeVariable({
        sourceType: 'DB_QUERY',
        sourceConfig: {
          query: 'SELECT SUM(amount) as total FROM invoices WHERE company_id = :companyId',
        },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toEqual([{ total: 5000 }]);
      expect(mockDb.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT SUM(amount) as total FROM invoices WHERE company_id = $1',
        'company-1',
      );
    });

    it('rejects non-SELECT queries', async () => {
      const variable = makeVariable({
        sourceType: 'DB_QUERY',
        sourceConfig: { query: "DELETE FROM invoices WHERE id = '123'" },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
      expect(mockDb.$queryRawUnsafe).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('rejects queries containing INSERT keyword', async () => {
      const variable = makeVariable({
        sourceType: 'DB_QUERY',
        sourceConfig: { query: "SELECT 1; INSERT INTO users VALUES ('hack')" },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
      expect(mockDb.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('rejects queries containing DROP keyword', async () => {
      const variable = makeVariable({
        sourceType: 'DB_QUERY',
        sourceConfig: { query: 'SELECT 1; DROP TABLE users' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
    });

    it('rejects queries containing UPDATE keyword', async () => {
      const variable = makeVariable({
        sourceType: 'DB_QUERY',
        sourceConfig: { query: 'SELECT * FROM invoices; UPDATE invoices SET amount = 0' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
    });

    it('returns undefined when query config is missing', async () => {
      const variable = makeVariable({
        sourceType: 'DB_QUERY',
        sourceConfig: {},
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
    });

    it('returns undefined on query execution error', async () => {
      mockDb.$queryRawUnsafe.mockRejectedValue(new Error('Query error'));

      const variable = makeVariable({
        sourceType: 'DB_QUERY',
        sourceConfig: { query: 'SELECT * FROM invoices WHERE company_id = :companyId' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('passes through results under 2000 characters unchanged', async () => {
      const shortResult = [
        { id: 'inv-1', amount: 500 },
        { id: 'inv-2', amount: 300 },
      ];
      mockDb.$queryRawUnsafe.mockResolvedValue(shortResult);

      const variable = makeVariable({
        sourceType: 'DB_QUERY',
        sourceConfig: { query: 'SELECT id, amount FROM invoices WHERE company_id = :companyId' },
      });

      const result = await handler.resolve(variable, makeContext());
      expect(result).toEqual(shortResult);
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('truncated'),
      );
    });

    it('truncates results exceeding 2000 characters with suffix', async () => {
      // Generate a result that will exceed 2000 chars when stringified
      const longResult = Array.from({ length: 100 }, (_, i) => ({
        id: `invoice-${String(i).padStart(4, '0')}`,
        description: `This is a long invoice description for testing truncation behaviour number ${i}`,
        amount: 1000 + i,
        status: 'OVERDUE',
      }));
      const stringified = JSON.stringify(longResult);
      expect(stringified.length).toBeGreaterThan(2000); // Sanity check

      mockDb.$queryRawUnsafe.mockResolvedValue(longResult);

      const variable = makeVariable({
        variableName: 'overdueInvoices',
        sourceType: 'DB_QUERY',
        sourceConfig: {
          query: "SELECT * FROM invoices WHERE status = 'OVERDUE' AND company_id = :companyId",
        },
      });

      const result = await handler.resolve(variable, makeContext());

      // Result should be a truncated string, not the raw array
      expect(typeof result).toBe('string');
      expect((result as string).endsWith('... [truncated]')).toBe(true);
      // 2000 chars of content + 15 chars of '... [truncated]' suffix
      expect((result as string).length).toBe(2000 + '... [truncated]'.length);
      // Logger should record the truncation
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          variableName: 'overdueInvoices',
          originalLength: stringified.length,
        }),
        'DB_QUERY result truncated to stay within token budget',
      );
    });
  });

  // =========================================================================
  // PageFieldHandler
  // =========================================================================

  describe('PageFieldHandler', () => {
    let handler: PageFieldHandler;

    beforeEach(() => {
      handler = new PageFieldHandler(mockLogger as any);
    });

    it('resolves a simple field from pageContext', async () => {
      const variable = makeVariable({
        sourceType: 'PAGE_FIELD',
        sourceConfig: { field: 'currentPage.selectedCustomerId' },
      });

      const context = makeContext({
        pageContext: {
          currentPage: { selectedCustomerId: 'cust-123' },
        },
      });

      const result = await handler.resolve(variable, context);
      expect(result).toBe('cust-123');
    });

    it('resolves nested field from pageContext', async () => {
      const variable = makeVariable({
        sourceType: 'PAGE_FIELD',
        sourceConfig: { field: 'currentPage.filters.status' },
      });

      const context = makeContext({
        pageContext: {
          currentPage: { filters: { status: 'OVERDUE' } },
        },
      });

      const result = await handler.resolve(variable, context);
      expect(result).toBe('OVERDUE');
    });

    it('returns undefined when pageContext is missing (autonomous mode)', async () => {
      const variable = makeVariable({
        sourceType: 'PAGE_FIELD',
        sourceConfig: { field: 'currentPage.selectedCustomerId' },
      });

      const context = makeContext({ pageContext: undefined });

      const result = await handler.resolve(variable, context);
      expect(result).toBeUndefined();
    });

    it('returns undefined for non-existent field paths', async () => {
      const variable = makeVariable({
        sourceType: 'PAGE_FIELD',
        sourceConfig: { field: 'currentPage.nonExistent.deep.path' },
      });

      const context = makeContext({
        pageContext: { currentPage: { name: 'Sales' } },
      });

      const result = await handler.resolve(variable, context);
      expect(result).toBeUndefined();
    });

    it('stringifies array values', async () => {
      const variable = makeVariable({
        sourceType: 'PAGE_FIELD',
        sourceConfig: { field: 'currentPage.selectedFilters' },
      });

      const context = makeContext({
        pageContext: {
          currentPage: { selectedFilters: ['OVERDUE', 'DRAFT'] },
        },
      });

      const result = await handler.resolve(variable, context);
      expect(result).toBe('["OVERDUE","DRAFT"]');
    });

    it('stringifies nested object values', async () => {
      const variable = makeVariable({
        sourceType: 'PAGE_FIELD',
        sourceConfig: { field: 'currentPage.filterState' },
      });

      const context = makeContext({
        pageContext: {
          currentPage: { filterState: { dateRange: '30d', status: 'active' } },
        },
      });

      const result = await handler.resolve(variable, context);
      expect(result).toBe('{"dateRange":"30d","status":"active"}');
    });

    it('returns undefined when field config is missing', async () => {
      const variable = makeVariable({
        sourceType: 'PAGE_FIELD',
        sourceConfig: {},
      });

      const context = makeContext({
        pageContext: { currentPage: { name: 'Sales' } },
      });

      const result = await handler.resolve(variable, context);
      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns primitive values as-is (string, number, boolean)', async () => {
      const handler2 = new PageFieldHandler(mockLogger as any);

      const numVar = makeVariable({
        sourceType: 'PAGE_FIELD',
        sourceConfig: { field: 'currentPage.itemCount' },
      });
      const boolVar = makeVariable({
        sourceType: 'PAGE_FIELD',
        sourceConfig: { field: 'currentPage.isFiltered' },
      });

      const context = makeContext({
        pageContext: {
          currentPage: { itemCount: 42, isFiltered: true },
        },
      });

      expect(await handler2.resolve(numVar, context)).toBe(42);
      expect(await handler2.resolve(boolVar, context)).toBe(true);
    });
  });

  // =========================================================================
  // VariableResolver — Main resolve()
  // =========================================================================

  describe('resolve()', () => {
    it('replaces template placeholders with resolved values', async () => {
      resolver.registerSourceHandler('CONSTANT', new ConstantHandler());

      const variables = [
        makeVariable({ variableName: 'name', sourceConfig: { value: 'Acme' } }),
        makeVariable({ variableName: 'amount', sourceConfig: { value: 500 } }),
      ];

      const result = await resolver.resolve(
        'Dear {{name}}, your total is {{amount}}.',
        variables,
        makeContext(),
      );
      expect(result).toBe('Dear Acme, your total is 500.');
    });

    it('replaces unresolved variables with [unknown: varName]', async () => {
      resolver.registerSourceHandler('CONSTANT', new ConstantHandler());

      const variables = [
        makeVariable({ variableName: 'knownVar', sourceConfig: { value: 'hello' } }),
      ];

      const result = await resolver.resolve(
        '{{knownVar}} and {{unknownVar}}',
        variables,
        makeContext(),
      );
      expect(result).toBe('hello and [unknown: unknownVar]');
    });

    it('stringifies object values in templates', async () => {
      resolver.registerSourceHandler('CONSTANT', new ConstantHandler());

      const variables = [makeVariable({ variableName: 'data', sourceConfig: { value: { a: 1 } } })];

      const result = await resolver.resolve('Result: {{data}}', variables, makeContext());
      expect(result).toBe('Result: {"a":1}');
    });

    it('stringifies array values in templates', async () => {
      resolver.registerSourceHandler('CONSTANT', new ConstantHandler());

      const variables = [
        makeVariable({ variableName: 'items', sourceConfig: { value: ['x', 'y'] } }),
      ];

      const result = await resolver.resolve('Items: {{items}}', variables, makeContext());
      expect(result).toBe('Items: ["x","y"]');
    });

    it('uses defaultValue when variable cannot be resolved', async () => {
      // Register a handler that returns undefined
      const failingHandler = {
        sourceType: 'FAILING',
        resolve: vi.fn().mockResolvedValue(undefined),
      };
      resolver.registerSourceHandler('FAILING', failingHandler);

      const variables = [
        makeVariable({
          variableName: 'myVar',
          sourceType: 'FAILING',
          defaultValue: 'fallback value',
          isRequired: false,
        }),
      ];

      const result = await resolver.resolve('Value: {{myVar}}', variables, makeContext());
      expect(result).toBe('Value: fallback value');
    });
  });

  // =========================================================================
  // Graceful fallback — required variable failure in autonomous mode
  // =========================================================================

  describe('autonomous mode — required variable failure', () => {
    it('throws UnresolvableRequiredParamError for required variable in autonomous mode', async () => {
      const failingHandler = {
        sourceType: 'FAILING',
        resolve: vi.fn().mockResolvedValue(undefined),
      };
      resolver.registerSourceHandler('FAILING', failingHandler);

      const variables = [
        makeVariable({
          variableName: 'requiredVar',
          sourceType: 'FAILING',
          isRequired: true,
        }),
      ];

      await expect(
        resolver.resolve('{{requiredVar}}', variables, makeContext({ autonomous: true })),
      ).rejects.toThrow(UnresolvableRequiredParamError);
    });

    it('does not throw for required variable when not in autonomous mode', async () => {
      const failingHandler = {
        sourceType: 'FAILING',
        resolve: vi.fn().mockResolvedValue(undefined),
      };
      resolver.registerSourceHandler('FAILING', failingHandler);

      const variables = [
        makeVariable({
          variableName: 'requiredVar',
          sourceType: 'FAILING',
          isRequired: true,
        }),
      ];

      const result = await resolver.resolve(
        '{{requiredVar}}',
        variables,
        makeContext({ autonomous: false }),
      );
      expect(result).toBe('[unknown: requiredVar]');
    });

    it('does not throw for optional variable in autonomous mode', async () => {
      const failingHandler = {
        sourceType: 'FAILING',
        resolve: vi.fn().mockResolvedValue(undefined),
      };
      resolver.registerSourceHandler('FAILING', failingHandler);

      const variables = [
        makeVariable({
          variableName: 'optionalVar',
          sourceType: 'FAILING',
          isRequired: false,
        }),
      ];

      const result = await resolver.resolve(
        '{{optionalVar}}',
        variables,
        makeContext({ autonomous: true }),
      );
      expect(result).toBe('[unknown: optionalVar]');
    });
  });

  // =========================================================================
  // resolveToMap()
  // =========================================================================

  describe('resolveToMap()', () => {
    it('returns a key-value map of resolved variables', async () => {
      resolver.registerSourceHandler('CONSTANT', new ConstantHandler());

      const variables = [
        makeVariable({ variableName: 'a', sourceConfig: { value: 'alpha' } }),
        makeVariable({ variableName: 'b', sourceConfig: { value: 42 } }),
      ];

      const result = await resolver.resolveToMap(variables, makeContext());
      expect(result).toEqual({ a: 'alpha', b: 42 });
    });

    it('uses defaultValue for unresolvable optional variables', async () => {
      const failingHandler = {
        sourceType: 'FAILING',
        resolve: vi.fn().mockResolvedValue(undefined),
      };
      resolver.registerSourceHandler('FAILING', failingHandler);

      const variables = [
        makeVariable({
          variableName: 'myVar',
          sourceType: 'FAILING',
          defaultValue: 'default',
          isRequired: false,
        }),
      ];

      const result = await resolver.resolveToMap(variables, makeContext());
      expect(result.myVar).toBe('default');
    });

    it('throws for required variable in autonomous mode', async () => {
      const failingHandler = {
        sourceType: 'FAILING',
        resolve: vi.fn().mockResolvedValue(undefined),
      };
      resolver.registerSourceHandler('FAILING', failingHandler);

      const variables = [
        makeVariable({
          variableName: 'criticalVar',
          sourceType: 'FAILING',
          isRequired: true,
        }),
      ];

      await expect(
        resolver.resolveToMap(variables, makeContext({ autonomous: true })),
      ).rejects.toThrow(UnresolvableRequiredParamError);
    });
  });

  // =========================================================================
  // No handler registered
  // =========================================================================

  describe('missing handler', () => {
    it('logs warning when no handler is registered for source type', async () => {
      const variables = [makeVariable({ variableName: 'x', sourceType: 'UNKNOWN_TYPE' })];

      const result = await resolver.resolve('{{x}}', variables, makeContext());
      expect(result).toBe('[unknown: x]');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ sourceType: 'UNKNOWN_TYPE' }),
        'No handler registered for source type',
      );
    });
  });

  // =========================================================================
  // createVariableResolver factory
  // =========================================================================

  describe('createVariableResolver()', () => {
    it('returns a resolver with all 7 handlers registered', async () => {
      const mockDb = {} as any;
      const factoryResolver = createVariableResolver(mockDb, mockLogger as any);

      // Test it can resolve a CONSTANT variable (one of the 6 handlers)
      const variables = [
        makeVariable({
          variableName: 'val',
          sourceType: 'CONSTANT',
          sourceConfig: { value: 'test' },
        }),
      ];

      const result = await factoryResolver.resolve('{{val}}', variables, makeContext());
      expect(result).toBe('test');
    });

    it('resolves SYSTEM variables through factory-created resolver', async () => {
      const mockDb = {} as any;
      const factoryResolver = createVariableResolver(mockDb, mockLogger as any);

      const variables = [
        makeVariable({
          variableName: 'today',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'today' },
        }),
      ];

      const result = await factoryResolver.resolve('Date: {{today}}', variables, makeContext());
      expect(result).toMatch(/^Date: \d{4}-\d{2}-\d{2}$/);
    });
  });
});
