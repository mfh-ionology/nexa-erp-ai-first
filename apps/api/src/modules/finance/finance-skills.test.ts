import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockLogger,
  mockEventBus,
  mockCreateJournalEntry,
  mockSearchAccounts,
  mockGetTrialBalance,
  mockCreateBudget,
  mockGetDashboard,
} = vi.hoisted(() => ({
  mockPrisma: {
    chartOfAccount: {
      findFirst: vi.fn(),
    },
  },
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockEventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
    drain: vi.fn(),
  },
  mockCreateJournalEntry: vi.fn(),
  mockSearchAccounts: vi.fn(),
  mockGetTrialBalance: vi.fn(),
  mockCreateBudget: vi.fn(),
  mockGetDashboard: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('./journals.service.js', () => ({
  createJournalEntry: mockCreateJournalEntry,
}));

vi.mock('./accounts.service.js', () => ({
  searchAccounts: mockSearchAccounts,
}));

vi.mock('./reports.service.js', () => ({
  getTrialBalance: mockGetTrialBalance,
}));

vi.mock('./budgets.service.js', () => ({
  createBudget: mockCreateBudget,
}));

vi.mock('./dashboard.service.js', () => ({
  getDashboard: mockGetDashboard,
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  FINANCE_TOOLS,
  registerFinanceTools,
  registerFinanceQueryHandlers,
  registerFinanceActionHandlers,
} from './finance-skills.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockToolRegistry() {
  const tools = new Map<string, unknown>();
  const queryHandlers = new Map<string, unknown>();
  return {
    registerTool: vi.fn((reg: any) => {
      tools.set(reg.definition.name, reg.definition);
      if (reg.handler) queryHandlers.set(reg.definition.name, reg.handler);
    }),
    getDefinition: vi.fn((name: string) => tools.get(name)),
    setQueryHandler: vi.fn((name: string, handler: unknown) => {
      queryHandlers.set(name, handler);
    }),
    getQueryHandler: vi.fn((name: string) => queryHandlers.get(name)),
    getDefinitions: vi.fn(() => Array.from(tools.values())),
    _tools: tools,
    _handlers: queryHandlers,
  };
}

function createMockQueryExecutor() {
  return {
    registerHandler: vi.fn(),
  };
}

function createMockActionExecutor() {
  const handlers = new Map<string, unknown>();
  return {
    registerHandler: vi.fn((actionType: string, handler: unknown) => {
      handlers.set(actionType.toUpperCase(), handler);
    }),
    hasHandler: (type: string) => handlers.has(type.toUpperCase()),
    _handlers: handlers,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Finance Skills — E14-S27', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── AC-1 & AC-2: Tool Definitions ───────────────────────────────────

  describe('FINANCE_TOOLS definitions', () => {
    it('exports 6 tool definitions', () => {
      expect(FINANCE_TOOLS).toHaveLength(6);
    });

    it('includes all required skill names', () => {
      const names = FINANCE_TOOLS.map((t) => t.name);
      expect(names).toContain('finance_create_journal');
      expect(names).toContain('finance_check_account_balance');
      expect(names).toContain('finance_get_trial_balance');
      expect(names).toContain('finance_search_accounts');
      expect(names).toContain('finance_create_budget');
      expect(names).toContain('finance_get_dashboard');
    });

    it('all tools have moduleKey "finance"', () => {
      for (const tool of FINANCE_TOOLS) {
        expect(tool.moduleKey).toBe('finance');
      }
    });

    it('action tools are typed correctly', () => {
      const actionTools = FINANCE_TOOLS.filter((t) => t.type === 'action');
      expect(actionTools).toHaveLength(2);
      const actionNames = actionTools.map((t) => t.name);
      expect(actionNames).toContain('finance_create_journal');
      expect(actionNames).toContain('finance_create_budget');
    });

    it('query tools are typed correctly', () => {
      const queryTools = FINANCE_TOOLS.filter((t) => t.type === 'query');
      expect(queryTools).toHaveLength(4);
      const queryNames = queryTools.map((t) => t.name);
      expect(queryNames).toContain('finance_check_account_balance');
      expect(queryNames).toContain('finance_get_trial_balance');
      expect(queryNames).toContain('finance_search_accounts');
      expect(queryNames).toContain('finance_get_dashboard');
    });

    it('each tool has a description and inputSchema', () => {
      for (const tool of FINANCE_TOOLS) {
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      }
    });
  });

  // ─── AC-3: Input schemas have required fields ─────────────────────────

  describe('input schemas', () => {
    it('create_journal requires description, transactionDate, periodId, lines', () => {
      const tool = FINANCE_TOOLS.find((t) => t.name === 'finance_create_journal')!;
      expect(tool.inputSchema.required).toEqual(
        expect.arrayContaining(['description', 'transactionDate', 'periodId', 'lines']),
      );
    });

    it('check_account_balance requires accountCode', () => {
      const tool = FINANCE_TOOLS.find((t) => t.name === 'finance_check_account_balance')!;
      expect(tool.inputSchema.required).toEqual(['accountCode']);
    });

    it('get_trial_balance requires fiscalYear', () => {
      const tool = FINANCE_TOOLS.find((t) => t.name === 'finance_get_trial_balance')!;
      expect(tool.inputSchema.required).toEqual(['fiscalYear']);
    });

    it('search_accounts requires search', () => {
      const tool = FINANCE_TOOLS.find((t) => t.name === 'finance_search_accounts')!;
      expect(tool.inputSchema.required).toEqual(['search']);
    });

    it('create_budget requires name, fiscalYear, lines', () => {
      const tool = FINANCE_TOOLS.find((t) => t.name === 'finance_create_budget')!;
      expect(tool.inputSchema.required).toEqual(
        expect.arrayContaining(['name', 'fiscalYear', 'lines']),
      );
    });

    it('get_dashboard has no required fields', () => {
      const tool = FINANCE_TOOLS.find((t) => t.name === 'finance_get_dashboard')!;
      expect(tool.inputSchema.required).toBeUndefined();
    });
  });

  // ─── Registration: registerFinanceTools ───────────────────────────────

  describe('registerFinanceTools', () => {
    it('registers all 6 tools in the ToolRegistry', () => {
      const registry = createMockToolRegistry();
      registerFinanceTools(registry as any);

      expect(registry.registerTool).toHaveBeenCalledTimes(6);
    });

    it('registers action tools without query handlers', () => {
      const registry = createMockToolRegistry();
      registerFinanceTools(registry as any);

      // Action tools should be registered with no handler
      const actionCalls = registry.registerTool.mock.calls.filter(
        (call: any[]) => call[0].definition.type === 'action',
      );
      expect(actionCalls).toHaveLength(2);
      for (const call of actionCalls) {
        expect(call[0].handler).toBeUndefined();
      }
    });

    it('registers query tools with sentinel handlers', () => {
      const registry = createMockToolRegistry();
      registerFinanceTools(registry as any);

      // Query tools should have sentinel handlers
      const queryCalls = registry.registerTool.mock.calls.filter(
        (call: any[]) => call[0].definition.type === 'query',
      );
      expect(queryCalls).toHaveLength(4);
      for (const call of queryCalls) {
        expect(call[0].handler).toBeDefined();
        expect(typeof call[0].handler).toBe('function');
      }
    });

    it('sentinel handler throws if invoked before real handler wiring', async () => {
      const registry = createMockToolRegistry();
      registerFinanceTools(registry as any);

      // Get the sentinel handler for a query tool
      const sentinelHandler = registry._handlers.get('finance_check_account_balance') as Function;
      expect(sentinelHandler).toBeDefined();

      await expect(sentinelHandler()).rejects.toThrow(/not initialized/);
    });
  });

  // ─── Registration: registerFinanceQueryHandlers ───────────────────────

  describe('registerFinanceQueryHandlers', () => {
    it('registers 4 query handlers with the QueryExecutor', () => {
      const queryExecutor = createMockQueryExecutor();
      registerFinanceQueryHandlers(queryExecutor as any, mockPrisma as any);

      expect(queryExecutor.registerHandler).toHaveBeenCalledTimes(4);
      expect(queryExecutor.registerHandler).toHaveBeenCalledWith(
        'finance_check_account_balance',
        expect.any(Function),
      );
      expect(queryExecutor.registerHandler).toHaveBeenCalledWith(
        'finance_get_trial_balance',
        expect.any(Function),
      );
      expect(queryExecutor.registerHandler).toHaveBeenCalledWith(
        'finance_search_accounts',
        expect.any(Function),
      );
      expect(queryExecutor.registerHandler).toHaveBeenCalledWith(
        'finance_get_dashboard',
        expect.any(Function),
      );
    });
  });

  // ─── Registration: registerFinanceActionHandlers ──────────────────────

  describe('registerFinanceActionHandlers', () => {
    it('registers 2 action handlers with the ActionExecutor', () => {
      const actionExecutor = createMockActionExecutor();
      registerFinanceActionHandlers(actionExecutor as any, mockEventBus as any, mockLogger as any);

      expect(actionExecutor.registerHandler).toHaveBeenCalledTimes(2);
      expect(actionExecutor.registerHandler).toHaveBeenCalledWith(
        'CREATE_JOURNAL',
        expect.any(Function),
      );
      expect(actionExecutor.registerHandler).toHaveBeenCalledWith(
        'CREATE_BUDGET',
        expect.any(Function),
      );
    });

    it('logs handler registration', () => {
      const actionExecutor = createMockActionExecutor();
      registerFinanceActionHandlers(actionExecutor as any, mockEventBus as any, mockLogger as any);

      expect(mockLogger.info).toHaveBeenCalledWith(
        { handlerCount: 2, module: 'finance' },
        'Finance module action handlers registered',
      );
    });
  });

  // ─── AC-4: Query handlers delegate to finance services ────────────────

  describe('query handler: finance_check_account_balance', () => {
    it('returns account balance when account found', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        code: '4000',
        name: 'Sales Revenue',
        accountType: 'REVENUE',
        normalBalance: 'CREDIT',
        currentBalance: 12500.5,
        openingBalance: 0,
        isActive: true,
      });

      const queryExecutor = createMockQueryExecutor();
      registerFinanceQueryHandlers(queryExecutor as any, mockPrisma as any);

      // Extract the handler that was registered
      const handler = queryExecutor.registerHandler.mock.calls.find(
        (call: any[]) => call[0] === 'finance_check_account_balance',
      )![1] as Function;

      const result = await handler({
        companyId: 'company-1',
        userId: 'user-1',
        input: { accountCode: '4000' },
      });

      expect(result.rowCount).toBe(1);
      expect(result.data).toEqual({
        code: '4000',
        name: 'Sales Revenue',
        accountType: 'REVENUE',
        normalBalance: 'CREDIT',
        currentBalance: 12500.5,
        openingBalance: 0,
        isActive: true,
      });
    });

    it('returns error when account not found', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null);

      const queryExecutor = createMockQueryExecutor();
      registerFinanceQueryHandlers(queryExecutor as any, mockPrisma as any);

      const handler = queryExecutor.registerHandler.mock.calls.find(
        (call: any[]) => call[0] === 'finance_check_account_balance',
      )![1] as Function;

      const result = await handler({
        companyId: 'company-1',
        userId: 'user-1',
        input: { accountCode: '9999' },
      });

      expect(result.rowCount).toBe(0);
      expect(result.data).toEqual({ error: 'No account found with code "9999"' });
    });
  });

  describe('query handler: finance_get_trial_balance', () => {
    it('delegates to getTrialBalance service and returns result', async () => {
      const mockResult = {
        fiscalYear: 2025,
        periodFrom: 1,
        periodTo: 12,
        accounts: [
          {
            accountCode: '1000',
            accountName: 'Cash',
            accountType: 'ASSET',
            normalBalance: 'DEBIT',
            openingBalance: 0,
            totalDebit: 5000,
            totalCredit: 2000,
            closingBalance: 3000,
          },
        ],
        totals: { totalDebit: 5000, totalCredit: 5000, isBalanced: true },
      };
      mockGetTrialBalance.mockResolvedValue(mockResult);

      const queryExecutor = createMockQueryExecutor();
      registerFinanceQueryHandlers(queryExecutor as any, mockPrisma as any);

      const handler = queryExecutor.registerHandler.mock.calls.find(
        (call: any[]) => call[0] === 'finance_get_trial_balance',
      )![1] as Function;

      const result = await handler({
        companyId: 'company-1',
        userId: 'user-1',
        input: { fiscalYear: 2025, periodFrom: 1, periodTo: 12 },
      });

      expect(mockGetTrialBalance).toHaveBeenCalledWith(mockPrisma, 'company-1', {
        fiscalYear: 2025,
        periodFrom: 1,
        periodTo: 12,
      });
      expect(result.data).toEqual(mockResult);
      expect(result.rowCount).toBe(1);
    });

    it('uses default period range when not provided', async () => {
      mockGetTrialBalance.mockResolvedValue({
        accounts: [],
        totals: { totalDebit: 0, totalCredit: 0, isBalanced: true },
      });

      const queryExecutor = createMockQueryExecutor();
      registerFinanceQueryHandlers(queryExecutor as any, mockPrisma as any);

      const handler = queryExecutor.registerHandler.mock.calls.find(
        (call: any[]) => call[0] === 'finance_get_trial_balance',
      )![1] as Function;

      await handler({
        companyId: 'company-1',
        userId: 'user-1',
        input: { fiscalYear: 2025 },
      });

      expect(mockGetTrialBalance).toHaveBeenCalledWith(mockPrisma, 'company-1', {
        fiscalYear: 2025,
        periodFrom: 1,
        periodTo: 12,
      });
    });
  });

  describe('query handler: finance_search_accounts', () => {
    it('delegates to searchAccounts service', async () => {
      const mockAccounts = [
        { code: '4000', name: 'Sales Revenue', accountType: 'REVENUE', currentBalance: 50000 },
        { code: '4010', name: 'Sales Discounts', accountType: 'REVENUE', currentBalance: -1500 },
      ];
      mockSearchAccounts.mockResolvedValue(mockAccounts);

      const queryExecutor = createMockQueryExecutor();
      registerFinanceQueryHandlers(queryExecutor as any, mockPrisma as any);

      const handler = queryExecutor.registerHandler.mock.calls.find(
        (call: any[]) => call[0] === 'finance_search_accounts',
      )![1] as Function;

      const result = await handler({
        companyId: 'company-1',
        userId: 'user-1',
        input: { search: 'sales', accountType: 'REVENUE', limit: 10 },
      });

      expect(mockSearchAccounts).toHaveBeenCalledWith(mockPrisma, 'company-1', {
        search: 'sales',
        accountType: 'REVENUE',
        limit: 10,
      });
      expect(result.data).toEqual(mockAccounts);
      expect(result.rowCount).toBe(2);
    });
  });

  describe('query handler: finance_get_dashboard', () => {
    it('delegates to getDashboard service', async () => {
      const mockDash = {
        fiscalYear: 2025,
        cashPosition: { totalBankBalance: 45000, bankAccounts: [] },
        profitAndLoss: { totalRevenue: 100000, totalExpenses: 80000, netProfit: 20000 },
        activity: {
          draftJournals: 3,
          unmatchedBankTransactions: 5,
          openPeriods: 2,
          closedPeriods: 10,
        },
        alerts: [],
      };
      mockGetDashboard.mockResolvedValue(mockDash);

      const queryExecutor = createMockQueryExecutor();
      registerFinanceQueryHandlers(queryExecutor as any, mockPrisma as any);

      const handler = queryExecutor.registerHandler.mock.calls.find(
        (call: any[]) => call[0] === 'finance_get_dashboard',
      )![1] as Function;

      const result = await handler({
        companyId: 'company-1',
        userId: 'user-1',
        input: { fiscalYear: 2025 },
      });

      expect(mockGetDashboard).toHaveBeenCalledWith(mockPrisma, 'company-1', {
        fiscalYear: 2025,
      });
      expect(result.data).toEqual(mockDash);
      expect(result.rowCount).toBe(1);
    });

    it('passes undefined fiscalYear when not provided', async () => {
      mockGetDashboard.mockResolvedValue({});

      const queryExecutor = createMockQueryExecutor();
      registerFinanceQueryHandlers(queryExecutor as any, mockPrisma as any);

      const handler = queryExecutor.registerHandler.mock.calls.find(
        (call: any[]) => call[0] === 'finance_get_dashboard',
      )![1] as Function;

      await handler({
        companyId: 'company-1',
        userId: 'user-1',
        input: {},
      });

      expect(mockGetDashboard).toHaveBeenCalledWith(mockPrisma, 'company-1', {
        fiscalYear: undefined,
      });
    });
  });

  // ─── AC-4: Action handlers delegate to finance services ───────────────

  describe('action handler: CREATE_JOURNAL', () => {
    it('delegates to createJournalEntry and returns entityId + displayRef', async () => {
      mockCreateJournalEntry.mockResolvedValue({
        id: 'journal-1',
        entryNumber: 'JNL-0001',
        description: 'Monthly rent',
      });

      const actionExecutor = createMockActionExecutor();
      registerFinanceActionHandlers(actionExecutor as any, mockEventBus as any, mockLogger as any);

      const handler = actionExecutor._handlers.get('CREATE_JOURNAL') as Function;

      const result = await handler(
        mockPrisma, // db (transaction client)
        'company-1',
        'user-1',
        {
          description: 'Monthly rent',
          transactionDate: '2025-03-01',
          periodId: 'period-1',
          lines: [
            { accountCode: '6000', debit: 1500, credit: 0, description: 'Rent expense' },
            { accountCode: '1000', debit: 0, credit: 1500, description: 'Cash' },
          ],
        },
      );

      expect(result.entityId).toBe('journal-1');
      expect(result.displayRef).toContain('JNL-0001');
      expect(result.displayRef).toContain('Monthly rent');

      expect(mockCreateJournalEntry).toHaveBeenCalledWith(
        mockPrisma,
        mockEventBus,
        'company-1',
        expect.objectContaining({
          description: 'Monthly rent',
          periodId: 'period-1',
          lines: expect.arrayContaining([
            expect.objectContaining({ accountCode: '6000', debit: 1500, credit: 0 }),
            expect.objectContaining({ accountCode: '1000', debit: 0, credit: 1500 }),
          ]),
        }),
        'user-1',
      );
    });

    it('passes transaction date as Date object', async () => {
      mockCreateJournalEntry.mockResolvedValue({
        id: 'journal-2',
        entryNumber: 'JNL-0002',
        description: 'Test',
      });

      const actionExecutor = createMockActionExecutor();
      registerFinanceActionHandlers(actionExecutor as any, mockEventBus as any, mockLogger as any);

      const handler = actionExecutor._handlers.get('CREATE_JOURNAL') as Function;

      await handler(mockPrisma, 'company-1', 'user-1', {
        description: 'Test',
        transactionDate: '2025-06-15',
        periodId: 'period-2',
        lines: [
          { accountCode: '1000', debit: 100 },
          { accountCode: '2000', credit: 100 },
        ],
      });

      const callArgs = mockCreateJournalEntry.mock.calls[0];
      const inputArg = callArgs[3]; // 4th argument is the data
      expect(inputArg.transactionDate).toBeInstanceOf(Date);
      expect(inputArg.transactionDate.toISOString()).toContain('2025-06-15');
    });
  });

  describe('action handler: CREATE_BUDGET', () => {
    it('delegates to createBudget and returns entityId + displayRef', async () => {
      mockCreateBudget.mockResolvedValue({
        id: 'budget-1',
        name: 'FY2025 Annual Budget',
        fiscalYear: 2025,
      });

      const actionExecutor = createMockActionExecutor();
      registerFinanceActionHandlers(actionExecutor as any, mockEventBus as any, mockLogger as any);

      const handler = actionExecutor._handlers.get('CREATE_BUDGET') as Function;

      const result = await handler(mockPrisma, 'company-1', 'user-1', {
        name: 'FY2025 Annual Budget',
        fiscalYear: 2025,
        budgetType: 'ANNUAL',
        description: 'Annual company budget',
        lines: [
          { accountCode: '4000', period1: 10000, period2: 10000 },
          { accountCode: '6000', period1: 5000, period2: 5000 },
        ],
      });

      expect(result.entityId).toBe('budget-1');
      expect(result.displayRef).toContain('FY2025 Annual Budget');
      expect(result.displayRef).toContain('2025');

      expect(mockCreateBudget).toHaveBeenCalledWith(
        mockPrisma,
        'company-1',
        expect.objectContaining({
          name: 'FY2025 Annual Budget',
          fiscalYear: 2025,
          budgetType: 'ANNUAL',
          description: 'Annual company budget',
        }),
        'user-1',
      );
    });

    it('defaults missing period amounts to 0', async () => {
      mockCreateBudget.mockResolvedValue({
        id: 'budget-2',
        name: 'Test',
        fiscalYear: 2025,
      });

      const actionExecutor = createMockActionExecutor();
      registerFinanceActionHandlers(actionExecutor as any, mockEventBus as any, mockLogger as any);

      const handler = actionExecutor._handlers.get('CREATE_BUDGET') as Function;

      await handler(mockPrisma, 'company-1', 'user-1', {
        name: 'Test',
        fiscalYear: 2025,
        lines: [{ accountCode: '4000', period1: 5000 }],
      });

      const callArgs = mockCreateBudget.mock.calls[0];
      const inputArg = callArgs[2]; // 3rd argument is the data
      const line = inputArg.lines[0];

      // period1 should be 5000, all others should default to 0
      expect(line.period1).toBe(5000);
      expect(line.period2).toBe(0);
      expect(line.period3).toBe(0);
      expect(line.period12).toBe(0);
    });

    it('defaults budgetType to ANNUAL when not provided', async () => {
      mockCreateBudget.mockResolvedValue({
        id: 'budget-3',
        name: 'No type',
        fiscalYear: 2025,
      });

      const actionExecutor = createMockActionExecutor();
      registerFinanceActionHandlers(actionExecutor as any, mockEventBus as any, mockLogger as any);

      const handler = actionExecutor._handlers.get('CREATE_BUDGET') as Function;

      await handler(mockPrisma, 'company-1', 'user-1', {
        name: 'No type',
        fiscalYear: 2025,
        lines: [{ accountCode: '4000' }],
      });

      const callArgs = mockCreateBudget.mock.calls[0];
      const inputArg = callArgs[2];
      expect(inputArg.budgetType).toBe('ANNUAL');
    });
  });
});
