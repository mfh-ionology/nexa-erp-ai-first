/**
 * Shared types for the Nexa ERP API client.
 * Platform-agnostic — no browser or React Native specific types.
 */

/** JWT token pair returned by auth endpoints */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Configuration for the API client — platform-specific values injected by the host app */
export interface ApiClientConfig {
  /** Base URL for the API (e.g. 'https://tenant.nexa-erp.com' or '' for same-origin) */
  baseUrl: string;
  /** Returns the current access token from the platform's storage */
  getAccessToken: () => string | null;
  /** Returns the current refresh token from the platform's storage */
  getRefreshToken: () => string | null;
  /** Returns the active company ID for the X-Company-Id header */
  getCompanyId: () => string | null;
  /** Returns the current locale for the Accept-Language header */
  getLocale: () => string;
  /** Called when tokens are refreshed — platform stores the new tokens */
  onTokenRefresh: (tokens: TokenPair) => void;
  /** Called when auth fails completely (refresh fails) — platform handles logout */
  onAuthFailure: () => void;
}

/** Options for individual API requests */
export interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip attaching auth headers (for public endpoints like login) */
  skipAuth?: boolean;
  /** Skip automatic 401 refresh retry (used internally to prevent loops) */
  skipRefreshRetry?: boolean;
  /** AbortSignal for cancelling in-flight requests (e.g. on component unmount) */
  signal?: AbortSignal;
}

/** Pagination metadata from API response envelope */
export interface ApiMeta {
  cursor?: string;
  hasMore?: boolean;
  total?: number;
}

/** Parsed successful API response */
export interface ApiResult<T> {
  data: T;
  meta?: ApiMeta;
}

// --- API response envelope types (internal) ---

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
