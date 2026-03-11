// ---------------------------------------------------------------------------
// Shared audit log utilities — used by audit-log page, detail panel, audit tab
// Story: E13b.6
// ---------------------------------------------------------------------------

import { format } from 'date-fns';

/** Format ISO timestamp to DD/MM/YYYY HH:mm:ss display format. */
export function formatAuditTimestamp(iso: string): string {
  try {
    return format(new Date(iso), 'dd/MM/yyyy HH:mm:ss');
  } catch {
    return iso;
  }
}

/** Badge colour class based on action prefix. */
export function actionBadgeClass(action: string): string {
  if (action.startsWith('tenant.')) return 'bg-blue-100 text-blue-700';
  if (action.startsWith('auth.')) return 'bg-green-100 text-green-700';
  if (action.startsWith('user.')) return 'bg-purple-100 text-purple-700';
  if (action.startsWith('platform.')) return 'bg-amber-100 text-amber-700';
  if (action.startsWith('billing.')) return 'bg-orange-100 text-orange-700';
  if (action.startsWith('ai.')) return 'bg-cyan-100 text-cyan-700';
  if (action.startsWith('knowledge.')) return 'bg-teal-100 text-teal-700';
  return 'bg-slate-100 text-slate-700';
}
