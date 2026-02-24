import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { NexaLogo } from '@/components/ui/nexa-logo';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import {
  login as loginApi,
  verifyMfa,
  fetchMyPermissions,
} from '@/lib/auth-api';
import { ApiError } from '@/lib/api-errors';
import { useAuthStore } from '@/stores/auth-store';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

// --- Zod schemas ---

const loginSchema = z.object({
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
          onBack={() => setMfaState(null)}
        />
      </LoginPageShell>
    );
  }

  return (
    <LoginPageShell>
      <LoginForm
        onMfaRequired={(email, password, rememberMe) =>
          setMfaState({ email, password, rememberMe })
        }
      />
    </LoginPageShell>
  );
}

// --- Page shell with branding ---

function LoginPageShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background px-4"
      role="main"
      aria-labelledby="login-heading"
    >
      <div className="w-full max-w-md">
        {/* Logo / branding */}
        <div className="mb-8 flex flex-col items-center text-center">
          <NexaLogo size="lg" className="mb-3" />
          <h1
            className="font-display text-2xl font-bold tracking-tight text-primary"
            aria-hidden="true"
          >
            {t('common:appName')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('common:appTagline')}</p>
        </div>
        {children}
      </div>
    </main>
  );
}

// --- Login form ---

interface LoginFormProps {
  onMfaRequired: (
    email: string,
    password: string,
    rememberMe: boolean,
  ) => void;
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
    <Card>
      <CardHeader className="text-center">
        <CardTitle id="login-heading" className="text-xl">
          {t('common:welcomeBack')}
        </CardTitle>
        <CardDescription>{t('common:signInDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
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
                    />
                  </FormControl>
                  <FormLabel className="cursor-pointer font-normal">
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
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  {t('common:signingIn')}
                </>
              ) : (
                t('common:signIn')
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// --- MFA verification step ---

interface MfaVerificationStepProps {
  email: string;
  password: string;
  rememberMe: boolean;
  onBack: () => void;
}

function MfaVerificationStep({
  email,
  password,
  rememberMe,
  onBack,
}: MfaVerificationStepProps) {
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
    <Card>
      <CardHeader className="text-center">
        <CardTitle id="login-heading" className="text-xl">
          {t('common:mfaTitle')}
        </CardTitle>
        <CardDescription>{t('common:mfaDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
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
                      className="text-center text-lg tracking-widest"
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
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
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
              className="w-full"
              onClick={onBack}
            >
              {t('common:mfaBackToLogin')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
