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

  // ── Finance Pages (new additions) ────────────────────────────────────────

  {
    key: 'finance/account-mappings',
    route: '/finance/account-mappings',
    description: 'Account Type Mappings.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/bank-accounts',
    route: '/finance/bank-accounts',
    description: 'Bank Account List.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/bank-accounts/detail',
    route: '/finance/bank-accounts/$id',
    description: 'Bank Account Details.',
    module: 'finance',
    params: [
      {
        name: 'id',
        type: 'string',
        required: true,
        description: 'Bank account UUID',
      },
    ],
    supportsAutoRun: false,
  },

  {
    key: 'finance/bank-accounts/new',
    route: '/finance/bank-accounts/new',
    description: 'Create Bank Account.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/bank-recon-rules',
    route: '/finance/bank-recon-rules',
    description: 'Bank Reconciliation Rules.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/bank-reconciliation/detail',
    route: '/finance/bank-reconciliation/$id',
    description: 'Bank Reconciliation Session Details.',
    module: 'finance',
    params: [
      {
        name: 'id',
        type: 'string',
        required: true,
        description: 'Bank reconciliation session UUID',
      },
    ],
    supportsAutoRun: false,
  },

  {
    key: 'finance/budgets/detail',
    route: '/finance/budgets/$id',
    description: 'Budget Details.',
    module: 'finance',
    params: [
      {
        name: 'id',
        type: 'string',
        required: true,
        description: 'Budget UUID',
      },
    ],
    supportsAutoRun: false,
  },

  {
    key: 'finance/chart-of-accounts/detail',
    route: '/finance/chart-of-accounts/$id',
    description: 'Account Details.',
    module: 'finance',
    params: [
      {
        name: 'id',
        type: 'string',
        required: true,
        description: 'Account UUID',
      },
    ],
    supportsAutoRun: false,
  },

  {
    key: 'finance/dimensions/values',
    route: '/finance/dimensions/$typeId/values',
    description: 'Dimension Values.',
    module: 'finance',
    params: [
      {
        name: 'typeId',
        type: 'string',
        required: true,
        description: 'Dimension type UUID',
      },
    ],
    supportsAutoRun: false,
  },

  {
    key: 'finance/dimensions/bulk-assign',
    route: '/finance/dimensions/bulk-assign',
    description: 'Bulk Assign Dimensions.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/dimensions/defaults',
    route: '/finance/dimensions/defaults',
    description: 'Dimension Defaults.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/dimensions/requirements',
    route: '/finance/dimensions/requirements',
    description: 'Dimension Requirements.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/import',
    route: '/finance/import',
    description: 'Finance Data Import.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/journals/detail',
    route: '/finance/journals/$id',
    description: 'Journal Entry Details.',
    module: 'finance',
    params: [
      {
        name: 'id',
        type: 'string',
        required: true,
        description: 'Journal entry UUID',
      },
    ],
    supportsAutoRun: false,
  },

  {
    key: 'finance/journals/new',
    route: '/finance/journals/new',
    description: 'Create Journal Entry.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/month-end',
    route: '/finance/month-end',
    description: 'Month End Close List.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/month-end/detail',
    route: '/finance/month-end/$periodId',
    description: 'Month End Close.',
    module: 'finance',
    params: [
      {
        name: 'periodId',
        type: 'string',
        required: true,
        description: 'Period UUID',
      },
    ],
    supportsAutoRun: false,
  },

  {
    key: 'finance/opening-balances',
    route: '/finance/opening-balances',
    description: 'Opening Balance Entry.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/periods',
    route: '/finance/periods',
    description: 'Fiscal Period Management.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/settings',
    route: '/finance/settings',
    description: 'Finance Module Settings.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/simulations',
    route: '/finance/simulations',
    description: 'Simulation List.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/simulations/detail',
    route: '/finance/simulations/$id',
    description: 'Simulation Details.',
    module: 'finance',
    params: [
      {
        name: 'id',
        type: 'string',
        required: true,
        description: 'Simulation UUID',
      },
    ],
    supportsAutoRun: false,
  },

  {
    key: 'finance/simulations/new',
    route: '/finance/simulations/new',
    description: 'Create Simulation.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/templates',
    route: '/finance/templates',
    description: 'Journal Template List.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/vat-returns',
    route: '/finance/vat-returns',
    description: 'VAT Return List.',
    module: 'finance',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'finance/vat-returns/detail',
    route: '/finance/vat-returns/$id',
    description: 'VAT Return Details.',
    module: 'finance',
    params: [
      {
        name: 'id',
        type: 'string',
        required: true,
        description: 'VAT return UUID',
      },
    ],
    supportsAutoRun: false,
  },

  {
    key: 'finance/year-end',
    route: '/finance/year-end',
    description: 'Year End Wizard.',
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

  // ── System Pages (new additions) ─────────────────────────────────────────

  {
    key: 'system/dashboard',
    route: '/system',
    description: 'System Dashboard.',
    module: 'system',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'system/email-templates',
    route: '/system/email-templates',
    description: 'Email Template List.',
    module: 'system',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'system/email-templates/detail',
    route: '/system/email-templates/$id',
    description: 'Email Template Details.',
    module: 'system',
    params: [
      {
        name: 'id',
        type: 'string',
        required: true,
        description: 'Email template UUID',
      },
    ],
    supportsAutoRun: false,
  },

  {
    key: 'system/email-templates/new',
    route: '/system/email-templates/new',
    description: 'Create Email Template.',
    module: 'system',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'system/resources',
    route: '/system/resources',
    description: 'Resource Registry.',
    module: 'system',
    params: [],
    supportsAutoRun: false,
  },

  // ── AI Admin Pages (no autoRun) ───────────────────────────────────────────

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

  // ── AI Admin Pages (new additions) ────────────────────────────────────────

  {
    key: 'ai/admin',
    route: '/ai/admin',
    description: 'AI Configuration Dashboard.',
    module: 'ai',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'ai/agents',
    route: '/ai/admin/agents',
    description: 'AI Agent List.',
    module: 'ai',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'ai/agents/detail',
    route: '/ai/admin/agents/$id',
    description: 'Agent Details.',
    module: 'ai',
    params: [
      {
        name: 'id',
        type: 'string',
        required: true,
        description: 'Agent UUID',
      },
    ],
    supportsAutoRun: false,
  },

  {
    key: 'ai/agents/new',
    route: '/ai/admin/agents/new',
    description: 'Create Agent.',
    module: 'ai',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'ai/analytics',
    route: '/ai/admin/analytics',
    description: 'AI Analytics.',
    module: 'ai',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'ai/automations',
    route: '/ai/admin/automations',
    description: 'Automation List.',
    module: 'ai',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'ai/automations/detail',
    route: '/ai/admin/automations/$automationId',
    description: 'Automation Details.',
    module: 'ai',
    params: [
      {
        name: 'automationId',
        type: 'string',
        required: true,
        description: 'Automation UUID',
      },
    ],
    supportsAutoRun: false,
  },

  {
    key: 'ai/automations/new',
    route: '/ai/admin/automations/new',
    description: 'Create Automation.',
    module: 'ai',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'ai/automations/runs',
    route: '/ai/admin/automations/runs',
    description: 'Automation Run History.',
    module: 'ai',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'ai/automations/runs/detail',
    route: '/ai/admin/automations/runs/$runId',
    description: 'Automation Run Details.',
    module: 'ai',
    params: [
      {
        name: 'runId',
        type: 'string',
        required: true,
        description: 'Automation run UUID',
      },
    ],
    supportsAutoRun: false,
  },

  {
    key: 'ai/knowledge',
    route: '/ai/admin/knowledge',
    description: 'Knowledge Base Management.',
    module: 'ai',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'ai/models',
    route: '/ai/admin/models',
    description: 'LLM Model List.',
    module: 'ai',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'ai/models/detail',
    route: '/ai/admin/models/$id',
    description: 'Model Details.',
    module: 'ai',
    params: [
      {
        name: 'id',
        type: 'string',
        required: true,
        description: 'Model UUID',
      },
    ],
    supportsAutoRun: false,
  },

  {
    key: 'ai/models/new',
    route: '/ai/admin/models/new',
    description: 'Create Model.',
    module: 'ai',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'ai/prompts',
    route: '/ai/admin/prompts',
    description: 'Prompt Template List.',
    module: 'ai',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'ai/prompts/detail',
    route: '/ai/admin/prompts/$id',
    description: 'Prompt Editor.',
    module: 'ai',
    params: [
      {
        name: 'id',
        type: 'string',
        required: true,
        description: 'Prompt template UUID',
      },
    ],
    supportsAutoRun: false,
  },

  {
    key: 'ai/prompts/new',
    route: '/ai/admin/prompts/new',
    description: 'Create Prompt Template.',
    module: 'ai',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'ai/skills/detail',
    route: '/ai/admin/skills/$id',
    description: 'Skill Details.',
    module: 'ai',
    params: [
      {
        name: 'id',
        type: 'string',
        required: true,
        description: 'Skill UUID',
      },
    ],
    supportsAutoRun: false,
  },

  {
    key: 'ai/memory',
    route: '/ai/memory',
    description: 'AI Memory Management.',
    module: 'ai',
    params: [],
    supportsAutoRun: false,
  },

  // ── AR Pages ─────────────────────────────────────────────────────────────

  {
    key: 'ar/dashboard',
    route: '/ar',
    description: 'Accounts Receivable Dashboard.',
    module: 'ar',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'ar/invoices',
    route: '/ar/invoices',
    description: 'Invoice List.',
    module: 'ar',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'ar/invoices/detail',
    route: '/ar/invoices/$id',
    description: 'Invoice Details.',
    module: 'ar',
    params: [
      {
        name: 'id',
        type: 'string',
        required: true,
        description: 'Invoice UUID',
      },
    ],
    supportsAutoRun: false,
  },

  // ── Module Hub Pages ──────────────────────────────────────────────────────

  {
    key: 'ap/dashboard',
    route: '/ap',
    description: 'Accounts Payable Dashboard.',
    module: 'ap',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'crm/dashboard',
    route: '/crm',
    description: 'CRM Dashboard.',
    module: 'crm',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'hr/dashboard',
    route: '/hr',
    description: 'HR & Payroll Dashboard.',
    module: 'hr',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'inventory/dashboard',
    route: '/inventory',
    description: 'Inventory Dashboard.',
    module: 'inventory',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'manufacturing/dashboard',
    route: '/manufacturing',
    description: 'Manufacturing Dashboard.',
    module: 'manufacturing',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'purchasing/dashboard',
    route: '/purchasing',
    description: 'Purchasing Dashboard.',
    module: 'purchasing',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'reporting/dashboard',
    route: '/reporting',
    description: 'Reporting Dashboard.',
    module: 'reporting',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'sales/dashboard',
    route: '/sales',
    description: 'Sales Dashboard.',
    module: 'sales',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'settings/document-templates',
    route: '/settings/document-templates',
    description: 'Document Templates.',
    module: 'system',
    params: [],
    supportsAutoRun: false,
  },

  {
    key: 'tasks/my-tasks',
    route: '/tasks',
    description: 'My Tasks.',
    module: 'system',
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
 * Build a frontend URL for a page, substituting path parameters ($paramName)
 * inline and remaining params as query string values.
 * Appends `autoRun=true` for pages that support it.
 */
export function buildPageRoute(page: PageEntry, params: Record<string, unknown>): string {
  // Substitute path parameters ($id, $typeId, etc.)
  let route = page.route;
  for (const paramDef of page.params) {
    const value = params[paramDef.name];
    if (value !== undefined && value !== null) {
      const placeholder = `$${paramDef.name}`;
      if (route.includes(placeholder)) {
        route = route.replace(placeholder, String(value));
      }
    }
  }

  // Build query parameters for params not already substituted into the path
  const searchParams = new URLSearchParams();
  for (const paramDef of page.params) {
    const value = params[paramDef.name];
    if (
      value !== undefined &&
      value !== null &&
      value !== '' &&
      !page.route.includes(`$${paramDef.name}`)
    ) {
      searchParams.set(paramDef.name, String(value));
    }
  }

  if (page.supportsAutoRun) {
    searchParams.set('autoRun', 'true');
  }

  const qs = searchParams.toString();
  return qs ? `${route}?${qs}` : route;
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
