import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { ResolvedPermissions, TokenPair, User } from './auth-store';
import { useAuthStore } from './auth-store';

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// --- Fixtures ---

const mockUser: User = {
  id: 'user-1',
  email: 'test@nexa.io',
  firstName: 'Test',
  lastName: 'User',
};

const mockTokens: TokenPair = {
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
    sales: {
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: false,
      canDelete: false,
    },
  },
  fieldOverrides: {},
  enabledModules: ['finance', 'sales'],
};

// --- Tests ---

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      activeCompanyId: null,
      permissions: null,
      isAuthenticated: false,
      isLoading: false,
      rememberMe: false,
    });
    sessionStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('sets user, tokens, permissions, and isAuthenticated', () => {
      useAuthStore.getState().login(mockUser, mockTokens, mockPermissions);
      const state = useAuthStore.getState();

      expect(state.user).toEqual(mockUser);
      expect(state.accessToken).toBe('access-token-123');
      expect(state.refreshToken).toBe('refresh-token-456');
      expect(state.permissions).toEqual(mockPermissions);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('sets activeCompanyId from permissions.companyId', () => {
      useAuthStore.getState().login(mockUser, mockTokens, mockPermissions);
      const state = useAuthStore.getState();

      expect(state.activeCompanyId).toBe('company-1');
    });

    it('persists refreshToken to sessionStorage when rememberMe is true', () => {
      useAuthStore.getState().login(mockUser, mockTokens, mockPermissions, true);

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'nexa_rt',
        'refresh-token-456',
      );
    });

    it('does not persist refreshToken when rememberMe is false', () => {
      useAuthStore.getState().login(mockUser, mockTokens, mockPermissions, false);

      expect(sessionStorageMock.setItem).not.toHaveBeenCalled();
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('nexa_rt');
    });
  });

  describe('logout', () => {
    it('clears all state', () => {
      // Login first
      useAuthStore.getState().login(mockUser, mockTokens, mockPermissions);

      // Then logout
      useAuthStore.getState().logout();
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.activeCompanyId).toBeNull();
      expect(state.permissions).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('removes refreshToken from sessionStorage', () => {
      useAuthStore.getState().login(mockUser, mockTokens, mockPermissions);
      useAuthStore.getState().logout();

      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('nexa_rt');
    });
  });

  describe('setActiveCompany', () => {
    it('updates activeCompanyId', () => {
      useAuthStore.getState().login(mockUser, mockTokens, mockPermissions);
      useAuthStore.getState().setActiveCompany('company-2');

      expect(useAuthStore.getState().activeCompanyId).toBe('company-2');
    });

    it('does not clear other state', () => {
      useAuthStore.getState().login(mockUser, mockTokens, mockPermissions);
      useAuthStore.getState().setActiveCompany('company-2');
      const state = useAuthStore.getState();

      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe('access-token-123');
    });
  });

  describe('updateTokens', () => {
    it('replaces tokens without clearing user', () => {
      useAuthStore.getState().login(mockUser, mockTokens, mockPermissions);

      const newTokens: TokenPair = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };
      useAuthStore.getState().updateTokens(newTokens);
      const state = useAuthStore.getState();

      expect(state.accessToken).toBe('new-access-token');
      expect(state.refreshToken).toBe('new-refresh-token');
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.permissions).toEqual(mockPermissions);
    });

    it('persists new refreshToken to sessionStorage when rememberMe is true', () => {
      useAuthStore.getState().login(mockUser, mockTokens, mockPermissions, true);
      vi.clearAllMocks();

      const newTokens: TokenPair = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };
      useAuthStore.getState().updateTokens(newTokens);

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'nexa_rt',
        'new-refresh-token',
      );
    });

    it('does not persist refreshToken when rememberMe is false', () => {
      useAuthStore.getState().login(mockUser, mockTokens, mockPermissions, false);
      vi.clearAllMocks();

      const newTokens: TokenPair = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };
      useAuthStore.getState().updateTokens(newTokens);

      expect(sessionStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('setPermissions', () => {
    it('updates permissions', () => {
      useAuthStore.getState().login(mockUser, mockTokens, mockPermissions);

      const newPermissions: ResolvedPermissions = {
        ...mockPermissions,
        role: 'SUPER_ADMIN',
        isSuperAdmin: true,
      };
      useAuthStore.getState().setPermissions(newPermissions);

      expect(useAuthStore.getState().permissions).toEqual(newPermissions);
    });
  });
});
