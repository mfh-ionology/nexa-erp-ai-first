// ---------------------------------------------------------------------------
// ImpersonationBanner — Fixed amber banner during platform admin impersonation
// Non-dismissable (BR-PLT-014), shows admin identity, tenant, countdown, and
// "End Session" button. Auto-redirects to platform admin portal on expiry.
// Story: E13b.5 Task 6.1
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { Shield, Timer } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ImpersonationSession } from '@/hooks/use-impersonation-session';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BANNER_HEIGHT = 48; // px — compact fixed banner
const COUNTDOWN_INTERVAL_MS = 1000;

// Platform admin redirect on expiry
const PLATFORM_ADMIN_URL =
  (import.meta.env.VITE_PLATFORM_ADMIN_URL as string | undefined) ?? 'http://localhost:5112';

// ---------------------------------------------------------------------------
// Countdown formatting
// ---------------------------------------------------------------------------

function formatCountdown(targetDate: Date): string {
  const diff = Math.max(0, Math.floor((targetDate.getTime() - Date.now()) / 1000));
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  if (hours > 0) {
    return `${String(hours)}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function isExpired(targetDate: Date): boolean {
  return targetDate.getTime() <= Date.now();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ImpersonationBannerProps {
  session: ImpersonationSession;
}

export function ImpersonationBanner({ session }: ImpersonationBannerProps) {
  const { adminEmail, tenantName, reason, expiresAt, endSession } = session;
  const [countdown, setCountdown] = useState(() => formatCountdown(expiresAt));
  const [isEnding, setIsEnding] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer — updates every second
  useEffect(() => {
    function tick() {
      if (isExpired(expiresAt)) {
        // Auto-redirect on expiry (AC #3)
        if (intervalRef.current) clearInterval(intervalRef.current);
        window.location.href = PLATFORM_ADMIN_URL;
        return;
      }
      setCountdown(formatCountdown(expiresAt));
    }

    tick(); // Initial tick
    intervalRef.current = setInterval(tick, COUNTDOWN_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [expiresAt]);

  const handleEndSession = useCallback(async () => {
    setIsEnding(true);
    try {
      await endSession();
    } catch {
      // endSession handles redirect internally
    }
  }, [endSession]);

  return (
    <>
      {/* Fixed banner — non-dismissable (BR-PLT-014), no close button */}
      <div
        role="alert"
        aria-live="polite"
        data-testid="impersonation-banner"
        className={cn(
          'fixed left-0 right-0 top-0 z-[9999]',
          'flex items-center justify-center gap-3 px-4',
          'bg-amber-500 text-black',
          'text-sm font-medium',
          'shadow-md',
        )}
        style={{ height: `${String(BANNER_HEIGHT)}px` }}
      >
        <Shield className="size-4 shrink-0" aria-hidden="true" />

        <span className="truncate" data-testid="impersonation-info">
          <span className="font-semibold">IMPERSONATING:</span> {tenantName}
        </span>

        <span className="mx-1 hidden text-amber-900/60 sm:inline" aria-hidden="true">
          |
        </span>

        <span
          className="hidden items-center gap-1 sm:inline-flex"
          data-testid="impersonation-countdown"
        >
          <Timer className="size-3.5" aria-hidden="true" />
          <span>Expires: {countdown}</span>
        </span>

        <span className="mx-1 hidden text-amber-900/60 md:inline" aria-hidden="true">
          |
        </span>

        <span className="hidden truncate md:inline" data-testid="impersonation-admin">
          {adminEmail}
        </span>

        {reason && (
          <>
            <span className="mx-1 hidden text-amber-900/60 lg:inline" aria-hidden="true">
              |
            </span>
            <span
              className="hidden truncate lg:inline text-amber-900/80"
              data-testid="impersonation-reason"
            >
              Reason: {reason}
            </span>
          </>
        )}

        <button
          type="button"
          onClick={() => void handleEndSession()}
          disabled={isEnding}
          data-testid="impersonation-end-session"
          className={cn(
            'ml-2 shrink-0 rounded px-3 py-1',
            'bg-black/20 text-black',
            'hover:bg-black/30',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50',
            'disabled:opacity-50',
            'text-xs font-semibold uppercase tracking-wide',
          )}
        >
          {isEnding ? 'Ending...' : 'End Session'}
        </button>
      </div>

      {/* Spacer to push main content below the fixed banner */}
      <div
        style={{ height: `${String(BANNER_HEIGHT)}px` }}
        aria-hidden="true"
        data-testid="impersonation-spacer"
      />
    </>
  );
}
