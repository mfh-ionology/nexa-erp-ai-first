/**
 * MFA verification screen — 6-digit TOTP code input.
 *
 * - Reads email/password from auth store's pendingMfaCredentials (set by login screen)
 * - On success → complete login flow, navigate to (tabs)
 * - On error → show error, allow retry
 * - All labels via t() translation keys
 */

import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';

import { useTranslation } from '@nexa/i18n';

import { apiClient } from '@/lib/api-client';
import {
  useAuthStore,
  mapLoginUser,
  mapApiPermissions,
} from '@/stores/auth-store';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const CODE_LENGTH = 6;

export default function MfaScreen() {
  const { t } = useTranslation('mobile');
  const { t: tCommon } = useTranslation('common');
  const pendingCredentials = useAuthStore((s) => s.pendingMfaCredentials);

  const [digits, setDigits] = useState<string[]>(
    Array.from({ length: CODE_LENGTH }, () => ''),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>(
    Array.from({ length: CODE_LENGTH }, () => null),
  );

  const handleDigitChange = useCallback(
    (text: string, index: number) => {
      // Only accept numeric input
      const digit = text.replace(/\D/g, '').slice(-1);

      setDigits((prev) => {
        const next = [...prev];
        next[index] = digit;
        return next;
      });

      // Auto-advance to next field
      if (digit && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [],
  );

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      // Handle backspace — move to previous field if current is empty
      if (key === 'Backspace' && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        setDigits((prev) => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
      }
    },
    [digits],
  );

  const handleVerify = useCallback(async () => {
    const code = digits.join('');
    if (code.length !== CODE_LENGTH) return;

    if (!pendingCredentials) {
      Alert.alert(tCommon('error'), tCommon('error'));
      return;
    }

    const { email, password } = pendingCredentials;

    setIsSubmitting(true);

    try {
      const loginResponse = await apiClient.auth.verifyMfa(
        email,
        password,
        code,
      );

      const user = mapLoginUser(loginResponse.user);
      const tokens = {
        accessToken: loginResponse.accessToken,
        refreshToken: loginResponse.refreshToken,
      };

      // Set tokens for the permissions fetch
      const authStore = useAuthStore.getState();
      await authStore.updateTokens(tokens);

      const apiPermissions = await apiClient.system.fetchMyPermissions();
      const permissions = mapApiPermissions(apiPermissions);

      await authStore.login(user, tokens, permissions, loginResponse.user.tenantName);
      // Credentials consumed — clear from store
      authStore.setPendingMfaCredentials(null);

      router.replace('/(tabs)/chat');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : tCommon('error');
      Alert.alert(tCommon('error'), message);

      // Clear code on failure for retry
      setDigits(Array.from({ length: CODE_LENGTH }, () => ''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }, [digits, pendingCredentials, tCommon]);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const codeComplete = digits.every((d) => d !== '');

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={tCommon('back')}
        >
          <Text style={styles.backText}>{tCommon('back')}</Text>
        </TouchableOpacity>

        {/* Title */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>{t('mfa.title')}</Text>
          <Text style={styles.subtitle}>{t('mfa.subtitle')}</Text>
        </View>

        {/* 6-digit code input */}
        <View style={styles.codeContainer}>
          {digits.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={[
                styles.codeInput,
                digit ? styles.codeInputFilled : null,
              ]}
              value={digit}
              onChangeText={(text) => handleDigitChange(text, index)}
              onKeyPress={({ nativeEvent }) =>
                handleKeyPress(nativeEvent.key, index)
              }
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              editable={!isSubmitting}
              accessibilityLabel={`${t('mfa.codeLabel')} ${String(index + 1)}`}
            />
          ))}
        </View>

        {/* Verify button */}
        <TouchableOpacity
          style={[
            styles.button,
            (!codeComplete || isSubmitting) && styles.buttonDisabled,
          ]}
          onPress={() => void handleVerify()}
          disabled={!codeComplete || isSubmitting}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('mfa.verify')}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.buttonText}>{t('mfa.verify')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'],
    backgroundColor: colors.background,
  },
  backButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
  },
  backText: {
    fontSize: typography.sizes.body,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.heading,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: typography.lineHeights.body,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontSize: typography.sizes.heading,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  codeInputFilled: {
    borderColor: colors.primary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
});
