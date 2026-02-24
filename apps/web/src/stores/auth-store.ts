import { create } from 'zustand';

// --- Types ---

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface ModulePermission {
  canAccess: boolean;
  canNew: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

/**
 * Resolved permissions returned by GET /system/my-permissions.
 * Stored in Zustand after login and on company switch.
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

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  activeCompanyId: string | null;
  permissions: ResolvedPermissions | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshingPermissions: boolean;
  rememberMe: boolean;

  // Actions
  login: (
    user: User,
    tokens: TokenPair,
    permissions: ResolvedPermissions,
    rememberMe?: boolean,
  ) => void;
  logout: () => void;
  setActiveCompany: (companyId: string) => void;
  setPermissions: (permissions: ResolvedPermissions) => void;
  setRefreshingPermissions: (refreshing: boolean) => void;
  updateTokens: (tokens: TokenPair) => void;
}

// --- sessionStorage helpers ---

const REFRESH_TOKEN_KEY = 'nexa_rt';

function persistRefreshToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // sessionStorage unavailable (SSR, private browsing quota, etc.)
  }
}

function hydrateRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

// --- Store ---

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,
  refreshToken: hydrateRefreshToken(),
  activeCompanyId: null,
  permissions: null,
  isAuthenticated: false,
  isLoading: false,
  isRefreshingPermissions: false,
  rememberMe: false,

  login: (user, tokens, permissions, rememberMe = false) => {
    if (rememberMe) {
      persistRefreshToken(tokens.refreshToken);
    } else {
      // Clear any previously persisted token when "Remember me" is unchecked
      persistRefreshToken(null);
    }
    set({
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      activeCompanyId: permissions.companyId,
      permissions,
      isAuthenticated: true,
      isLoading: false,
      rememberMe,
    });
  },

  logout: () => {
    persistRefreshToken(null);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      activeCompanyId: null,
      permissions: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  setActiveCompany: (companyId) => set({ activeCompanyId: companyId }),

  setPermissions: (permissions) => set({ permissions }),

  setRefreshingPermissions: (refreshing) => set({ isRefreshingPermissions: refreshing }),

  updateTokens: (tokens) => {
    const { rememberMe } = useAuthStore.getState();
    if (rememberMe) {
      persistRefreshToken(tokens.refreshToken);
    }
    set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  },
}));
