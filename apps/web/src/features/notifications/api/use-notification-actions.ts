/**
 * TanStack Query mutation hooks for notification actions.
 *
 * - useMarkAsRead: PATCH /notifications/:id/read (optimistic)
 * - useDismissNotification: POST /notifications/:id/dismiss (optimistic)
 * - useMarkAllAsRead: PATCH /notifications/mark-all-read (optimistic)
 *
 * All mutations use optimistic updates via the Zustand notification store
 * with rollback on error and query invalidation on settle.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiPatch, apiPost } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useNotificationStore } from '@/stores/notification-store';
import type { Notification } from '@/stores/notification-store';

// ── useMarkAsRead ────────────────────────────────────────────────────────────

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const store = useNotificationStore;

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const result = await apiPatch<Notification>(`/notifications/${notificationId}/read`);
      return result.data;
    },
    onMutate: async (notificationId) => {
      // Cancel outgoing queries to avoid overwrites
      await queryClient.cancelQueries({
        queryKey: queryKeys.notifications.all,
      });

      // Snapshot store state for rollback
      const previousNotifications = store.getState().notifications;
      const previousUnreadCount = store.getState().unreadCount;

      // Optimistic update in Zustand store
      store.getState().markAsRead(notificationId);

      return { previousNotifications, previousUnreadCount };
    },
    onError: (_err, _notificationId, context) => {
      // Rollback Zustand store
      if (context) {
        store.getState().setNotifications(context.previousNotifications);
        store.getState().setUnreadCount(context.previousUnreadCount);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.list(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount(),
      });
    },
  });
}

// ── useDismissNotification ───────────────────────────────────────────────────

export function useDismissNotification() {
  const queryClient = useQueryClient();
  const store = useNotificationStore;

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const result = await apiPost<Notification>(`/notifications/${notificationId}/dismiss`);
      return result.data;
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.notifications.all,
      });

      const previousNotifications = store.getState().notifications;
      const previousUnreadCount = store.getState().unreadCount;

      // Optimistic: remove from list, decrement count if was unread
      store.getState().markAsDismissed(notificationId);

      return { previousNotifications, previousUnreadCount };
    },
    onError: (_err, _notificationId, context) => {
      if (context) {
        store.getState().setNotifications(context.previousNotifications);
        store.getState().setUnreadCount(context.previousUnreadCount);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.list(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount(),
      });
    },
  });
}

// ── useMarkAllAsRead ─────────────────────────────────────────────────────────

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const store = useNotificationStore;

  return useMutation({
    mutationFn: async () => {
      const result = await apiPatch<{ updated: number }>('/notifications/mark-all-read');
      return result.data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.notifications.all,
      });

      const previousNotifications = store.getState().notifications;
      const previousUnreadCount = store.getState().unreadCount;

      // Optimistic: mark all as read, set count to 0
      store.getState().markAllAsRead();

      return { previousNotifications, previousUnreadCount };
    },
    onError: (_err, _variables, context) => {
      if (context) {
        store.getState().setNotifications(context.previousNotifications);
        store.getState().setUnreadCount(context.previousUnreadCount);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.list(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount(),
      });
    },
  });
}
