/**
 * Push notification hook — registration, foreground display, and tap navigation.
 *
 * - Registers for Expo push tokens on physical devices
 * - Shows notifications as alerts when the app is in the foreground
 * - Handles notification tap → deep link to the relevant app screen
 * - Cleans up listeners on unmount
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  ACTION_APPROVE,
  ACTION_REJECT,
} from '@/lib/notification-categories';

// --- Types ---

/** Data payload attached to incoming push notifications. */
export interface PushNotificationData {
  entityType?: string;
  entityId?: string;
  category?: string;
  action?: string;
}

export interface UsePushNotificationsReturn {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  registerForPushNotifications: () => Promise<string | null>;
}

// --- Deep link mapping ---

/**
 * Map a push notification's entity type to an Expo Router path.
 * Returns the route to navigate to, or null if no mapping exists.
 */
function resolveDeepLink(data: PushNotificationData): string | null {
  if (!data.entityType) return null;

  switch (data.entityType) {
    case 'approval':
    case 'approval_request':
      return '/(tabs)/approvals';
    case 'briefing':
    case 'briefing_alert':
      return '/(tabs)/briefing';
    case 'stock_alert':
    case 'inventory':
      return '/(tabs)/more';
    case 'chat':
    case 'ai_chat':
      return '/(tabs)/chat';
    default:
      return null;
  }
}

// --- Configure foreground notification behaviour ---

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// --- Hook ---

export function usePushNotifications(): UsePushNotificationsReturn {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);

  const notificationListenerRef =
    useRef<Notifications.EventSubscription | null>(null);
  const responseListenerRef =
    useRef<Notifications.EventSubscription | null>(null);

  /**
   * Register the device for push notifications and return the Expo push token.
   * Returns null if the device is a simulator or permissions are denied.
   */
  async function registerForPushNotifications(): Promise<string | null> {
    // Push notifications only work on physical devices
    if (!Device.isDevice) {
      return null;
    }

    // Request notification permissions on Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7c3aed',
      });
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    setExpoPushToken(token);
    return token;
  }

  useEffect(() => {
    // Listen for incoming notifications while the app is in the foreground
    notificationListenerRef.current =
      Notifications.addNotificationReceivedListener((incomingNotification) => {
        setNotification(incomingNotification);
      });

    // Listen for user tapping on a notification → deep link to relevant screen
    responseListenerRef.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = (response.notification.request.content.data ??
          {}) as PushNotificationData;

        // Handle actionable notification responses (approve/reject from lock screen)
        const actionId = response.actionIdentifier;
        if (
          (actionId === ACTION_APPROVE || actionId === ACTION_REJECT) &&
          data.entityId
        ) {
          // User tapped an inline action button — navigate to approvals
          // The actual approve/reject API call will be handled by the approvals screen
          router.push('/(tabs)/approvals');
          return;
        }

        // Standard tap → navigate to the relevant screen
        const route = resolveDeepLink(data);
        if (route) {
          router.push(route);
        }
      });

    return () => {
      if (notificationListenerRef.current) {
        Notifications.removeNotificationSubscription(
          notificationListenerRef.current,
        );
      }
      if (responseListenerRef.current) {
        Notifications.removeNotificationSubscription(
          responseListenerRef.current,
        );
      }
    };
  }, []);

  return {
    expoPushToken,
    notification,
    registerForPushNotifications,
  };
}
