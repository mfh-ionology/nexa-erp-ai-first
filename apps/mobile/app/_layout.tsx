/**
 * Root layout — i18n init, session restoration, splash screen, and global providers.
 *
 * On mount:
 * 1. Initialise i18n (load mobile namespace)
 * 2. Check biometric availability
 * 3. If biometric enabled → prompt for biometric auth → restore session
 * 4. Else → attempt silent session restore via stored refresh token
 * 5. If restore succeeds → Slot renders (tabs) (auth guard passes)
 * 6. If restore fails → Slot renders (auth)/login (auth guard redirects)
 * 7. Hide splash screen once determination is made
 */

import { Slot, SplashScreen, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { I18nProvider, i18n } from '@nexa/i18n';

import { initMobileI18n } from '@/lib/i18n-setup';
import { setupNotificationCategories } from '@/lib/notification-categories';
import { useAuthStore } from '@/stores/auth-store';
import { colors } from '@/theme/colors';

// Prevent the splash screen from auto-hiding until we finish loading
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Initialise i18n: load mobile-specific namespace
        await initMobileI18n();

        // Register notification categories with translated button labels
        const approveLabel = i18n.t('approvals.approve', { ns: 'mobile' });
        const rejectLabel = i18n.t('approvals.reject', { ns: 'mobile' });
        await setupNotificationCategories(approveLabel, rejectLabel);

        const authStore = useAuthStore.getState();

        // Check if device supports biometric auth
        await authStore.checkBiometricAvailability();

        const { biometricEnabled, biometricAvailable } =
          useAuthStore.getState();

        let restored = false;

        if (biometricEnabled && biometricAvailable) {
          // Mark that biometric was attempted on cold start (prevents double prompt in login screen)
          authStore.setBiometricAttemptedOnLaunch(true);
          // Prompt biometric auth, then restore session using stored refresh token
          const biometricPrompt = i18n.t('login.biometricPrompt', {
            ns: 'mobile',
          });
          restored = await authStore.attemptBiometricLogin(biometricPrompt);
        } else {
          // Attempt silent restore using stored refresh token
          restored = await authStore.restoreSession();
        }

        if (restored) {
          router.replace('/(tabs)/chat');
        } else {
          router.replace('/(auth)/login');
        }
      } catch {
        // On any error, fall through to login
        router.replace('/(auth)/login');
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    }
    void prepare();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <I18nProvider>
      <StatusBar style="light" />
      <Slot />
    </I18nProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
