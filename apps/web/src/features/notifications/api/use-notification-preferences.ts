/**
 * TanStack Query hook for fetching notification preferences.
 *
 * Uses `useQuery` against `GET /notifications/preferences`.
 * Returns the user's preferences merged with template defaults.
 */

import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NotificationPreferenceItem {
  templateId: string;
  templateCode: string;
  templateName: string;
  eventName: string;
  defaultChannels: Array<'IN_APP' | 'EMAIL' | 'PUSH'>;
  defaultPriority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  enableInApp: boolean;
  enableEmail: boolean;
  enablePush: boolean;
  priorityOverride: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | null;
  isMuted: boolean;
  muteUntil: string | null;
  hasUserPreference: boolean;
  source: 'USER' | 'ROLE_DEFAULT' | 'TEMPLATE_DEFAULT';
}

interface PreferencesResponse {
  items: NotificationPreferenceItem[];
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Query for the current user's notification preferences merged with template defaults.
 *
 * Stale time: 5 minutes (preferences rarely change).
 */
export function useNotificationPreferences() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.notifications.preferences(),
    queryFn: async () => {
      const result = await apiGet<PreferencesResponse>('/notifications/preferences');
      return result.data;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}
