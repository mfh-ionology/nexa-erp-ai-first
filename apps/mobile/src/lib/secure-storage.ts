/**
 * Wrapper around expo-secure-store for encrypted key-value token storage.
 *
 * All tokens and sensitive flags are stored in the OS keychain
 * (iOS Keychain / Android EncryptedSharedPreferences).
 */

import * as SecureStore from 'expo-secure-store';

/** Well-known keys stored in SecureStore. */
export const STORAGE_KEYS = {
  REFRESH_TOKEN: 'nexa_refresh_token',
  BIOMETRIC_ENABLED: 'nexa_biometric_enabled',
  USER_ID: 'nexa_user_id',
  USER_EMAIL: 'nexa_user_email',
  USER_FIRST_NAME: 'nexa_user_first_name',
  USER_LAST_NAME: 'nexa_user_last_name',
  PUSH_TOKEN: 'nexa_push_token',
  COMPANY_NAME: 'nexa_company_name',
} as const;

/**
 * Store a value in encrypted secure storage.
 */
export async function setToken(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

/**
 * Retrieve a value from encrypted secure storage.
 * Returns `null` if the key does not exist.
 */
export async function getToken(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

/**
 * Delete a value from encrypted secure storage.
 */
export async function deleteToken(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
