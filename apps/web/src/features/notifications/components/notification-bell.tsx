import { forwardRef, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/stores/notification-store';

/**
 * Notification bell icon with unread count badge.
 *
 * Reads unread count from the notification Zustand store (synced by
 * NotificationProvider via WebSocket + React Query).  Clicking toggles
 * the notification dropdown.
 *
 * Uses forwardRef so it works correctly as a Radix `asChild` target
 * (e.g. inside TooltipTrigger).
 */
export const NotificationBell = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<'button'>
>(function NotificationBell(props, ref) {
  const { t } = useI18n();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const isDropdownOpen = useNotificationStore((s) => s.isDropdownOpen);

  // ── Badge bounce animation on count increase ─────────────────────────
  const prevCountRef = useRef(unreadCount);
  const [isBouncing, setIsBouncing] = useState(false);

  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      setIsBouncing(true);
      const timer = setTimeout(() => setIsBouncing(false), 1000);
      prevCountRef.current = unreadCount;
      return () => clearTimeout(timer);
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  const displayCount = unreadCount > 99 ? '99+' : String(unreadCount);

  // NOTE: No onClick handler here. Open/close is controlled by the
  // Radix Popover via onOpenChange in NotificationDropdown. Adding
  // onClick={toggleDropdown} here would double-toggle on every click.
  return (
    <button
      ref={ref}
      type="button"
      className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      aria-label={t('notifications:ariaLabel', { count: unreadCount })}
      aria-expanded={isDropdownOpen}
      {...props}
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span
          className={cn(
            'absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-[4px] bg-destructive px-1 text-[10px] font-bold leading-none text-white',
            'h-4',
            isBouncing && 'animate-bounce',
          )}
        >
          {displayCount}
        </span>
      )}
    </button>
  );
});
