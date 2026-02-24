/**
 * Briefing tab — daily AI briefing cards.
 *
 * Placeholder UI with:
 * - Full-width card layout for briefing items
 * - Pull-to-refresh gesture
 * - Sample briefing card structure (header, metric, delta, action button)
 * - Will call GET /ai/briefing when wired in a later epic
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTranslation } from '@nexa/i18n';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface BriefingItem {
  id: string;
  titleKey: string;
  titleFallback: string;
  metric: string;
  delta: string;
  deltaPositive: boolean;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}

/** Static sample briefing data — replaced by API data in later epic. */
const SAMPLE_BRIEFINGS: BriefingItem[] = [
  {
    id: '1',
    titleKey: 'briefing.sampleCashPosition',
    titleFallback: 'Cash Position',
    metric: '\u00a312,450.00',
    delta: '+8.2%',
    deltaPositive: true,
    icon: 'cash-multiple',
  },
  {
    id: '2',
    titleKey: 'briefing.sampleOverdueInvoices',
    titleFallback: 'Overdue Invoices',
    metric: '3',
    delta: '\u00a32,100.00 total',
    deltaPositive: false,
    icon: 'file-alert-outline',
  },
  {
    id: '3',
    titleKey: 'briefing.samplePendingApprovals',
    titleFallback: 'Pending Approvals',
    metric: '5',
    delta: '2 urgent',
    deltaPositive: false,
    icon: 'clipboard-check-outline',
  },
];

export default function BriefingScreen() {
  const { t } = useTranslation('mobile');
  const [refreshing, setRefreshing] = useState(false);
  const [briefings] = useState<BriefingItem[]>(SAMPLE_BRIEFINGS);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Placeholder — will call GET /ai/briefing when wired
    refreshTimerRef.current = setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const renderBriefingCard = ({ item }: { item: BriefingItem }) => {
    const translated = t(item.titleKey);
    const title = translated === item.titleKey ? item.titleFallback : translated;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconContainer}>
            <MaterialCommunityIcons
              name={item.icon}
              size={24}
              color={colors.primary}
            />
          </View>
          <Text style={styles.cardTitle}>{title}</Text>
        </View>

        <Text style={styles.cardMetric}>{item.metric}</Text>

        <View style={styles.cardFooter}>
          <View
            style={[
              styles.deltaBadge,
              item.deltaPositive
                ? styles.deltaPositive
                : styles.deltaNegative,
            ]}
          >
            <MaterialCommunityIcons
              name={item.deltaPositive ? 'trending-up' : 'trending-down'}
              size={14}
              color={
                item.deltaPositive
                  ? colors.statusSuccess
                  : colors.statusError
              }
            />
            <Text
              style={[
                styles.deltaText,
                item.deltaPositive
                  ? styles.deltaPositiveText
                  : styles.deltaNegativeText,
              ]}
            >
              {item.delta}
            </Text>
          </View>

          <Pressable
            style={styles.actionButton}
            accessibilityRole="button"
          >
            <Text style={styles.actionButtonText}>
              {t('briefing.viewDetails')}
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={16}
              color={colors.primary}
            />
          </Pressable>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <MaterialCommunityIcons
        name="weather-sunny"
        size={64}
        color={colors.primaryLight}
      />
      <Text style={styles.emptyStateText}>{t('briefing.emptyState')}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={briefings}
        renderItem={renderBriefingCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          briefings.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.md,
    gap: spacing.md,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyStateText: {
    fontSize: typography.sizes.body,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  cardMetric: {
    fontSize: typography.sizes.heading + 4,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  deltaPositive: {
    backgroundColor: '#ecfdf5',
  },
  deltaNegative: {
    backgroundColor: '#fef2f2',
  },
  deltaText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
  },
  deltaPositiveText: {
    color: colors.statusSuccess,
  },
  deltaNegativeText: {
    color: colors.statusError,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  actionButtonText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: colors.primary,
  },
});
