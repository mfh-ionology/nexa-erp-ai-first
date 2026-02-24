/**
 * Auth API functions matching API Contracts §2.1 and §3 (detailed endpoint specs).
 *
 * All functions use the shared apiRequest wrapper which handles
 * headers, envelope parsing, and error mapping automatically.
 */

import { apiPost, apiGet } from './api-client';

import type {
  TokenPair,
  ModulePermission,
  ResolvedPermissions,
} from '@/stores/auth-store';

// Re-export for consumers that import from auth-api
export type { TokenPair, ResolvedPermissions };

// --- Response types (from API Contracts §3 — detailed endpoint specs) ---

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

/**
 * Wire format returned by GET /system/my-permissions.
 * The API uses `permissions` for the module map; the store normalises this to `modules`.
 */
interface ApiResolvedPermissions {
  userId: string;
  companyId: string;
  role: string;
  isSuperAdmin: boolean;
  accessGroups: Array<{ id: string; code: string; name: string }>;
  permissions: Record<string, ModulePermission>;
  fieldOverrides: Record<string, Record<string, 'VISIBLE' | 'READ_ONLY' | 'HIDDEN'>>;
  enabledModules: string[];
}

/**
 * Convert the API wire format to the store's canonical ResolvedPermissions shape.
 * Maps `permissions` → `modules` so the rest of the app uses one consistent type.
 */
function toResolvedPermissions(api: ApiResolvedPermissions): ResolvedPermissions {
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

// --- Auth API functions ---

/**
 * Authenticate a user with email and password.
 * If MFA is enabled, the response will have `requiresMfa: true` and no tokens.
 * Pass `mfaToken` in a second call to complete MFA login.
 */
export async function login(
  email: string,
  password: string,
  mfaToken?: string,
): Promise<LoginResponse> {
  const { data } = await apiPost<LoginResponse>('/auth/login', {
    email,
    password,
    ...(mfaToken ? { mfaToken } : {}),
  }, { skipAuth: true });
  return data;
}

/**
 * Verify MFA TOTP code after initial login indicated MFA is required.
 */
export async function verifyMfa(
  email: string,
  password: string,
  mfaToken: string,
): Promise<LoginResponse> {
  const { data } = await apiPost<LoginResponse>('/auth/mfa/verify', {
    email,
    password,
    mfaToken,
  }, { skipAuth: true });
  return data;
}

/**
 * Refresh the access token using a refresh token.
 */
export async function refreshToken(token: string): Promise<TokenPair> {
  const { data } = await apiPost<TokenPair>('/auth/refresh', {
    refreshToken: token,
  }, { skipAuth: true });
  return data;
}

/**
 * Invalidate the current session.
 */
export async function logout(): Promise<void> {
  await apiPost<void>('/auth/logout');
}

/**
 * Fetch the current user's resolved permissions for the active company.
 * Called on login, company switch, and PERMISSIONS_CHANGED WebSocket events.
 *
 * Converts the API wire format (uses `permissions` field) to the store's
 * canonical shape (uses `modules` field) for consistency across the app.
 */
export async function fetchMyPermissions(): Promise<ResolvedPermissions> {
  const { data } = await apiGet<ApiResolvedPermissions>('/system/my-permissions');
  return toResolvedPermissions(data);
}
