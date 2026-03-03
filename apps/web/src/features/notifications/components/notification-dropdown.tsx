/**
 * NotificationDropdown — Popover panel anchored to the NotificationBell.
 *
 * Shows recent notifications with priority indicators, timestamps, dismiss
 * actions, and a "Mark All Read" bulk action. Navigates to the related
 * entity on click and marks the notification as READ.
 *
 * Uses:
 * - Zustand notification store for reactive state
 * - React Query hooks for data fetching + mutations
 * - i18n translation keys for relative timestamps
 * - TanStack Router for entity navigation
 */

import { useCallback } from 'react';
import { Bell, X } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/stores/notification-store';
import type { Notification, NotificationPriority } from '@/stores/notification-store';

import { useNotifications } from '../api/use-notifications';
import {
  useMarkAsRead,
  useDismissNotification,
  useMarkAllAsRead,
} from '../api/use-notification-actions';
import { NotificationBell } from './notification-bell';

// ── Priority → left border colour mapping ────────────────────────────────────

const PRIORITY_BORDER: Record<NotificationPriority, string> = {
  URGENT: 'border-l-red-500',
  HIGH: 'border-l-amber-500',
  NORMAL: 'border-l-blue-500',
  LOW: 'border-l-gray-400',
};

// ── i18n-compatible relative time ────────────────────────────────────────────

function formatRelativeTime(
  isoDate: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();

  // Guard: invalid date string or future timestamp (clock skew)
  if (Number.isNaN(then) || now - then < 0) {
    return t('notifications:justNow');
  }

  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return t('notifications:justNow');
  if (diffMin < 60) return t('notifications:minutesAgo', { count: diffMin });
  if (diffHr < 24) return t('notifications:hoursAgo', { count: diffHr });
  return t('notifications:daysAgo', { count: diffDay });
}

// ── Skeleton loader ──────────────────────────────────────────────────────────

function NotificationSkeleton() {
  return (
    <div className="flex flex-col gap-2 border-l-4 border-l-transparent px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-12" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

// ── Single notification item ─────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
  onNavigate: (url: string, notificationId: string) => void;
  onMarkAsRead: (notificationId: string) => void;
  onDismiss: (notificationId: string) => void;
}

function NotificationItem({
  notification,
  onNavigate,
  onMarkAsRead,
  onDismiss,
}: NotificationItemProps) {
  const { t } = useI18n();
  const isUnread = notification.status === 'PENDING' || notification.status === 'DELIVERED';

  const relativeTime = formatRelativeTime(notification.createdAt, t);

  // State machine §17.2: only DELIVERED can transition to READ or DISMISSED
  const canTransition = notification.status === 'DELIVERED';

  const handleClick = () => {
    if (notification.actionUrl) {
      // Navigate + mark as read (handleNavigate does both)
      onNavigate(notification.actionUrl, notification.id);
    } else if (canTransition) {
      // No actionUrl: just mark as read
      onMarkAsRead(notification.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'group relative flex cursor-pointer flex-col gap-1 border-l-4 px-3 py-3 transition-colors',
        'hover:bg-[#f5f3ff]',
        PRIORITY_BORDER[notification.priority],
        isUnread && 'bg-[#faf9ff]',
      )}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Row 1: title + timestamp */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isUnread && <span className="mt-0.5 size-2 shrink-0 rounded-full bg-blue-500" />}
          <span
            className={cn(
              'line-clamp-1 text-sm font-heading',
              isUnread ? 'font-semibold' : 'font-normal text-muted-foreground',
            )}
          >
            {notification.title}
          </span>
        </div>
        <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
          {relativeTime}
        </span>
      </div>

      {/* Row 2: body preview */}
      <p
        className={cn(
          'line-clamp-2 text-xs',
          isUnread ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {notification.body}
      </p>

      {/* Dismiss button — visible on hover, only for DELIVERED notifications (§17.2) */}
      {canTransition && (
        <button
          type="button"
          className="absolute right-2 top-2 hidden rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground group-hover:block"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(notification.id);
          }}
          aria-label={t('notifications:dismiss')}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Main dropdown ────────────────────────────────────────────────────────────

export function NotificationDropdown() {
  const { t } = useI18n();
  const navigate = useNavigate();

  // Store state
  const isDropdownOpen = useNotificationStore((s) => s.isDropdownOpen);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const closeDropdown = useNotificationStore((s) => s.closeDropdown);
  const setDropdownOpen = useNotificationStore((s) => s.setDropdownOpen);

  // Data fetching (initial load handled by NotificationProvider — this
  // tracks loading state for the dropdown UI)
  const { isLoading } = useNotifications();

  // Mutations
  const markAsRead = useMarkAsRead();
  const dismissNotification = useDismissNotification();
  const markAllAsRead = useMarkAllAsRead();

  const handleNavigate = useCallback(
    (url: string, notificationId: string) => {
      markAsRead.mutate(notificationId);
      closeDropdown();
      void navigate({ to: url });
    },
    [markAsRead, closeDropdown, navigate],
  );

  const handleMarkAsRead = useCallback(
    (notificationId: string) => {
      markAsRead.mutate(notificationId);
    },
    [markAsRead],
  );

  const handleDismiss = useCallback(
    (notificationId: string) => {
      dismissNotification.mutate(notificationId);
    },
    [dismissNotification],
  );

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead.mutate();
  }, [markAllAsRead]);

  const handleViewAll = useCallback(() => {
    closeDropdown();
    void navigate({ to: '/notifications' as string });
  }, [closeDropdown, navigate]);

  return (
    <Popover open={isDropdownOpen} onOpenChange={setDropdownOpen}>
      <PopoverTrigger asChild>
        <NotificationBell />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] rounded-xl border border-border bg-white p-0 shadow-lg max-sm:w-[calc(100vw-2rem)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-heading text-sm font-semibold">{t('notifications:title')}</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-primary hover:text-primary/80"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
            >
              {t('notifications:markAllRead')}
            </Button>
          )}
        </div>

        {/* Body */}
        {isLoading ? (
          /* Loading skeleton */
          <div className="divide-y divide-border">
            <NotificationSkeleton />
            <NotificationSkeleton />
            <NotificationSkeleton />
          </div>
        ) : notifications.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <Bell className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              {t('notifications:noNotifications')}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {t('notifications:noNotificationsDescription')}
            </p>
          </div>
        ) : (
          /* Notification list */
          <ScrollArea className="max-h-[400px]">
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onNavigate={handleNavigate}
                  onMarkAsRead={handleMarkAsRead}
                  onDismiss={handleDismiss}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        <div className="border-t border-border">
          <button
            type="button"
            className="w-full px-4 py-2.5 text-center text-xs font-medium text-primary transition-colors hover:bg-[#f5f3ff]"
            onClick={handleViewAll}
          >
            {t('notifications:viewAll')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
