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
}

export interface NavigationModule {
  key: string;
  labelKey: string;
  icon: string;
  items: NavigationItem[];
}

export const NAVIGATION_MODULES: NavigationModule[] = [
  {
    key: 'system',
    labelKey: 'navigation:system',
    icon: 'Settings',
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
  {
    key: 'finance',
    labelKey: 'navigation:finance',
    icon: 'Landmark',
    items: [
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
        key: 'finance.periods',
        labelKey: 'navigation:finance.periods',
        icon: 'Calendar',
        path: '/finance/periods',
      },
      {
        key: 'finance.bankRec',
        labelKey: 'navigation:finance.bankRec',
        icon: 'ArrowLeftRight',
        path: '/finance/bank-reconciliation',
      },
      {
        key: 'finance.budgets',
        labelKey: 'navigation:finance.budgets',
        icon: 'PiggyBank',
        path: '/finance/budgets',
      },
    ],
  },
  {
    key: 'ar',
    labelKey: 'navigation:ar',
    icon: 'Receipt',
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
    items: [
      {
        key: 'reporting.financialReports',
        labelKey: 'navigation:reporting.financialReports',
        icon: 'FileBarChart',
        path: '/reporting/financial-reports',
      },
      {
        key: 'reporting.dashboards',
        labelKey: 'navigation:reporting.dashboards',
        icon: 'LayoutDashboard',
        path: '/reporting/dashboards',
      },
    ],
  },
];

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

  return NAVIGATION_MODULES
    .map((mod) => {
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
    })
    .filter((mod) => mod.items.length > 0);
}
