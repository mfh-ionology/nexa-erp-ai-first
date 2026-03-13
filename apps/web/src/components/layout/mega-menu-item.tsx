import { useNavigate } from '@tanstack/react-router';
import { ChevronRight, Star } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { cn } from '@/lib/utils';
import { resolveIcon } from '@/lib/icon-resolver';
import { useFavouritePages } from '@/hooks/use-favourite-pages';
import type { NavigationModule, NavigationItem } from '@/lib/navigation-config';
import { useMegaMenuStore } from '@/stores/mega-menu-store';

interface MegaMenuItemProps {
  module: NavigationModule;
  isExpanded: boolean;
  /** Whether this module contains the current route (reserved for future styling) */
  isActive: boolean;
  onToggle: () => void;
  activePath: string;
}

export function MegaMenuItem({
  module,
  isExpanded,
  isActive: _isActive,
  onToggle,
  activePath,
}: MegaMenuItemProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const close = useMegaMenuStore((s) => s.close);
  const { isPinned, togglePin } = useFavouritePages();
  const ModuleIcon = resolveIcon(module.icon);

  const handleSubItemClick = (item: NavigationItem) => {
    navigate({ to: item.path });
    close();
  };

  const handlePinClick = (e: React.MouseEvent, item: NavigationItem) => {
    e.stopPropagation();
    togglePin(item.path, t(item.labelKey), item.icon);
  };

  return (
    <div className="mb-0.5">
      <button
        className={cn(
          'flex w-full items-center gap-3 rounded-[10px] px-3.5 py-2.5 transition-all',
          isExpanded ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent',
        )}
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        {ModuleIcon && (
          <div
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg',
              isExpanded ? 'bg-primary/15' : 'bg-secondary',
            )}
          >
            <ModuleIcon className="size-4" />
          </div>
        )}
        <div className="flex-1 text-left">
          <div className="text-sm font-semibold">{t(module.labelKey)}</div>
        </div>
        <ChevronRight
          className={cn(
            'size-4 text-muted-foreground transition-transform',
            isExpanded && 'rotate-90',
          )}
        />
      </button>

      {isExpanded && (
        <div className="mt-0.5 space-y-0.5">
          {module.items.map((item) => {
            const ItemIcon = resolveIcon(item.icon);
            const isItemActive = activePath === item.path || activePath.startsWith(item.path + '/');
            const pinned = isPinned(item.path);
            const category = item.category ?? 'page';

            return (
              <button
                key={item.key}
                className={cn(
                  'group flex w-full items-center gap-2 rounded-lg py-1.5 pl-11 pr-3 transition-all',
                  isItemActive
                    ? 'font-medium text-primary'
                    : category === 'page'
                      ? 'text-muted-foreground hover:bg-accent hover:text-primary'
                      : 'text-muted-foreground/60 hover:bg-accent hover:text-primary',
                  category !== 'page' && 'text-[11px]',
                )}
                onClick={() => handleSubItemClick(item)}
              >
                {ItemIcon && (
                  <ItemIcon className={cn('size-3.5', category !== 'page' && 'size-3')} />
                )}
                <span className="flex-1 text-left text-[13px]">{t(item.labelKey)}</span>
                {isItemActive && <span className="size-1.5 rounded-full bg-primary" />}
                <Star
                  className={cn(
                    'size-3 transition-opacity',
                    pinned
                      ? 'fill-amber-400 text-amber-400 opacity-100'
                      : 'text-muted-foreground/40 opacity-0 group-hover:opacity-100',
                  )}
                  onClick={(e) => handlePinClick(e, item)}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
