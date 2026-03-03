/**
 * Shared constants for automation status badges, trigger type badges,
 * and formatting utilities used across automation list and run pages.
 */

import type {
  AutomationRunStatus,
  AutomationStepRunStatus,
  AutomationTriggerType,
} from '../api/types';

// ─── Run status badge config ────────────────────────────────────────────────

export const RUN_STATUS_CONFIG: Record<AutomationRunStatus, { label: string; dotColor: string }> = {
  COMPLETED: { label: 'Completed', dotColor: 'bg-[#10b981]' },
  FAILED: { label: 'Failed', dotColor: 'bg-[#dc2626]' },
  RUNNING: { label: 'Running', dotColor: 'bg-[#f59e0b]' },
  PENDING: { label: 'Pending', dotColor: 'bg-[#d1d5db]' },
  CANCELLED: { label: 'Cancelled', dotColor: 'bg-[#9ca3af]' },
};

// ─── Step run status badge config ───────────────────────────────────────────

export const STEP_STATUS_CONFIG: Record<
  AutomationStepRunStatus,
  { label: string; dotColor: string; bgColor: string }
> = {
  COMPLETED: { label: 'Completed', dotColor: 'bg-[#10b981]', bgColor: 'bg-[#10b981]' },
  FAILED: { label: 'Failed', dotColor: 'bg-[#dc2626]', bgColor: 'bg-[#dc2626]' },
  RUNNING: { label: 'Running', dotColor: 'bg-[#f59e0b]', bgColor: 'bg-[#f59e0b]' },
  PENDING: { label: 'Pending', dotColor: 'bg-[#d1d5db]', bgColor: 'bg-transparent' },
  SKIPPED: { label: 'Skipped', dotColor: 'bg-[#9ca3af]', bgColor: 'bg-[#9ca3af]' },
};

// ─── Trigger type badge config ──────────────────────────────────────────────

export const TRIGGER_BADGE_CONFIG: Record<
  AutomationTriggerType,
  { label: string; className: string }
> = {
  SCHEDULED: {
    label: 'Scheduled',
    className: 'bg-[#f5f3ff] text-[#7c3aed] border border-[#7c3aed]/20',
  },
  EVENT: {
    label: 'Event',
    className: 'bg-[#eff6ff] text-[#2563eb] border border-[#2563eb]/20',
  },
  CHAIN: {
    label: 'Chain',
    className: 'bg-[#fffbeb] text-[#d97706] border border-[#d97706]/20',
  },
  MANUAL: {
    label: 'Manual',
    className: 'bg-[#f3f4f6] text-[#6b7280] border border-[#6b7280]/20',
  },
};

// ─── Formatting utilities ───────────────────────────────────────────────────

/** Format duration between two timestamps, with handling for in-progress runs. */
export function formatDuration(
  startedAt: string | null,
  completedAt: string | null,
  status: AutomationRunStatus,
): string {
  if (!startedAt) return '\u2014';
  const start = new Date(startedAt).getTime();
  if (!completedAt) {
    if (status === 'RUNNING') {
      const elapsed = Math.round((Date.now() - start) / 1000);
      if (elapsed < 60) return `${elapsed}s`;
      const m = Math.floor(elapsed / 60);
      const s = elapsed % 60;
      return s > 0 ? `${m}m ${s}s` : `${m}m`;
    }
    return '\u2014';
  }
  const end = new Date(completedAt).getTime();
  const diffMs = end - start;
  if (diffMs < 0) return '\u2014';
  const totalSeconds = Math.round(diffMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/** Format the triggeredBy field into a human-readable label. */
export function formatTriggeredBy(value: string): string {
  if (value.startsWith('manual:')) return value.slice(7);
  if (value === 'scheduler') return 'Scheduler';
  if (value.startsWith('chain:')) return `Chain: ${value.slice(6)}`;
  if (value.startsWith('retry:')) return `Retry: ${value.slice(6).slice(0, 8)}\u2026`;
  return value;
}

/** Format latency in milliseconds to a human-readable string. */
export function formatLatency(ms: number | null): string {
  if (ms === null) return '\u2014';
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}
