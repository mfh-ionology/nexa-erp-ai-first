/**
 * Priority-based notification toast display utility.
 *
 * Routes incoming notifications to Sonner toasts based on priority:
 * - URGENT → toast with 8s duration + action button
 * - HIGH   → toast with 5s duration + action button
 * - NORMAL / LOW → no toast (badge update only, handled by notification store)
 */

import { toast } from 'sonner';

import { i18n } from '@nexa/i18n';

import type { Notification } from '@/stores/notification-store';

/**
 * Duration in milliseconds before auto-dismiss.
 * Story spec: URGENT = 8s, HIGH = 5s.
 */
const TOAST_DURATION: Record<string, number> = {
  URGENT: 8_000,
  HIGH: 5_000,
};

/**
 * Show a toast notification for URGENT/HIGH priority notifications.
 * NORMAL and LOW priorities are silently added to the notification centre only.
 *
 * @param notification — The notification payload from the WebSocket
 * @param onNavigate  — Optional callback to navigate to the notification's actionUrl
 */
export function showNotificationToast(
  notification: Notification,
  onNavigate?: (url: string) => void,
): void {
  const { priority, title, body, actionUrl } = notification;

  // Only URGENT and HIGH show toasts
  if (priority !== 'URGENT' && priority !== 'HIGH') {
    return;
  }

  const duration = TOAST_DURATION[priority];

  toast(title, {
    description: body,
    duration,
    ...(actionUrl && onNavigate
      ? {
          action: {
            label: i18n.t('notifications:toastAction'),
            onClick: () => onNavigate(actionUrl),
          },
        }
      : {}),
  });
}
