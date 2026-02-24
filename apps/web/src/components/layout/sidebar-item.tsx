import { Link, useRouterState } from '@tanstack/react-router';
import { icons, type LucideIcon } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { NavigationItem } from '@/lib/navigation-config';
import { cn } from '@/lib/utils';

import { useI18n } from '@nexa/i18n';

interface SidebarItemProps {
  item: NavigationItem;
  isCollapsed: boolean;
}

/**
 * A single navigation item in the sidebar.
 * Renders a link with a Lucide icon and translated label.
 * In collapsed mode, shows a tooltip with the label on hover.
 */
export function SidebarItem({ item, isCollapsed }: SidebarItemProps) {
  const { t } = useI18n();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const isActive = pathname === item.path || pathname.startsWith(item.path + '/');

  const Icon: LucideIcon | undefined = icons[item.icon as keyof typeof icons];
  const label = t(item.labelKey);

  const linkContent = (
    <Link
      to={item.path}
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        'outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isActive
          ? 'border-l-2 border-primary bg-background font-semibold text-primary'
          : 'text-text-muted hover:bg-background hover:text-text',
        isCollapsed && 'justify-center px-0',
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      {Icon && (
        <Icon
          className={cn(
            'size-4 shrink-0',
            isActive ? 'text-primary' : 'text-text-muted group-hover:text-text',
          )}
        />
      )}
      {!isCollapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}
