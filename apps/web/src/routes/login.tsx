/* eslint-disable jsx-a11y/no-autofocus */
import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { NexaLogo } from '@/components/ui/nexa-logo';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useZodForm } from '@/lib/form-utils';
import { login as loginApi, verifyMfa, fetchMyPermissions } from '@/lib/auth-api';
import { ApiError } from '@/lib/api-errors';
import { useAuthStore } from '@/stores/auth-store';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

// --- Zod schemas ---

const loginSchema = z.object({
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Zod 4 still supports .email() on ZodString
  email: z.string().min(1).email(),
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const mfaSchema = z.object({
  mfaCode: z
    .string()
    .min(6)
    .max(6)
    .regex(/^\d{6}$/),
});

type MfaFormValues = z.infer<typeof mfaSchema>;

// --- Login page ---

function LoginPage() {
  // Security trade-off: credentials are held in component state during the
  // MFA step because the API requires re-authentication with email + password
  // + mfaToken. The password is visible in React DevTools while MFA is active
  // and cleared when the component unmounts or MFA completes. This is an
  // accepted trade-off given the API contract for POST /auth/mfa/verify.
  const [mfaState, setMfaState] = useState<{
    email: string;
    password: string;
    rememberMe: boolean;
  } | null>(null);

  if (mfaState) {
    return (
      <LoginPageShell>
        <MfaVerificationStep
          email={mfaState.email}
          password={mfaState.password}
          rememberMe={mfaState.rememberMe}
          onBack={() => {
            setMfaState(null);
          }}
        />
      </LoginPageShell>
    );
  }

  return (
    <LoginPageShell>
      <LoginForm
        onMfaRequired={(email, password, rememberMe) => {
          setMfaState({ email, password, rememberMe });
        }}
      />
    </LoginPageShell>
  );
}

// --- Page shell with branding ---

function LoginPageShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();

  return (
    <main
      className="flex min-h-screen items-center justify-center login-bg-mesh px-4"
      role="main"
      aria-labelledby="login-heading"
    >
      <div className="w-full max-w-[400px]">
        {/* Logo / branding */}
        <div className="mb-8 flex flex-col items-center gap-1 animate-step-in">
          <div className="flex items-center gap-2.5">
            <NexaLogo size="lg" />
            <span className="font-serif text-2xl font-bold text-[#7c3aed]">
              {t('common:appName')}
            </span>
          </div>
          <span className="text-sm text-muted-foreground">{t('common:appTagline')}</span>
        </div>
        {children}
      </div>
    </main>
  );
}

// --- Login form ---

interface LoginFormProps {
  onMfaRequired: (email: string, password: string, rememberMe: boolean) => void;
}

function LoginForm({ onMfaRequired }: LoginFormProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const authLogin = useAuthStore((s) => s.login);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useZodForm<LoginFormValues>({
    schema: loginSchema,
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setIsSubmitting(true);
    try {
      const response = await loginApi(values.email, values.password);

      // MFA required — switch to MFA step
      if (response.requiresMfa) {
        onMfaRequired(values.email, values.password, values.rememberMe);
        return;
      }

      // Temporarily set tokens so the API client can authenticate the permissions request
      useAuthStore.getState().updateTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });

      let permissions;
      try {
        permissions = await fetchMyPermissions();
      } catch (permError) {
        // Clean up tokens to avoid inconsistent store state
        useAuthStore.getState().logout();
        throw permError;
      }

      // Complete login — permissions are already in canonical store format
      authLogin(
        {
          id: response.user.id,
          email: response.user.email,
          firstName: response.user.firstName,
          lastName: response.user.lastName,
        },
        {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        },
        permissions,
        values.rememberMe,
      );

      await navigate({ to: '/' });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? t(`errors:${error.code}`, { defaultValue: error.message })
          : t('common:error');
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in-up rounded-xl border border-border bg-card p-8 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="mb-6">
        <h1 id="login-heading" className="font-serif text-xl font-bold text-foreground">
          {t('common:welcomeBack')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('common:signInDescription')}</p>
      </div>
      <Form {...form}>
        <form
          onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
          noValidate
          className="flex flex-col gap-4"
        >
          {/* Email field */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('common:email')}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder={t('common:emailPlaceholder')}
                    autoFocus
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password field */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('common:password')}</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder={t('common:passwordPlaceholder')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Remember me checkbox */}
          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="data-[state=checked]:bg-[#7c3aed] data-[state=checked]:border-[#7c3aed]"
                  />
                </FormControl>
                <FormLabel className="cursor-pointer font-normal text-muted-foreground">
                  {t('common:rememberMe')}
                </FormLabel>
              </FormItem>
            )}
          />

          {/* Error announcements for screen readers */}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {form.formState.errors.email?.message}
            {form.formState.errors.password?.message}
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            className="mt-2 w-full bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common:signingIn')}
              </>
            ) : (
              t('common:signIn')
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}

// --- MFA verification step ---

interface MfaVerificationStepProps {
  email: string;
  password: string;
  rememberMe: boolean;
  onBack: () => void;
}

function MfaVerificationStep({ email, password, rememberMe, onBack }: MfaVerificationStepProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const authLogin = useAuthStore((s) => s.login);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useZodForm<MfaFormValues>({
    schema: mfaSchema,
    defaultValues: {
      mfaCode: '',
    },
  });

  async function onSubmit(values: MfaFormValues) {
    setIsSubmitting(true);
    try {
      const response = await verifyMfa(email, password, values.mfaCode);

      // Temporarily set tokens for the permissions fetch
      useAuthStore.getState().updateTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });

      let permissions;
      try {
        permissions = await fetchMyPermissions();
      } catch (permError) {
        // Clean up tokens to avoid inconsistent store state
        useAuthStore.getState().logout();
        throw permError;
      }

      // Complete login — permissions are already in canonical store format
      authLogin(
        {
          id: response.user.id,
          email: response.user.email,
          firstName: response.user.firstName,
          lastName: response.user.lastName,
        },
        {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        },
        permissions,
        rememberMe,
      );

      await navigate({ to: '/' });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? t(`errors:${error.code}`, { defaultValue: error.message })
          : t('common:error');
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in-up rounded-xl border border-border bg-card p-8 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="mb-6">
        <h1 id="login-heading" className="font-serif text-xl font-bold text-foreground">
          {t('common:mfaTitle')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('common:mfaDescription')}</p>
      </div>
      <Form {...form}>
        <form
          onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
          noValidate
          className="flex flex-col gap-4"
        >
          {/* MFA code field */}
          <FormField
            control={form.control}
            name="mfaCode"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={t('common:mfaCodePlaceholder')}
                    maxLength={6}
                    className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
                    autoFocus
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Error announcements for screen readers */}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {form.formState.errors.mfaCode?.message}
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common:mfaVerifying')}
              </>
            ) : (
              t('common:mfaVerify')
            )}
          </Button>

          {/* Back to login */}
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground"
            onClick={onBack}
          >
            {t('common:mfaBackToLogin')}
          </Button>
        </form>
      </Form>
    </div>
  );
}
