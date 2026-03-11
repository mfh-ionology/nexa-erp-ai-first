import { create } from 'zustand';

// --- Types ---

export type PlatformRole = 'PLATFORM_ADMIN' | 'PLATFORM_VIEWER' | 'PLATFORM_SUPPORT';

export interface PlatformUser {
  id: string;
  email: string;
  displayName: string;
  role: PlatformRole;
}

export interface PlatformAuthState {
  user: PlatformUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (user: PlatformUser, accessToken: string) => void;
  logout: () => void;
  setAccessToken: (token: string) => void;
  setLoading: (loading: boolean) => void;
}

// --- Store ---

export const usePlatformAuthStore = create<PlatformAuthState>()((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,

  login: (user, accessToken) => {
    set({
      user,
      accessToken,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: () => {
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  setAccessToken: (token) =>
    set((state) => ({
      accessToken: token,
      isAuthenticated: state.user !== null,
    })),

  setLoading: (loading) => set({ isLoading: loading }),
}));
