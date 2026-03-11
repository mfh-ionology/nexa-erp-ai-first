// ---------------------------------------------------------------------------
// useImpersonationSession — Hook tests
// Story: E13b.5 Task 6.5
// ---------------------------------------------------------------------------

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useImpersonationSession } from './use-impersonation-session';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMPERSONATION_TOKEN_KEY = 'nexa_impersonation_token';
const IMPERSONATION_META_KEY = 'nexa_impersonation_meta';

// A valid-looking JWT with type: 'impersonation' (base64url encoded payload)
// Payload: { sub: 'platform-user-1', tenantId: 'tenant-1', sessionId: 'session-1', type: 'impersonation', exp: <future> }
function createMockJwt(exp?: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: 'platform-user-1',
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      type: 'impersonation',
      iss: 'nexa-platform',
      exp: exp ?? Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    }),
  );
  const signature = 'mock-signature';
  return `${header}.${payload}.${signature}`;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const originalLocation = window.location;
let replaceStateSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  sessionStorage.clear();
  replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});

  // Reset location with empty hash (implementation reads from hash fragment)
  Object.defineProperty(window, 'location', {
    writable: true,
    value: {
      ...originalLocation,
      search: '',
      hash: '',
      pathname: '/',
      href: 'http://localhost:5110/',
    },
  });
});

afterEach(() => {
  replaceStateSpy.mockRestore();
  Object.defineProperty(window, 'location', {
    writable: true,
    value: originalLocation,
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useImpersonationSession', () => {
  it('returns isImpersonating=false when no token present', () => {
    const { result } = renderHook(() => useImpersonationSession());

    expect(result.current.isImpersonating).toBe(false);
    expect(result.current.adminEmail).toBe('');
    expect(result.current.tenantName).toBe('');
    expect(result.current.sessionId).toBe('');
  });

  it('detects impersonation token from URL hash fragment', () => {
    const token = createMockJwt();
    const params = new URLSearchParams({
      impersonation_token: token,
      admin_email: 'admin@platform.io',
      tenant_name: 'Acme Ltd',
      tenant_code: 'ACME',
    });

    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...originalLocation,
        search: '',
        hash: `#${params.toString()}`,
        pathname: '/',
        href: `http://localhost:5110/#${params.toString()}`,
      },
    });

    const { result } = renderHook(() => useImpersonationSession());

    expect(result.current.isImpersonating).toBe(true);
    expect(result.current.adminEmail).toBe('admin@platform.io');
    expect(result.current.tenantName).toBe('Acme Ltd (ACME)');
    expect(result.current.sessionId).toBe('session-1');
  });

  it('stores token and metadata in sessionStorage', () => {
    const token = createMockJwt();
    const hashParams = `impersonation_token=${encodeURIComponent(token)}&admin_email=admin@platform.io&tenant_name=Test`;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...originalLocation,
        search: '',
        hash: `#${hashParams}`,
        pathname: '/',
        href: 'http://localhost:5110/',
      },
    });

    renderHook(() => useImpersonationSession());

    expect(sessionStorage.getItem(IMPERSONATION_TOKEN_KEY)).toBe(token);
    const meta = JSON.parse(sessionStorage.getItem(IMPERSONATION_META_KEY)!);
    expect(meta.adminEmail).toBe('admin@platform.io');
    expect(meta.sessionId).toBe('session-1');
  });

  it('cleans URL after reading impersonation hash fragment', () => {
    const token = createMockJwt();
    const hashParams = `impersonation_token=${encodeURIComponent(token)}&admin_email=admin@platform.io`;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...originalLocation,
        search: '',
        hash: `#${hashParams}`,
        pathname: '/dashboard',
        href: 'http://localhost:5110/dashboard',
      },
    });

    renderHook(() => useImpersonationSession());

    // Implementation cleans hash by replacing with pathname + search (no hash)
    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/dashboard');
  });

  it('hydrates from sessionStorage on subsequent renders', () => {
    const meta = {
      adminId: 'platform-user-1',
      adminEmail: 'admin@platform.io',
      tenantId: 'tenant-1',
      tenantName: 'Acme Ltd',
      tenantCode: 'ACME',
      sessionId: 'session-1',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
    sessionStorage.setItem(IMPERSONATION_META_KEY, JSON.stringify(meta));
    sessionStorage.setItem(IMPERSONATION_TOKEN_KEY, 'stored-token');

    const { result } = renderHook(() => useImpersonationSession());

    expect(result.current.isImpersonating).toBe(true);
    expect(result.current.adminEmail).toBe('admin@platform.io');
    expect(result.current.tenantName).toBe('Acme Ltd (ACME)');
  });

  it('returns isImpersonating=false when session is expired', () => {
    const meta = {
      adminId: 'platform-user-1',
      adminEmail: 'admin@platform.io',
      tenantId: 'tenant-1',
      tenantName: 'Acme Ltd',
      tenantCode: '',
      sessionId: 'session-1',
      expiresAt: Math.floor(Date.now() / 1000) - 60, // expired 1 minute ago
    };
    sessionStorage.setItem(IMPERSONATION_META_KEY, JSON.stringify(meta));

    const { result } = renderHook(() => useImpersonationSession());

    expect(result.current.isImpersonating).toBe(false);
    // Should have cleared sessionStorage
    expect(sessionStorage.getItem(IMPERSONATION_META_KEY)).toBeNull();
  });

  it('endSession clears sessionStorage and redirects', async () => {
    const locationMock = {
      ...originalLocation,
      search: '',
      pathname: '/',
      href: 'http://localhost:5110/',
    };
    Object.defineProperty(window, 'location', {
      writable: true,
      value: locationMock,
    });

    // Pre-populate sessionStorage
    const meta = {
      adminId: 'platform-user-1',
      adminEmail: 'admin@platform.io',
      tenantId: 'tenant-1',
      tenantName: 'Acme Ltd',
      tenantCode: '',
      sessionId: 'session-1',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
    sessionStorage.setItem(IMPERSONATION_META_KEY, JSON.stringify(meta));
    sessionStorage.setItem(IMPERSONATION_TOKEN_KEY, 'stored-token');

    // Mock fetch for the end-session API call
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());

    const { result } = renderHook(() => useImpersonationSession());

    await act(async () => {
      await result.current.endSession();
    });

    // Should clear sessionStorage
    expect(sessionStorage.getItem(IMPERSONATION_TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(IMPERSONATION_META_KEY)).toBeNull();

    // Should redirect to platform admin
    expect(locationMock.href).toContain('localhost:5112');

    fetchSpy.mockRestore();
  });

  it('ignores non-impersonation JWTs in URL hash', () => {
    // Create a JWT without type: 'impersonation'
    const header = btoa(JSON.stringify({ alg: 'HS256' }));
    const payload = btoa(JSON.stringify({ sub: 'user-1', type: 'user' }));
    const token = `${header}.${payload}.sig`;

    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...originalLocation,
        search: '',
        hash: `#impersonation_token=${encodeURIComponent(token)}`,
        pathname: '/',
        href: 'http://localhost:5110/',
      },
    });

    const { result } = renderHook(() => useImpersonationSession());

    expect(result.current.isImpersonating).toBe(false);
  });
});
