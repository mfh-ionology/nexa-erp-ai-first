import { usePlatformAuthStore, type PlatformRole, type PlatformUser } from '@/stores/auth-store';

const VALID_PLATFORM_ROLES: PlatformRole[] = [
  'PLATFORM_ADMIN',
  'PLATFORM_VIEWER',
  'PLATFORM_SUPPORT',
];

/**
 * Base URL for Platform API requests.
 *
 * Dev: defaults to '/api/v1' — Vite dev server proxy (see vite.config.ts)
 *      rewrites /api/v1/* → http://localhost:5101/* stripping the prefix.
 * Prod: set VITE_PLATFORM_API_BASE_URL to the Platform API origin
 *       (e.g., 'https://platform-api.nexa.example.com'). In production the
 *       API paths (/admin/intelligence/*) are appended directly to this URL.
 */
export const BASE_URL = import.meta.env.VITE_PLATFORM_API_BASE_URL ?? '/api/v1';

/** Typed API error for Platform API responses. */
export class PlatformApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PlatformApiError';
  }
}

/** Pagination meta returned by list endpoints. */
export interface PaginationMeta {
  cursor?: string | null;
  hasMore?: boolean;
  total?: number;
}

/** Result type that includes both data and optional pagination meta. */
export interface ApiResult<T> {
  data: T;
  meta?: PaginationMeta;
}

/** Standard envelope from the Platform API. */
interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
  error?: { code: string; message: string };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  const { accessToken } = usePlatformAuthStore.getState();

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include', // Send httpOnly cookies for refresh
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle 401 — try token refresh once
  if (res.status === 401 && accessToken) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = usePlatformAuthStore.getState().accessToken;
      headers['Authorization'] = `Bearer ${newToken}`;
      const retryRes = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
      return parseResponse<T>(retryRes);
    }
    usePlatformAuthStore.getState().logout();
    throw new PlatformApiError(401, 'UNAUTHORIZED', 'Session expired');
  }

  return parseResponse<T>(res);
}

async function parseResponse<T>(res: Response): Promise<ApiResult<T>> {
  const json = (await res.json()) as ApiEnvelope<T>;

  if (!res.ok || !json.success) {
    throw new PlatformApiError(
      res.status,
      json.error?.code ?? 'UNKNOWN',
      json.error?.message ?? 'An unexpected error occurred',
    );
  }

  return { data: json.data, meta: json.meta };
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/admin/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return false;

      const json = (await res.json()) as ApiEnvelope<{ accessToken: string; expiresIn: number }>;
      if (json.success && json.data.accessToken) {
        usePlatformAuthStore.getState().setAccessToken(json.data.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Attempt to bootstrap auth by silent-refreshing the access token.
 * Called once on app load when there's no in-memory token but an httpOnly
 * refresh cookie may be present.
 */
let bootstrapPromise: Promise<boolean> | null = null;

export function tryBootstrapAuth(): Promise<boolean> {
  if (usePlatformAuthStore.getState().isAuthenticated) {
    return Promise.resolve(true);
  }
  // Deduplicate concurrent bootstrap attempts
  if (bootstrapPromise) return bootstrapPromise;

  usePlatformAuthStore.getState().setLoading(true);

  bootstrapPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/admin/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return false;

      const json = (await res.json()) as ApiEnvelope<{
        accessToken: string;
        expiresIn: number;
        user?: { id: string; email: string; displayName: string; role: string };
      }>;
      if (json.success && json.data.accessToken) {
        const store = usePlatformAuthStore.getState();
        if (json.data.user) {
          if (!VALID_PLATFORM_ROLES.includes(json.data.user.role as PlatformRole)) {
            return false;
          }
          const user: PlatformUser = {
            id: json.data.user.id,
            email: json.data.user.email,
            displayName: json.data.user.displayName,
            role: json.data.user.role as PlatformRole,
          };
          store.login(user, json.data.accessToken);
        } else {
          store.setAccessToken(json.data.accessToken);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      usePlatformAuthStore.getState().setLoading(false);
      bootstrapPromise = null;
    }
  })();

  return bootstrapPromise;
}

export function apiGet<T>(path: string): Promise<ApiResult<T>> {
  return request<T>('GET', path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return request<T>('POST', path, body);
}

export function apiPatch<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return request<T>('PATCH', path, body);
}

export function apiPut<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return request<T>('PUT', path, body);
}

export function apiDelete<T>(path: string): Promise<ApiResult<T>> {
  return request<T>('DELETE', path);
}

/**
 * Build a query string from a params object.
 * Omits null/undefined values.
 */
export function buildQueryString(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number | boolean] => entry[1] != null,
  );
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}
