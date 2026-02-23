import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockRedis, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    aiPrompt: {
      findUnique: vi.fn(),
    },
    customerInvoice: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    customer: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
  mockRedis: {
    get: vi.fn(),
  },
  mockLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { PromptManager } from './prompt-manager.js';
import { AiPromptNotFoundError } from './ai.errors.js';
import type { AiPrompt } from '@nexa/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createPromptManager() {
  return new PromptManager(
    mockPrisma as any,
    mockRedis as any,
    mockLogger as any,
  );
}

const baseContext = {
  userId: 'user-1',
  companyId: 'company-1',
  tenantId: 'tenant-1',
  locale: 'en-GB',
  currentEntityType: 'customerInvoice',
  currentEntityId: 'inv-123',
  currentPage: '/ar/invoices/inv-123',
};

function makePrompt(overrides: Partial<AiPrompt> = {}): AiPrompt {
  return {
    id: 'prompt-1',
    name: 'test-prompt',
    description: 'A test prompt',
    category: 'test',
    systemPrompt: 'You are a helpful assistant.',
    userTemplate: 'Hello {{userName}}',
    parameters: {},
    outputFormat: null,
    activeVersion: 1,
    isActive: true,
    createdBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as AiPrompt;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PromptManager', () => {
  let pm: PromptManager;

  beforeEach(() => {
    vi.clearAllMocks();
    pm = createPromptManager();
  });

  // ─── loadPrompt ───────────────────────────────────────────────────────────

  describe('loadPrompt', () => {
    it('loads an active prompt by name', async () => {
      const prompt = makePrompt();
      mockPrisma.aiPrompt.findUnique.mockResolvedValue(prompt);

      const result = await pm.loadPrompt('test-prompt');

      expect(mockPrisma.aiPrompt.findUnique).toHaveBeenCalledWith({
        where: { name: 'test-prompt' },
      });
      expect(result.systemPrompt).toBe('You are a helpful assistant.');
      expect(result.userPrompt).toBe('Hello {{userName}}');
      expect(result.promptId).toBe('prompt-1');
      expect(result.promptVersion).toBe(1);
      expect(result.prompt).toBe(prompt);
    });

    it('throws AiPromptNotFoundError when prompt does not exist', async () => {
      mockPrisma.aiPrompt.findUnique.mockResolvedValue(null);

      await expect(pm.loadPrompt('missing-prompt')).rejects.toThrow(
        AiPromptNotFoundError,
      );
    });

    it('throws AiPromptNotFoundError when prompt is inactive', async () => {
      mockPrisma.aiPrompt.findUnique.mockResolvedValue(
        makePrompt({ isActive: false }),
      );

      await expect(pm.loadPrompt('inactive-prompt')).rejects.toThrow(
        AiPromptNotFoundError,
      );
    });
  });

  // ─── compileTemplate ──────────────────────────────────────────────────────

  describe('compileTemplate', () => {
    it('replaces simple {{param}} placeholders', () => {
      const result = pm.compileTemplate(
        'Hello {{name}}, welcome to {{company}}!',
        { name: 'Alice', company: 'Acme' },
      );

      expect(result).toBe('Hello Alice, welcome to Acme!');
    });

    it('replaces nested {{obj.prop}} placeholders', () => {
      const result = pm.compileTemplate(
        'Customer: {{customer.name}}, Terms: {{customer.paymentTerms}}',
        { customer: { name: 'Bob Corp', paymentTerms: 'Net 30' } },
      );

      expect(result).toBe('Customer: Bob Corp, Terms: Net 30');
    });

    it('serializes arrays as JSON', () => {
      const orders = [
        { id: 'ord-1', total: 100 },
        { id: 'ord-2', total: 250 },
      ];
      const result = pm.compileTemplate(
        'Recent orders: {{recentOrders}}',
        { recentOrders: orders },
      );

      expect(result).toBe(`Recent orders: ${JSON.stringify(orders)}`);
    });

    it('serializes objects as JSON', () => {
      const result = pm.compileTemplate(
        'Data: {{info}}',
        { info: { key: 'value', nested: { a: 1 } } },
      );

      expect(result).toBe('Data: {"key":"value","nested":{"a":1}}');
    });

    it('replaces unresolved params with [paramName] placeholder and logs warning', () => {
      const result = pm.compileTemplate(
        'Hello {{name}}, your role is {{role}}.',
        { name: 'Alice' },
      );

      expect(result).toBe('Hello Alice, your role is [role].');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { param: 'role' },
        'Unresolved template parameter',
      );
    });

    it('handles templates with no placeholders', () => {
      const result = pm.compileTemplate('No placeholders here.', {});
      expect(result).toBe('No placeholders here.');
    });

    it('converts numeric values to strings', () => {
      const result = pm.compileTemplate('Count: {{count}}', { count: 42 });
      expect(result).toBe('Count: 42');
    });

    it('converts boolean values to strings', () => {
      const result = pm.compileTemplate('Active: {{active}}', { active: true });
      expect(result).toBe('Active: true');
    });

    it('handles null values with placeholder', () => {
      const result = pm.compileTemplate('Value: {{val}}', { val: null });
      expect(result).toBe('Value: [val]');
    });
  });

  // ─── resolveParameters ────────────────────────────────────────────────────

  describe('resolveParameters', () => {
    it('resolves userInput parameters from user message', async () => {
      const prompt = makePrompt({
        systemPrompt: 'You help with invoices.',
        userTemplate: 'User says: {{message}}',
        parameters: { message: { type: 'userInput' } } as any,
      });

      const result = await pm.resolveParameters(
        prompt,
        baseContext,
        'Create an invoice for Bob',
      );

      expect(result.systemPrompt).toBe('You help with invoices.');
      expect(result.userPrompt).toBe('User says: Create an invoice for Bob');
    });

    it('resolves computed parameters', async () => {
      const prompt = makePrompt({
        systemPrompt: 'Today is {{today}}.',
        userTemplate: 'Period: {{period}}',
        parameters: {
          today: { type: 'computed', fn: 'currentDate' },
          period: { type: 'computed', fn: 'currentPeriod' },
        } as any,
      });

      const result = await pm.resolveParameters(prompt, baseContext, '');

      // Should be YYYY-MM-DD format
      expect(result.systemPrompt).toMatch(/Today is \d{4}-\d{2}-\d{2}\./);
      // Should be YYYY-MM format
      expect(result.userPrompt).toMatch(/Period: \d{4}-\d{2}/);
    });

    it('injects intentData keys not already in param defs', async () => {
      const prompt = makePrompt({
        systemPrompt: 'You are an assistant.',
        userTemplate: 'Invoice for {{customerName}}',
        parameters: {} as any,
      });

      const result = await pm.resolveParameters(
        prompt,
        baseContext,
        'test',
        { customerName: 'Acme Ltd' },
      );

      expect(result.userPrompt).toBe('Invoice for Acme Ltd');
    });

    it('handles param resolution failure gracefully', async () => {
      const prompt = makePrompt({
        systemPrompt: 'System',
        userTemplate: 'Entity: {{entity}}',
        parameters: {
          entity: {
            type: 'entity',
            entityType: 'nonExistentModel',
            idFrom: 'currentEntityId',
          },
        } as any,
      });

      const result = await pm.resolveParameters(prompt, baseContext, '');

      // Should not throw, should use [not found] placeholder
      expect(result.userPrompt).toBe('Entity: [not found]');
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ─── Entity Parameter Resolution ──────────────────────────────────────────

  describe('entity parameter resolution', () => {
    it('fetches entity by ID with companyId scoping', async () => {
      const invoice = { id: 'inv-123', number: 'INV-001', total: 500 };
      mockPrisma.customerInvoice.findFirst.mockResolvedValue(invoice);

      const prompt = makePrompt({
        systemPrompt: 'Invoice: {{invoice}}',
        userTemplate: 'test',
        parameters: {
          invoice: {
            type: 'entity',
            entityType: 'customerInvoice',
            idFrom: 'currentEntityId',
          },
        } as any,
      });

      const result = await pm.resolveParameters(prompt, baseContext, '');

      expect(mockPrisma.customerInvoice.findFirst).toHaveBeenCalledWith({
        where: { id: 'inv-123', companyId: 'company-1' },
      });
      expect(result.systemPrompt).toBe(`Invoice: ${JSON.stringify(invoice)}`);
    });

    it('applies field selection when specified', async () => {
      const invoice = { number: 'INV-001', total: 500 };
      mockPrisma.customerInvoice.findFirst.mockResolvedValue(invoice);

      const prompt = makePrompt({
        systemPrompt: 'Invoice: {{invoice}}',
        userTemplate: 'test',
        parameters: {
          invoice: {
            type: 'entity',
            entityType: 'customerInvoice',
            idFrom: 'currentEntityId',
            fields: ['number', 'total'],
          },
        } as any,
      });

      await pm.resolveParameters(prompt, baseContext, '');

      expect(mockPrisma.customerInvoice.findFirst).toHaveBeenCalledWith({
        where: { id: 'inv-123', companyId: 'company-1' },
        select: { number: true, total: true },
      });
    });

    it('returns [not found] when entity ID is missing from context', async () => {
      const prompt = makePrompt({
        systemPrompt: 'Entity: {{entity}}',
        userTemplate: 'test',
        parameters: {
          entity: {
            type: 'entity',
            entityType: 'customerInvoice',
            idFrom: 'currentEntityId',
          },
        } as any,
      });

      const contextWithoutEntity = { ...baseContext, currentEntityId: undefined };
      const result = await pm.resolveParameters(prompt, contextWithoutEntity, '');

      expect(result.systemPrompt).toBe('Entity: [not found]');
    });

    it('returns [not found] when entity not found in DB', async () => {
      mockPrisma.customerInvoice.findFirst.mockResolvedValue(null);

      const prompt = makePrompt({
        systemPrompt: 'Entity: {{entity}}',
        userTemplate: 'test',
        parameters: {
          entity: {
            type: 'entity',
            entityType: 'customerInvoice',
            idFrom: 'currentEntityId',
          },
        } as any,
      });

      const result = await pm.resolveParameters(prompt, baseContext, '');

      expect(result.systemPrompt).toBe('Entity: [not found]');
    });

    it('resolves entity ID from intentData', async () => {
      const customer = { id: 'cust-1', name: 'Bob' };
      mockPrisma.customer.findFirst.mockResolvedValue(customer);

      const prompt = makePrompt({
        systemPrompt: 'Customer: {{cust}}',
        userTemplate: 'test',
        parameters: {
          cust: {
            type: 'entity',
            entityType: 'customer',
            idFrom: 'customerId',
          },
        } as any,
      });

      const result = await pm.resolveParameters(
        prompt,
        baseContext,
        '',
        { customerId: 'cust-1' },
      );

      expect(mockPrisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: 'cust-1', companyId: 'company-1' },
      });
      expect(result.systemPrompt).toBe(`Customer: ${JSON.stringify(customer)}`);
    });
  });

  // ─── Query Parameter Resolution ───────────────────────────────────────────

  describe('query parameter resolution', () => {
    it('fetches records with companyId scoping and default limit', async () => {
      const invoices = [
        { id: 'inv-1', number: 'INV-001' },
        { id: 'inv-2', number: 'INV-002' },
      ];
      mockPrisma.customerInvoice.findMany.mockResolvedValue(invoices);

      const prompt = makePrompt({
        systemPrompt: 'Invoices: {{invoices}}',
        userTemplate: 'test',
        parameters: {
          invoices: {
            type: 'query',
            entityType: 'customerInvoice',
            where: { status: 'DRAFT' },
          },
        } as any,
      });

      const result = await pm.resolveParameters(prompt, baseContext, '');

      expect(mockPrisma.customerInvoice.findMany).toHaveBeenCalledWith({
        where: { status: 'DRAFT', companyId: 'company-1' },
        take: 50, // DEFAULT_QUERY_LIMIT
      });
      expect(result.systemPrompt).toBe(`Invoices: ${JSON.stringify(invoices)}`);
    });

    it('respects custom limit capped at 50', async () => {
      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);

      const prompt = makePrompt({
        systemPrompt: 'test',
        userTemplate: 'test',
        parameters: {
          invoices: {
            type: 'query',
            entityType: 'customerInvoice',
            where: {},
            limit: 100, // exceeds max
          },
        } as any,
      });

      await pm.resolveParameters(prompt, baseContext, '');

      expect(mockPrisma.customerInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it('applies select when provided', async () => {
      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);

      const prompt = makePrompt({
        systemPrompt: 'test',
        userTemplate: 'test',
        parameters: {
          invoices: {
            type: 'query',
            entityType: 'customerInvoice',
            where: {},
            select: { number: true, total: true },
          },
        } as any,
      });

      await pm.resolveParameters(prompt, baseContext, '');

      expect(mockPrisma.customerInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { number: true, total: true },
        }),
      );
    });

    it('returns empty array for unknown entity type', async () => {
      const prompt = makePrompt({
        systemPrompt: 'Data: {{data}}',
        userTemplate: 'test',
        parameters: {
          data: {
            type: 'query',
            entityType: 'unknownModel',
            where: {},
          },
        } as any,
      });

      const result = await pm.resolveParameters(prompt, baseContext, '');

      expect(result.systemPrompt).toBe('Data: []');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { entityType: 'unknownModel' },
        'Unknown entity type for query parameter resolution',
      );
    });
  });

  // ─── Context Parameter Resolution ─────────────────────────────────────────

  describe('context parameter resolution', () => {
    it('fetches value from Redis and traverses dot-path', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          tenant: { companyName: 'Acme Ltd', baseCurrency: 'GBP' },
          user: { name: 'Alice' },
        }),
      );

      const prompt = makePrompt({
        systemPrompt: 'Company: {{company}}',
        userTemplate: 'test',
        parameters: {
          company: { type: 'context', path: 'tenant.companyName' },
        } as any,
      });

      const result = await pm.resolveParameters(prompt, baseContext, '');

      expect(mockRedis.get).toHaveBeenCalledWith('tenant-1:context:user-1');
      expect(result.systemPrompt).toBe('Company: Acme Ltd');
    });

    it('returns [not found] when Redis key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const prompt = makePrompt({
        systemPrompt: 'Company: {{company}}',
        userTemplate: 'test',
        parameters: {
          company: { type: 'context', path: 'tenant.companyName' },
        } as any,
      });

      const result = await pm.resolveParameters(prompt, baseContext, '');

      expect(result.systemPrompt).toBe('Company: [not found]');
    });

    it('returns [not found] when dot-path does not resolve', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ tenant: { companyName: 'Acme' } }),
      );

      const prompt = makePrompt({
        systemPrompt: 'Missing: {{missing}}',
        userTemplate: 'test',
        parameters: {
          missing: { type: 'context', path: 'tenant.nonExistent.deep' },
        } as any,
      });

      const result = await pm.resolveParameters(prompt, baseContext, '');

      expect(result.systemPrompt).toBe('Missing: [not found]');
    });

    it('handles malformed JSON in Redis gracefully', async () => {
      mockRedis.get.mockResolvedValue('not-valid-json{{{');

      const prompt = makePrompt({
        systemPrompt: 'Val: {{val}}',
        userTemplate: 'test',
        parameters: {
          val: { type: 'context', path: 'some.path' },
        } as any,
      });

      const result = await pm.resolveParameters(prompt, baseContext, '');

      expect(result.systemPrompt).toBe('Val: [not found]');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { redisKey: 'tenant-1:context:user-1' },
        'Failed to parse context JSON from Redis',
      );
    });
  });

  // ─── Computed Parameter Resolution ────────────────────────────────────────

  describe('computed parameter resolution', () => {
    it('resolves currentDate as YYYY-MM-DD', async () => {
      const prompt = makePrompt({
        systemPrompt: 'Date: {{today}}',
        userTemplate: 'test',
        parameters: {
          today: { type: 'computed', fn: 'currentDate' },
        } as any,
      });

      const result = await pm.resolveParameters(prompt, baseContext, '');

      expect(result.systemPrompt).toMatch(/^Date: \d{4}-\d{2}-\d{2}$/);
    });

    it('resolves currentTime as ISO string', async () => {
      const prompt = makePrompt({
        systemPrompt: 'Time: {{now}}',
        userTemplate: 'test',
        parameters: {
          now: { type: 'computed', fn: 'currentTime' },
        } as any,
      });

      const result = await pm.resolveParameters(prompt, baseContext, '');

      // ISO 8601 format
      expect(result.systemPrompt).toMatch(/^Time: \d{4}-\d{2}-\d{2}T/);
    });

    it('resolves currentPeriod as YYYY-MM', async () => {
      const prompt = makePrompt({
        systemPrompt: 'Period: {{period}}',
        userTemplate: 'test',
        parameters: {
          period: { type: 'computed', fn: 'currentPeriod' },
        } as any,
      });

      const result = await pm.resolveParameters(prompt, baseContext, '');

      expect(result.systemPrompt).toMatch(/^Period: \d{4}-\d{2}$/);
    });

    it('resolves currentUser', async () => {
      const prompt = makePrompt({
        systemPrompt: 'User: {{user}}',
        userTemplate: 'test',
        parameters: {
          user: { type: 'computed', fn: 'currentUser' },
        } as any,
      });

      const result = await pm.resolveParameters(prompt, baseContext, '');

      expect(result.systemPrompt).toBe('User: currentUser');
    });
  });

  // ─── Mixed parameter resolution ───────────────────────────────────────────

  describe('mixed parameter resolution', () => {
    it('resolves multiple parameter types in a single prompt', async () => {
      const customer = { id: 'cust-1', name: 'Bob' };
      mockPrisma.customer.findFirst.mockResolvedValue(customer);
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ tenant: { companyName: 'Acme Ltd' } }),
      );

      const prompt = makePrompt({
        systemPrompt: 'Company: {{company}}, Date: {{today}}',
        userTemplate: 'Customer: {{cust}}, Message: {{msg}}',
        parameters: {
          company: { type: 'context', path: 'tenant.companyName' },
          today: { type: 'computed', fn: 'currentDate' },
          cust: { type: 'entity', entityType: 'customer', idFrom: 'customerId' },
          msg: { type: 'userInput' },
        } as any,
      });

      const result = await pm.resolveParameters(
        prompt,
        baseContext,
        'Help me with invoices',
        { customerId: 'cust-1' },
      );

      expect(result.systemPrompt).toMatch(/^Company: Acme Ltd, Date: \d{4}-\d{2}-\d{2}$/);
      expect(result.userPrompt).toBe(
        `Customer: ${JSON.stringify(customer)}, Message: Help me with invoices`,
      );
    });
  });
});
