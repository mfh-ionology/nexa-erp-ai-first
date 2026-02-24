/**
 * Web-specific API client instance.
 *
 * Wraps the shared @nexa/api-client with web platform configuration:
 * - Tokens from Zustand auth store (memory + sessionStorage)
 * - Locale from i18n instance
 * - Auth failure triggers store logout
 */

import { ApiClient } from '@nexa/api-client';
import type { ApiResult, RequestOptions } from '@nexa/api-client';
import { i18n } from '@nexa/i18n';

import { useAuthStore } from '@/stores/auth-store';

// Re-export types from the shared package for backward compatibility
export type { ApiResult, ApiMeta } from '@nexa/api-client';

/** Shared web API client instance */
export const apiClient = new ApiClient({
  baseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '',
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  getCompanyId: () => useAuthStore.getState().activeCompanyId,
  getLocale: () => i18n.language,
  onTokenRefresh: (tokens) => useAuthStore.getState().updateTokens(tokens),
  onAuthFailure: () => useAuthStore.getState().logout(),
});

// --- Backward-compatible function exports ---

interface LegacyRequestOptions extends RequestOptions {
  method?: string;
}

/**
 * Send a typed request to the Nexa API.
 *
 * @param path - API path relative to `/api/v1` (e.g. `/auth/login`)
 * @param options - Request configuration
 * @returns Parsed response data and optional pagination meta
 */
export async function apiRequest<T>(
  path: string,
  options: LegacyRequestOptions = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', ...rest } = options;
  return apiClient.request<T>(method, path, rest);
}

export function apiGet<T>(
  path: string,
  options?: Omit<RequestOptions, 'body'>,
): Promise<ApiResult<T>> {
  return apiClient.get<T>(path, options);
}

export function apiPost<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'body'>,
): Promise<ApiResult<T>> {
  return apiClient.post<T>(path, body, options);
}

export function apiPatch<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'body'>,
): Promise<ApiResult<T>> {
  return apiClient.patch<T>(path, body, options);
}

export function apiPut<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'body'>,
): Promise<ApiResult<T>> {
  return apiClient.put<T>(path, body, options);
}

export function apiDelete<T = void>(
  path: string,
  options?: Omit<RequestOptions, 'body'>,
): Promise<ApiResult<T>> {
  return apiClient.delete<T>(path, options);
}

// --- Utilities ---

/** Build a query string from params, omitting empty/undefined/null values. */
export function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  const qs = new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  ).toString();
  return `?${qs}`;
}
