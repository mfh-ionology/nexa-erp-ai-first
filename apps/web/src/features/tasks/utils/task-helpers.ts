/**
 * Shared helper functions for the Task feature module.
 *
 * Consolidates isOverdue, overdueDays, formatDueDate, formatDateTime,
 * and getInitials — previously duplicated across multiple components.
 */

import type { Task } from '../types';

/** Returns true if a task is past its due date and not in a terminal state. */
export function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
  return new Date(task.dueDate) < new Date();
}

/** Returns the number of days past due. */
export function overdueDays(task: Task): number {
  if (!task.dueDate) return 0;
  const diff = Date.now() - new Date(task.dueDate).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

/** Formats an ISO date string for display in tables/lists (e.g., "4 Mar 2026"). */
export function formatDueDate(iso: string, locale = 'en-GB'): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

/** Formats an ISO date string with time (e.g., "4 Mar 2026 14:30"). */
export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Extracts up to 2 initials from a display name or email. */
export function getInitials(displayName: string | null, email: string | null): string {
  if (displayName) {
    return displayName
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  if (email) return email.charAt(0).toUpperCase();
  return '?';
}
