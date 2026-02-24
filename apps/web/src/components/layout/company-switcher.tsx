/**
 * Company switcher dropdown for the sidebar.
 *
 * - Fetches user's accessible companies via TanStack Query
 * - Switches active company context (Zustand + X-Company-Id header)
 * - Invalidates all queries and re-fetches permissions on switch
 * - Shows current company with checkmark indicator
 */

import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Building2, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { NAVIGATION_MODULES } from '@/lib/navigation-config';
import { queryKeys } from '@/lib/query-keys';
import { fetchCompanies, fetchMyPermissions } from '@/lib/system-api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

import { useI18n } from '@nexa/i18n';

interface CompanySwitcherProps {
  isCollapsed: boolean;
}

export function CompanySwitcher({ isCollapsed }: CompanySwitcherProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const setActiveCompany = useAuthStore((s) => s.setActiveCompany);
  const setPermissions = useAuthStore((s) => s.setPermissions);
  const setRefreshingPermissions = useAuthStore((s) => s.setRefreshingPermissions);
  const [isSwitching, setIsSwitching] = useState(false);

  const { data: companies, isLoading } = useQuery({
    queryKey: queryKeys.system.companies(),
    queryFn: fetchCompanies,
  });

  const activeCompany = companies?.find((c) => c.id === activeCompanyId);

  const handleCompanySwitch = useCallback(
    async (companyId: string, companyName: string) => {
      if (companyId === activeCompanyId) return;

      setIsSwitching(true);
      setRefreshingPermissions(true);

      // 1. Update Zustand store (updates X-Company-Id header for all subsequent API calls)
      setActiveCompany(companyId);

      // 2. Re-fetch permissions for the new company BEFORE invalidating queries
      //    so the sidebar updates atomically with the data refetch
      let permissionsFetched = true;
      let newEnabledModules: string[] = [];
      let newIsSuperAdmin = false;
      try {
        const newPermissions = await fetchMyPermissions();
        setPermissions(newPermissions);
        newEnabledModules = newPermissions.enabledModules;
        newIsSuperAdmin = newPermissions.isSuperAdmin;
      } catch {
        permissionsFetched = false;
      }

      // 3. Check if current route is still accessible under the new company's permissions.
      //    Extract module key from current path (e.g., '/finance/journals' → 'finance').
      //    If the module is no longer enabled, redirect to /403 — unless the current
      //    route matches an alwaysVisible nav item (e.g., /system/my-permissions).
      if (permissionsFetched && !newIsSuperAdmin) {
        const segments = pathname.split('/').filter(Boolean);
        const moduleKey = segments[0];
        if (moduleKey && !newEnabledModules.includes(moduleKey)) {
          // Check if the current path matches an alwaysVisible navigation item
          const isAlwaysVisible = NAVIGATION_MODULES.some((mod) =>
            mod.items.some((item) => item.alwaysVisible && pathname.startsWith(item.path)),
          );
          if (!isAlwaysVisible) {
            navigate({ to: '/403' });
          }
        }
      }

      // 4. Invalidate all TanStack Query cache (company context changed)
      await queryClient.invalidateQueries();

      setIsSwitching(false);
      setRefreshingPermissions(false);

      // 5. Show result toast — warn if permissions couldn't be refreshed
      if (permissionsFetched) {
        toast.success(t('navigation:companySwitched', { name: companyName }));
      } else {
        toast.error(t('navigation:companySwitchPermissionError', { name: companyName }));
      }
    },
    [activeCompanyId, setActiveCompany, queryClient, setPermissions, setRefreshingPermissions, navigate, pathname, t],
  );

  /**
   * Generate initials from company name for the avatar fallback.
   * Takes first letter of each word (max 2).
   */
  function getInitials(name: string): string {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-sidebar-border',
          isCollapsed ? 'justify-center px-2' : 'px-3',
        )}
      >
        <Skeleton className={cn('rounded', isCollapsed ? 'size-8' : 'h-8 w-full')} />
      </div>
    );
  }

  // Single company — no dropdown needed, just show the name
  if (!companies || companies.length <= 1) {
    return (
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-sidebar-border',
          isCollapsed ? 'justify-center px-2' : 'gap-2 px-3',
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">
          {activeCompany ? getInitials(activeCompany.name) : <Building2 className="size-4" />}
        </div>
        {!isCollapsed && activeCompany && (
          <span
            className="truncate text-sm font-semibold text-sidebar-foreground"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {activeCompany.name}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-14 shrink-0 items-center border-b border-sidebar-border',
        isCollapsed ? 'justify-center px-2' : 'px-3',
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'flex w-full items-center rounded-md outline-none',
            'focus-visible:ring-2 focus-visible:ring-primary',
            'hover:bg-accent',
            isCollapsed ? 'justify-center p-1' : 'gap-2 p-1.5',
          )}
          aria-label={t('navigation:companySwitcher')}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">
            {activeCompany ? getInitials(activeCompany.name) : <Building2 className="size-4" />}
          </div>
          {!isCollapsed && (
            <>
              <span
                className="flex-1 truncate text-left text-sm font-semibold text-sidebar-foreground"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {activeCompany?.name ?? t('navigation:companySwitcher')}
              </span>
              {isSwitching ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
              )}
            </>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          side={isCollapsed ? 'right' : 'bottom'}
          className="w-60"
        >
          <DropdownMenuLabel>
            {t('navigation:companySwitcher')}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {companies.map((company) => (
            <DropdownMenuItem
              key={company.id}
              onClick={() => handleCompanySwitch(company.id, company.name)}
              className="flex items-center gap-2"
            >
              <div className="flex size-6 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary">
                {getInitials(company.name)}
              </div>
              <span className="flex-1 truncate text-sm">{company.name}</span>
              {company.id === activeCompanyId && (
                <Check
                  className="size-4 shrink-0 text-primary"
                  aria-label={t('navigation:currentCompany')}
                />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
