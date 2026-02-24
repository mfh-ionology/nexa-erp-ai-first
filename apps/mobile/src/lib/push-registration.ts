/**
 * Push token registration — sends the Expo push token to the server.
 *
 * - registerPushToken: called after successful login to register the device
 * - unregisterPushToken: called on logout to stop receiving push notifications
 */

import * as Device from 'expo-device';

import type { ApiClient } from '@nexa/api-client';

/**
 * Stable device identifier using expo-device.
 * Falls back to a UUID-based identifier if the OS model name is unavailable.
 */
function getDeviceId(): string {
  // Device.modelId provides a stable hardware identifier (e.g. "iPhone15,2")
  // Combined with OS to disambiguate across platforms
  const model = Device.modelId ?? Device.modelName ?? 'unknown';
  const os = Device.osName ?? 'unknown';
  return `${os}-${model}`;
}

/**
 * Register the device's Expo push token with the server.
 *
 * Called after successful login so the server can send push notifications
 * (approval requests, briefing alerts, stock alerts) to this device.
 *
 * @param client - Authenticated API client instance
 * @param pushToken - Expo push token string (e.g., "ExponentPushToken[...]")
 */
export async function registerPushToken(
  client: ApiClient,
  pushToken: string,
): Promise<void> {
  await client.notifications.registerDevice({
    pushToken,
    platform: 'expo',
    deviceId: getDeviceId(),
  });
}

/**
 * Unregister the device's push token from the server.
 *
 * Called on logout so the server stops sending push notifications
 * to this device.
 *
 * @param client - Authenticated API client instance
 * @param pushToken - Expo push token to unregister
 */
export async function unregisterPushToken(
  client: ApiClient,
  pushToken: string,
): Promise<void> {
  await client.notifications.unregisterDevice(pushToken);
}
