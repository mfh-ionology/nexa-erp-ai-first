/**
 * Navigation configuration for the ERP sidebar.
 *
 * Module keys MUST match the `enabledModules` array
 * from `GET /system/my-permissions`.
 * Icon names MUST be valid Lucide React component names.
 * Route paths follow TanStack Router file-based conventions.
 */

import type { ModulePermission } from '@/stores/auth-store';

export interface NavigationItem {
  key: string;
  labelKey: string;
  icon: string;
  path: string;
  resourceCode?: string; // dot-notation code matching permissions keys (e.g., 'system.users.list')
  /** When true, the item is shown regardless of module-level filtering.
   *  Used for pages accessible to all authenticated users (e.g., My Permissions). */
  alwaysVisible?: boolean;
  /** Categorises item for module context bar: page (default), setting, or report */
  category?: 'page' | 'setting' | 'report';
  /** When 'header', renders as a non-interactive section label in the mega-menu */
  type?: 'item' | 'header';
}

export interface NavigationModule {
  key: string;
  labelKey: string;
  icon: string;
  items: NavigationItem[];
  /** Display order in mega-menu (lower = higher) */
  displayOrder?: number;
  /** URL prefix for module detection (e.g., '/finance', '/sales') */
  pathPrefix: string;
}

export const NAVIGATION_MODULES: NavigationModule[] = [
  {
    key: 'finance',
    labelKey: 'navigation:finance',
    icon: 'Landmark',
    pathPrefix: '/finance',
    displayOrder: 2,
    items: [
      // Dashboard
      {
        key: 'finance.dashboard',
        labelKey: 'navigation:finance.dashboard',
        icon: 'LayoutDashboard',
        path: '/finance',
      },

      // Pages
      {
        key: 'finance.pages',
        type: 'header',
        labelKey: 'navigation:finance.pages',
        icon: '',
        path: '',
      },
      {
        key: 'finance.chartOfAccounts',
        labelKey: 'navigation:finance.chartOfAccounts',
        icon: 'BookOpen',
        path: '/finance/chart-of-accounts',
      },
      {
        key: 'finance.journals',
        labelKey: 'navigation:finance.journals',
        icon: 'BookText',
        path: '/finance/journals',
      },
      {
        key: 'finance.bankAccounts',
        labelKey: 'navigation:finance.bankAccounts',
        icon: 'Building2',
        path: '/finance/bank-accounts',
      },
      {
        key: 'finance.bankReconciliation',
        labelKey: 'navigation:finance.bankReconciliation',
        icon: 'ArrowLeftRight',
        path: '/finance/bank-reconciliation',
      },
      {
        key: 'finance.vatReturns',
        labelKey: 'navigation:finance.vatReturns',
        icon: 'Receipt',
        path: '/finance/vat-returns',
      },
      {
        key: 'finance.budgets',
        labelKey: 'navigation:finance.budgets',
        icon: 'PiggyBank',
        path: '/finance/budgets',
      },
      {
        key: 'finance.simulations',
        labelKey: 'navigation:finance.simulations',
        icon: 'FlaskConical',
        path: '/finance/simulations',
      },
      {
        key: 'finance.dimensions',
        labelKey: 'navigation:finance.dimensions',
        icon: 'Tags',
        path: '/finance/dimensions',
      },
      {
        key: 'finance.templates',
        labelKey: 'navigation:finance.templates',
        icon: 'Copy',
        path: '/finance/templates',
      },

      // Reports
      {
        key: 'finance.reports',
        type: 'header',
        labelKey: 'navigation:finance.reports',
        icon: '',
        path: '',
        category: 'report',
      },
      {
        key: 'finance.trialBalance',
        labelKey: 'navigation:finance.trialBalance',
        icon: 'Scale',
        path: '/finance/reports/trial-balance',
        category: 'report',
      },
      {
        key: 'finance.profitAndLoss',
        labelKey: 'navigation:finance.profitAndLoss',
        icon: 'TrendingUp',
        path: '/finance/reports/profit-and-loss',
        category: 'report',
      },
      {
        key: 'finance.balanceSheet',
        labelKey: 'navigation:finance.balanceSheet',
        icon: 'FileSpreadsheet',
        path: '/finance/reports/balance-sheet',
        category: 'report',
      },
      {
        key: 'finance.transactionJournal',
        labelKey: 'navigation:finance.transactionJournal',
        icon: 'List',
        path: '/finance/reports/transaction-journal',
        category: 'report',
      },
      {
        key: 'finance.budgetVariance',
        labelKey: 'navigation:finance.budgetVariance',
        icon: 'BarChart3',
        path: '/finance/reports/budget-variance',
        category: 'report',
      },
      {
        key: 'finance.glDetail',
        labelKey: 'navigation:finance.glDetail',
        icon: 'FileSearch',
        path: '/finance/reports/gl-detail',
        category: 'report',
      },
      {
        key: 'finance.generalLedger',
        labelKey: 'navigation:finance.generalLedger',
        icon: 'BookOpenCheck',
        path: '/finance/reports/general-ledger',
        category: 'report',
      },
      // Departmental P&L merged into Profit & Loss page (Group by Dimension)

      // Settings
      {
        key: 'finance.settingsSection',
        type: 'header',
        labelKey: 'navigation:finance.settingsSection',
        icon: '',
        path: '',
        category: 'setting',
      },
      {
        key: 'finance.financeSettings',
        labelKey: 'navigation:finance.financeSettings',
        icon: 'Settings',
        path: '/finance/settings',
        category: 'setting',
      },
      {
        key: 'finance.accountMappings',
        labelKey: 'navigation:finance.accountMappings',
        icon: 'GitBranch',
        path: '/finance/account-mappings',
        category: 'setting',
      },
      {
        key: 'finance.periods',
        labelKey: 'navigation:finance.periods',
        icon: 'Calendar',
        path: '/finance/periods',
        category: 'setting',
      },

      // Maintenance
      {
        key: 'finance.maintenance',
        type: 'header',
        labelKey: 'navigation:finance.maintenance',
        icon: '',
        path: '',
        category: 'setting',
      },
      {
        key: 'finance.monthEnd',
        labelKey: 'navigation:finance.monthEnd',
        icon: 'CalendarCheck',
        path: '/finance/month-end',
        category: 'setting',
      },
      {
        key: 'finance.yearEnd',
        labelKey: 'navigation:finance.yearEnd',
        icon: 'CalendarX',
        path: '/finance/year-end',
        category: 'setting',
      },
      {
        key: 'finance.openingBalances',
        labelKey: 'navigation:finance.openingBalances',
        icon: 'Upload',
        path: '/finance/opening-balances',
        category: 'setting',
      },
      {
        key: 'finance.import',
        labelKey: 'navigation:finance.import',
        icon: 'FileInput',
        path: '/finance/import',
        category: 'setting',
      },
    ],
  },
  {
    key: 'ar',
    labelKey: 'navigation:ar',
    icon: 'Receipt',
    pathPrefix: '/ar',
    displayOrder: 3,
    items: [
      {
        key: 'ar.customers',
        labelKey: 'navigation:ar.customers',
        icon: 'UserCheck',
        path: '/ar/customers',
      },
      {
        key: 'ar.invoices',
        labelKey: 'navigation:ar.invoices',
        icon: 'FileText',
        path: '/ar/invoices',
      },
      {
        key: 'ar.payments',
        labelKey: 'navigation:ar.payments',
        icon: 'CreditCard',
        path: '/ar/payments',
      },
      {
        key: 'ar.creditNotes',
        labelKey: 'navigation:ar.creditNotes',
        icon: 'FileX',
        path: '/ar/credit-notes',
      },
      {
        key: 'ar.statements',
        labelKey: 'navigation:ar.statements',
        icon: 'ScrollText',
        path: '/ar/statements',
      },
    ],
  },
  {
    key: 'ap',
    labelKey: 'navigation:ap',
    icon: 'FileText',
    pathPrefix: '/ap',
    displayOrder: 4,
    items: [
      {
        key: 'ap.suppliers',
        labelKey: 'navigation:ap.suppliers',
        icon: 'Truck',
        path: '/ap/suppliers',
      },
      {
        key: 'ap.bills',
        labelKey: 'navigation:ap.bills',
        icon: 'FileText',
        path: '/ap/bills',
      },
      {
        key: 'ap.payments',
        labelKey: 'navigation:ap.payments',
        icon: 'CreditCard',
        path: '/ap/payments',
      },
      {
        key: 'ap.creditNotes',
        labelKey: 'navigation:ap.creditNotes',
        icon: 'FileX',
        path: '/ap/credit-notes',
      },
    ],
  },
  {
    key: 'sales',
    labelKey: 'navigation:sales',
    icon: 'ShoppingCart',
    pathPrefix: '/sales',
    displayOrder: 5,
    items: [
      {
        key: 'sales.quotes',
        labelKey: 'navigation:sales.quotes',
        icon: 'FileQuestion',
        path: '/sales/quotes',
      },
      {
        key: 'sales.orders',
        labelKey: 'navigation:sales.orders',
        icon: 'ClipboardList',
        path: '/sales/orders',
      },
      {
        key: 'sales.deliveryNotes',
        labelKey: 'navigation:sales.deliveryNotes',
        icon: 'PackageCheck',
        path: '/sales/delivery-notes',
      },
    ],
  },
  {
    key: 'purchasing',
    labelKey: 'navigation:purchasing',
    icon: 'Package',
    pathPrefix: '/purchasing',
    displayOrder: 6,
    items: [
      {
        key: 'purchasing.orders',
        labelKey: 'navigation:purchasing.orders',
        icon: 'ClipboardList',
        path: '/purchasing/orders',
      },
      {
        key: 'purchasing.goodsReceipts',
        labelKey: 'navigation:purchasing.goodsReceipts',
        icon: 'PackageCheck',
        path: '/purchasing/goods-receipts',
      },
    ],
  },
  {
    key: 'inventory',
    labelKey: 'navigation:inventory',
    icon: 'Warehouse',
    pathPrefix: '/inventory',
    displayOrder: 7,
    items: [
      {
        key: 'inventory.items',
        labelKey: 'navigation:inventory.items',
        icon: 'Box',
        path: '/inventory/items',
      },
      {
        key: 'inventory.warehouses',
        labelKey: 'navigation:inventory.warehouses',
        icon: 'Warehouse',
        path: '/inventory/warehouses',
      },
      {
        key: 'inventory.stockMovements',
        labelKey: 'navigation:inventory.stockMovements',
        icon: 'ArrowRightLeft',
        path: '/inventory/stock-movements',
      },
      {
        key: 'inventory.stockTakes',
        labelKey: 'navigation:inventory.stockTakes',
        icon: 'ClipboardCheck',
        path: '/inventory/stock-takes',
      },
    ],
  },
  {
    key: 'crm',
    labelKey: 'navigation:crm',
    icon: 'Users',
    pathPrefix: '/crm',
    displayOrder: 9,
    items: [
      {
        key: 'crm.leads',
        labelKey: 'navigation:crm.leads',
        icon: 'UserPlus',
        path: '/crm/leads',
      },
      {
        key: 'crm.opportunities',
        labelKey: 'navigation:crm.opportunities',
        icon: 'Target',
        path: '/crm/opportunities',
      },
      {
        key: 'crm.campaigns',
        labelKey: 'navigation:crm.campaigns',
        icon: 'Megaphone',
        path: '/crm/campaigns',
      },
      {
        key: 'crm.contacts',
        labelKey: 'navigation:crm.contacts',
        icon: 'Contact',
        path: '/crm/contacts',
      },
    ],
  },
  {
    key: 'hr',
    labelKey: 'navigation:hr',
    icon: 'UserCog',
    pathPrefix: '/hr',
    displayOrder: 10,
    items: [
      {
        key: 'hr.employees',
        labelKey: 'navigation:hr.employees',
        icon: 'Users',
        path: '/hr/employees',
      },
      {
        key: 'hr.contracts',
        labelKey: 'navigation:hr.contracts',
        icon: 'FileSignature',
        path: '/hr/contracts',
      },
      {
        key: 'hr.leave',
        labelKey: 'navigation:hr.leave',
        icon: 'CalendarOff',
        path: '/hr/leave',
      },
      {
        key: 'hr.payrollRuns',
        labelKey: 'navigation:hr.payrollRuns',
        icon: 'Banknote',
        path: '/hr/payroll-runs',
      },
      {
        key: 'hr.appraisals',
        labelKey: 'navigation:hr.appraisals',
        icon: 'Star',
        path: '/hr/appraisals',
      },
    ],
  },
  {
    key: 'manufacturing',
    labelKey: 'navigation:manufacturing',
    icon: 'Factory',
    pathPrefix: '/manufacturing',
    displayOrder: 11,
    items: [
      {
        key: 'manufacturing.recipes',
        labelKey: 'navigation:manufacturing.recipes',
        icon: 'FileCode',
        path: '/manufacturing/recipes',
      },
      {
        key: 'manufacturing.workOrders',
        labelKey: 'navigation:manufacturing.workOrders',
        icon: 'ClipboardList',
        path: '/manufacturing/work-orders',
      },
      {
        key: 'manufacturing.machines',
        labelKey: 'navigation:manufacturing.machines',
        icon: 'Cog',
        path: '/manufacturing/machines',
      },
      {
        key: 'manufacturing.mrp',
        labelKey: 'navigation:manufacturing.mrp',
        icon: 'Network',
        path: '/manufacturing/mrp',
      },
    ],
  },
  {
    key: 'reporting',
    labelKey: 'navigation:reporting',
    icon: 'BarChart3',
    pathPrefix: '/reporting',
    displayOrder: 12,
    items: [
      {
        key: 'reporting.financialReports',
        labelKey: 'navigation:reporting.financialReports',
        icon: 'FileBarChart',
        path: '/reporting/financial-reports',
        category: 'report',
      },
      {
        key: 'reporting.dashboards',
        labelKey: 'navigation:reporting.dashboards',
        icon: 'LayoutDashboard',
        path: '/reporting/dashboards',
        category: 'report',
      },
    ],
  },
  {
    key: 'ai',
    labelKey: 'navigation:ai',
    icon: 'Bot',
    pathPrefix: '/ai',
    displayOrder: 13,
    items: [
      // User-facing (always visible)
      {
        key: 'ai.briefing',
        labelKey: 'navigation:ai.briefing',
        icon: 'Sun',
        path: '/ai/briefing',
        alwaysVisible: true,
        category: 'page',
      },
      {
        key: 'ai.memory',
        labelKey: 'navigation:ai.memory',
        icon: 'Brain',
        path: '/ai/memory',
        alwaysVisible: true,
        category: 'page',
      },
      {
        key: 'ai.skills',
        labelKey: 'navigation:ai.skills',
        icon: 'Wand2',
        path: '/ai/skills',
        alwaysVisible: true,
        category: 'page',
      },
      {
        key: 'ai.knowledge',
        labelKey: 'navigation:ai.knowledge',
        icon: 'LibraryBig',
        path: '/ai/admin/knowledge',
        alwaysVisible: true,
        category: 'page',
      },

      // AI Settings section header
      {
        key: 'ai.admin.settings',
        labelKey: 'navigation:ai.admin.settings',
        icon: '',
        path: '',
        type: 'header',
        resourceCode: 'system.settings.detail',
        category: 'setting',
      },
      {
        key: 'ai.admin',
        labelKey: 'navigation:ai.admin',
        icon: 'Brain',
        path: '/ai/admin',
        resourceCode: 'system.settings.detail',
        category: 'setting',
      },
      {
        key: 'ai.admin.models',
        labelKey: 'navigation:ai.admin.models',
        icon: 'Cpu',
        path: '/ai/admin/models',
        resourceCode: 'system.settings.detail',
        category: 'setting',
      },
      {
        key: 'ai.admin.prompts',
        labelKey: 'navigation:ai.admin.prompts',
        icon: 'FileCode',
        path: '/ai/admin/prompts',
        resourceCode: 'system.settings.detail',
        category: 'setting',
      },
      {
        key: 'ai.admin.agents',
        labelKey: 'navigation:ai.admin.agents',
        icon: 'Bot',
        path: '/ai/admin/agents',
        resourceCode: 'system.settings.detail',
        category: 'setting',
      },
      {
        key: 'ai.admin.skills',
        labelKey: 'navigation:ai.admin.skills',
        icon: 'Wand2',
        path: '/ai/admin/skills',
        resourceCode: 'system.settings.detail',
        category: 'setting',
      },
      {
        key: 'ai.admin.analytics',
        labelKey: 'navigation:ai.admin.analytics',
        icon: 'BarChart3',
        path: '/ai/admin/analytics',
        resourceCode: 'system.settings.detail',
        category: 'setting',
      },

      // Automations section header
      {
        key: 'ai.admin.automations.section',
        labelKey: 'navigation:ai.admin.automations.section',
        icon: '',
        path: '',
        type: 'header',
        resourceCode: 'system.settings.detail',
        category: 'setting',
      },
      {
        key: 'ai.admin.automations',
        labelKey: 'navigation:ai.admin.automations',
        icon: 'Workflow',
        path: '/ai/admin/automations',
        resourceCode: 'system.settings.detail',
        category: 'setting',
      },
      {
        key: 'ai.admin.automationRuns',
        labelKey: 'navigation:ai.admin.automationRuns',
        icon: 'History',
        path: '/ai/admin/automations/runs',
        resourceCode: 'system.settings.detail',
        category: 'setting',
      },
    ],
  },
  {
    key: 'system',
    labelKey: 'navigation:system',
    icon: 'Settings',
    pathPrefix: '/system',
    displayOrder: 14,
    items: [
      {
        key: 'system.users',
        labelKey: 'navigation:system.users',
        icon: 'Users',
        path: '/system/users',
        resourceCode: 'system.users.list',
      },
      {
        key: 'system.companies',
        labelKey: 'navigation:system.companies',
        icon: 'Building2',
        path: '/system/companies',
        resourceCode: 'system.company-profile.detail',
      },
      {
        key: 'system.settings',
        labelKey: 'navigation:system.settings',
        icon: 'Settings',
        path: '/system/settings',
        category: 'setting',
      },
      {
        key: 'system.documentTemplates',
        labelKey: 'navigation:system.documentTemplates',
        icon: 'FileText',
        path: '/settings/document-templates',
        resourceCode: 'system.settings.detail',
        category: 'setting',
      },
      {
        key: 'system.notificationPreferences',
        labelKey: 'navigation:system.notificationPreferences',
        icon: 'Bell',
        path: '/system/notification-preferences',
        alwaysVisible: true,
        category: 'setting',
      },
      {
        key: 'system.printPreferences',
        labelKey: 'navigation:system.printPreferences',
        icon: 'Printer',
        path: '/system/print-preferences',
        alwaysVisible: true,
        category: 'setting',
      },
      {
        key: 'system.myPermissions',
        labelKey: 'navigation:system.myPermissions',
        icon: 'Shield',
        path: '/system/my-permissions',
        // No resourceCode — accessible to all authenticated users
        alwaysVisible: true,
      },
    ],
  },
];

/**
 * Returns the items within a module that match the given category.
 * Items without an explicit `category` default to `'page'`.
 */
export function getModuleItemsByCategory(
  module: NavigationModule,
  category: 'page' | 'setting' | 'report',
): NavigationItem[] {
  return module.items.filter((item) => (item.category ?? 'page') === category);
}

/**
 * Returns navigation modules filtered by the user's enabled modules and
 * item-level permissions. SUPER_ADMIN sees all modules regardless.
 *
 * Items with `alwaysVisible: true` are shown regardless of module or
 * resource filtering (e.g., My Permissions is accessible to all users).
 * Items without a `resourceCode` default to visible within enabled modules.
 * Items with a `resourceCode` are only shown if `canAccess === true` in
 * the permissions map. Module groups with zero visible items are hidden.
 */
export function getFilteredModules(
  enabledModules: string[],
  isSuperAdmin = false,
  modulePermissions?: Record<string, ModulePermission>,
): NavigationModule[] {
  if (isSuperAdmin) return NAVIGATION_MODULES;

  return NAVIGATION_MODULES.map((mod) => {
    const moduleEnabled = enabledModules.includes(mod.key);
    return {
      ...mod,
      items: mod.items.filter((item) => {
        // Always-visible items bypass all filtering
        if (item.alwaysVisible) return true;
        // If the module is not enabled, hide all non-alwaysVisible items
        if (!moduleEnabled) return false;
        // Within an enabled module, filter by resourceCode
        if (!item.resourceCode) return true; // no resource code = visible
        return modulePermissions?.[item.resourceCode]?.canAccess === true;
      }),
    };
  }).filter((mod) => mod.items.length > 0);
}
