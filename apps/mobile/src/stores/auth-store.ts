/**
 * Mobile authentication store (Zustand).
 *
 * Manages JWT tokens, user state, permissions, and biometric unlock.
 *
 * - Access token: kept in memory (Zustand state)
 * - Refresh token: persisted in expo-secure-store (OS keychain)
 * - Biometric flag: persisted in expo-secure-store
 * - Session restoration: reads refresh token from SecureStore → calls POST /auth/refresh
 * - Biometric flow: local Face ID / fingerprint gate → then token-based restore
 */

import * as LocalAuthentication from 'expo-local-authentication';
import { create } from 'zustand';

import type { TokenPair, LoginUser, ApiResolvedPermissions } from '@nexa/api-client';

import { STORAGE_KEYS, setToken, getToken, deleteToken } from '@/lib/secure-storage';

// --- Types ---

/** Subset of user fields stored in the mobile auth state. */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface ModulePermission {
  canAccess: boolean;
  canNew: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

/**
 * Resolved permissions stored in the mobile auth store.
 * Maps API wire format (`permissions`) to local naming (`modules`)
 * for consistency with the web auth store.
 */
export interface ResolvedPermissions {
  userId: string;
  companyId: string;
  role: string;
  isSuperAdmin: boolean;
  accessGroups: Array<{ id: string; code: string; name: string }>;
  modules: Record<string, ModulePermission>;
  fieldOverrides: Record<
    string,
    Record<string, 'VISIBLE' | 'READ_ONLY' | 'HIDDEN'>
  >;
  enabledModules: string[];
}

/** Short-lived MFA credentials held in memory between login → MFA screen. */
export interface PendingMfaCredentials {
  email: string;
  password: string;
}

export interface MobileAuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  activeCompanyId: string | null;
  activeCompanyName: string | null;
  permissions: ResolvedPermissions | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  /** Biometric login was already attempted during cold start (prevents double prompt). */
  biometricAttemptedOnLaunch: boolean;
  /** Short-lived MFA credentials — cleared after use. Never persisted to storage. */
  pendingMfaCredentials: PendingMfaCredentials | null;

  // Actions
  login: (
    user: User,
    tokens: TokenPair,
    permissions: ResolvedPermissions,
    companyName?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  setActiveCompany: (companyId: string) => void;
  setPermissions: (permissions: ResolvedPermissions) => void;
  updateTokens: (tokens: TokenPair) => Promise<void>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  attemptBiometricLogin: (promptMessage?: string) => Promise<boolean>;
  restoreSession: () => Promise<boolean>;
  checkBiometricAvailability: () => Promise<void>;
  setPendingMfaCredentials: (creds: PendingMfaCredentials | null) => void;
  setBiometricAttemptedOnLaunch: (value: boolean) => void;
}

/** Map a LoginUser from the API to the local User shape. */
export function mapLoginUser(apiUser: LoginUser): User {
  return {
    id: apiUser.id,
    email: apiUser.email,
    firstName: apiUser.firstName,
    lastName: apiUser.lastName,
  };
}

/** Map the API permission wire format to the local ResolvedPermissions shape. */
export function mapApiPermissions(
  api: ApiResolvedPermissions,
): ResolvedPermissions {
  return {
    userId: api.userId,
    companyId: api.companyId,
    role: api.role,
    isSuperAdmin: api.isSuperAdmin,
    accessGroups: api.accessGroups,
    modules: api.permissions,
    fieldOverrides: api.fieldOverrides,
    enabledModules: api.enabledModules,
  };
}

// --- Store ---

export const useAuthStore = create<MobileAuthState>()((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  activeCompanyId: null,
  activeCompanyName: null,
  permissions: null,
  isAuthenticated: false,
  isLoading: false,
  biometricEnabled: false,
  biometricAvailable: false,
  biometricAttemptedOnLaunch: false,
  pendingMfaCredentials: null,

  login: async (user, tokens, permissions, companyName?) => {
    // Persist refresh token and user profile in encrypted OS keychain
    await setToken(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
    await setToken(STORAGE_KEYS.USER_ID, user.id);
    await setToken(STORAGE_KEYS.USER_EMAIL, user.email);
    await setToken(STORAGE_KEYS.USER_FIRST_NAME, user.firstName);
    await setToken(STORAGE_KEYS.USER_LAST_NAME, user.lastName);
    if (companyName) {
      await setToken(STORAGE_KEYS.COMPANY_NAME, companyName);
    }

    set({
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      activeCompanyId: permissions.companyId,
      activeCompanyName: companyName ?? null,
      permissions,
      isAuthenticated: true,
      isLoading: false,
      pendingMfaCredentials: null,
    });
  },

  logout: async () => {
    // Unregister push token from server (best-effort)
    try {
      const pushToken = await getToken(STORAGE_KEYS.PUSH_TOKEN);
      if (pushToken) {
        const { apiClient } = await import('@/lib/api-client');
        const { unregisterPushToken } = await import(
          '@/lib/push-registration'
        );
        await unregisterPushToken(apiClient, pushToken);
      }
    } catch {
      // Push unregistration is best-effort — do not block logout
    }

    // Clear all persisted tokens from SecureStore
    await deleteToken(STORAGE_KEYS.REFRESH_TOKEN);
    await deleteToken(STORAGE_KEYS.USER_ID);
    await deleteToken(STORAGE_KEYS.USER_EMAIL);
    await deleteToken(STORAGE_KEYS.USER_FIRST_NAME);
    await deleteToken(STORAGE_KEYS.USER_LAST_NAME);
    await deleteToken(STORAGE_KEYS.BIOMETRIC_ENABLED);
    await deleteToken(STORAGE_KEYS.PUSH_TOKEN);
    await deleteToken(STORAGE_KEYS.COMPANY_NAME);

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      activeCompanyId: null,
      activeCompanyName: null,
      permissions: null,
      isAuthenticated: false,
      isLoading: false,
      biometricEnabled: false,
      pendingMfaCredentials: null,
    });
  },

  setActiveCompany: (companyId) => set({ activeCompanyId: companyId }),

  setPermissions: (permissions) => set({ permissions }),

  updateTokens: async (tokens) => {
    // Update in-memory state synchronously first so that any immediate
    // retry (e.g. after 401 token refresh) reads the new access token.
    // SecureStore persistence follows asynchronously.
    set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    await setToken(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
  },

  enableBiometric: async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (!compatible || !enrolled) {
      return;
    }

    await setToken(STORAGE_KEYS.BIOMETRIC_ENABLED, 'true');
    set({ biometricEnabled: true });
  },

  disableBiometric: async () => {
    await deleteToken(STORAGE_KEYS.BIOMETRIC_ENABLED);
    set({ biometricEnabled: false });
  },

  attemptBiometricLogin: async (promptMessage) => {
    const { biometricEnabled } = get();
    if (!biometricEnabled) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage ?? 'Authenticate to sign in',
      disableDeviceFallback: false,
    });

    if (!result.success) return false;

    // Biometric succeeded — use stored refresh token to restore session
    return get().restoreSession();
  },

  restoreSession: async () => {
    set({ isLoading: true });

    const storedRefreshToken = await getToken(STORAGE_KEYS.REFRESH_TOKEN);
    if (!storedRefreshToken) {
      set({ isLoading: false });
      return false;
    }

    try {
      // Lazy import to avoid circular dependency (api-client imports auth-store)
      const { apiClient } = await import('@/lib/api-client');

      const tokenResult = await apiClient.auth.refreshToken(storedRefreshToken);
      await setToken(STORAGE_KEYS.REFRESH_TOKEN, tokenResult.refreshToken);

      // Temporarily set tokens so the permissions fetch is authenticated
      set({
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
      });

      const permissionsResult = await apiClient.system.fetchMyPermissions();
      const permissions = mapApiPermissions(permissionsResult);

      // Restore user and company name from SecureStore (persisted at login time)
      const storedUserId = await getToken(STORAGE_KEYS.USER_ID);
      const storedEmail = await getToken(STORAGE_KEYS.USER_EMAIL);
      const storedFirstName = await getToken(STORAGE_KEYS.USER_FIRST_NAME);
      const storedLastName = await getToken(STORAGE_KEYS.USER_LAST_NAME);
      const storedCompanyName = await getToken(STORAGE_KEYS.COMPANY_NAME);
      const user: User = {
        id: storedUserId ?? permissions.userId,
        email: storedEmail ?? '',
        firstName: storedFirstName ?? '',
        lastName: storedLastName ?? '',
      };

      set({
        user,
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
        activeCompanyId: permissions.companyId,
        activeCompanyName: storedCompanyName,
        permissions,
        isAuthenticated: true,
        isLoading: false,
      });

      return true;
    } catch {
      // Refresh failed — clear stored tokens
      await deleteToken(STORAGE_KEYS.REFRESH_TOKEN);
      set({
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
      return false;
    }
  },

  checkBiometricAvailability: async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const biometricFlag = await getToken(STORAGE_KEYS.BIOMETRIC_ENABLED);

    set({
      biometricAvailable: compatible && enrolled,
      biometricEnabled: biometricFlag === 'true',
    });
  },

  setPendingMfaCredentials: (creds) => set({ pendingMfaCredentials: creds }),

  setBiometricAttemptedOnLaunch: (value) =>
    set({ biometricAttemptedOnLaunch: value }),
}));
