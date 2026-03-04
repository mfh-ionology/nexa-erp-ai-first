import { Link, useRouterState } from '@tanstack/react-router';
import { BookOpen, Brain, ChevronLeft, ChevronRight, LayoutDashboard, LogOut } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';
import { usePlatformAuthStore } from '@/stores/auth-store';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/intelligence', label: 'AI Intelligence', icon: Brain },
  { path: '/knowledge', label: 'Knowledge Management', icon: BookOpen, disabled: true },
];

function isActivePath(path: string, pathname: string) {
  if (path === '/') return pathname === '/';
  return pathname.startsWith(path);
}

export function PlatformSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = usePlatformAuthStore((s) => s.user);
  const logout = usePlatformAuthStore((s) => s.logout);

  return (
    <nav
      role="navigation"
      aria-label="Platform navigation"
      className={cn(
        'flex h-full flex-col bg-[var(--sidebar-background)] text-[var(--sidebar-foreground)] transition-[width] duration-200',
        isCollapsed ? 'w-16' : 'w-[260px]',
      )}
    >
      {/* Branding */}
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-[var(--sidebar-border)] px-4',
          isCollapsed && 'justify-center px-0',
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-bold text-white">
          N
        </div>
        {!isCollapsed && (
          <div className="ml-3 flex flex-col">
            <span className="text-sm font-semibold text-white">PLATFORM ADMIN</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(item.path, pathname);
            const Icon = item.icon;

            if (item.disabled) {
              return (
                <div
                  key={item.path}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium opacity-40 cursor-not-allowed',
                    isCollapsed && 'justify-center px-0',
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!isCollapsed && <span className="nav-item-text">{item.label}</span>}
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-white',
                  isCollapsed && 'justify-center px-0',
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span className="nav-item-text">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </div>

      {/* User info + logout */}
      {user && (
        <div className="shrink-0 border-t border-[var(--sidebar-border)] p-2">
          {!isCollapsed && (
            <div className="mb-2 px-2.5 py-1">
              <p className="truncate text-xs font-medium text-white">{user.displayName}</p>
              <p className="truncate text-[11px] text-[var(--sidebar-muted)]">{user.role}</p>
            </div>
          )}
          <button
            onClick={logout}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
              'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-white',
              isCollapsed && 'justify-center px-0',
            )}
            title={isCollapsed ? 'Sign out' : undefined}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="shrink-0 border-t border-[var(--sidebar-border)] p-2">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'flex h-8 w-full items-center justify-center rounded-lg transition-colors',
            'text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-accent)] hover:text-white',
          )}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </nav>
  );
}
