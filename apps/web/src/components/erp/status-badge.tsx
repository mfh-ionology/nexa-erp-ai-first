import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  Loader2,
  type LucideIcon,
  MinusCircle,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { useI18n } from '@nexa/i18n';

type StatusSize = 'sm' | 'md' | 'lg';

export interface StatusBadgeProps {
  /** The status string (e.g., 'DRAFT', 'POSTED', 'APPROVED') */
  status: string;
  /** Entity type identifier — used for entity-specific status label keys */
  entityType: string;
  /** Badge size */
  size?: StatusSize;
}

interface StatusStyleConfig {
  colorVar: string;
  icon: LucideIcon;
  labelKey: string;
}

const STATUS_CONFIG: Record<string, StatusStyleConfig> = {
  DRAFT: {
    colorVar: 'var(--color-status-initial)',
    icon: Circle,
    labelKey: 'status.draft',
  },
  NEW: {
    colorVar: 'var(--color-status-initial)',
    icon: Circle,
    labelKey: 'status.new',
  },
  IN_PROGRESS: {
    colorVar: 'var(--color-status-in-progress)',
    icon: Loader2,
    labelKey: 'status.inProgress',
  },
  PROCESSING: {
    colorVar: 'var(--color-status-in-progress)',
    icon: Loader2,
    labelKey: 'status.processing',
  },
  AWAITING_APPROVAL: {
    colorVar: 'var(--color-status-awaiting)',
    icon: Clock,
    labelKey: 'status.awaitingApproval',
  },
  PENDING: {
    colorVar: 'var(--color-status-awaiting)',
    icon: Clock,
    labelKey: 'status.pending',
  },
  APPROVED: {
    colorVar: 'var(--color-status-success)',
    icon: CheckCircle2,
    labelKey: 'status.approved',
  },
  POSTED: {
    colorVar: 'var(--color-status-success)',
    icon: CheckCircle2,
    labelKey: 'status.posted',
  },
  ACTIVE: {
    colorVar: 'var(--color-status-success)',
    icon: CheckCircle2,
    labelKey: 'status.active',
  },
  PARTIALLY_FULFILLED: {
    colorVar: 'var(--color-status-partial)',
    icon: CircleDot,
    labelKey: 'status.partiallyFulfilled',
  },
  CANCELLED: {
    colorVar: 'var(--color-status-cancelled)',
    icon: MinusCircle,
    labelKey: 'status.cancelled',
  },
  OVERDUE: {
    colorVar: 'var(--color-status-error)',
    icon: AlertTriangle,
    labelKey: 'status.overdue',
  },
  REJECTED: {
    colorVar: 'var(--color-status-error)',
    icon: XCircle,
    labelKey: 'status.rejected',
  },
  VOID: {
    colorVar: 'var(--color-status-terminal)',
    icon: Ban,
    labelKey: 'status.void',
  },
  CLOSED: {
    colorVar: 'var(--color-status-terminal)',
    icon: Ban,
    labelKey: 'status.closed',
  },
};

const DEFAULT_STATUS_CONFIG: StatusStyleConfig = {
  colorVar: 'var(--color-status-initial)',
  icon: Circle,
  labelKey: 'status.unknown',
};

const SIZE_CLASSES: Record<StatusSize, string> = {
  sm: 'text-xs px-1.5 py-0 gap-0.5 [&>svg]:size-3',
  md: 'text-xs px-2 py-0.5 gap-1 [&>svg]:size-3.5',
  lg: 'text-sm px-2.5 py-1 gap-1.5 [&>svg]:size-4',
};

export function StatusBadge({
  status,
  entityType,
  size = 'md',
}: StatusBadgeProps) {
  const { t } = useI18n();

  const config = STATUS_CONFIG[status] ?? DEFAULT_STATUS_CONFIG;
  const Icon = config.icon;
  const statusLabel = t(config.labelKey);

  return (
    <Badge
      variant="outline"
      className={cn(
        'border-transparent font-medium',
        SIZE_CLASSES[size],
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${config.colorVar} 15%, transparent)`,
        color: config.colorVar,
        borderColor: `color-mix(in srgb, ${config.colorVar} 30%, transparent)`,
      }}
      aria-label={t('status.ariaLabel', { status: statusLabel })}
      data-entity-type={entityType}
      data-status={status}
    >
      <Icon aria-hidden="true" />
      {statusLabel}
    </Badge>
  );
}
