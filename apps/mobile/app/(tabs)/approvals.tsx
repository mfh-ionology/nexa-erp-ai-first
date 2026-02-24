/**
 * Approvals tab — pending approval queue.
 *
 * Placeholder UI with:
 * - List of pending approval items as cards
 * - Each card: entity type icon, entity reference, requestor, date, approve/reject buttons
 * - Pull-to-refresh gesture
 * - Will call approval API when wired in a later epic
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

interface ApprovalItem {
  id: string;
  entityTypeKey: string;
  entityRef: string;
  requestor: string;
  dateKey: string;
  dateParams?: Record<string, unknown>;
  amount?: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}

/** Static sample approval data — replaced by API data in later epic. */
const SAMPLE_APPROVALS: ApprovalItem[] = [
  {
    id: '1',
    entityTypeKey: 'approvals.entityPurchaseOrder',
    entityRef: 'PO-2024-0042',
    requestor: 'Sarah Jones',
    dateKey: 'approvals.timeHoursAgo',
    dateParams: { count: 2 },
    amount: '\u00a31,250.00',
    icon: 'cart-outline',
  },
  {
    id: '2',
    entityTypeKey: 'approvals.entitySalesQuote',
    entityRef: 'QT-2024-0108',
    requestor: 'James Chen',
    dateKey: 'approvals.timeHoursAgo',
    dateParams: { count: 5 },
    amount: '\u00a34,800.00',
    icon: 'file-document-outline',
  },
  {
    id: '3',
    entityTypeKey: 'approvals.entityLeaveRequest',
    entityRef: 'LR-2024-0019',
    requestor: 'Emily Brown',
    dateKey: 'approvals.timeYesterday',
    icon: 'calendar-account-outline',
  },
];

export default function ApprovalsScreen() {
  const { t } = useTranslation('mobile');
  const [refreshing, setRefreshing] = useState(false);
  const [approvals] = useState<ApprovalItem[]>(SAMPLE_APPROVALS);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Placeholder — will call approval API when wired
    refreshTimerRef.current = setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleApprove = (_id: string) => {
    // Placeholder — will call approval API when wired
  };

  const handleReject = (_id: string) => {
    // Placeholder — will call approval API when wired
  };

  const renderApprovalCard = ({ item }: { item: ApprovalItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.entityIconContainer}>
          <MaterialCommunityIcons
            name={item.icon}
            size={22}
            color={colors.primary}
          />
        </View>
        <View style={styles.entityInfo}>
          <Text style={styles.entityType}>{t(item.entityTypeKey)}</Text>
          <Text style={styles.entityRef}>{item.entityRef}</Text>
        </View>
        {item.amount ? (
          <Text style={styles.amount}>{item.amount}</Text>
        ) : null}
      </View>

      <View style={styles.cardMeta}>
        <MaterialCommunityIcons
          name="account-outline"
          size={14}
          color={colors.textMuted}
        />
        <Text style={styles.metaText}>{item.requestor}</Text>
        <Text style={styles.metaDot}>{'\u00b7'}</Text>
        <MaterialCommunityIcons
          name="clock-outline"
          size={14}
          color={colors.textMuted}
        />
        <Text style={styles.metaText}>
          {t(item.dateKey, item.dateParams ?? {})}
        </Text>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          style={styles.rejectButton}
          onPress={() => handleReject(item.id)}
          accessibilityRole="button"
          accessibilityLabel={t('approvals.reject')}
        >
          <MaterialCommunityIcons
            name="close"
            size={18}
            color={colors.statusError}
          />
          <Text style={styles.rejectButtonText}>{t('approvals.reject')}</Text>
        </Pressable>

        <Pressable
          style={styles.approveButton}
          onPress={() => handleApprove(item.id)}
          accessibilityRole="button"
          accessibilityLabel={t('approvals.approve')}
        >
          <MaterialCommunityIcons
            name="check"
            size={18}
            color={colors.surface}
          />
          <Text style={styles.approveButtonText}>
            {t('approvals.approve')}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <MaterialCommunityIcons
        name="check-circle-outline"
        size={64}
        color={colors.primaryLight}
      />
      <Text style={styles.emptyStateText}>{t('approvals.emptyState')}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={approvals}
        renderItem={renderApprovalCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          approvals.length === 0 ? styles.emptyList : styles.list
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
  entityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entityInfo: {
    flex: 1,
  },
  entityType: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  entityRef: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  amount: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  metaText: {
    fontSize: typography.sizes.caption,
    color: colors.textMuted,
  },
  metaDot: {
    fontSize: typography.sizes.caption,
    color: colors.textMuted,
    marginHorizontal: spacing.xs,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.statusError,
    backgroundColor: colors.surface,
  },
  rejectButtonText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.statusError,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colors.statusSuccess,
  },
  approveButtonText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.surface,
  },
});
