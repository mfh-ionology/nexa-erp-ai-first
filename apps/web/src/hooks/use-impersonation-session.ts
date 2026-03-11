// ---------------------------------------------------------------------------
// useImpersonationSession — Detects and manages platform admin impersonation
// Reads impersonation token from URL hash fragment or sessionStorage.
// Story: E13b.5 Task 6.2
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// SessionStorage keys (session-scoped, not persisted across tabs)
// ---------------------------------------------------------------------------

const IMPERSONATION_TOKEN_KEY = 'nexa_impersonation_token';
const IMPERSONATION_META_KEY = 'nexa_impersonation_meta';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImpersonationMeta {
  adminId: string;
  adminEmail: string;
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  sessionId: string;
  reason: string;
  expiresAt: number; // Unix timestamp in seconds
}

export interface ImpersonationSession {
  isImpersonating: boolean;
  adminEmail: string;
  tenantName: string;
  sessionId: string;
  reason: string;
  expiresAt: Date;
  endSession: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Platform URLs (configurable via env, defaults for dev)
// ---------------------------------------------------------------------------

const PLATFORM_API_URL =
  (import.meta.env.VITE_PLATFORM_API_URL as string | undefined) ?? 'http://localhost:5101/api/v1';
const PLATFORM_ADMIN_URL =
  (import.meta.env.VITE_PLATFORM_ADMIN_URL as string | undefined) ?? 'http://localhost:5112';

// ---------------------------------------------------------------------------
// JWT decoding (client-side, no verification — verification is server-side)
// ---------------------------------------------------------------------------

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    // Handle base64url encoding
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SessionStorage helpers
// ---------------------------------------------------------------------------

function readMeta(): ImpersonationMeta | null {
  try {
    const stored = sessionStorage.getItem(IMPERSONATION_META_KEY);
    if (!stored) return null;
    const meta = JSON.parse(stored) as ImpersonationMeta;
    // Check expiry — clear if expired
    if (meta.expiresAt <= Date.now() / 1000) {
      sessionStorage.removeItem(IMPERSONATION_TOKEN_KEY);
      sessionStorage.removeItem(IMPERSONATION_META_KEY);
      return null;
    }
    return meta;
  } catch {
    return null;
  }
}

function writeMeta(token: string, meta: ImpersonationMeta): void {
  try {
    sessionStorage.setItem(IMPERSONATION_TOKEN_KEY, token);
    sessionStorage.setItem(IMPERSONATION_META_KEY, JSON.stringify(meta));
  } catch {
    // sessionStorage unavailable
  }
}

function clearMeta(): void {
  try {
    sessionStorage.removeItem(IMPERSONATION_TOKEN_KEY);
    sessionStorage.removeItem(IMPERSONATION_META_KEY);
  } catch {
    // sessionStorage unavailable
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useImpersonationSession(): ImpersonationSession {
  const [meta, setMeta] = useState<ImpersonationMeta | null>(readMeta);
  const initialised = useRef(false);

  // On mount, check for impersonation token in URL hash fragment.
  // E13b.5 Fix: Hash fragments are used instead of query parameters to avoid
  // leaking the JWT in server logs, Referer headers, and proxy logs.
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    // Read from hash fragment (strip leading '#')
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const token = params.get('impersonation_token');
    if (!token) return;

    const payload = decodeJwtPayload(token);
    if (!payload || payload.type !== 'impersonation') return;

    const newMeta: ImpersonationMeta = {
      adminId: (payload.sub as string) ?? '',
      adminEmail: params.get('admin_email') ?? (payload.sub as string) ?? 'Platform Admin',
      tenantId: (payload.tenantId as string) ?? '',
      tenantName: params.get('tenant_name') ?? 'Tenant',
      tenantCode: params.get('tenant_code') ?? '',
      sessionId: (payload.sessionId as string) ?? '',
      reason: params.get('reason') ?? '',
      expiresAt: (payload.exp as number) ?? 0,
    };

    writeMeta(token, newMeta);
    setMeta(newMeta);

    // Clean URL — remove hash fragment entirely
    window.history.replaceState({}, '', window.location.pathname + window.location.search);
  }, []);

  const endSession = useCallback(async () => {
    if (!meta) return;

    // Best-effort call to end the session via platform API
    try {
      const token = sessionStorage.getItem(IMPERSONATION_TOKEN_KEY);
      if (token) {
        await fetch(`${PLATFORM_API_URL}/admin/impersonation-sessions/${meta.sessionId}/end`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch {
      // Best-effort — session will auto-expire via background job
    }

    clearMeta();
    setMeta(null);

    // Redirect to platform admin portal
    window.location.href = PLATFORM_ADMIN_URL;
  }, [meta]);

  return useMemo(() => {
    const isImpersonating = meta !== null && meta.expiresAt > Date.now() / 1000;
    return {
      isImpersonating,
      adminEmail: meta?.adminEmail ?? '',
      tenantName: meta ? `${meta.tenantName}${meta.tenantCode ? ` (${meta.tenantCode})` : ''}` : '',
      sessionId: meta?.sessionId ?? '',
      reason: meta?.reason ?? '',
      expiresAt: meta ? new Date(meta.expiresAt * 1000) : new Date(),
      endSession,
    };
  }, [meta, endSession]);
}
