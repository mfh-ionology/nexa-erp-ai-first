/**
 * Tab bar layout with auth guard.
 *
 * Four tabs: Chat (primary), Briefing, Approvals (with badge), More.
 * - Checks auth store for valid token on mount
 * - Redirects to (auth)/login if not authenticated
 * - On app foreground resume → checks token validity
 * - Tab titles use t() translation keys
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, View, Text, StyleSheet } from 'react-native';

import { useTranslation } from '@nexa/i18n';

import { useAuthStore } from '@/stores/auth-store';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

/** Badge component for tab bar icons (e.g., approvals count). */
function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  const label = count > 99 ? '99+' : String(count);

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

/** Wraps a tab icon with an optional badge overlay. */
function IconWithBadge({
  iconName,
  color,
  size,
  badgeCount,
}: {
  iconName: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
  size: number;
  badgeCount?: number;
}) {
  return (
    <View style={styles.iconContainer}>
      <MaterialCommunityIcons name={iconName} size={size} color={color} />
      {badgeCount !== undefined && <TabBadge count={badgeCount} />}
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation('mobile');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  // Placeholder approval count — will be wired to API in a later epic
  const [approvalCount] = useState(0);

  // On app foreground resume → check token validity, attempt refresh
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isAuthenticated) {
        void useAuthStore.getState().restoreSession();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);

  // While checking session, don't redirect yet
  if (isLoading) {
    return null;
  }

  // Auth guard — redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: typography.sizes.small,
          fontWeight: typography.weights.medium,
        },
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: colors.surface,
        headerTitleStyle: {
          fontWeight: typography.weights.semibold,
        },
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tab.chat'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="message-text-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="briefing"
        options={{
          title: t('tab.briefing'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="view-dashboard-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: t('tab.approvals'),
          tabBarIcon: ({ color, size }) => (
            <IconWithBadge
              iconName="checkbox-marked-outline"
              color={color}
              size={size}
              badgeCount={approvalCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('tab.more'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="view-grid-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: colors.statusError,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.surface,
    fontSize: typography.sizes.small - 2,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
});
