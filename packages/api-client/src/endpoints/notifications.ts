/**
 * Notification endpoint methods (API Contracts §2.25).
 */

import type { ApiClient } from '../client';
import type { ApiMeta } from '../types';

// --- Response types ---

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  isDismissed: boolean;
  entityType?: string;
  entityId?: string;
  createdAt: string; // ISO 8601
}

export interface NotificationListResponse {
  notifications: Notification[];
  meta?: ApiMeta;
}

export interface NotificationPreferences {
  userId: string;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  notificationChannels: Record<string, boolean>;
  quietHours?: {
    enabled: boolean;
    startTime?: string; // HH:MM
    endTime?: string; // HH:MM
  };
}

// --- Endpoint interface ---

/** Payload for registering a device's push token with the server. */
export interface RegisterDevicePayload {
  pushToken: string;
  platform: 'expo';
  deviceId: string;
}

export interface NotificationEndpoints {
  fetchNotifications(
    cursor?: string,
    limit?: number,
  ): Promise<NotificationListResponse>;
  markRead(notificationId: string): Promise<Notification>;
  dismiss(notificationId: string): Promise<Notification>;
  getPreferences(): Promise<NotificationPreferences>;
  updatePreferences(
    prefs: Partial<Omit<NotificationPreferences, 'userId'>>,
  ): Promise<NotificationPreferences>;
  registerDevice(payload: RegisterDevicePayload): Promise<void>;
  unregisterDevice(pushToken: string): Promise<void>;
}

// --- Factory ---

export function createNotificationEndpoints(
  client: ApiClient,
): NotificationEndpoints {
  return {
    async fetchNotifications(cursor?, limit?) {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (limit != null) params.set('limit', String(limit));
      const query = params.toString();
      const { data } = await client.get<NotificationListResponse>(
        `/notifications${query ? `?${query}` : ''}`,
      );
      return data;
    },

    async markRead(notificationId) {
      const { data } = await client.patch<Notification>(
        `/notifications/${notificationId}/read`,
      );
      return data;
    },

    async dismiss(notificationId) {
      const { data } = await client.post<Notification>(
        `/notifications/${notificationId}/dismiss`,
      );
      return data;
    },

    async getPreferences() {
      const { data } = await client.get<NotificationPreferences>(
        '/notifications/preferences',
      );
      return data;
    },

    async updatePreferences(prefs) {
      const { data } = await client.put<NotificationPreferences>(
        '/notifications/preferences',
        prefs,
      );
      return data;
    },

    async registerDevice(payload) {
      await client.post('/notifications/devices', payload);
    },

    async unregisterDevice(pushToken) {
      await client.delete(
        `/notifications/devices/${encodeURIComponent(pushToken)}`,
      );
    },
  };
}
