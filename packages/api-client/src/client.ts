/**
 * Platform-agnostic typed API client for the Nexa ERP API.
 *
 * Uses the `fetch` API (available in both web and React Native).
 * Platform-specific behavior (token storage, auth failure handling)
 * is injected via the config object.
 */

import {
  ApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessRuleError,
} from './errors';
import type { ApiClientConfig, ApiResponse, ApiResult, RequestOptions, TokenPair } from './types';
import {
  createAuthEndpoints,
  type AuthEndpoints,
  createSystemEndpoints,
  type SystemEndpoints,
  createAiEndpoints,
  type AiEndpoints,
  createNotificationEndpoints,
  type NotificationEndpoints,
} from './endpoints';

export class ApiClient {
  private readonly config: ApiClientConfig;
  private refreshPromise: Promise<boolean> | null = null;

  readonly auth: AuthEndpoints;
  readonly system: SystemEndpoints;
  readonly ai: AiEndpoints;
  readonly notifications: NotificationEndpoints;

  constructor(config: ApiClientConfig) {
    this.config = config;
    this.auth = createAuthEndpoints(this);
    this.system = createSystemEndpoints(this);
    this.ai = createAiEndpoints(this);
    this.notifications = createNotificationEndpoints(this);
  }

  /**
   * Send a typed request to the Nexa API.
   *
   * @param method - HTTP method
   * @param path - API path relative to `/api/v1` (e.g. `/auth/login`)
   * @param options - Request configuration
   * @returns Parsed response data and optional pagination meta
   */
  async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<ApiResult<T>> {
    const {
      body,
      headers: extraHeaders = {},
      skipAuth = false,
      skipRefreshRetry = false,
      signal,
    } = options;

    const url = `${this.config.baseUrl}/api/v1${path}`;

    const headers: Record<string, string> = {
      'Accept-Language': this.config.getLocale(),
      ...extraHeaders,
    };

    if (body != null) {
      headers['Content-Type'] = 'application/json';
    }

    if (!skipAuth) {
      const accessToken = this.config.getAccessToken();
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      const companyId = this.config.getCompanyId();
      if (companyId) {
        headers['X-Company-Id'] = companyId;
      }
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal,
    });

    // Handle 401 with automatic token refresh
    if (res.status === 401 && !skipAuth && !skipRefreshRetry) {
      // Consume the response body to release the underlying connection
      await res.body?.cancel().catch(() => {});
      const refreshed = await this.attemptTokenRefresh();
      if (refreshed) {
        return this.request<T>(method, path, {
          ...options,
          skipRefreshRetry: true,
        });
      }
      throw new UnauthorizedError();
    }

    // Handle 204 No Content — return empty result without attempting JSON parse
    if (res.status === 204) {
      return { data: undefined as T, meta: undefined };
    }

    let json: ApiResponse<T>;
    try {
      json = (await res.json()) as ApiResponse<T>;
    } catch {
      throw new ApiError(
        'PARSE_ERROR',
        `Server returned non-JSON response (HTTP ${String(res.status)})`,
        res.status,
      );
    }

    if (!json.success) {
      const err = json.error ?? {
        code: 'UNKNOWN_ERROR',
        message: `HTTP ${String(res.status)}`,
      };
      const { code, message, details } = err;
      switch (res.status) {
        case 400:
          throw new ValidationError(message, details, code);
        case 401:
          throw new UnauthorizedError(message, code);
        case 403:
          throw new ForbiddenError(message, code);
        case 404:
          throw new NotFoundError(message, code);
        case 422:
          throw new BusinessRuleError(message, details, code);
        default:
          throw new ApiError(code, message, res.status);
      }
    }

    return { data: json.data, meta: json.meta };
  }

  // --- Convenience methods ---

  get<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<ApiResult<T>> {
    return this.request<T>('GET', path, options);
  }

  post<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'body'>,
  ): Promise<ApiResult<T>> {
    return this.request<T>('POST', path, { ...options, body });
  }

  patch<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'body'>,
  ): Promise<ApiResult<T>> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  put<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'body'>,
  ): Promise<ApiResult<T>> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  delete<T = void>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<ApiResult<T>> {
    return this.request<T>('DELETE', path, options);
  }

  // --- Token refresh ---

  /**
   * Attempt to refresh the access token using the stored refresh token.
   * Returns true if refresh succeeded, false otherwise.
   * Concurrent callers share the same in-flight promise.
   */
  private async attemptTokenRefresh(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      const refreshToken = this.config.getRefreshToken();
      if (!refreshToken) {
        this.config.onAuthFailure();
        return false;
      }

      try {
        const res = await fetch(`${this.config.baseUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!res.ok) {
          this.config.onAuthFailure();
          return false;
        }

        const json = (await res.json()) as ApiResponse<TokenPair>;
        if (!json.success) {
          this.config.onAuthFailure();
          return false;
        }

        this.config.onTokenRefresh(json.data);
        return true;
      } catch {
        this.config.onAuthFailure();
        return false;
      }
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }
}
