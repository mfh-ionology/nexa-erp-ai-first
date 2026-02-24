/**
 * Mobile-specific API client instance.
 *
 * Wraps the shared @nexa/api-client with React Native platform configuration:
 * - Tokens from Zustand auth store (in-memory, synced with expo-secure-store)
 * - Company ID from mobile auth store
 * - Locale from i18n
 * - Auth failure triggers logout (navigates to login screen)
 *
 * Note: The auth store is created in Task 3 (E6-6). This file will compile
 * once the auth store module exists.
 */

import { ApiClient } from '@nexa/api-client';
import { i18n } from '@nexa/i18n';

import { useAuthStore } from '@/stores/auth-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

/**
 * Mobile API client — reads tokens from Zustand (memory) for access token
 * and refresh token (synced with SecureStore by the auth store).
 *
 * Auth failure triggers the auth store's logout action, which clears
 * SecureStore tokens and resets to the login screen.
 */
export const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  getCompanyId: () => useAuthStore.getState().activeCompanyId,
  getLocale: () => i18n.language,
  onTokenRefresh: (tokens) => {
    useAuthStore.getState().updateTokens(tokens);
  },
  onAuthFailure: () => {
    // logout() is async but onAuthFailure is sync — catch errors to prevent unhandled rejections
    void useAuthStore.getState().logout().catch(() => {});
  },
});
