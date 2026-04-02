// ---------------------------------------------------------------------------
// Page Registry — code-based lookup of all navigable ERP pages
// The AI copilot uses this to navigate users to pages and auto-populate
// report filters. Will be DB-backed in a future iteration.
// ---------------------------------------------------------------------------

export interface PageParam {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  description: string;
}

export interface PageEntry {
  key: string;
  route: string;
  description: string;
  module: string;
  params: PageParam[];
  supportsAutoRun: boolean;
}

// ---------------------------------------------------------------------------
// PAGE_REGISTRY
// ---------------------------------------------------------------------------

export const PAGE_REGISTRY: PageEntry[] = [
  // ── Finance Reports (supportsAutoRun: true) ──────────────────────────────

  {
    key: 'finance/profit-and-loss',
    route: '/finance/reports/profit-and-loss',
    description: 'Profit & Loss report showing revenue and expense summary for a period.',
    module: 'finance',
    params: [
      {
        name: 'fiscalYear',
        type: 'number',
        required: true,
        description: 'Fiscal year (e.g. 2025)',
      },
      {
        name: 'periodFrom',
        type: 'number',
        required: false,
        description: 'Starting period number (1–13)',
      },
      {
        name: 'periodTo',
        type: 'number',
        required: false,
        description: 'Ending period number (1–13)',
      },
      {
        name: 'dimensionTypeId',
        type: 'string',
        required: false,
        description: 'Dimension type UUID for filtering',
      },
      {
        name: 'dimensionValueId',
        type: 'string',
        required: false,
        description: 'Dimension value UUID for filtering',
      },
      {
        name: 'includeSimulations',
        type: 'boolean',
        required: false,
        description: 'Include simulation entries',
      },
    ],
    supportsAutoRun: true,
  },

  {
    key: 'finance/balance-sheet',
    route: '/finance/reports/balance-sheet',
    description: 'Balance Sheet report showing assets, liabilities and equity at a point in time.',
    module: 'finance',
    params: [
      {
        name: 'fiscalYear',
        type: 'number',
        required: true,
        description: 'Fiscal year (e.g. 2025)',
      },
      {
        name: 'periodFrom',
        type: 'number',
        required: false,
        description: 'Starting period number (1–13)',
      },
      {
        name: 'periodTo',
        type: 'number',
        required: false,
        description: 'Ending period number (1–13)',
      },
      {
        name: 'dimensionTypeId',
        type: 'string',
        required: false,
        description: 'Dimension type UUID for filtering',
      },
      {
        name: 'dimensionValueId',
        type: 'string',
        required: false,
        description: 'Dimension value UUID for filtering',
      },
    ],
    supportsAutoRun: true,
  },

  {
    key: 'finance/trial-balance',
    route: '/finance/reports/trial-balance',
    description: 'Trial Balance report listing all account balances for a period.',
    module: 'finance',
    params: [
      {
        name: 'fiscalYear',
        type: 'number',
        required: true,
        description: 'Fiscal year (e.g. 2025)',
      },
      {
        name: 'periodFrom',
        type: 'number',
        required: false,
        description: 'Starting period number (1–13)',
      },
      {
        name: 'periodTo',
        type: 'number',
        required: false,
        description: 'Ending period number (1–13)',
      },
    ],
    supportsAutoRun: true,
  },

  {
    key: 'finance/gl-detail',
    route: '/finance/reports/gl-detail',
    description: 'General Ledger Detail report showing all transactions for a specific account.',
    module: 'finance',
    params: [
      {
        name: 'fiscalYear',
        type: 'number',
        required: true,
        description: 'Fiscal year (e.g. 2025)',
      },
      {
        name: 'accountId',
        type: 'string',
        required: false,
        description: 'Account UUID to show detail for',
      },
      {
        name: 'periodFrom',
        type: 'number',
        required: false,
        description: 'Starting period number (1–13)',
      },
      {
        name: 'periodTo',
        type: 'number',
        required: false,
        description: 'Ending period number (1–13)',
      },
    ],
    supportsAutoRun: true,
  },

  {
    key: 'finance/general-ledger',
    route: '/finance/reports/general-ledger',
    description: 'General Ledger report showing all journal activity across all accounts.',
    module: 'finance',
    params: [
      {
        name: 'fiscalYear',
        type: 'number',
        required: true,
        description: 'Fiscal year (e.g. 2025)',
      },
      {
        name: 'periodFrom',
        type: 'number',
        required: false,
        description: 'Starting period number (1–13)',
      },
      {
        name: 'periodTo',
        type: 'number',
        required: false,
        description: 'Ending period number (1–13)',
      },
    ],
    supportsAutoRun: true,
  },

  {
    key: 'finance/budget-variance',
    route: '/finance/reports/budget-variance',
    description: 'Budget Variance report comparing actual vs budgeted figures.',
    module: 'finance',
    params: [
      {
        name: 'fiscalYear',
        type: 'number',
        required: true,
        description: 'Fiscal year (e.g. 2025)',
      },
      {
        name: 'periodFrom',
        type: 'number',
        required: false,
        description: 'Starting period number (1–13)',
      },
      {
        name: 'periodTo',
        type: 'number',
        required: false,
        description: 'Ending period number (1–13)',
      },
    ],
    supportsAutoRun: true,
  },

  {
    key: 'finance/departmental-pnl',
    route: '/finance/reports/departmental-pnl',
    description: 'Departmental P&L report breaking down profit and loss by department/dimension.',
    module: 'finance',
    params: [
      {
        name: 'fiscalYear',
        type: 'number',
        required: true,
        description: 'Fiscal year (e.g. 2025)',
      },
      {
        name: 'periodFrom',
        type: 'number',
        required: false,
        description: 'Starting period number (1–13)',
      },
      {
        name: 'periodTo',
        type: 'number',
        required: false,
        description: 'Ending period number (1–13)',
      },
    ],
    supportsAutoRun: true,
  },

  {
    key: 'finance/transaction-journal',
    route: '/finance/reports/transaction-journal',
    description: 'Transaction Journal report listing all posted journal entries for a period.',
    module: 'finance',
    params: [
      {
        name: 'fiscalYear',
        type: 'number',
        required: true,
        description: 'Fiscal year (e.g. 2025)',
      },
      {
        name: 'periodFrom',
        type: 'number',
        required: false,
        description: 'Starting period number (1–13)',
      },
      {
        name: 'periodTo',
        type: 'number',
        required: false,
        description: 'Ending period number (1–13)',
      },
    ],
    supportsAutoRun: true,
  },

  // ── Finance Pages (no autoRun, no params) ────────────────────────────────

  {
    key: 'finance/chart-of-accounts',
    route: '/finance/chart-of-accounts',
    description: 'Chart of Accounts — manage GL accounts.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/journals',
    route: '/finance/journals',
    description: 'Journal Entries — view and manage general journal entries.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/dimensions',
    route: '/finance/dimensions',
    description:
      'Dimensions — manage dimension types and values (departments, cost centres, etc.).',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/fiscal-years',
    route: '/finance/fiscal-years',
    description: 'Fiscal Years — manage fiscal years and accounting periods.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/budgets',
    route: '/finance/budgets',
    description: 'Budgets — create and manage annual and revised budgets.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/dashboard',
    route: '/finance',
    description: 'Finance Dashboard — cash position, P&L summary, and key finance KPIs.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/bank-reconciliation',
    route: '/finance/bank-reconciliation',
    description: 'Bank Reconciliation — match bank statement transactions to GL entries.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  // ── System Pages (no autoRun, no params) ─────────────────────────────────

  {
    key: 'system/users',
    route: '/system/users',
    description: 'Users — manage system users and their access.',
    module: 'system',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'system/access-groups',
    route: '/system/access-groups',
    description: 'Access Groups — manage RBAC roles and permission sets.',
    module: 'system',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'system/companies',
    route: '/system/companies',
    description: 'Companies — manage multi-company configuration.',
    module: 'system',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'system/audit-log',
    route: '/system/audit-log',
    description: 'Audit Log — view system-wide audit trail of all changes.',
    module: 'system',
    params: [],
    supportsAutoRun: false,
  },

  // ── AI Admin Pages (no autoRun, no params) ───────────────────────────────

  {
    key: 'ai/providers',
    route: '/ai/providers',
    description: 'AI Providers — configure LLM providers and API keys.',
    module: 'ai',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'ai/skills',
    route: '/ai/skills',
    description: 'AI Skills — manage AI skill definitions and routing configuration.',
    module: 'ai',
    params: [],
    supportsAutoRun: false,
  },
];

// ---------------------------------------------------------------------------
// Lookup Helpers
// ---------------------------------------------------------------------------

/** Case-insensitive lookup by key. */
export function getPage(key: string): PageEntry | undefined {
  const normalised = key.toLowerCase().trim();
  return PAGE_REGISTRY.find((p) => p.key.toLowerCase() === normalised);
}

/**
 * Build a frontend URL for a page, substituting known params as query
 * string values. Appends `autoRun=true` for pages that support it.
 */
export function buildPageRoute(page: PageEntry, params: Record<string, unknown>): string {
  const qs = new URLSearchParams();

  for (const param of page.params) {
    const value = params[param.name];
    if (value !== undefined && value !== null && value !== '') {
      qs.set(param.name, String(value));
    }
  }

  if (page.supportsAutoRun) {
    qs.set('autoRun', 'true');
  }

  const queryString = qs.toString();
  return queryString ? `${page.route}?${queryString}` : page.route;
}

/**
 * Build a system-prompt context block listing all available pages.
 * Used by the LLM to understand what pages it can navigate to.
 */
export function buildPageListContext(): string {
  const lines: string[] = [];

  // Group by module for readability
  const byModule = new Map<string, PageEntry[]>();
  for (const page of PAGE_REGISTRY) {
    const group = byModule.get(page.module) ?? [];
    group.push(page);
    byModule.set(page.module, group);
  }

  for (const [module, pages] of byModule) {
    lines.push(`## ${module.toUpperCase()} module`);
    for (const page of pages) {
      const requiredParams = page.params.filter((p) => p.required);
      const optionalParams = page.params.filter((p) => !p.required);

      let paramSig = '';
      if (requiredParams.length > 0) {
        paramSig += requiredParams.map((p) => `${p.name}: ${p.type} (required)`).join(', ');
      }
      if (optionalParams.length > 0) {
        if (paramSig) paramSig += ', ';
        paramSig += optionalParams.map((p) => `${p.name}: ${p.type}`).join(', ');
      }

      const autoRunNote = page.supportsAutoRun ? ' [auto-runs with params]' : '';
      lines.push(
        `- key: "${page.key}"${autoRunNote}`,
        `  description: ${page.description}`,
        paramSig ? `  params: ${paramSig}` : '',
      );
    }
    lines.push('');
  }

  return `<available_pages>\n${lines.filter((l) => l !== undefined).join('\n')}</available_pages>`;
}
