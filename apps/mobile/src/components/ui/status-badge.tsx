import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@nexa/i18n';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

/**
 * 9 status categories from State Machine Reference §1:
 * Initial, InProgress, AwaitingAction, Success, Partial,
 * Cancelled, Error, Warning, Terminal
 */
type StatusCategory =
  | 'initial'
  | 'inProgress'
  | 'awaitingAction'
  | 'success'
  | 'partial'
  | 'cancelled'
  | 'error'
  | 'warning'
  | 'terminal';

interface StatusConfig {
  color: string;
  bgColor: string;
  labelKey: string;
}

const STATUS_MAP: Record<string, { category: StatusCategory; labelKey: string }> = {
  DRAFT: { category: 'initial', labelKey: 'status.draft' },
  NEW: { category: 'initial', labelKey: 'status.new' },
  IN_PROGRESS: { category: 'inProgress', labelKey: 'status.inProgress' },
  PROCESSING: { category: 'inProgress', labelKey: 'status.processing' },
  AWAITING_APPROVAL: { category: 'awaitingAction', labelKey: 'status.awaitingApproval' },
  PENDING: { category: 'awaitingAction', labelKey: 'status.pending' },
  APPROVED: { category: 'success', labelKey: 'status.approved' },
  POSTED: { category: 'success', labelKey: 'status.posted' },
  ACTIVE: { category: 'success', labelKey: 'status.active' },
  PARTIALLY_FULFILLED: { category: 'partial', labelKey: 'status.partiallyFulfilled' },
  CANCELLED: { category: 'cancelled', labelKey: 'status.cancelled' },
  OVERDUE: { category: 'error', labelKey: 'status.overdue' },
  REJECTED: { category: 'error', labelKey: 'status.rejected' },
  VOID: { category: 'terminal', labelKey: 'status.void' },
  CLOSED: { category: 'terminal', labelKey: 'status.closed' },
};

const CATEGORY_STYLES: Record<StatusCategory, StatusConfig> = {
  initial: {
    color: colors.statusInitial,
    bgColor: '#f3f4f6',
    labelKey: 'status.unknown',
  },
  inProgress: {
    color: colors.statusInProgress,
    bgColor: '#dbeafe',
    labelKey: 'status.unknown',
  },
  awaitingAction: {
    color: colors.statusAwaiting,
    bgColor: '#fef3c7',
    labelKey: 'status.unknown',
  },
  success: {
    color: colors.statusSuccess,
    bgColor: '#d1fae5',
    labelKey: 'status.unknown',
  },
  partial: {
    color: '#8b5cf6',
    bgColor: '#ede9fe',
    labelKey: 'status.unknown',
  },
  cancelled: {
    color: colors.statusInitial,
    bgColor: '#f3f4f6',
    labelKey: 'status.unknown',
  },
  error: {
    color: colors.statusError,
    bgColor: '#fee2e2',
    labelKey: 'status.unknown',
  },
  warning: {
    color: colors.statusAwaiting,
    bgColor: '#fef3c7',
    labelKey: 'status.unknown',
  },
  terminal: {
    color: '#1f2937',
    bgColor: '#f3f4f6',
    labelKey: 'status.unknown',
  },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation('common');

  const mapped = STATUS_MAP[status];
  const category = mapped?.category ?? 'initial';
  const labelKey = mapped?.labelKey ?? 'status.unknown';
  const categoryStyle = CATEGORY_STYLES[category];

  const label = t(labelKey);

  return (
    <View
      style={[styles.container, { backgroundColor: categoryStyle.bgColor }]}
      accessibilityRole="text"
      accessibilityLabel={t('status.ariaLabel', { status: label })}
    >
      <View style={[styles.dot, { backgroundColor: categoryStyle.color }]} />
      <Text style={[styles.label, { color: categoryStyle.color }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    lineHeight: typography.lineHeights.small,
  },
});
