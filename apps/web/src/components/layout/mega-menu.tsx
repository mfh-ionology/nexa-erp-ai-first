import { useEffect, useRef } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { X, Search } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { cn } from '@/lib/utils';
import { useMegaMenuStore } from '@/stores/mega-menu-store';
import { useAuthStore } from '@/stores/auth-store';
import { getFilteredModules } from '@/lib/navigation-config';
import { MegaMenuItem } from './mega-menu-item';

export function MegaMenu() {
  const { t } = useI18n();

  const { isOpen, close, expandedModule, setExpandedModule, filterQuery, setFilterQuery } =
    useMegaMenuStore();

  const permissions = useAuthStore((s) => s.permissions);
  const enabledModules = permissions?.enabledModules ?? [];
  const isSuperAdmin = permissions?.isSuperAdmin ?? false;

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const panelRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  const modulePermissions = permissions?.modules;

  // Get filtered modules based on user permissions
  const modules = getFilteredModules(enabledModules, isSuperAdmin, modulePermissions).sort(
    (a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99),
  );

  // Filter by search query
  const filteredModules = filterQuery
    ? modules.filter(
        (m) =>
          t(m.labelKey).toLowerCase().includes(filterQuery.toLowerCase()) ||
          m.items.some((item) =>
            t(item.labelKey).toLowerCase().includes(filterQuery.toLowerCase()),
          ),
      )
    : modules;

  // Focus filter input when panel opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => filterRef.current?.focus(), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableEls = panel.querySelectorAll<HTMLElement>(
        'button, input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusableEls.length === 0) return;

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] transition-opacity',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={close}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label={t('navigation:modules')}
        aria-modal="true"
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[380px] bg-card shadow-xl transition-transform duration-250 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'max-sm:w-[300px]',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Panel header */}
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <button
            onClick={close}
            className="rounded-lg p-1.5 hover:bg-secondary"
            aria-label={t('navigation:closeMegaMenu')}
          >
            <X className="size-5 text-muted-foreground" />
          </button>
          <span className="font-serif font-bold text-foreground">{t('navigation:allModules')}</span>
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={filterRef}
              type="text"
              placeholder={t('navigation:filterModules')}
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-40 rounded-lg border border-border bg-secondary py-1.5 pl-8 pr-3 text-xs focus:border-primary focus:outline-none"
              aria-label={t('navigation:filterModules')}
            />
          </div>
        </div>

        {/* Module list */}
        <div className="h-[calc(100%-56px)] overflow-y-auto p-3">
          {filteredModules.map((module, index) => {
            const DIVIDER_AFTER = [7, 11];
            const prevOrder = filteredModules[index - 1]?.displayOrder ?? 0;
            const showDivider =
              index > 0 &&
              DIVIDER_AFTER.some(
                (threshold) =>
                  (prevOrder ?? 0) <= threshold && (module.displayOrder ?? 99) > threshold,
              );

            return (
              <div key={module.key}>
                {showDivider && <div className="my-2 border-t border-border/50" />}
                <MegaMenuItem
                  module={module}
                  isExpanded={expandedModule === module.key}
                  isActive={pathname.startsWith(module.pathPrefix)}
                  onToggle={() =>
                    setExpandedModule(expandedModule === module.key ? null : module.key)
                  }
                  activePath={pathname}
                />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
