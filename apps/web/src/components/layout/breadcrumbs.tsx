import { Link, useRouterState } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';

import { NAVIGATION_MODULES } from '@/lib/navigation-config';
import { cn } from '@/lib/utils';

import { useI18n } from '@nexa/i18n';

interface BreadcrumbSegment {
  labelKey: string | null;
  fallbackLabel: string;
  path: string;
  isCurrent: boolean;
}

/**
 * Build a path → i18n label key lookup map from the navigation config.
 * Module paths (e.g., '/finance') map to the module labelKey.
 * Item paths (e.g., '/finance/journals') map to the item labelKey.
 */
function buildPathLabelMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const mod of NAVIGATION_MODULES) {
    map.set(`/${mod.key}`, mod.labelKey);
    for (const item of mod.items) {
      map.set(item.path, item.labelKey);
    }
  }
  return map;
}

const PATH_LABEL_MAP = buildPathLabelMap();

/**
 * Derive breadcrumb segments from the current pathname.
 * Builds progressive paths and looks up labels from the navigation config.
 */
function deriveBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  const cleaned = pathname.replace(/\/$/, '');
  const parts = cleaned.split('/').filter(Boolean);

  if (parts.length === 0) return [];

  const crumbs: BreadcrumbSegment[] = [];
  let currentPath = '';

  for (let i = 0; i < parts.length; i++) {
    const segment = parts[i]!;
    currentPath += `/${segment}`;
    const labelKey = PATH_LABEL_MAP.get(currentPath) ?? null;

    crumbs.push({
      labelKey,
      fallbackLabel: segment,
      path: currentPath,
      isCurrent: i === parts.length - 1,
    });
  }

  return crumbs;
}

/**
 * Breadcrumb trail based on the current route.
 *
 * Format: Module > Entity Type > Record Name
 * Uses `<nav aria-label="Breadcrumb">` with `<ol>` list and
 * `aria-current="page"` on the last item (WCAG 2.1 AA).
 * All labels via translation keys where available.
 */
export function Breadcrumbs() {
  const { t } = useI18n();
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  const crumbs = deriveBreadcrumbs(pathname);

  if (crumbs.length === 0) return null;

  return (
    <nav
      aria-label={t('navigation:breadcrumb')}
      className="shrink-0 border-b border-border bg-surface px-4 py-2"
    >
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {crumbs.map((crumb, index) => {
          const label = crumb.labelKey
            ? t(crumb.labelKey)
            : crumb.fallbackLabel;

          return (
            <li key={crumb.path} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              {crumb.isCurrent ? (
                <span
                  className="font-medium text-foreground"
                  aria-current="page"
                >
                  {label}
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className={cn(
                    'hover:text-foreground transition-colors',
                    'outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-sm',
                  )}
                >
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
