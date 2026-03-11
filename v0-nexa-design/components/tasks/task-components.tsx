'use client';

import Link from 'next/link';
import { Circle, CircleDot, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { TaskStatus, TaskPriority } from './task-types';
import { PRIORITY_CONFIG } from './task-types';

/* ─── TaskStatusIcon ─── */
const statusIconMap: Record<TaskStatus, { icon: typeof Circle; color: string }> = {
  OPEN: { icon: Circle, color: '#9ca3af' },
  IN_PROGRESS: { icon: CircleDot, color: '#3b82f6' },
  COMPLETED: { icon: CheckCircle2, color: '#10b981' },
  CANCELLED: { icon: XCircle, color: '#9ca3af' },
};

export function TaskStatusIcon({
  status,
  onClick,
  overdue,
  className = '',
}: {
  status: TaskStatus;
  onClick?: () => void;
  overdue?: boolean;
  className?: string;
}) {
  const { icon: Icon, color } = statusIconMap[status];
  const effectiveColor =
    overdue && (status === 'OPEN' || status === 'IN_PROGRESS') ? '#ef4444' : color;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={status === 'COMPLETED' || status === 'CANCELLED'}
      className={`shrink-0 transition-transform hover:scale-110 disabled:cursor-default disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]/30 rounded ${className}`}
      aria-label={`Task status: ${status.replace('_', ' ').toLowerCase()}`}
    >
      <Icon className="h-4.5 w-4.5" style={{ color: effectiveColor }} />
    </button>
  );
}

/* ─── TaskPriorityBadge ─── */
export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none"
      style={{
        backgroundColor: cfg.bg,
        color: cfg.color,
        border: cfg.border ? `1px solid ${cfg.border}` : undefined,
      }}
    >
      {cfg.label}
    </span>
  );
}

/* ─── TaskOverdueBadge ─── */
export function TaskOverdueBadge({ days }: { days?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[#ef4444]">
      <AlertTriangle className="h-3 w-3" />
      <span className="text-xs font-semibold">{days ? `Overdue ${days}d` : 'Overdue'}</span>
    </span>
  );
}

/* ─── EntityLink ─── */
export function EntityLink({ code, href }: { code: string; href: string }) {
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className="font-mono text-xs text-[#7c3aed] transition-colors hover:text-[#5b21b6] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]/30 rounded"
    >
      {code}
    </Link>
  );
}

/* ─── AvatarGroup ─── */
export function AssigneeAvatars({
  assignees,
  max = 3,
}: {
  assignees: { id: string; name: string; initials: string }[];
  max?: number;
}) {
  const visible = assignees.slice(0, max);
  const overflow = assignees.length - max;
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((a) => (
        <div
          key={a.id}
          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-[#ede9fe] text-[9px] font-semibold text-[#5b21b6]"
          title={a.name}
        >
          {a.initials}
        </div>
      ))}
      {overflow > 0 && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-secondary text-[9px] font-semibold text-muted-foreground">
          +{overflow}
        </div>
      )}
    </div>
  );
}
