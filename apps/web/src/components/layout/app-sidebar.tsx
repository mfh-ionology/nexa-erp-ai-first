import { Link, useRouterState } from '@tanstack/react-router';
import {
  BarChart3,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Factory,
  FileText,
  Landmark,
  LayoutDashboard,
  Receipt,
  Settings,
  Shield,
  ShoppingCart,
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

/* ── v0-style nav group structure ──────────────────────────── */

interface NavItem {
  path: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Module key for permission filtering (null = always visible) */
  moduleKey: string | null;
}

interface NavGroup {
  titleKey: string;
  showDivider?: boolean;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: 'navigation:main',
    items: [
      { path: '/', labelKey: 'navigation:dashboard', icon: LayoutDashboard, moduleKey: null },
    ],
  },
  {
    titleKey: 'navigation:operations',
    items: [
      { path: '/finance', labelKey: 'navigation:finance', icon: Landmark, moduleKey: 'finance' },
      { path: '/ar', labelKey: 'navigation:ar', icon: FileText, moduleKey: 'ar' },
      { path: '/ap', labelKey: 'navigation:ap', icon: Receipt, moduleKey: 'ap' },
      { path: '/sales', labelKey: 'navigation:sales', icon: ShoppingCart, moduleKey: 'sales' },
      {
        path: '/purchasing',
        labelKey: 'navigation:purchasing',
        icon: CreditCard,
        moduleKey: 'purchasing',
      },
      {
        path: '/inventory',
        labelKey: 'navigation:inventory',
        icon: Warehouse,
        moduleKey: 'inventory',
      },
    ],
  },
  {
    titleKey: 'navigation:other',
    items: [
      { path: '/crm', labelKey: 'navigation:crm', icon: Briefcase, moduleKey: 'crm' },
      { path: '/hr', labelKey: 'navigation:hr', icon: UsersIcon, moduleKey: 'hr' },
      {
        path: '/manufacturing',
        labelKey: 'navigation:manufacturing',
        icon: Factory,
        moduleKey: 'manufacturing',
      },
      {
        path: '/reporting',
        labelKey: 'navigation:reporting',
        icon: BarChart3,
        moduleKey: 'reporting',
      },
    ],
  },
  {
    titleKey: 'navigation:admin',
    showDivider: true,
    items: [
      {
        path: '/system/settings',
        labelKey: 'navigation:system.settings',
        icon: Settings,
        moduleKey: 'system',
      },
      {
        path: '/system/users',
        labelKey: 'navigation:system.users',
        icon: UsersIcon,
        moduleKey: 'system',
      },
      {
        path: '/system/access-groups',
        labelKey: 'navigation:system.accessGroups',
        icon: Shield,
        moduleKey: 'system',
      },
    ],
  },
];

function isActivePath(path: string, pathname: string) {
  if (path === '/') return pathname === '/';
  return pathname.startsWith(path);
}

interface AppSidebarProps {
  forceExpanded?: boolean;
}

export function AppSidebar({ forceExpanded = false }: AppSidebarProps) {
  const { t } = useI18n();
  const permissions = useAuthStore((s) => s.permissions);
  const isRefreshingPermissions = useAuthStore((s) => s.isRefreshingPermissions);
  const { isCollapsed: storeCollapsed, collapse, expand } = useSidebarStore();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isCollapsed = forceExpanded ? false : storeCollapsed;
  const enabledModules = permissions?.enabledModules ?? [];
  const isSuperAdmin = permissions?.isSuperAdmin ?? false;

  const filteredGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.moduleKey === null) return true;
      if (isSuperAdmin) return true;
      return enabledModules.includes(item.moduleKey);
    }),
  })).filter((group) => group.items.length > 0);

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
                {filteredGroups.map((group, groupIdx) => (
                  <div key={group.titleKey} className={cn(groupIdx > 0 && 'mt-3')}>
                    {group.showDivider && <div className="mx-1 mb-3 border-t border-border" />}
                    <div className="flex flex-col gap-0.5">
                      {group.items.map((item) => {
                        const active = isActivePath(item.path, pathname);
                        const Icon = item.icon;
                        return (
                          <Tooltip key={item.path}>
                            <TooltipTrigger asChild>
                              <Link
                                to={item.path}
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
                            <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              /* Expanded: full links with group titles */
              <>
                {filteredGroups.map((group, groupIdx) => (
                  <div key={group.titleKey} className={cn(groupIdx > 0 && 'mt-4')}>
                    {group.showDivider && <div className="mx-2 mb-3 border-t border-border" />}
                    <span className="mb-1.5 block px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t(group.titleKey)}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {group.items.map((item) => {
                        const active = isActivePath(item.path, pathname);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                              active
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            {t(item.labelKey)}
                          </Link>
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
