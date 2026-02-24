/**
 * Login screen — email/password authentication with optional biometric unlock.
 *
 * - On success → store tokens, fetch permissions, navigate to (tabs)
 * - On MFA required → navigate to (auth)/mfa
 * - On error → show translated error alert
 * - Biometric toggle visible only if device supports it
 * - All labels via t() translation keys
 */

import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
} from 'react-native';

import { useTranslation } from '@nexa/i18n';

import { usePushNotifications } from '@/hooks/use-push-notifications';
import { apiClient } from '@/lib/api-client';
import { registerPushToken } from '@/lib/push-registration';
import { STORAGE_KEYS, setToken } from '@/lib/secure-storage';
import {
  useAuthStore,
  mapLoginUser,
  mapApiPermissions,
} from '@/stores/auth-store';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export default function LoginScreen() {
  const { t } = useTranslation('mobile');
  const { t: tCommon } = useTranslation('common');
  const {
    biometricAvailable,
    biometricEnabled,
    checkBiometricAvailability,
    attemptBiometricLogin,
    isLoading: isRestoringSession,
  } = useAuthStore();

  const { registerForPushNotifications } = usePushNotifications();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [enableBiometric, setEnableBiometric] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void checkBiometricAvailability();
  }, [checkBiometricAvailability]);

  const biometricAttemptedOnLaunch = useAuthStore(
    (s) => s.biometricAttemptedOnLaunch,
  );

  // Attempt biometric login if previously enabled — but skip if root layout already tried
  useEffect(() => {
    if (
      biometricEnabled &&
      biometricAvailable &&
      !biometricAttemptedOnLaunch
    ) {
      void attemptBiometricLogin(t('login.biometricPrompt')).then(
        (success) => {
          if (success) {
            router.replace('/(tabs)/chat');
          }
        },
      );
    }
  }, [biometricEnabled, biometricAvailable, biometricAttemptedOnLaunch, attemptBiometricLogin, t]);

  const handleLogin = useCallback(async () => {
    if (!email.trim() || !password.trim()) return;

    setIsSubmitting(true);

    try {
      const loginResponse = await apiClient.auth.login(email.trim(), password);

      // MFA required — store credentials in auth store (never in route params)
      if (loginResponse.requiresMfa) {
        useAuthStore
          .getState()
          .setPendingMfaCredentials({ email: email.trim(), password });
        router.push('/(auth)/mfa');
        setIsSubmitting(false);
        return;
      }

      // Fetch resolved permissions
      const user = mapLoginUser(loginResponse.user);
      const tokens = {
        accessToken: loginResponse.accessToken,
        refreshToken: loginResponse.refreshToken,
      };

      // Temporarily set tokens for the permissions fetch
      const authStore = useAuthStore.getState();
      await authStore.updateTokens(tokens);

      const apiPermissions = await apiClient.system.fetchMyPermissions();
      const permissions = mapApiPermissions(apiPermissions);

      await authStore.login(user, tokens, permissions, loginResponse.user.tenantName);

      // Enable biometric if user toggled it on
      if (enableBiometric && biometricAvailable) {
        await authStore.enableBiometric();
      }

      // Register for push notifications (non-blocking — don't fail login if this fails)
      try {
        const pushToken = await registerForPushNotifications();
        if (pushToken) {
          await setToken(STORAGE_KEYS.PUSH_TOKEN, pushToken);
          await registerPushToken(apiClient, pushToken);
        }
      } catch {
        // Push registration is best-effort — do not block login
      }

      router.replace('/(tabs)/chat');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : tCommon('error');
      Alert.alert(tCommon('error'), message);
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, enableBiometric, biometricAvailable, tCommon]);

  const isDisabled = isSubmitting || isRestoringSession;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* Logo & branding */}
          <View style={styles.brandingContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>{tCommon('appName')}</Text>
            </View>
            <Text style={styles.appTagline}>{tCommon('appTagline')}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{t('login.title')}</Text>

          {/* Email field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>{t('login.emailLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('login.emailPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!isDisabled}
              accessibilityLabel={t('login.emailLabel')}
            />
          </View>

          {/* Password field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>{t('login.passwordLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('login.passwordPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              editable={!isDisabled}
              accessibilityLabel={t('login.passwordLabel')}
            />
          </View>

          {/* Remember me */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t('login.rememberMe')}</Text>
            <Switch
              value={rememberMe}
              onValueChange={setRememberMe}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={rememberMe ? colors.primary : colors.surface}
              disabled={isDisabled}
              accessibilityLabel={t('login.rememberMe')}
            />
          </View>

          {/* Biometric toggle — visible only if device supports it */}
          {biometricAvailable ? (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                {t('login.enableBiometric')}
              </Text>
              <Switch
                value={enableBiometric}
                onValueChange={setEnableBiometric}
                trackColor={{
                  false: colors.border,
                  true: colors.primaryLight,
                }}
                thumbColor={enableBiometric ? colors.primary : colors.surface}
                disabled={isDisabled}
                accessibilityLabel={t('login.enableBiometric')}
              />
            </View>
          ) : null}

          {/* Sign in button */}
          <TouchableOpacity
            style={[styles.button, isDisabled && styles.buttonDisabled]}
            onPress={() => void handleLogin()}
            disabled={isDisabled}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('login.signIn')}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.buttonText}>{t('login.signIn')}</Text>
            )}
          </TouchableOpacity>

          {/* Forgot password */}
          <TouchableOpacity style={styles.forgotContainer}>
            <Text style={styles.forgotText}>{t('login.forgotPassword')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing['2xl'],
    backgroundColor: colors.background,
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  logoText: {
    fontSize: typography.sizes.subheading,
    fontWeight: typography.weights.bold,
    color: colors.surface,
  },
  appTagline: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: typography.sizes.heading,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: typography.sizes.body,
    color: colors.text,
    minHeight: 48,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    minHeight: 44,
  },
  switchLabel: {
    fontSize: typography.sizes.body,
    color: colors.text,
    flex: 1,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.surface,
  },
  forgotContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  forgotText: {
    fontSize: typography.sizes.caption,
    color: colors.primary,
  },
});
