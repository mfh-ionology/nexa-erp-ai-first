'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export default function LoginPage() {
  const [step, setStep] = useState<'login' | 'mfa'>('login');
  const [loading, setLoading] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('mfa');
    }, 1500);
  }

  function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      window.location.href = '/';
    }, 1200);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Animated gradient mesh background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 20% 30%, rgba(124,58,237,0.07) 0%, transparent 70%),
            radial-gradient(ellipse 50% 60% at 80% 20%, rgba(99,102,241,0.06) 0%, transparent 70%),
            radial-gradient(ellipse 40% 50% at 50% 80%, rgba(139,92,246,0.05) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 70% 60%, rgba(167,139,250,0.05) 0%, transparent 70%)
          `,
          backgroundSize: '200% 200%',
          animation: 'gradientShift 15s ease infinite',
        }}
      />

      <style jsx>{`
        @keyframes gradientShift {
          0%,
          100% {
            background-position: 0% 0%;
          }
          25% {
            background-position: 50% 25%;
          }
          50% {
            background-position: 100% 50%;
          }
          75% {
            background-position: 50% 75%;
          }
        }
        @keyframes stepIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-step-in {
          animation: stepIn 0.5s ease forwards;
          opacity: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-step-in {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>

      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="animate-step-in mb-8 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#7c3aed]">
              <span className="text-lg font-bold text-white">N</span>
            </div>
            <span className="font-serif text-2xl font-bold text-[#7c3aed]">Nexa</span>
          </div>
          <span className="text-sm text-muted-foreground">Enterprise Resource Planning</span>
        </div>

        {step === 'login' ? (
          <div
            className="animate-fade-in-up rounded-xl border border-border bg-card p-8 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
            key="login"
          >
            <div className="mb-6">
              <h1 className="font-serif text-xl font-bold text-foreground">Welcome back</h1>
              <p className="mt-1 text-sm text-muted-foreground">Sign in to your Nexa ERP account</p>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@company.co.uk" required autoFocus />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="Enter your password" required />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  className="data-[state=checked]:bg-[#7c3aed] data-[state=checked]:border-[#7c3aed]"
                />
                <Label
                  htmlFor="remember"
                  className="text-sm font-normal text-muted-foreground cursor-pointer"
                >
                  Remember me
                </Label>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="mt-2 w-full bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {'Signing in\u2026'}
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </div>
        ) : (
          <div
            className="animate-fade-in-up rounded-xl border border-border bg-card p-8 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
            key="mfa"
          >
            <div className="mb-6">
              <h1 className="font-serif text-xl font-bold text-foreground">
                Two-Factor Authentication
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <form onSubmit={handleMfa} className="flex flex-col gap-4">
              <Input
                value={mfaCode}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setMfaCode(v);
                }}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                className="text-center text-2xl font-mono tracking-[0.5em] h-14"
                autoFocus
              />
              <Button
                type="submit"
                disabled={loading || mfaCode.length !== 6}
                className="w-full bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {'Verifying\u2026'}
                  </>
                ) : (
                  'Verify'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setStep('login');
                  setMfaCode('');
                }}
              >
                Back to sign in
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
