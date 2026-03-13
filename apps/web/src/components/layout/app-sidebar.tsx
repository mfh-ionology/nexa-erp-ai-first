import { Link, useRouterState } from '@tanstack/react-router';
import {
  BarChart3,
  Brain,
  Briefcase,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Factory,
  FileText,
  History,
  Landmark,
  LayoutDashboard,
  Receipt,
  Shield,
  ShoppingCart,
  Sun,
  Users as UsersIcon,
  Warehouse,
} from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';

import { useI18n } from '@nexa/i18n';

import { CompanySwitcher } from './company-switcher';

/* ── Hierarchical nav structure ──────────────────────────── */

interface NavSubItem {
  path: string;
  labelKey: string;
}

interface NavModule {
  /** Group key used for expandedGroups toggling */
  groupKey: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Module key for permission filtering (null = always visible) */
  moduleKey: string | null;
  subItems: NavSubItem[];
}

interface NavSection {
  titleKey?: string;
  showDivider?: boolean;
  modules: NavModule[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: 'navigation:main',
    modules: [
      {
        groupKey: 'dashboard',
        labelKey: 'navigation:dashboard',
        icon: LayoutDashboard,
        moduleKey: null,
        subItems: [],
      },
      {
        groupKey: 'tasks',
        labelKey: 'navigation:myTasks',
        icon: CheckSquare,
        moduleKey: null,
        subItems: [],
      },
    ],
  },
  {
    titleKey: 'navigation:operations',
    modules: [
      {
        groupKey: 'finance',
        labelKey: 'navigation:finance',
        icon: Landmark,
        moduleKey: 'finance',
        subItems: [
          { path: '/finance/chart-of-accounts', labelKey: 'navigation:finance.chartOfAccounts' },
          { path: '/finance/journals', labelKey: 'navigation:finance.journals' },
          { path: '/finance/periods', labelKey: 'navigation:finance.periods' },
        ],
      },
      {
        groupKey: 'ar',
        labelKey: 'navigation:ar',
        icon: FileText,
        moduleKey: 'ar',
        subItems: [
          { path: '/ar/invoices', labelKey: 'navigation:ar.invoices' },
          { path: '/ar/customers', labelKey: 'navigation:ar.customers' },
        ],
      },
      {
        groupKey: 'ap',
        labelKey: 'navigation:ap',
        icon: Receipt,
        moduleKey: 'ap',
        subItems: [
          { path: '/ap/bills', labelKey: 'navigation:ap.bills' },
          { path: '/ap/suppliers', labelKey: 'navigation:ap.suppliers' },
        ],
      },
      {
        groupKey: 'sales',
        labelKey: 'navigation:sales',
        icon: ShoppingCart,
        moduleKey: 'sales',
        subItems: [
          { path: '/sales/orders', labelKey: 'navigation:sales.orders' },
          { path: '/sales/quotes', labelKey: 'navigation:sales.quotes' },
        ],
      },
      {
        groupKey: 'purchasing',
        labelKey: 'navigation:purchasing',
        icon: CreditCard,
        moduleKey: 'purchasing',
        subItems: [{ path: '/purchasing/orders', labelKey: 'navigation:purchasing.orders' }],
      },
      {
        groupKey: 'inventory',
        labelKey: 'navigation:inventory',
        icon: Warehouse,
        moduleKey: 'inventory',
        subItems: [{ path: '/inventory/items', labelKey: 'navigation:inventory.items' }],
      },
    ],
  },
  {
    titleKey: 'navigation:other',
    modules: [
      {
        groupKey: 'crm',
        labelKey: 'navigation:crm',
        icon: Briefcase,
        moduleKey: 'crm',
        subItems: [{ path: '/crm/contacts', labelKey: 'navigation:crm.contacts' }],
      },
      {
        groupKey: 'hr',
        labelKey: 'navigation:hr',
        icon: UsersIcon,
        moduleKey: 'hr',
        subItems: [{ path: '/hr/employees', labelKey: 'navigation:hr.employees' }],
      },
      {
        groupKey: 'manufacturing',
        labelKey: 'navigation:manufacturing',
        icon: Factory,
        moduleKey: 'manufacturing',
        subItems: [{ path: '/manufacturing/orders', labelKey: 'navigation:manufacturing.orders' }],
      },
      {
        groupKey: 'reporting',
        labelKey: 'navigation:reporting',
        icon: BarChart3,
        moduleKey: 'reporting',
        subItems: [{ path: '/reporting/dashboard', labelKey: 'navigation:reporting.dashboard' }],
      },
    ],
  },
  {
    titleKey: 'navigation:ai',
    showDivider: true,
    modules: [
      {
        groupKey: 'ai-briefing',
        labelKey: 'navigation:ai.briefing',
        icon: Sun,
        moduleKey: null,
        subItems: [],
      },
      {
        groupKey: 'ai-memory',
        labelKey: 'navigation:ai.memory',
        icon: Brain,
        moduleKey: null,
        subItems: [],
      },
      {
        groupKey: 'ai-runs',
        labelKey: 'navigation:ai.admin.automationRuns',
        icon: History,
        moduleKey: null,
        subItems: [],
      },
    ],
  },
  {
    showDivider: true,
    modules: [
      {
        groupKey: 'system',
        labelKey: 'navigation:system',
        icon: Shield,
        moduleKey: 'system',
        subItems: [
          { path: '/system/settings', labelKey: 'navigation:system.settings' },
          { path: '/system/users', labelKey: 'navigation:system.users' },
          { path: '/system/access-groups', labelKey: 'navigation:system.accessGroups' },
          {
            path: '/system/notification-preferences',
            labelKey: 'navigation:communications.notificationPreferences',
          },
          { path: '/system/email-templates', labelKey: 'navigation:communications.emailTemplates' },
          { path: '/ai/admin/models', labelKey: 'navigation:ai.admin.models' },
          { path: '/ai/admin/prompts', labelKey: 'navigation:ai.admin.prompts' },
          { path: '/ai/admin/agents', labelKey: 'navigation:ai.admin.agents' },
          { path: '/ai/admin/skills', labelKey: 'navigation:ai.admin.skills' },
          { path: '/ai/admin/automations', labelKey: 'navigation:ai.admin.automations' },
          { path: '/ai/admin/knowledge', labelKey: 'navigation:ai.admin.knowledge' },
        ],
      },
    ],
  },
];

/** Returns the default single link path for a module (first sub-item or a root path) */
function getModuleRootPath(module: NavModule): string {
  if (module.subItems.length > 0) return module.subItems[0]!.path;
  return `/${module.groupKey}`;
}

function isActivePath(path: string, pathname: string) {
  if (path === '/') return pathname === '/';
  return pathname.startsWith(path);
}

function isModuleActive(module: NavModule, pathname: string): boolean {
  if (module.subItems.length === 0) {
    return isActivePath(getModuleRootPath(module), pathname);
  }
  return module.subItems.some((sub) => isActivePath(sub.path, pathname));
}

interface AppSidebarProps {
  forceExpanded?: boolean;
}

export function AppSidebar({ forceExpanded = false }: AppSidebarProps) {
  const { t } = useI18n();
  const permissions = useAuthStore((s) => s.permissions);
  const isRefreshingPermissions = useAuthStore((s) => s.isRefreshingPermissions);
  const {
    isCollapsed: storeCollapsed,
    collapse,
    expand,
    expandedGroups,
    toggleGroup,
  } = useSidebarStore();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isCollapsed = forceExpanded ? false : storeCollapsed;
  const enabledModules = permissions?.enabledModules ?? [];
  const isSuperAdmin = permissions?.isSuperAdmin ?? false;

  const filteredSections = NAV_SECTIONS.map((section) => ({
    ...section,
    modules: section.modules.filter((module) => {
      if (module.moduleKey === null) return true;
      if (isSuperAdmin) return true;
      return enabledModules.includes(module.moduleKey);
    }),
  })).filter((section) => section.modules.length > 0);

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        role="navigation"
        aria-label={t('navigation:sidebar')}
        className={cn(
          'flex h-full flex-col border-r border-border bg-card',
          isCollapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* Company Switcher */}
        <CompanySwitcher isCollapsed={isCollapsed} />

        {/* Navigation */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-2 py-3">
            {isRefreshingPermissions ? (
              <div className="space-y-3 px-2 py-2" aria-busy="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-lg" />
                ))}
              </div>
            ) : isCollapsed ? (
              /* Collapsed: icon-only links with tooltips */
              <>
                {filteredSections.map((section, sectionIdx) => (
                  <div
                    key={section.titleKey ?? sectionIdx}
                    className={cn(sectionIdx > 0 && 'mt-3')}
                  >
                    {section.showDivider && <div className="mx-1 mb-3 border-t border-border" />}
                    <div className="flex flex-col gap-0.5">
                      {section.modules.map((module) => {
                        const active = isModuleActive(module, pathname);
                        const Icon = module.icon;
                        const linkPath = getModuleRootPath(module);
                        return (
                          <Tooltip key={module.groupKey}>
                            <TooltipTrigger asChild>
                              <Link
                                to={linkPath}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                  'flex h-9 w-full items-center justify-center rounded-lg transition-colors',
                                  active
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                                )}
                              >
                                <Icon className="h-5 w-5" />
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right">{t(module.labelKey)}</TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              /* Expanded: hierarchical groups with collapsible sub-items */
              <>
                {filteredSections.map((section, sectionIdx) => (
                  <div
                    key={section.titleKey ?? sectionIdx}
                    className={cn(sectionIdx > 0 && 'mt-4')}
                  >
                    {section.showDivider && <div className="mx-2 mb-3 border-t border-border" />}
                    {section.titleKey && (
                      <span className="mb-1.5 block px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t(section.titleKey)}
                      </span>
                    )}
                    <div className="flex flex-col gap-0.5">
                      {section.modules.map((module) => {
                        const active = isModuleActive(module, pathname);
                        const Icon = module.icon;
                        const isExpanded = expandedGroups.includes(module.groupKey);
                        const hasSubItems = module.subItems.length > 0;

                        if (!hasSubItems) {
                          /* Leaf module — direct link */
                          const linkPath = getModuleRootPath(module);
                          return (
                            <Link
                              key={module.groupKey}
                              to={linkPath}
                              aria-current={active ? 'page' : undefined}
                              className={cn(
                                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                                active
                                  ? 'bg-primary text-white shadow-sm'
                                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                              )}
                            >
                              <Icon className="h-5 w-5 shrink-0" />
                              {t(module.labelKey)}
                            </Link>
                          );
                        }

                        /* Expandable module group */
                        return (
                          <div key={module.groupKey}>
                            <button
                              type="button"
                              onClick={() => toggleGroup(module.groupKey)}
                              className={cn(
                                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                                active
                                  ? 'text-foreground'
                                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                              )}
                            >
                              <Icon className="h-5 w-5 shrink-0" />
                              <span className="flex-1 text-left">{t(module.labelKey)}</span>
                              <ChevronDown
                                className={cn(
                                  'h-4 w-4 shrink-0 transition-transform',
                                  isExpanded && 'rotate-180',
                                )}
                              />
                            </button>

                            {/* Sub-items */}
                            <div
                              className={cn(
                                'overflow-hidden transition-all',
                                isExpanded ? 'max-h-96' : 'max-h-0',
                              )}
                            >
                              <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-3">
                                {module.subItems.map((sub) => {
                                  const subActive = isActivePath(sub.path, pathname);
                                  return (
                                    <Link
                                      key={sub.path}
                                      to={sub.path}
                                      aria-current={subActive ? 'page' : undefined}
                                      className={cn(
                                        'rounded-md px-2 py-1.5 text-sm transition-colors',
                                        subActive
                                          ? 'bg-primary text-white shadow-sm'
                                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                                      )}
                                    >
                                      {t(sub.labelKey)}
                                    </Link>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Collapse/expand toggle */}
        {!forceExpanded && (
          <div className="shrink-0 border-t border-border p-2">
            <button
              onClick={isCollapsed ? expand : collapse}
              className="flex h-8 w-full items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={isCollapsed ? t('navigation:expand') : t('navigation:collapse')}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
        )}
      </nav>
    </TooltipProvider>
  );
}
