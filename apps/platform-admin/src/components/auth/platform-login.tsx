import { useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';

import { BASE_URL } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { usePlatformAuthStore, type PlatformUser, type PlatformRole } from '@/stores/auth-store';

const VALID_PLATFORM_ROLES: PlatformRole[] = [
  'PLATFORM_ADMIN',
  'PLATFORM_VIEWER',
  'PLATFORM_SUPPORT',
];

interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  platformUser: {
    id: string;
    email: string;
    displayName: string;
    role: string;
  };
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

export function PlatformLogin() {
  const login = usePlatformAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const body: Record<string, string> = { email, password };
      if (requiresMfa && mfaCode) {
        body.mfaCode = mfaCode;
      }

      const res = await fetch(`${BASE_URL}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const json = (await res.json()) as ApiEnvelope<LoginResponse & { requiresMfa?: boolean }>;

      // 202 = MFA challenge
      if (res.status === 202 && json.data?.requiresMfa) {
        setRequiresMfa(true);
        setIsSubmitting(false);
        return;
      }

      if (!res.ok || !json.success) {
        setError(json.error?.message ?? 'Login failed');
        setIsSubmitting(false);
        return;
      }

      const { accessToken, platformUser } = json.data;
      if (!VALID_PLATFORM_ROLES.includes(platformUser.role as PlatformRole)) {
        setError(`Unexpected platform role: ${platformUser.role}`);
        return;
      }
      const user: PlatformUser = {
        id: platformUser.id,
        email: platformUser.email,
        displayName: platformUser.displayName,
        role: platformUser.role as PlatformRole,
      };
      login(user, accessToken);
      navigate({ to: '/' });
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="rounded-xl bg-card p-8 shadow-[var(--shadow-card)]">
          {/* Logo and branding */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-2xl font-bold text-white">
              N
            </div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Platform Admin</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to the Nexa platform dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                className="rounded-lg bg-error-bg px-4 py-3 text-sm text-error-foreground"
                role="alert"
              >
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (requiresMfa) {
                    setRequiresMfa(false);
                    setMfaCode('');
                  }
                }}
                className={cn(
                  'w-full rounded-[var(--radius-input)] border border-input bg-background px-3 py-2 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-ring',
                  'placeholder:text-muted-foreground',
                )}
                placeholder="admin@nexa.io"
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (requiresMfa) {
                    setRequiresMfa(false);
                    setMfaCode('');
                  }
                }}
                className={cn(
                  'w-full rounded-[var(--radius-input)] border border-input bg-background px-3 py-2 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-ring',
                  'placeholder:text-muted-foreground',
                )}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
            </div>

            {requiresMfa && (
              <div className="animate-fade-in-up">
                <label
                  htmlFor="mfaCode"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  MFA Code
                </label>
                <input
                  id="mfaCode"
                  type="text"
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className={cn(
                    'w-full rounded-[var(--radius-input)] border border-input bg-background px-3 py-2 text-sm font-mono tracking-widest',
                    'focus:outline-none focus:ring-2 focus:ring-ring',
                    'placeholder:text-muted-foreground',
                  )}
                  placeholder="000000"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  disabled={isSubmitting}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'w-full rounded-[var(--radius-button)] bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground',
                'hover:bg-[var(--primary-dark)] transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              )}
            >
              {isSubmitting ? 'Signing in...' : requiresMfa ? 'Verify & Sign In' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
