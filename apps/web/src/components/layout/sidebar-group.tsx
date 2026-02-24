import { ChevronDown, icons, type LucideIcon } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { NavigationModule } from '@/lib/navigation-config';
import { cn } from '@/lib/utils';

import { useI18n } from '@nexa/i18n';

import { SidebarItem } from './sidebar-item';

interface SidebarGroupProps {
  module: NavigationModule;
  isCollapsed: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  /** Called in collapsed mode to expand the sidebar before showing items */
  onExpandSidebar?: () => void;
}

/**
 * A collapsible module group in the sidebar.
 * Shows a Lucide icon + translated label with expand/collapse chevron.
 * In collapsed (icon-only) mode, shows a tooltip on hover.
 */
export function SidebarGroup({
  module,
  isCollapsed,
  isExpanded,
  onToggle,
  onExpandSidebar,
}: SidebarGroupProps) {
  const { t } = useI18n();
  const Icon: LucideIcon | undefined =
    icons[module.icon as keyof typeof icons];
  const label = t(module.labelKey);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  const handleCollapsedClick = () => {
    // Expand the sidebar so sub-items become visible
    onExpandSidebar?.();
    // Ensure the group is expanded (open it if not already)
    if (!isExpanded) {
      onToggle();
    }
  };

  // Collapsed (icon-only) mode: just render module icon with tooltip
  if (isCollapsed) {
    return (
      <div className="px-2 py-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleCollapsedClick}
              className={cn(
                'flex w-full items-center justify-center rounded-md p-2',
                'text-text-muted hover:bg-background hover:text-text',
                'outline-none focus-visible:ring-2 focus-visible:ring-primary',
              )}
              aria-label={label}
            >
              {Icon && <Icon className="size-5" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {label}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // Expanded mode: full group with toggle and child items
  return (
    <div className="px-2 py-1">
      <button
        type="button"
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold',
          'text-text hover:bg-background',
          'outline-none focus-visible:ring-2 focus-visible:ring-primary',
        )}
        style={{ fontFamily: 'var(--font-display)' }}
        aria-expanded={isExpanded}
      >
        {Icon && <Icon className="size-5 shrink-0 text-text-muted" />}
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-text-muted transition-transform duration-200',
            isExpanded && 'rotate-180',
          )}
        />
      </button>

      <div
        className={cn(
          'overflow-hidden transition-[max-height] duration-200 ease-out',
          isExpanded ? 'max-h-96' : 'max-h-0',
        )}
      >
        <div className="ml-2 space-y-0.5 py-1">
          {module.items.map((item) => (
            <SidebarItem
              key={item.key}
              item={item}
              isCollapsed={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
