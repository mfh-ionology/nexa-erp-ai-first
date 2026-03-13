/**
 * ModuleContextBar — 32px bar showing the active module context.
 *
 * Auto-detected from the URL via useActiveModule.
 * Displays the module icon + name, then category pills (Pages / Settings / Reports)
 * that open popover dropdowns with the matching navigation items.
 * Returns null when outside a module context (e.g., Dashboard, Tasks).
 */

import { Link, useRouterState } from '@tanstack/react-router';
import { icons, type LucideIcon } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { cn } from '@/lib/utils';
import { useActiveModule } from '@/hooks/use-active-module';
import { useAuthStore } from '@/stores/auth-store';
import {
  NAVIGATION_MODULES,
  getFilteredModules,
  getModuleItemsByCategory,
  type NavigationItem,
} from '@/lib/navigation-config';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function resolveIcon(name: string): LucideIcon | undefined {
  return icons[name as keyof typeof icons];
}

type CategoryKey = 'page' | 'setting' | 'report';

const CATEGORIES: { key: CategoryKey; labelKey: string }[] = [
  { key: 'page', labelKey: 'navigation:moduleContext.pages' },
  { key: 'setting', labelKey: 'navigation:moduleContext.settings' },
  { key: 'report', labelKey: 'navigation:moduleContext.reports' },
];

interface CategoryPillProps {
  label: string;
  items: NavigationItem[];
  activePath: string;
  translate: (key: string) => string;
}

function CategoryPill({ label, items, activePath, translate }: CategoryPillProps) {
  const hasActiveItem = items.some(
    (item) => activePath === item.path || activePath.startsWith(item.path + '/'),
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all',
            hasActiveItem
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-primary/10 hover:text-primary',
          )}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-2">
        <div className="space-y-0.5">
          {items.map((item) => {
            const Icon = resolveIcon(item.icon);
            const isActive = activePath === item.path || activePath.startsWith(item.path + '/');

            return (
              <Link
                key={item.key}
                to={item.path}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {Icon && <Icon className="size-3.5" />}
                <span className="truncate">{translate(item.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ModuleContextBar() {
  const { t } = useI18n();
  const activeModuleKey = useActiveModule();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const permissions = useAuthStore((s) => s.permissions);

  // Don't render when not inside a module
  if (!activeModuleKey) return null;

  const enabledModules = permissions?.enabledModules ?? [];
  const isSuperAdmin = permissions?.isSuperAdmin ?? false;
  const modulePermissions = permissions?.modules;

  // Find the module from filtered (permission-aware) list
  const filteredModules = getFilteredModules(enabledModules, isSuperAdmin, modulePermissions);
  const activeModule = filteredModules.find((m) => m.key === activeModuleKey);

  // Fallback to unfiltered if not found (shouldn't happen, but safe)
  const module = activeModule ?? NAVIGATION_MODULES.find((m) => m.key === activeModuleKey);
  if (!module) return null;

  const ModuleIcon = resolveIcon(module.icon);

  // Build category items — only include categories that have items
  const categoryData = CATEGORIES.map((cat) => ({
    ...cat,
    items: getModuleItemsByCategory(module, cat.key),
  })).filter((cat) => cat.items.length > 0);

  return (
    <div
      className="flex h-8 items-center gap-2 border-b border-border/30 px-4"
      style={{ backgroundColor: '#faf9ff' }}
    >
      {/* Module icon + name */}
      <div className="flex shrink-0 items-center gap-1.5">
        {ModuleIcon && (
          <div className="flex size-5 items-center justify-center rounded bg-primary/10">
            <ModuleIcon className="size-3 text-primary" />
          </div>
        )}
        <span className="text-xs font-semibold text-foreground">{t(module.labelKey)}</span>
      </div>

      {/* Vertical divider */}
      <div className="mx-1 h-3.5 w-px shrink-0 bg-border" />

      {/* Category pills */}
      {categoryData.map((cat) => (
        <CategoryPill
          key={cat.key}
          label={t(cat.labelKey)}
          items={cat.items}
          activePath={pathname}
          translate={t}
        />
      ))}
    </div>
  );
}
