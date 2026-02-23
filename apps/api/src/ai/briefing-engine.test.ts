import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger, mockOrchestrator, mockContextEngine, mockRedis } = vi.hoisted(() => ({
  mockPrisma: {
    customerInvoice: {
      findMany: vi.fn(),
    },
    supplierInvoice: {
      findMany: vi.fn(),
    },
    bankAccount: {
      findMany: vi.fn(),
    },
    purchaseOrder: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  } as Record<string, any>,
  mockLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockOrchestrator: {
    process: vi.fn(),
    processDirect: vi.fn(),
  },
  mockContextEngine: {
    getUserContext: vi.fn(),
    updateContext: vi.fn(),
    refreshContext: vi.fn(),
  },
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    scan: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { BriefingEngine } from './briefing-engine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEngine() {
  return new BriefingEngine(
    mockOrchestrator as any,
    mockContextEngine as any,
    mockPrisma as any,
    mockRedis as any,
    mockLogger as any,
  );
}

const defaultUserContext = {
  user: { id: 'user-1', name: 'Mohammed Hussein', role: 'SUPER_ADMIN' },
  tenant: { id: 'tenant-1', companyName: 'Acme Ltd', baseCurrency: 'GBP' },
  recentEntities: [],
  recentActions: [],
  currentPeriod: { start: '2026-02-01', end: '2026-02-28', isLocked: false },
  preferences: { dateFormat: 'DD/MM/YYYY', locale: 'en' },
};

function makeValidBriefingResponse(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    summary: 'You have 3 overdue invoices and £25,000 in your accounts.',
    items: [
      {
        id: 'item-1',
        title: '3 Overdue Invoices',
        description: 'Total outstanding: £12,400',
        category: 'overdue_receivables',
        priority: 'high',
        metric: {
          value: '£12,400',
          delta: '+8%',
          trend: 'up',
          comparisonPeriod: 'vs last month',
        },
        actions: [
          {
            label: 'Chase All',
            actionType: 'chase',
            route: '/ar/invoices?status=overdue',
          },
          {
            label: 'Review',
            actionType: 'navigate',
            route: '/ar/invoices?status=overdue',
          },
        ],
        entityLink: {
          entityType: 'CustomerInvoice',
          route: '/ar/invoices?status=overdue',
        },
      },
      {
        id: 'item-2',
        title: 'Cash Position',
        description: 'Current balance: £25,000 across 2 accounts',
        category: 'cash_position',
        priority: 'medium',
        metric: {
          value: '£25,000',
          trend: 'flat',
        },
        actions: [
          {
            label: 'View Accounts',
            actionType: 'navigate',
            route: '/finance/bank-accounts',
          },
        ],
      },
    ],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BriefingEngine', () => {
  let engine: BriefingEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = createEngine();
  });

  // ─── Role Resolution ────────────────────────────────────────────────────

  describe('resolveRole()', () => {
    it('maps SUPER_ADMIN to OWNER', () => {
      expect(engine.resolveRole('SUPER_ADMIN')).toBe('OWNER');
    });

    it('maps OWNER to OWNER', () => {
      expect(engine.resolveRole('OWNER')).toBe('OWNER');
    });

    it('maps ADMIN to ADMIN', () => {
      expect(engine.resolveRole('ADMIN')).toBe('ADMIN');
    });

    it('maps finance-related roles to FINANCE', () => {
      expect(engine.resolveRole('FINANCE_MANAGER')).toBe('FINANCE');
      expect(engine.resolveRole('ACCOUNTANT')).toBe('FINANCE');
      expect(engine.resolveRole('BOOKKEEPER')).toBe('FINANCE');
    });

    it('maps sales-related roles to SALES', () => {
      expect(engine.resolveRole('SALES_MANAGER')).toBe('SALES');
      expect(engine.resolveRole('COMMERCIAL_DIRECTOR')).toBe('SALES');
    });

    it('maps HR-related roles to HR', () => {
      expect(engine.resolveRole('HR_MANAGER')).toBe('HR');
      expect(engine.resolveRole('HUMAN_RESOURCES')).toBe('HR');
      expect(engine.resolveRole('PAYROLL_CLERK')).toBe('HR');
    });

    it('maps warehouse-related roles to WAREHOUSE', () => {
      expect(engine.resolveRole('WAREHOUSE_STAFF')).toBe('WAREHOUSE');
      expect(engine.resolveRole('INVENTORY_MANAGER')).toBe('WAREHOUSE');
      expect(engine.resolveRole('STOCK_CONTROLLER')).toBe('WAREHOUSE');
    });

    it('falls back to ADMIN for unknown roles', () => {
      expect(engine.resolveRole('STAFF')).toBe('ADMIN');
      expect(engine.resolveRole('VIEWER')).toBe('ADMIN');
      expect(engine.resolveRole('UNKNOWN_ROLE')).toBe('ADMIN');
    });

    it('is case-insensitive', () => {
      expect(engine.resolveRole('super_admin')).toBe('OWNER');
      expect(engine.resolveRole('Finance_Manager')).toBe('FINANCE');
    });
  });

  // ─── Role Categories ────────────────────────────────────────────────────

  describe('getRoleCategories()', () => {
    it('returns OWNER categories', () => {
      const categories = engine.getRoleCategories('OWNER');
      expect(categories).toContain('approvals');
      expect(categories).toContain('revenue');
      expect(categories).toContain('cash_position');
    });

    it('returns FINANCE categories', () => {
      const categories = engine.getRoleCategories('FINANCE');
      expect(categories).toContain('overdue_invoices');
      expect(categories).toContain('cash_position');
      expect(categories).toContain('payment_runs');
    });

    it('returns SALES categories', () => {
      const categories = engine.getRoleCategories('SALES');
      expect(categories).toContain('pipeline');
      expect(categories).toContain('pending_quotes');
    });

    it('returns HR categories', () => {
      const categories = engine.getRoleCategories('HR');
      expect(categories).toContain('leave_requests');
      expect(categories).toContain('payroll_status');
    });

    it('returns WAREHOUSE categories', () => {
      const categories = engine.getRoleCategories('WAREHOUSE');
      expect(categories).toContain('low_stock');
      expect(categories).toContain('picking_queue');
    });

    it('returns ADMIN categories', () => {
      const categories = engine.getRoleCategories('ADMIN');
      expect(categories).toContain('system_health');
      expect(categories).toContain('user_activity');
    });
  });

  // ─── Data Gathering ─────────────────────────────────────────────────────

  describe('gatherBriefingData()', () => {
    it('scopes all queries by companyId', async () => {
      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);

      // Use FINANCE role — it queries all data categories
      await engine.gatherBriefingData('company-123', 'FINANCE', {
        user: { name: 'Test', role: 'FINANCE' },
        tenant: { companyName: 'TestCo', baseCurrency: 'GBP' },
      });

      for (const model of [
        mockPrisma.customerInvoice,
        mockPrisma.supplierInvoice,
        mockPrisma.bankAccount,
        mockPrisma.purchaseOrder,
      ]) {
        const whereArg = model.findMany.mock.calls[0]?.[0]?.where;
        expect(whereArg?.companyId).toBe('company-123');
      }
    });

    it('returns overdue invoice count and total', async () => {
      mockPrisma.customerInvoice.findMany.mockResolvedValue([
        { id: 'inv-1', totalAmount: '5000.00' },
        { id: 'inv-2', totalAmount: '7400.00' },
      ]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);

      const result = await engine.gatherBriefingData('company-1', 'FINANCE', {
        user: { name: 'Test', role: 'FINANCE' },
        tenant: { companyName: 'TestCo', baseCurrency: 'GBP' },
      });

      expect(result.overdueInvoices.count).toBe(2);
      expect(result.overdueInvoices.totalAmount).toBe('12400.0000');
    });

    it('returns overdue bills count and total', async () => {
      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([
        { id: 'bill-1', totalAmount: '3000.00' },
      ]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);

      const result = await engine.gatherBriefingData('company-1', 'FINANCE', {
        user: { name: 'Test', role: 'FINANCE' },
        tenant: { companyName: 'TestCo', baseCurrency: 'GBP' },
      });

      expect(result.overdueBills.count).toBe(1);
      expect(result.overdueBills.totalAmount).toBe('3000.0000');
    });

    it('returns cash position from bank accounts', async () => {
      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([
        { id: 'ba-1', balance: '15000.00', currency: 'GBP' },
        { id: 'ba-2', balance: '10000.00', currency: 'GBP' },
      ]);

      const result = await engine.gatherBriefingData('company-1', 'OWNER', {
        user: { name: 'Test', role: 'OWNER' },
        tenant: { companyName: 'TestCo', baseCurrency: 'GBP' },
      });

      expect(result.cashPosition.totalBalance).toBe('25000.0000');
      expect(result.cashPosition.accountCount).toBe(2);
      expect(result.cashPosition.currency).toBe('GBP');
    });

    it('degrades gracefully when models do not exist', async () => {
      const prismaEmpty = {} as any;
      const engineEmpty = new BriefingEngine(
        mockOrchestrator as any,
        mockContextEngine as any,
        prismaEmpty,
        mockRedis as any,
        mockLogger as any,
      );

      const result = await engineEmpty.gatherBriefingData('company-1', 'OWNER', {
        user: { name: 'Test', role: 'OWNER' },
        tenant: { companyName: 'TestCo', baseCurrency: 'GBP' },
      });

      expect(result.overdueInvoices.count).toBe(0);
      expect(result.overdueBills.count).toBe(0);
      expect(result.cashPosition.totalBalance).toBe('0.00');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('caps query results with take parameter', async () => {
      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);

      // Use FINANCE role — it queries all data categories
      await engine.gatherBriefingData('company-1', 'FINANCE', {
        user: { name: 'Test', role: 'FINANCE' },
        tenant: { companyName: 'TestCo', baseCurrency: 'GBP' },
      });

      for (const model of [
        mockPrisma.customerInvoice,
        mockPrisma.supplierInvoice,
        mockPrisma.bankAccount,
        mockPrisma.purchaseOrder,
      ]) {
        const args = model.findMany.mock.calls[0]?.[0];
        expect(args?.take).toBe(100);
      }
    });

    it('returns defaults when all data is empty', async () => {
      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);

      const result = await engine.gatherBriefingData('company-1', 'ADMIN', {
        user: { name: 'Admin User', role: 'ADMIN' },
        tenant: { companyName: 'TestCo', baseCurrency: 'GBP' },
      });

      expect(result.pendingApprovals).toBe(0);
      expect(result.overdueInvoices.count).toBe(0);
      expect(result.overdueBills.count).toBe(0);
      expect(result.cashPosition.totalBalance).toBe('0.00');
      expect(result.userName).toBe('Admin User');
      expect(result.companyName).toBe('TestCo');
    });
  });

  // ─── Prompt Building ────────────────────────────────────────────────────

  describe('buildBriefingPrompt()', () => {
    it('includes role name in system prompt', () => {
      const { systemPrompt } = engine.buildBriefingPrompt('FINANCE', {
        pendingApprovals: 0,
        overdueInvoices: { count: 0, totalAmount: '0.00' },
        overdueBills: { count: 0, totalAmount: '0.00' },
        cashPosition: { totalBalance: '0.00', currency: 'GBP', accountCount: 0 },
        upcomingPaymentRuns: 0,
        userName: 'Test',
        userRole: 'FINANCE',
        companyName: 'TestCo',
        currency: 'GBP',
      });

      expect(systemPrompt).toContain('FINANCE');
    });

    it('includes role categories in system prompt', () => {
      const { systemPrompt } = engine.buildBriefingPrompt('OWNER', {
        pendingApprovals: 0,
        overdueInvoices: { count: 0, totalAmount: '0.00' },
        overdueBills: { count: 0, totalAmount: '0.00' },
        cashPosition: { totalBalance: '0.00', currency: 'GBP', accountCount: 0 },
        upcomingPaymentRuns: 0,
        userName: 'Test',
        userRole: 'OWNER',
        companyName: 'TestCo',
        currency: 'GBP',
      });

      // OWNER categories should be in the prompt
      expect(systemPrompt).toContain('approvals');
      expect(systemPrompt).toContain('revenue');
      expect(systemPrompt).toContain('cash position');
    });

    it('includes user name and company in user message', () => {
      const { userMessage } = engine.buildBriefingPrompt('OWNER', {
        pendingApprovals: 5,
        overdueInvoices: { count: 3, totalAmount: '12400.00' },
        overdueBills: { count: 1, totalAmount: '3000.00' },
        cashPosition: { totalBalance: '25000.00', currency: 'GBP', accountCount: 2 },
        upcomingPaymentRuns: 1,
        userName: 'Mohammed Hussein',
        userRole: 'OWNER',
        companyName: 'Acme Ltd',
        currency: 'GBP',
      });

      expect(userMessage).toContain('Mohammed Hussein');
      expect(userMessage).toContain('Acme Ltd');
      expect(userMessage).toContain('12400.00');
      expect(userMessage).toContain('25000.00');
      expect(userMessage).toContain('GBP');
    });

    it('includes structured JSON output format instructions', () => {
      const { systemPrompt } = engine.buildBriefingPrompt('ADMIN', {
        pendingApprovals: 0,
        overdueInvoices: { count: 0, totalAmount: '0.00' },
        overdueBills: { count: 0, totalAmount: '0.00' },
        cashPosition: { totalBalance: '0.00', currency: 'GBP', accountCount: 0 },
        upcomingPaymentRuns: 0,
        userName: 'Test',
        userRole: 'ADMIN',
        companyName: 'TestCo',
        currency: 'GBP',
      });

      expect(systemPrompt).toContain('valid JSON');
      expect(systemPrompt).toContain('"items"');
      expect(systemPrompt).toContain('"actions"');
    });
  });

  // ─── Response Parsing ───────────────────────────────────────────────────

  describe('parseBriefingResponse()', () => {
    it('parses valid AI response into DailyBriefing', () => {
      const result = engine.parseBriefingResponse(
        makeValidBriefingResponse(),
        'user-1',
        'OWNER',
        'Mohammed Hussein',
      );

      expect(result.userId).toBe('user-1');
      expect(result.role).toBe('OWNER');
      expect(result.summary).toBe('You have 3 overdue invoices and £25,000 in your accounts.');
      expect(result.items).toHaveLength(2);
      expect(result.generatedAt).toBeDefined();
    });

    it('parses briefing items with correct types', () => {
      const result = engine.parseBriefingResponse(
        makeValidBriefingResponse(),
        'user-1',
        'OWNER',
        'Mohammed',
      );

      const item = result.items[0]!;
      expect(item.title).toBe('3 Overdue Invoices');
      expect(item.description).toBe('Total outstanding: £12,400');
      expect(item.category).toBe('overdue_receivables');
      expect(item.priority).toBe('high');
      expect(item.actions).toHaveLength(2);
      expect(item.actions[0]!.label).toBe('Chase All');
      expect(item.actions[0]!.actionType).toBe('chase');
    });

    it('parses metric data correctly', () => {
      const result = engine.parseBriefingResponse(
        makeValidBriefingResponse(),
        'user-1',
        'OWNER',
        'Mohammed',
      );

      const metric = result.items[0]!.metric!;
      expect(metric.value).toBe('£12,400');
      expect(metric.delta).toBe('+8%');
      expect(metric.trend).toBe('up');
      expect(metric.comparisonPeriod).toBe('vs last month');
    });

    it('parses entity links correctly', () => {
      const result = engine.parseBriefingResponse(
        makeValidBriefingResponse(),
        'user-1',
        'OWNER',
        'Mohammed',
      );

      const entityLink = result.items[0]!.entityLink!;
      expect(entityLink.entityType).toBe('CustomerInvoice');
      expect(entityLink.route).toBe('/ar/invoices?status=overdue');
    });

    it('handles malformed JSON gracefully', () => {
      const result = engine.parseBriefingResponse(
        'not valid json',
        'user-1',
        'ADMIN',
        'Test User',
      );

      expect(result.items).toEqual([]);
      expect(result.summary).toContain('Unable to generate');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'BriefingEngine: Failed to parse AI briefing response as JSON — returning empty briefing',
      );
    });

    it('skips malformed items and logs warnings', () => {
      const response = JSON.stringify({
        summary: 'Your briefing.',
        items: [
          { title: 'Incomplete item' }, // missing required fields
          {
            id: 'item-1',
            title: 'Valid Item',
            description: 'This is valid',
            category: 'test',
            priority: 'medium',
            actions: [{ label: 'Review', actionType: 'navigate', route: '/test' }],
          },
        ],
      });

      const result = engine.parseBriefingResponse(
        response,
        'user-1',
        'ADMIN',
        'Test User',
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.title).toBe('Valid Item');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ raw: expect.any(Object) }),
        'BriefingEngine: Skipping malformed briefing item — missing required fields',
      );
    });

    it('skips items with empty actions array', () => {
      const response = JSON.stringify({
        summary: 'Your briefing.',
        items: [
          {
            id: 'item-1',
            title: 'No Actions',
            description: 'Item without actions',
            category: 'test',
            priority: 'low',
            actions: [], // empty — should be skipped
          },
        ],
      });

      const result = engine.parseBriefingResponse(
        response,
        'user-1',
        'ADMIN',
        'Test User',
      );

      expect(result.items).toHaveLength(0);
    });

    it('normalises invalid priority to medium', () => {
      const response = JSON.stringify({
        summary: 'Briefing.',
        items: [
          {
            id: 'item-1',
            title: 'Item',
            description: 'Test',
            category: 'test',
            priority: 'CRITICAL', // not a valid value
            actions: [{ label: 'Go', actionType: 'navigate' }],
          },
        ],
      });

      const result = engine.parseBriefingResponse(
        response,
        'user-1',
        'ADMIN',
        'Test',
      );

      expect(result.items[0]!.priority).toBe('medium');
    });

    it('normalises invalid action types to navigate', () => {
      const response = JSON.stringify({
        summary: 'Briefing.',
        items: [
          {
            id: 'item-1',
            title: 'Item',
            description: 'Test',
            category: 'test',
            priority: 'high',
            actions: [{ label: 'Do Thing', actionType: 'INVALID_TYPE' }],
          },
        ],
      });

      const result = engine.parseBriefingResponse(
        response,
        'user-1',
        'ADMIN',
        'Test',
      );

      expect(result.items[0]!.actions[0]!.actionType).toBe('navigate');
    });

    it('generates unique IDs for items missing them', () => {
      const response = JSON.stringify({
        summary: 'Briefing.',
        items: [
          {
            title: 'No ID Item',
            description: 'Test',
            category: 'test',
            priority: 'low',
            actions: [{ label: 'Go', actionType: 'navigate' }],
          },
        ],
      });

      const result = engine.parseBriefingResponse(
        response,
        'user-1',
        'ADMIN',
        'Test',
      );

      expect(result.items[0]!.id).toBeDefined();
      expect(result.items[0]!.id.length).toBeGreaterThan(0);
    });

    it('handles empty items array', () => {
      const response = JSON.stringify({
        summary: 'Nothing to report today.',
        items: [],
      });

      const result = engine.parseBriefingResponse(
        response,
        'user-1',
        'ADMIN',
        'Test',
      );

      expect(result.items).toEqual([]);
      expect(result.summary).toBe('Nothing to report today.');
    });

    it('uses default summary when missing', () => {
      const response = JSON.stringify({ items: [] });

      const result = engine.parseBriefingResponse(
        response,
        'user-1',
        'ADMIN',
        'Test',
      );

      expect(result.summary).toBe('Your daily briefing is ready.');
    });
  });

  // ─── Greeting Generation ────────────────────────────────────────────────

  describe('generateGreeting()', () => {
    it('says good morning before 12:00', () => {
      const morning = new Date('2026-02-23T09:00:00');
      expect(engine.generateGreeting('Mohammed Hussein', morning)).toBe('Good morning, Mohammed.');
    });

    it('says good afternoon between 12:00 and 17:00', () => {
      const afternoon = new Date('2026-02-23T14:00:00');
      expect(engine.generateGreeting('Mohammed Hussein', afternoon)).toBe('Good afternoon, Mohammed.');
    });

    it('says good evening after 17:00', () => {
      const evening = new Date('2026-02-23T19:00:00');
      expect(engine.generateGreeting('Mohammed Hussein', evening)).toBe('Good evening, Mohammed.');
    });

    it('uses first name only', () => {
      const morning = new Date('2026-02-23T09:00:00');
      expect(engine.generateGreeting('John Smith', morning)).toBe('Good morning, John.');
    });

    it('handles single-name users', () => {
      const morning = new Date('2026-02-23T09:00:00');
      expect(engine.generateGreeting('Admin', morning)).toBe('Good morning, Admin.');
    });
  });

  // ─── generateBriefing (end-to-end) ──────────────────────────────────────

  describe('generateBriefing()', () => {
    it('calls orchestrator with intent "briefing" and routing tags ["briefing"]', async () => {
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);
      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: makeValidBriefingResponse(),
      });

      await engine.generateBriefing('user-1', 'company-1', 'tenant-1');

      expect(mockOrchestrator.processDirect).toHaveBeenCalledOnce();
      const call = mockOrchestrator.processDirect.mock.calls[0]![0];
      expect(call.intent).toBe('briefing');
      expect(call.routingTags).toEqual(['briefing']);
      expect(call.context.userId).toBe('user-1');
      expect(call.context.companyId).toBe('company-1');
      expect(call.context.tenantId).toBe('tenant-1');
    });

    it('returns parsed briefing with correct role', async () => {
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);
      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: makeValidBriefingResponse(),
      });

      const result = await engine.generateBriefing('user-1', 'company-1', 'tenant-1');

      expect(result.userId).toBe('user-1');
      expect(result.role).toBe('OWNER'); // SUPER_ADMIN maps to OWNER
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.generatedAt).toBeDefined();
      expect(result.greeting).toBeDefined();
    });

    it('includes financial data in user message', async () => {
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);
      mockPrisma.customerInvoice.findMany.mockResolvedValue([
        { id: 'inv-1', totalAmount: '5000.00' },
      ]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([
        { id: 'ba-1', balance: '25000.00', currency: 'GBP' },
      ]);
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: makeValidBriefingResponse(),
      });

      await engine.generateBriefing('user-1', 'company-1', 'tenant-1');

      const call = mockOrchestrator.processDirect.mock.calls[0]![0];
      expect(call.userMessage).toContain('5000.00');
      expect(call.userMessage).toContain('25000.00');
    });

    it('returns fallback briefing when orchestrator returns error', async () => {
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);
      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockOrchestrator.processDirect.mockRejectedValue(new Error('AI service down'));

      const result = await engine.generateBriefing('user-1', 'company-1', 'tenant-1');

      expect(result.summary).toContain('could not be generated');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.title).toBe('Briefing Unavailable');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns fallback briefing when context engine fails', async () => {
      mockContextEngine.getUserContext.mockRejectedValue(new Error('Redis connection failed'));

      const result = await engine.generateBriefing('user-1', 'company-1', 'tenant-1');

      expect(result.summary).toContain('could not be generated');
      expect(result.items[0]!.actions[0]!.route).toBe('/');
    });

    it('handles briefing with empty database gracefully', async () => {
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);
      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          summary: 'No data to report today.',
          items: [
            {
              id: 'item-1',
              title: 'Getting Started',
              description: 'No business data available yet. Start by adding customers and invoices.',
              category: 'system',
              priority: 'low',
              actions: [{ label: 'Go to Setup', actionType: 'navigate', route: '/settings' }],
            },
          ],
        }),
      });

      const result = await engine.generateBriefing('user-1', 'company-1', 'tenant-1');

      expect(result.items).toHaveLength(1);
      expect(result.summary).toBe('No data to report today.');
    });

    it('resolves correct role from user context', async () => {
      const financeContext = {
        ...defaultUserContext,
        user: { id: 'user-2', name: 'Jane Doe', role: 'FINANCE_MANAGER' },
      };
      mockContextEngine.getUserContext.mockResolvedValue(financeContext);
      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: makeValidBriefingResponse(),
      });

      const result = await engine.generateBriefing('user-2', 'company-1', 'tenant-1');

      expect(result.role).toBe('FINANCE');
      // System prompt should mention FINANCE role
      const call = mockOrchestrator.processDirect.mock.calls[0]![0];
      expect(call.systemPrompt).toContain('FINANCE');
    });
  });

  // ─── Redis Caching ──────────────────────────────────────────────────────

  describe('caching', () => {
    const cachedBriefing = {
      generatedAt: '2026-02-23T08:00:00.000Z',
      userId: 'user-1',
      role: 'OWNER' as const,
      greeting: 'Good morning, Mohammed.',
      summary: 'Cached briefing summary.',
      items: [
        {
          id: 'cached-item-1',
          title: 'Cached Item',
          description: 'From cache',
          category: 'test',
          priority: 'medium' as const,
          actions: [{ label: 'Review', actionType: 'navigate' as const, route: '/test' }],
        },
      ],
      cachedAt: new Date().toISOString(),
    };

    describe('cache hit', () => {
      it('returns cached data without calling AI when cache is valid', async () => {
        mockRedis.get.mockResolvedValue(JSON.stringify(cachedBriefing));

        const result = await engine.generateBriefing('user-1', 'company-1', 'tenant-1');

        expect(result.summary).toBe('Cached briefing summary.');
        expect(result.items[0]!.title).toBe('Cached Item');
        expect(mockOrchestrator.processDirect).not.toHaveBeenCalled();
        expect(mockContextEngine.getUserContext).not.toHaveBeenCalled();
        expect(mockRedis.get).toHaveBeenCalledWith('tenant-1:briefing:user-1:company-1');
      });

      it('uses correct cache key pattern', () => {
        expect(engine.getCacheKey('user-1', 'company-1', 'tenant-1')).toBe('tenant-1:briefing:user-1:company-1');
        expect(engine.getCacheKey('u-abc', 'c-xyz', 't-123')).toBe('t-123:briefing:u-abc:c-xyz');
      });
    });

    describe('cache miss', () => {
      it('generates briefing and stores in cache on miss', async () => {
        mockRedis.get.mockResolvedValue(null);
        mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);
        mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
        mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
        mockPrisma.bankAccount.findMany.mockResolvedValue([]);
        mockOrchestrator.processDirect.mockResolvedValue({
          type: 'text',
          messageId: 'msg-1',
          content: makeValidBriefingResponse(),
        });

        const result = await engine.generateBriefing('user-1', 'company-1', 'tenant-1');

        // Should have called AI
        expect(mockOrchestrator.processDirect).toHaveBeenCalledOnce();
        // Should have stored in Redis with 24h TTL
        expect(mockRedis.set).toHaveBeenCalledOnce();
        const setArgs = mockRedis.set.mock.calls[0]!;
        expect(setArgs[0]).toBe('tenant-1:briefing:user-1:company-1');
        expect(setArgs[2]).toBe('EX');
        expect(setArgs[3]).toBe(86_400);
        // Result should have cachedAt set
        expect(result.cachedAt).toBeDefined();
      });

      it('returns briefing even if cache write fails', async () => {
        mockRedis.get.mockResolvedValue(null);
        mockRedis.set.mockRejectedValue(new Error('Redis write error'));
        mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);
        mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
        mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
        mockPrisma.bankAccount.findMany.mockResolvedValue([]);
        mockOrchestrator.processDirect.mockResolvedValue({
          type: 'text',
          messageId: 'msg-1',
          content: makeValidBriefingResponse(),
        });

        const result = await engine.generateBriefing('user-1', 'company-1', 'tenant-1');

        expect(result.items.length).toBeGreaterThan(0);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ error: 'Redis write error' }),
          'BriefingEngine: failed to cache briefing — returning uncached',
        );
      });
    });

    describe('forceRefresh', () => {
      it('bypasses cache and regenerates when forceRefresh is true', async () => {
        mockRedis.get.mockResolvedValue(JSON.stringify(cachedBriefing));
        mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);
        mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
        mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
        mockPrisma.bankAccount.findMany.mockResolvedValue([]);
        mockOrchestrator.processDirect.mockResolvedValue({
          type: 'text',
          messageId: 'msg-1',
          content: makeValidBriefingResponse(),
        });

        const result = await engine.generateBriefing('user-1', 'company-1', 'tenant-1', true);

        // Should NOT have read from cache
        expect(mockRedis.get).not.toHaveBeenCalled();
        // Should have called AI
        expect(mockOrchestrator.processDirect).toHaveBeenCalledOnce();
        // Should have written new result to cache
        expect(mockRedis.set).toHaveBeenCalledOnce();
        expect(result.cachedAt).toBeDefined();
      });
    });

    describe('cache read failure', () => {
      it('falls through to generation when cache read fails', async () => {
        mockRedis.get.mockRejectedValue(new Error('Redis connection error'));
        mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);
        mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
        mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
        mockPrisma.bankAccount.findMany.mockResolvedValue([]);
        mockOrchestrator.processDirect.mockResolvedValue({
          type: 'text',
          messageId: 'msg-1',
          content: makeValidBriefingResponse(),
        });

        const result = await engine.generateBriefing('user-1', 'company-1', 'tenant-1');

        expect(mockOrchestrator.processDirect).toHaveBeenCalledOnce();
        expect(result.items.length).toBeGreaterThan(0);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ error: 'Redis connection error' }),
          'BriefingEngine: cache read failed — proceeding to generate',
        );
      });
    });
  });

  // ─── Cache Invalidation ────────────────────────────────────────────────

  describe('cache invalidation', () => {
    describe('invalidateBriefing()', () => {
      it('deletes the correct cache key', async () => {
        mockRedis.del.mockResolvedValue(1);

        await engine.invalidateBriefing('user-1', 'company-1', 'tenant-1');

        expect(mockRedis.del).toHaveBeenCalledWith('tenant-1:briefing:user-1:company-1');
      });

      it('logs warning on failure but does not throw', async () => {
        mockRedis.del.mockRejectedValue(new Error('Redis del error'));

        await engine.invalidateBriefing('user-1', 'company-1', 'tenant-1');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ error: 'Redis del error' }),
          'BriefingEngine: failed to invalidate user briefing cache',
        );
      });
    });

    describe('invalidateCompanyBriefings()', () => {
      it('scans and deletes all matching keys', async () => {
        // First scan returns 2 keys and a cursor pointing to more
        // Second scan returns 1 key and cursor '0' (done)
        mockRedis.scan
          .mockResolvedValueOnce(['42', ['tenant-1:briefing:user-1:company-1', 'tenant-1:briefing:user-2:company-1']])
          .mockResolvedValueOnce(['0', ['tenant-1:briefing:user-3:company-1']]);
        mockRedis.del.mockResolvedValue(1);

        const deleted = await engine.invalidateCompanyBriefings('company-1', 'tenant-1');

        expect(deleted).toBe(3);
        expect(mockRedis.scan).toHaveBeenCalledTimes(2);
        expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'tenant-1:briefing:*:company-1', 'COUNT', 100);
        expect(mockRedis.del).toHaveBeenCalledTimes(2);
      });

      it('returns 0 when no keys match', async () => {
        mockRedis.scan.mockResolvedValueOnce(['0', []]);

        const deleted = await engine.invalidateCompanyBriefings('company-1', 'tenant-1');

        expect(deleted).toBe(0);
        expect(mockRedis.del).not.toHaveBeenCalled();
      });

      it('handles scan failure gracefully', async () => {
        mockRedis.scan.mockRejectedValue(new Error('Redis scan error'));

        const deleted = await engine.invalidateCompanyBriefings('company-1', 'tenant-1');

        expect(deleted).toBe(0);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ error: 'Redis scan error' }),
          'BriefingEngine: failed to invalidate company briefing caches',
        );
      });

      it('uses correct pattern for company cache keys', () => {
        expect(engine.getCompanyCachePattern('company-1', 'tenant-1')).toBe('tenant-1:briefing:*:company-1');
      });
    });
  });

  // ─── Staleness Detection ───────────────────────────────────────────────

  describe('staleness detection', () => {
    function makeCachedBriefing(overrides: Record<string, unknown> = {}) {
      return {
        generatedAt: '2026-02-23T08:00:00.000Z',
        userId: 'user-1',
        role: 'OWNER',
        greeting: 'Good morning, Mohammed.',
        summary: 'Cached briefing summary.',
        items: [
          {
            id: 'cached-item-1',
            title: 'Cached Item',
            description: 'From cache',
            category: 'test',
            priority: 'medium',
            actions: [{ label: 'Review', actionType: 'navigate', route: '/test' }],
          },
        ],
        cachedAt: new Date().toISOString(),
        ...overrides,
      };
    }

    it('marks briefing as not stale when recently cached', async () => {
      const recentBriefing = makeCachedBriefing({ cachedAt: new Date().toISOString() });
      mockRedis.get.mockResolvedValue(JSON.stringify(recentBriefing));

      const result = await engine.generateBriefing('user-1', 'company-1', 'tenant-1');

      expect(result.isStale).toBe(false);
    });

    it('marks briefing as stale when cached over 24h ago', async () => {
      const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      const staleBriefing = makeCachedBriefing({ cachedAt: staleDate.toISOString() });
      mockRedis.get.mockResolvedValue(JSON.stringify(staleBriefing));

      const result = await engine.generateBriefing('user-1', 'company-1', 'tenant-1');

      expect(result.isStale).toBe(true);
    });

    it('marks briefing as stale when cachedAt is missing', async () => {
      const noCachedAt = makeCachedBriefing();
      delete (noCachedAt as any).cachedAt;
      mockRedis.get.mockResolvedValue(JSON.stringify(noCachedAt));

      const result = await engine.generateBriefing('user-1', 'company-1', 'tenant-1');

      expect(result.isStale).toBe(true);
    });

    it('marks briefing as not stale at exactly 24h boundary', async () => {
      // At exactly 24h minus 1s, should NOT be stale
      const boundaryDate = new Date(Date.now() - (24 * 60 * 60 * 1000) + 1000);
      const boundaryBriefing = makeCachedBriefing({ cachedAt: boundaryDate.toISOString() });
      mockRedis.get.mockResolvedValue(JSON.stringify(boundaryBriefing));

      const result = await engine.generateBriefing('user-1', 'company-1', 'tenant-1');

      expect(result.isStale).toBe(false);
    });
  });
});
