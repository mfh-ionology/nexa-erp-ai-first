// ---------------------------------------------------------------------------
// AI Alerts Tab — Quota warnings, exceeded alerts, and usage spike detection
// Story E13b-4 Task 5 (AC#3, AC#4)
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, AlertCircle, TrendingUp, CheckCircle2, Loader2, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { cn } from '@/lib/utils';
import { RequirePlatformRole } from '@/components/auth/require-platform-role';
import { Button } from '@/components/ui/button';

import { useAiAlerts, useAcknowledgeAlert } from '../hooks/use-ai-usage';
import type { AiAlert, AiAlertsFilters } from '../hooks/use-ai-usage';

// ---------------------------------------------------------------------------
// Alert type configuration
// ---------------------------------------------------------------------------

type AlertType = AiAlert['type'];

interface AlertTypeConfig {
  icon: typeof AlertTriangle;
  badgeBg: string;
  badgeText: string;
  badgeDot: string;
  label: string;
}

const ALERT_TYPE_CONFIG: Record<AlertType, AlertTypeConfig> = {
  QUOTA_WARNING: {
    icon: AlertTriangle,
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    badgeDot: 'bg-amber-500',
    label: 'Quota Warning',
  },
  QUOTA_EXCEEDED: {
    icon: AlertCircle,
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    badgeDot: 'bg-red-600',
    label: 'Quota Exceeded',
  },
  USAGE_SPIKE: {
    icon: TrendingUp,
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-700',
    badgeDot: 'bg-purple-600',
    label: 'Usage Spike',
  },
};

// ---------------------------------------------------------------------------
// Alert type badge
// ---------------------------------------------------------------------------

function AlertTypeBadge({ type }: { type: AlertType }) {
  const config = ALERT_TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.badgeBg,
        config.badgeText,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Single alert row
// ---------------------------------------------------------------------------

function AlertRow({
  alert,
  onAcknowledge,
  isAcknowledging,
  isAnyAcknowledging,
}: {
  alert: AiAlert;
  onAcknowledge: (id: string) => void;
  /** Whether this specific alert is being acknowledged (shows spinner) */
  isAcknowledging: boolean;
  /** Whether any alert is being acknowledged (disables all buttons) */
  isAnyAcknowledging: boolean;
}) {
  const config = ALERT_TYPE_CONFIG[alert.type];

  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-[var(--radius-card)] border border-border bg-card p-4',
        'transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]',
        alert.acknowledged && 'opacity-60',
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          config.badgeBg,
        )}
      >
        <config.icon className={cn('h-4 w-4', config.badgeText)} aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <AlertTypeBadge type={alert.type} />
          <Link
            to="/tenants/$tenantId"
            params={{ tenantId: alert.tenantId }}
            className="text-sm font-medium text-primary hover:text-[var(--primary-dark)] hover:underline"
          >
            {alert.tenantName}
          </Link>
          <span className="font-mono text-xs text-muted-foreground">{alert.tenantCode}</span>
        </div>

        <p className="mb-1 text-sm text-foreground">{alert.message}</p>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Usage: {alert.usagePct.toFixed(1)}%</span>
          {alert.threshold !== null && <span>Threshold: {alert.threshold.toFixed(0)}%</span>}
          <span>{formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}</span>
          {alert.acknowledged && alert.acknowledgedBy && (
            <span className="flex items-center gap-1 text-green-600">
              <Check className="h-3 w-3" />
              Acknowledged
            </span>
          )}
        </div>
      </div>

      {/* Acknowledge button — PLATFORM_ADMIN only */}
      {!alert.acknowledged && (
        <RequirePlatformRole roles={['PLATFORM_ADMIN']}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAcknowledge(alert.id)}
            disabled={isAnyAcknowledging}
            aria-label={`Acknowledge alert for ${alert.tenantName}`}
          >
            {isAcknowledging ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Acknowledge
          </Button>
        </RequirePlatformRole>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyAlerts() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <CheckCircle2 className="mb-3 h-12 w-12 text-green-500" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">No active alerts</p>
      <p className="mt-1 text-xs text-muted-foreground">
        All tenants are within their usage limits.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter controls
// ---------------------------------------------------------------------------

const ALERT_TYPE_OPTIONS: Array<{ value: AlertType | ''; label: string }> = [
  { value: '', label: 'All Types' },
  { value: 'QUOTA_WARNING', label: 'Quota Warning' },
  { value: 'QUOTA_EXCEEDED', label: 'Quota Exceeded' },
  { value: 'USAGE_SPIKE', label: 'Usage Spike' },
];

const ACKNOWLEDGED_OPTIONS = [
  { value: '', label: 'Active' },
  { value: 'true', label: 'Acknowledged' },
  { value: 'all', label: 'All' },
] as const;

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AiAlertsTab() {
  const [typeFilter, setTypeFilter] = useState<AlertType | ''>('');
  const [acknowledgedFilter, setAcknowledgedFilter] = useState<'' | 'true' | 'all'>('');

  const filters: AiAlertsFilters = {};
  if (typeFilter) filters.type = typeFilter;
  if (acknowledgedFilter === '') filters.acknowledged = false;
  else if (acknowledgedFilter === 'true') filters.acknowledged = true;
  // 'all' = no acknowledged filter

  const { data: alerts, isLoading, error, refetch } = useAiAlerts(filters);
  const acknowledgeMutation = useAcknowledgeAlert();

  const handleAcknowledge = (alertId: string) => {
    acknowledgeMutation.mutate(alertId);
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label htmlFor="alert-type-filter" className="sr-only">
            Filter by alert type
          </label>
          <select
            id="alert-type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as AlertType | '')}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {ALERT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="alert-acknowledged-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="alert-acknowledged-filter"
            value={acknowledgedFilter}
            onChange={(e) => setAcknowledgedFilter(e.target.value as '' | 'true' | 'all')}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {ACKNOWLEDGED_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alert list */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-destructive">
          <p className="text-sm">Failed to load alerts</p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : !alerts || alerts.length === 0 ? (
        <EmptyAlerts />
      ) : (
        <div className="space-y-3" role="list" aria-label="AI usage alerts">
          {alerts.map((alert) => (
            <div key={alert.id} role="listitem">
              <AlertRow
                alert={alert}
                onAcknowledge={handleAcknowledge}
                isAcknowledging={
                  acknowledgeMutation.isPending && acknowledgeMutation.variables === alert.id
                }
                isAnyAcknowledging={acknowledgeMutation.isPending}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
