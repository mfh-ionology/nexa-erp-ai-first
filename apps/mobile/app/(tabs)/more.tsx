/**
 * More tab — module quick-access grid, user info, sign out.
 *
 * - Grid of module quick-access icons (2 columns)
 * - User info header: avatar, name, company name, role
 * - "Preferences" link
 * - "Sign Out" button at bottom
 * - Modules filtered by user's permissions (from resolved permissions in auth store)
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTranslation } from '@nexa/i18n';

import { useAuthStore } from '@/stores/auth-store';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface ModuleItem {
  key: string;
  labelKey: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}

/** Module definitions with navigation i18n key and icon. */
const ALL_MODULES: ModuleItem[] = [
  { key: 'finance', labelKey: 'navigation:finance', icon: 'bank-outline' },
  { key: 'sales', labelKey: 'navigation:sales', icon: 'tag-outline' },
  {
    key: 'purchasing',
    labelKey: 'navigation:purchasing',
    icon: 'cart-outline',
  },
  {
    key: 'inventory',
    labelKey: 'navigation:inventory',
    icon: 'package-variant-closed',
  },
  { key: 'crm', labelKey: 'navigation:crm', icon: 'account-group-outline' },
  { key: 'hr', labelKey: 'navigation:hr', icon: 'badge-account-outline' },
  {
    key: 'manufacturing',
    labelKey: 'navigation:manufacturing',
    icon: 'cog-outline',
  },
  {
    key: 'reporting',
    labelKey: 'navigation:reporting',
    icon: 'chart-bar',
  },
];

export default function MoreScreen() {
  const { t } = useTranslation(['mobile', 'navigation', 'common']);
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const activeCompanyName = useAuthStore((s) => s.activeCompanyName);
  const logout = useAuthStore((s) => s.logout);

  /** Filter modules based on user's resolved permissions. */
  const visibleModules = useMemo(() => {
    if (!permissions) return ALL_MODULES;

    // Super admins see all modules
    if (permissions.isSuperAdmin) return ALL_MODULES;

    return ALL_MODULES.filter((mod) => {
      const modPerms = permissions.modules[mod.key];
      return modPerms?.canAccess === true;
    });
  }, [permissions]);

  const handleModulePress = (_moduleKey: string) => {
    // Placeholder — will navigate to module list in later epic
  };

  const handlePreferences = () => {
    // Placeholder — will navigate to preferences screen in later epic
  };

  const handleSignOut = () => {
    Alert.alert(
      t('mobile:more.signOut'),
      t('mobile:session.signOutConfirm'),
      [
        { text: t('common:cancel'), style: 'cancel' },
        {
          text: t('mobile:more.signOut'),
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  };

  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || user.email
    : '';

  const userInitials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : '';

  const roleName = permissions?.role ?? '';
  const companyLabel = activeCompanyName ?? '';

  const renderModuleItem = ({ item }: { item: ModuleItem }) => {
    const translated = t(item.labelKey);

    return (
      <Pressable
        style={styles.moduleItem}
        onPress={() => handleModulePress(item.key)}
        accessibilityRole="button"
        accessibilityLabel={translated}
      >
        <View style={styles.moduleIconContainer}>
          <MaterialCommunityIcons
            name={item.icon}
            size={28}
            color={colors.primary}
          />
        </View>
        <Text style={styles.moduleLabel} numberOfLines={2}>
          {translated}
        </Text>
      </Pressable>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* User info header */}
      <View style={styles.userHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userInitials}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{displayName}</Text>
          {roleName ? (
            <Text style={styles.userRole}>{roleName}</Text>
          ) : null}
          {companyLabel ? (
            <Text style={styles.userCompany}>{companyLabel}</Text>
          ) : null}
        </View>
      </View>

      {/* Preferences link */}
      <Pressable
        style={styles.preferencesRow}
        onPress={handlePreferences}
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name="cog-outline"
          size={22}
          color={colors.text}
        />
        <Text style={styles.preferencesText}>
          {t('mobile:more.preferences')}
        </Text>
        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color={colors.textMuted}
        />
      </Pressable>

      {/* Module grid */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {t('mobile:more.modules')}
        </Text>
      </View>

      <FlatList
        data={visibleModules}
        renderItem={renderModuleItem}
        keyExtractor={(item) => item.key}
        numColumns={2}
        scrollEnabled={false}
        contentContainerStyle={styles.moduleGrid}
        columnWrapperStyle={styles.moduleRow}
      />

      {/* Sign out */}
      <Pressable
        style={styles.signOutButton}
        onPress={handleSignOut}
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name="logout"
          size={20}
          color={colors.statusError}
        />
        <Text style={styles.signOutText}>{t('mobile:more.signOut')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing['2xl'],
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingTop: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.sizes.subheading,
    fontWeight: typography.weights.bold,
    color: colors.surface,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: typography.sizes.subheading,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  userRole: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: colors.primary,
    marginTop: 2,
  },
  userCompany: {
    fontSize: typography.sizes.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  preferencesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 52,
  },
  preferencesText: {
    flex: 1,
    fontSize: typography.sizes.body,
    color: colors.text,
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  moduleGrid: {
    paddingHorizontal: spacing.md,
  },
  moduleRow: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  moduleItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  moduleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  moduleLabel: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: colors.text,
    textAlign: 'center',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.statusError,
    minHeight: 48,
  },
  signOutText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.statusError,
  },
});
