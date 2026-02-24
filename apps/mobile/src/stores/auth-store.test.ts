/**
 * Tests for the mobile authentication store.
 *
 * Covers: login, logout, restoreSession, enableBiometric, attemptBiometricLogin.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import {
  setMockSecureStoreValue,
  clearMockSecureStore,
  setBiometricHardwareAvailable,
  setBiometricEnrolled,
  setBiometricAuthSuccess,
  resetMockState,
} from '../test-setup';

import type { ResolvedPermissions, User } from './auth-store';
import { useAuthStore } from './auth-store';

// --- Test fixtures ---

const mockUser: User = {
  id: 'user-1',
  email: 'test@nexa.com',
  firstName: 'Test',
  lastName: 'User',
};

const mockTokens = {
  accessToken: 'access-token-123',
  refreshToken: 'refresh-token-456',
};

const mockPermissions: ResolvedPermissions = {
  userId: 'user-1',
  companyId: 'company-1',
  role: 'ADMIN',
  isSuperAdmin: false,
  accessGroups: [{ id: 'ag-1', code: 'DEFAULT', name: 'Default' }],
  modules: {
    finance: {
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: true,
      canDelete: false,
    },
  },
  fieldOverrides: {},
  enabledModules: ['finance', 'sales'],
};

// Mock API client module for restoreSession tests
const mockRefreshToken = jest.fn();
const mockFetchMyPermissions = jest.fn();

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    auth: {
      refreshToken: (...args: unknown[]) => mockRefreshToken(...args),
    },
    system: {
      fetchMyPermissions: (...args: unknown[]) =>
        mockFetchMyPermissions(...args),
    },
  },
}));

// Mock push-registration for logout tests
jest.mock('@/lib/push-registration', () => ({
  unregisterPushToken: jest.fn(async () => {}),
}));

// --- Helpers ---

function resetStore(): void {
  useAuthStore.setState({
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
  });
}

// --- Tests ---

describe('useAuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    resetMockState();
  });

  describe('login', () => {
    it('sets user, tokens, permissions, and isAuthenticated', async () => {
      await useAuthStore.getState().login(mockUser, mockTokens, mockPermissions);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.accessToken).toBe('access-token-123');
      expect(state.refreshToken).toBe('refresh-token-456');
      expect(state.permissions).toEqual(mockPermissions);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.activeCompanyId).toBe('company-1');
    });

    it('persists refresh token in SecureStore', async () => {
      await useAuthStore.getState().login(mockUser, mockTokens, mockPermissions);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'nexa_refresh_token',
        'refresh-token-456',
      );
    });

    it('persists user ID in SecureStore', async () => {
      await useAuthStore.getState().login(mockUser, mockTokens, mockPermissions);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'nexa_user_id',
        'user-1',
      );
    });

    it('persists user profile fields in SecureStore', async () => {
      await useAuthStore.getState().login(mockUser, mockTokens, mockPermissions);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'nexa_user_email',
        'test@nexa.com',
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'nexa_user_first_name',
        'Test',
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'nexa_user_last_name',
        'User',
      );
    });

    it('clears pending MFA credentials on login', async () => {
      useAuthStore.setState({
        pendingMfaCredentials: { email: 'x@y.com', password: 'p' },
      });
      await useAuthStore.getState().login(mockUser, mockTokens, mockPermissions);
      expect(useAuthStore.getState().pendingMfaCredentials).toBeNull();
    });
  });

  describe('logout', () => {
    it('clears all state', async () => {
      // First login
      await useAuthStore.getState().login(mockUser, mockTokens, mockPermissions);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Then logout
      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.activeCompanyId).toBeNull();
      expect(state.permissions).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.biometricEnabled).toBe(false);
    });

    it('clears all tokens from SecureStore', async () => {
      await useAuthStore.getState().login(mockUser, mockTokens, mockPermissions);
      await useAuthStore.getState().logout();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'nexa_refresh_token',
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('nexa_user_id');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'nexa_user_email',
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'nexa_user_first_name',
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'nexa_user_last_name',
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'nexa_biometric_enabled',
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'nexa_push_token',
      );
    });
  });

  describe('restoreSession', () => {
    it('succeeds when refresh token exists in SecureStore', async () => {
      // Pre-populate SecureStore via the global mock state
      setMockSecureStoreValue('nexa_refresh_token', 'stored-refresh-token');
      setMockSecureStoreValue('nexa_user_id', 'user-1');
      setMockSecureStoreValue('nexa_user_email', 'test@nexa.com');
      setMockSecureStoreValue('nexa_user_first_name', 'Test');
      setMockSecureStoreValue('nexa_user_last_name', 'User');

      mockRefreshToken.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      mockFetchMyPermissions.mockResolvedValue({
        userId: 'user-1',
        companyId: 'company-1',
        role: 'ADMIN',
        isSuperAdmin: false,
        accessGroups: [],
        permissions: { finance: { canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false } },
        fieldOverrides: {},
        enabledModules: ['finance'],
      });

      const result = await useAuthStore.getState().restoreSession();

      expect(result).toBe(true);
      expect(mockRefreshToken).toHaveBeenCalledWith('stored-refresh-token');
      expect(mockFetchMyPermissions).toHaveBeenCalled();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe('new-access-token');
      expect(state.refreshToken).toBe('new-refresh-token');
      expect(state.user?.id).toBe('user-1');
      expect(state.user?.email).toBe('test@nexa.com');
      expect(state.user?.firstName).toBe('Test');
      expect(state.user?.lastName).toBe('User');
      expect(state.activeCompanyId).toBe('company-1');
    });

    it('fails and returns false when no refresh token in SecureStore', async () => {
      const result = await useAuthStore.getState().restoreSession();

      expect(result).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('fails and clears tokens when refresh API call fails', async () => {
      setMockSecureStoreValue('nexa_refresh_token', 'expired-token');

      mockRefreshToken.mockRejectedValue(new Error('Token expired'));

      const result = await useAuthStore.getState().restoreSession();

      expect(result).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().accessToken).toBeNull();
      // Expired token should be removed from SecureStore
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'nexa_refresh_token',
      );
    });
  });

  describe('enableBiometric', () => {
    it('stores biometric flag in SecureStore when hardware is available', async () => {
      setBiometricHardwareAvailable(true);
      setBiometricEnrolled(true);

      await useAuthStore.getState().enableBiometric();

      expect(LocalAuthentication.hasHardwareAsync).toHaveBeenCalled();
      expect(LocalAuthentication.isEnrolledAsync).toHaveBeenCalled();
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'nexa_biometric_enabled',
        'true',
      );
      expect(useAuthStore.getState().biometricEnabled).toBe(true);
    });

    it('does not enable when hardware is not available', async () => {
      setBiometricHardwareAvailable(false);

      await useAuthStore.getState().enableBiometric();

      expect(useAuthStore.getState().biometricEnabled).toBe(false);
      expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
        'nexa_biometric_enabled',
        expect.anything(),
      );
    });

    it('does not enable when biometric is not enrolled', async () => {
      setBiometricHardwareAvailable(true);
      setBiometricEnrolled(false);

      await useAuthStore.getState().enableBiometric();

      expect(useAuthStore.getState().biometricEnabled).toBe(false);
    });
  });

  describe('attemptBiometricLogin', () => {
    it('calls expo-local-authentication and restores session on success', async () => {
      // Enable biometric first
      useAuthStore.setState({ biometricEnabled: true });
      setBiometricAuthSuccess(true);

      // Set up SecureStore with token and profile for restoreSession
      setMockSecureStoreValue('nexa_refresh_token', 'bio-refresh-token');
      setMockSecureStoreValue('nexa_user_id', 'user-1');
      setMockSecureStoreValue('nexa_user_email', 'test@nexa.com');
      setMockSecureStoreValue('nexa_user_first_name', 'Test');
      setMockSecureStoreValue('nexa_user_last_name', 'User');

      mockRefreshToken.mockResolvedValue({
        accessToken: 'bio-access-token',
        refreshToken: 'bio-new-refresh-token',
      });
      mockFetchMyPermissions.mockResolvedValue({
        userId: 'user-1',
        companyId: 'company-1',
        role: 'STAFF',
        isSuperAdmin: false,
        accessGroups: [],
        permissions: {},
        fieldOverrides: {},
        enabledModules: [],
      });

      const result = await useAuthStore
        .getState()
        .attemptBiometricLogin('Test biometric prompt');

      expect(result).toBe(true);
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Test biometric prompt',
        disableDeviceFallback: false,
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('returns false when biometric is not enabled', async () => {
      useAuthStore.setState({ biometricEnabled: false });

      const result = await useAuthStore.getState().attemptBiometricLogin();

      expect(result).toBe(false);
      expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
    });

    it('returns false when biometric authentication fails', async () => {
      useAuthStore.setState({ biometricEnabled: true });
      setBiometricAuthSuccess(false);

      const result = await useAuthStore.getState().attemptBiometricLogin();

      expect(result).toBe(false);
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('setActiveCompany', () => {
    it('updates activeCompanyId', () => {
      useAuthStore.getState().setActiveCompany('company-2');
      expect(useAuthStore.getState().activeCompanyId).toBe('company-2');
    });
  });

  describe('setPermissions', () => {
    it('updates permissions', () => {
      useAuthStore.getState().setPermissions(mockPermissions);
      expect(useAuthStore.getState().permissions).toEqual(mockPermissions);
    });
  });

  describe('disableBiometric', () => {
    it('clears biometric flag from SecureStore and state', async () => {
      useAuthStore.setState({ biometricEnabled: true });
      await useAuthStore.getState().disableBiometric();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'nexa_biometric_enabled',
      );
      expect(useAuthStore.getState().biometricEnabled).toBe(false);
    });
  });
});
