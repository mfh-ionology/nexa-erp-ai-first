/**
 * Auth endpoint methods (API Contracts §2.1 / §3.1).
 */

import type { ApiClient } from '../client';
import type { TokenPair } from '../types';

// --- Response types ---

export interface LoginUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER';
  enabledModules: string[];
  tenantId: string;
  tenantName: string;
  mfaEnabled: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: LoginUser;
  requiresMfa?: boolean;
}

// --- Endpoint interface ---

export interface AuthEndpoints {
  login(
    email: string,
    password: string,
    mfaToken?: string,
  ): Promise<LoginResponse>;
  refreshToken(token: string): Promise<TokenPair>;
  logout(): Promise<void>;
  verifyMfa(
    email: string,
    password: string,
    mfaToken: string,
  ): Promise<LoginResponse>;
}

// --- Factory ---

export function createAuthEndpoints(client: ApiClient): AuthEndpoints {
  return {
    async login(email, password, mfaToken?) {
      const { data } = await client.post<LoginResponse>(
        '/auth/login',
        { email, password, ...(mfaToken ? { mfaToken } : {}) },
        { skipAuth: true },
      );
      return data;
    },

    async refreshToken(token) {
      const { data } = await client.post<TokenPair>(
        '/auth/refresh',
        { refreshToken: token },
        { skipAuth: true },
      );
      return data;
    },

    async logout() {
      // Best-effort — don't let a 401/refresh loop block logout
      try {
        await client.post<void>('/auth/logout', undefined, {
          skipRefreshRetry: true,
        });
      } catch {
        // Server-side session cleanup is best-effort; local cleanup proceeds regardless
      }
    },

    async verifyMfa(email, password, mfaToken) {
      const { data } = await client.post<LoginResponse>(
        '/auth/mfa/verify',
        { email, password, mfaToken },
        { skipAuth: true },
      );
      return data;
    },
  };
}
