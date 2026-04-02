// ---------------------------------------------------------------------------
// Finance AI Skill Pack — Tool definitions, query handlers, and action handlers
// E14-S27: Register AI skills the copilot can invoke for finance operations
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { ToolDefinition, QueryToolHandler } from '@nexa/ai-tools';
import type { ToolRegistry } from '@nexa/ai-tools';
import type { QueryExecutor } from '../../ai/query-executor.js';
import type { ActionHandler, ActionExecutor } from '../../ai/action-executor.js';
import type { EventBus } from '../../core/events/event-bus.js';
import type { Logger } from 'pino';

import { createJournalEntry } from './journals.service.js';
import { searchAccounts } from './accounts.service.js';
import { getTrialBalance } from './reports.service.js';
import { createBudget } from './budgets.service.js';
import { getDashboard } from './dashboard.service.js';

// ---------------------------------------------------------------------------
// Tool Definitions — registered in the ToolRegistry for SkillRouter L2
// ---------------------------------------------------------------------------

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;

export const FINANCE_TOOLS: ToolDefinition[] = [
  // 1. create_journal — action tool (requires approval via guardrails)
  {
    name: 'finance_create_journal',
    description:
      'Create a new journal entry with debit/credit lines. The period is auto-resolved from the transaction date if not provided. Requires a description, transaction date, and at least two balanced lines.',
    moduleKey: 'finance',
    type: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Description of the journal entry',
        },
        transactionDate: {
          type: 'string',
          format: 'date',
          description: 'Transaction date in ISO format (YYYY-MM-DD)',
        },
        periodId: {
          type: 'string',
          description:
            'UUID of the financial period. Optional — if not provided, auto-resolved from the transaction date.',
        },
        reference: {
          type: 'string',
          description: 'Optional external reference',
        },
        lines: {
          type: 'array',
          description: 'Array of journal lines (min 2, must balance)',
          items: {
            type: 'object',
            properties: {
              accountCode: {
                type: 'string',
                description: 'Chart of account code (e.g. "4000")',
              },
              debit: {
                type: 'number',
                description: 'Debit amount (0 if credit line)',
                default: 0,
              },
              credit: {
                type: 'number',
                description: 'Credit amount (0 if debit line)',
                default: 0,
              },
              description: {
                type: 'string',
                description: 'Optional line description',
              },
            },
            required: ['accountCode'],
          },
        },
      },
      required: ['description', 'transactionDate', 'lines'],
    },
  },

  // 2. check_account_balance — query tool
  {
    name: 'finance_check_account_balance',
    description:
      'Check the current balance of a GL account by its code. Returns the account name, type, and current balance.',
    moduleKey: 'finance',
    type: 'query',
    inputSchema: {
      type: 'object',
      properties: {
        accountCode: {
          type: 'string',
          description: 'The chart of account code to look up (e.g. "1000", "4000")',
        },
      },
      required: ['accountCode'],
    },
  },

  // 3. get_trial_balance — query tool
  {
    name: 'finance_get_trial_balance',
    description:
      'Get the trial balance report for a fiscal year and period range. Shows all account balances with debits, credits, and closing balances.',
    moduleKey: 'finance',
    type: 'query',
    inputSchema: {
      type: 'object',
      properties: {
        fiscalYear: {
          type: 'number',
          description: 'Fiscal year (e.g. 2025)',
        },
        periodFrom: {
          type: 'number',
          description: 'Starting period number (1-13, default 1)',
          default: 1,
        },
        periodTo: {
          type: 'number',
          description: 'Ending period number (1-13, default 12)',
          default: 12,
        },
      },
      required: ['fiscalYear'],
    },
  },

  // 4. search_accounts — query tool
  {
    name: 'finance_search_accounts',
    description:
      'Search the chart of accounts by name or code. Returns matching accounts with their type, balance, and status.',
    moduleKey: 'finance',
    type: 'query',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Search term to match against account code or name',
        },
        accountType: {
          type: 'string',
          description: 'Optional filter by account type',
          enum: [...ACCOUNT_TYPES],
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default 20, max 100)',
          default: 20,
        },
      },
      required: ['search'],
    },
  },

  // 5. create_budget — action tool (requires approval via guardrails)
  {
    name: 'finance_create_budget',
    description:
      'Create a new budget with period amounts per account. Creates a DRAFT budget that can be approved later.',
    moduleKey: 'finance',
    type: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Budget name (e.g. "FY2025 Annual Budget")',
        },
        fiscalYear: {
          type: 'number',
          description: 'Fiscal year for the budget (e.g. 2025)',
        },
        budgetType: {
          type: 'string',
          description: 'Budget type',
          enum: ['ANNUAL', 'REVISED'],
          default: 'ANNUAL',
        },
        description: {
          type: 'string',
          description: 'Optional budget description',
        },
        lines: {
          type: 'array',
          description: 'Budget lines with period amounts',
          items: {
            type: 'object',
            properties: {
              accountCode: {
                type: 'string',
                description: 'Chart of account code',
              },
              period1: { type: 'number', default: 0 },
              period2: { type: 'number', default: 0 },
              period3: { type: 'number', default: 0 },
              period4: { type: 'number', default: 0 },
              period5: { type: 'number', default: 0 },
              period6: { type: 'number', default: 0 },
              period7: { type: 'number', default: 0 },
              period8: { type: 'number', default: 0 },
              period9: { type: 'number', default: 0 },
              period10: { type: 'number', default: 0 },
              period11: { type: 'number', default: 0 },
              period12: { type: 'number', default: 0 },
            },
            required: ['accountCode'],
          },
        },
      },
      required: ['name', 'fiscalYear', 'lines'],
    },
  },

  // 6. get_dashboard — query tool
  {
    name: 'finance_get_dashboard',
    description:
      'Get the finance dashboard summary: cash position, P&L, activity counts, VAT status, and alerts.',
    moduleKey: 'finance',
    type: 'query',
    inputSchema: {
      type: 'object',
      properties: {
        fiscalYear: {
          type: 'number',
          description: 'Optional fiscal year (defaults to current)',
        },
      },
    },
  },

  // 7. run_report — query tool (navigation, no DB)
  {
    name: 'finance_run_report',
    description:
      'Open a financial report page with specified parameters. Use this when the user asks to run, view, or show a financial report such as P&L, Balance Sheet, Trial Balance, etc.',
    moduleKey: 'finance',
    type: 'query' as const,
    inputSchema: {
      type: 'object',
      properties: {
        reportType: {
          type: 'string',
          enum: [
            'profit-and-loss',
            'balance-sheet',
            'trial-balance',
            'gl-detail',
            'general-ledger',
            'budget-variance',
            'departmental-pnl',
            'transaction-journal',
          ],
          description: 'The type of financial report to run',
        },
        fiscalYear: { type: 'number', description: 'Fiscal year (e.g. 2025)' },
        periodFrom: { type: 'number', description: 'Start period (1-13), defaults to 1' },
        periodTo: { type: 'number', description: 'End period (1-13), defaults to 12' },
        dimensionTypeId: { type: 'string', description: 'Dimension type UUID for filtering' },
        dimensionValueId: { type: 'string', description: 'Dimension value UUID for filtering' },
        includeSimulations: { type: 'boolean', description: 'Include simulation entries' },
      },
      required: ['reportType', 'fiscalYear'],
    },
  },

  // 8. list_dimensions — query tool
  {
    name: 'finance_list_dimensions',
    description:
      'List available dimension types and their values. Use when the user asks about dimensions, departments, cost centres, or wants to filter reports by dimension.',
    moduleKey: 'finance',
    type: 'query' as const,
    inputSchema: {
      type: 'object',
      properties: {
        dimensionTypeId: {
          type: 'string',
          description: 'If provided, returns values for this dimension type only',
        },
      },
    },
  },

  // 9. list_fiscal_years — query tool
  {
    name: 'finance_list_fiscal_years',
    description: 'List available fiscal years configured in the system.',
    moduleKey: 'finance',
    type: 'query' as const,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Query Tool Handlers — READ-only, registered with QueryExecutor
// ---------------------------------------------------------------------------

function createCheckAccountBalanceHandler(db: PrismaClient): QueryToolHandler {
  return async ({ companyId, input }) => {
    const accountCode = input.accountCode as string;

    const account = await db.chartOfAccount.findFirst({
      where: { companyId, code: accountCode },
      select: {
        id: true,
        code: true,
        name: true,
        accountType: true,
        normalBalance: true,
        currentBalance: true,
        openingBalance: true,
        isActive: true,
      },
    });

    if (!account) {
      return {
        data: { error: `No account found with code "${accountCode}"` },
        rowCount: 0,
      };
    }

    return {
      data: {
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        normalBalance: account.normalBalance,
        currentBalance: Number(account.currentBalance ?? 0),
        openingBalance: Number(account.openingBalance ?? 0),
        isActive: account.isActive,
      },
      rowCount: 1,
    };
  };
}

function createGetTrialBalanceHandler(db: PrismaClient): QueryToolHandler {
  return async ({ companyId, input }) => {
    const fiscalYear = input.fiscalYear as number;
    const periodFrom = (input.periodFrom as number) ?? 1;
    const periodTo = (input.periodTo as number) ?? 12;

    const result = await getTrialBalance(db, companyId, {
      fiscalYear,
      periodFrom,
      periodTo,
    });

    return {
      data: result,
      rowCount: result.accounts.length,
    };
  };
}

function createSearchAccountsHandler(db: PrismaClient): QueryToolHandler {
  return async ({ companyId, input }) => {
    const search = input.search as string;
    const accountType = input.accountType as string | undefined;
    const limit = (input.limit as number) ?? 20;

    const results = await searchAccounts(db, companyId, {
      search,
      accountType: accountType as any,
      limit,
    });

    return {
      data: results,
      rowCount: results.length,
    };
  };
}

function createGetDashboardHandler(db: PrismaClient): QueryToolHandler {
  return async ({ companyId, input }) => {
    const fiscalYear = input.fiscalYear as number | undefined;

    const result = await getDashboard(db, companyId, {
      fiscalYear,
    });

    return {
      data: result,
      rowCount: 1,
    };
  };
}

function createRunReportHandler(): QueryToolHandler {
  return async ({ input }) => {
    const reportType = input.reportType as string;
    const fiscalYear = input.fiscalYear as number;
    const periodFrom = (input.periodFrom as number) ?? 1;
    const periodTo = (input.periodTo as number) ?? 12;

    const params = new URLSearchParams();
    params.set('fiscalYear', String(fiscalYear));
    params.set('periodFrom', String(periodFrom));
    params.set('periodTo', String(periodTo));
    if (input.dimensionTypeId) params.set('dimensionTypeId', input.dimensionTypeId as string);
    if (input.dimensionValueId) params.set('dimensionValueId', input.dimensionValueId as string);
    if (input.includeSimulations) params.set('includeSimulations', 'true');
    params.set('autoRun', 'true');

    const route = `/finance/reports/${reportType}?${params.toString()}`;

    return {
      data: {
        _navigateTo: route,
        description: `${reportType.replace(/-/g, ' ')} report for FY ${fiscalYear} (periods ${periodFrom}-${periodTo})`,
      },
      rowCount: 1,
    };
  };
}

function createListDimensionsHandler(db: PrismaClient): QueryToolHandler {
  return async ({ companyId, input }) => {
    const dimensionTypeId = input.dimensionTypeId as string | undefined;

    if (dimensionTypeId) {
      const values = await db.dimensionValue.findMany({
        where: { companyId, dimensionTypeId, isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      });
      return { data: { values }, rowCount: values.length };
    }

    const types = await db.dimensionType.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        values: {
          where: { isActive: true },
          select: { id: true, code: true, name: true },
          orderBy: { code: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return { data: { dimensionTypes: types }, rowCount: types.length };
  };
}

function createListFiscalYearsHandler(db: PrismaClient): QueryToolHandler {
  return async ({ companyId }) => {
    // Fiscal years are derived from financial periods (no standalone FiscalYear model)
    const periods = await db.financialPeriod.findMany({
      where: { companyId },
      select: { fiscalYear: true, status: true },
      orderBy: { fiscalYear: 'desc' },
    });

    // Group by fiscal year — a year is "closed" only if ALL its periods are CLOSED
    const yearMap = new Map<number, { year: number; isClosed: boolean }>();
    for (const p of periods) {
      const existing = yearMap.get(p.fiscalYear);
      if (!existing) {
        yearMap.set(p.fiscalYear, { year: p.fiscalYear, isClosed: p.status === 'CLOSED' });
      } else if (p.status !== 'CLOSED') {
        existing.isClosed = false;
      }
    }

    const fiscalYears = Array.from(yearMap.values()).sort((a, b) => b.year - a.year);

    return { data: { fiscalYears }, rowCount: fiscalYears.length };
  };
}

// ---------------------------------------------------------------------------
// Action Handlers — mutations, registered with ActionExecutor
// ---------------------------------------------------------------------------

function createJournalActionHandler(eventBus: EventBus): ActionHandler {
  return async (db, companyId, userId, data) => {
    const lines = (data.lines as Array<Record<string, unknown>>) ?? [];
    const transactionDate = new Date(data.transactionDate as string);

    // Auto-resolve periodId from transaction date if not provided
    let periodId = data.periodId as string | undefined;
    if (!periodId) {
      const period = await db.financialPeriod.findFirst({
        where: {
          companyId,
          startDate: { lte: transactionDate },
          endDate: { gte: transactionDate },
          status: 'OPEN',
        },
        select: { id: true },
        orderBy: { startDate: 'desc' },
      });
      if (!period) {
        throw new Error(
          `No open financial period found for date ${transactionDate.toISOString().slice(0, 10)}`,
        );
      }
      periodId = period.id;
    }

    const entry = (await createJournalEntry(
      db,
      eventBus,
      companyId,
      {
        transactionDate,
        description: data.description as string,
        reference: data.reference as string | undefined,
        periodId,
        lines: lines.map((line) => ({
          accountCode: line.accountCode as string,
          debit: (line.debit as number) ?? 0,
          credit: (line.credit as number) ?? 0,
          description: line.description as string | undefined,
        })),
      },
      userId,
    )) as Record<string, unknown>;

    return {
      entityId: entry.id as string,
      displayRef: `Journal ${entry.entryNumber} — ${entry.description}`,
    };
  };
}

const createBudgetActionHandler: ActionHandler = async (db, companyId, userId, data) => {
  const lines = (data.lines as Array<Record<string, unknown>>) ?? [];

  const budget = (await createBudget(
    db,
    companyId,
    {
      name: data.name as string,
      fiscalYear: data.fiscalYear as number,
      budgetType: (data.budgetType as 'ANNUAL' | 'REVISED') ?? 'ANNUAL',
      description: data.description as string | undefined,
      lines: lines.map((line) => ({
        accountCode: line.accountCode as string,
        period1: (line.period1 as number) ?? 0,
        period2: (line.period2 as number) ?? 0,
        period3: (line.period3 as number) ?? 0,
        period4: (line.period4 as number) ?? 0,
        period5: (line.period5 as number) ?? 0,
        period6: (line.period6 as number) ?? 0,
        period7: (line.period7 as number) ?? 0,
        period8: (line.period8 as number) ?? 0,
        period9: (line.period9 as number) ?? 0,
        period10: (line.period10 as number) ?? 0,
        period11: (line.period11 as number) ?? 0,
        period12: (line.period12 as number) ?? 0,
      })),
    },
    userId,
  )) as Record<string, unknown>;

  return {
    entityId: budget.id as string,
    displayRef: `Budget "${budget.name}" (${budget.fiscalYear})`,
  };
};

// ---------------------------------------------------------------------------
// Registration Functions
// ---------------------------------------------------------------------------

/**
 * Register all finance tool definitions in the ToolRegistry.
 * Query tools get sentinel handlers that throw if invoked before real handlers
 * are wired via registerFinanceQueryHandlers().
 */
export function registerFinanceTools(registry: ToolRegistry): void {
  for (const definition of FINANCE_TOOLS) {
    if (definition.type === 'action') {
      registry.registerTool({ definition: definition as ToolDefinition & { type: 'action' } });
    } else {
      // Query tools: register with sentinel handler (replaced by real handler below)
      const toolName = definition.name;
      registry.registerTool({
        definition: definition as ToolDefinition & { type: 'query' },
        handler: async () => {
          throw new Error(
            `Query handler for "${toolName}" not initialized. ` +
              `Ensure registerFinanceQueryHandlers() is called after registerFinanceTools().`,
          );
        },
      });
    }
  }
}

/**
 * Register query handlers for finance query tools with the QueryExecutor.
 * Each handler captures the PrismaClient via closure.
 */
export function registerFinanceQueryHandlers(queryExecutor: QueryExecutor, db: PrismaClient): void {
  queryExecutor.registerHandler(
    'finance_check_account_balance',
    createCheckAccountBalanceHandler(db),
  );
  queryExecutor.registerHandler('finance_get_trial_balance', createGetTrialBalanceHandler(db));
  queryExecutor.registerHandler('finance_search_accounts', createSearchAccountsHandler(db));
  queryExecutor.registerHandler('finance_get_dashboard', createGetDashboardHandler(db));
  queryExecutor.registerHandler('finance_run_report', createRunReportHandler());
  queryExecutor.registerHandler('finance_list_dimensions', createListDimensionsHandler(db));
  queryExecutor.registerHandler('finance_list_fiscal_years', createListFiscalYearsHandler(db));
}

/**
 * Register finance action handlers with the ActionExecutor.
 * These execute confirmed AI action proposals through the standard service layer.
 */
export function registerFinanceActionHandlers(
  actionExecutor: ActionExecutor,
  eventBus: EventBus,
  logger: Logger,
): void {
  actionExecutor.registerHandler('CREATE_JOURNAL', createJournalActionHandler(eventBus));
  actionExecutor.registerHandler('FINANCE_CREATE_JOURNAL', createJournalActionHandler(eventBus));
  actionExecutor.registerHandler('CREATE_BUDGET', createBudgetActionHandler);
  actionExecutor.registerHandler('FINANCE_CREATE_BUDGET', createBudgetActionHandler);

  logger.info({ handlerCount: 2, module: 'finance' }, 'Finance module action handlers registered');
}
