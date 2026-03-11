// ---------------------------------------------------------------------------
// StatusBadge — Reusable colour-coded status badge with dot indicator
// Story: E13b.2 Task 1.3
// ---------------------------------------------------------------------------

import { cn } from '@/lib/utils';
import type { BillingStatus, TenantStatus } from '@/types/tenant';

const TENANT_STATUS_STYLES: Record<
  TenantStatus,
  { dot: string; bg: string; text: string; label: string }
> = {
  ACTIVE: { dot: 'bg-green-600', bg: 'bg-green-100', text: 'text-green-600', label: 'Active' },
  SUSPENDED: { dot: 'bg-red-600', bg: 'bg-red-100', text: 'text-red-600', label: 'Suspended' },
  READ_ONLY: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-100',
    text: 'text-amber-500',
    label: 'Read Only',
  },
  ARCHIVED: { dot: 'bg-slate-400', bg: 'bg-slate-100', text: 'text-slate-400', label: 'Archived' },
  PROVISIONING: {
    dot: 'bg-slate-500',
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    label: 'Provisioning',
  },
};

const BILLING_STATUS_STYLES: Record<
  BillingStatus,
  { dot: string; bg: string; text: string; label: string }
> = {
  CURRENT: { dot: 'bg-green-600', bg: 'bg-green-100', text: 'text-green-600', label: 'Current' },
  GRACE: { dot: 'bg-amber-500', bg: 'bg-amber-100', text: 'text-amber-500', label: 'Grace' },
  OVERDUE: { dot: 'bg-red-500', bg: 'bg-red-100', text: 'text-red-500', label: 'Overdue' },
  BLOCKED: { dot: 'bg-red-700', bg: 'bg-red-100', text: 'text-red-700', label: 'Blocked' },
};

type StatusBadgeProps =
  | { status: TenantStatus; billingStatus?: never; className?: string }
  | { status?: never; billingStatus: BillingStatus; className?: string };

export function StatusBadge({ status, billingStatus, className }: StatusBadgeProps) {
  const styles = status ? TENANT_STATUS_STYLES[status] : BILLING_STATUS_STYLES[billingStatus!];

  if (!styles) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles.bg,
        styles.text,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} />
      {styles.label}
    </span>
  );
}
