/**
 * Dashboard bottom cards — Tasks Today + Recent Activity.
 * Visual design from v0 Concept D prototype.
 *
 * TasksCard is wired to the real Task API (E11 endpoints).
 */

import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { CheckSquare, Clock, ArrowRight } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Skeleton } from '@/components/ui/skeleton';

import { useMyTasks, useChangeTaskStatus } from '@/features/tasks/hooks/use-tasks';
import { TaskStatusIcon } from '@/features/tasks/components/TaskStatusIcon';
import { TaskPriorityBadge } from '@/features/tasks/components/TaskPriorityBadge';
import { cycleStatus } from '@/features/tasks/types';
import type { Task } from '@/features/tasks/types';

/* ── Static data (activity card) ───────────────────────────── */

interface Activity {
  initials: string;
  color: string;
  descriptionKey: string;
  timeKey: string;
}

const activities: Activity[] = [
  {
    initials: 'SC',
    color: '#7c3aed',
    descriptionKey: 'dashboard.activity.sarahApproved',
    timeKey: 'dashboard.activity.hoursAgo',
  },
  {
    initials: 'AI',
    color: '#10b981',
    descriptionKey: 'dashboard.activity.aiMatchedPayment',
    timeKey: 'dashboard.activity.threeHoursAgo',
  },
  {
    initials: 'DM',
    color: '#3b82f6',
    descriptionKey: 'dashboard.activity.davidPostedJournal',
    timeKey: 'dashboard.activity.yesterday',
  },
];

/* ── Helpers ────────────────────────────────────────────────── */

/** Returns true if the task is due today or overdue (past due). */
function isDueTodayOrOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  return due <= today;
}

/** Returns true if the task's dueDate is strictly before today. */
function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

/* ── Tasks Card ─────────────────────────────────────────────── */

export function TasksCard() {
  const { t } = useI18n();
  const { tasks: allTasks, isLoading } = useMyTasks();
  const statusMutation = useChangeTaskStatus();

  // Filter to active tasks (OPEN/IN_PROGRESS) that are due today or overdue, limit to 4
  const todayTasks = useMemo(
    () =>
      allTasks
        .filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS')
        .filter(isDueTodayOrOverdue)
        .slice(0, 4),
    [allTasks],
  );

  const activeCount = todayTasks.filter(
    (t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED',
  ).length;

  const handleCycleStatus = (task: Task) => {
    const next = cycleStatus(task.status);
    if (next) {
      statusMutation.mutate({ id: task.id, status: next });
    }
  };

  return (
    <div
      className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
      style={{ animationDelay: '450ms' }}
    >
      <div className="mb-4 flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-[#7c3aed]" />
        <h3 className="font-serif text-sm font-semibold text-foreground">
          {t('tasks.dashboard.title')} ({isLoading ? '…' : activeCount})
        </h3>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4.5 w-4.5 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* Task rows */}
      {!isLoading && (
        <div className="flex flex-col gap-1">
          {todayTasks.map((task) => (
            <div
              key={task.id}
              className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-[#f9fafb]"
            >
              <div className="flex items-center gap-3">
                <TaskStatusIcon
                  status={task.status}
                  overdue={isOverdue(task)}
                  onClick={() => handleCycleStatus(task)}
                />
                <span
                  className={`text-sm ${
                    task.status === 'COMPLETED'
                      ? 'text-muted-foreground line-through'
                      : 'text-foreground'
                  }`}
                >
                  {task.title}
                </span>
              </div>
              <TaskPriorityBadge priority={task.priority} />
            </div>
          ))}

          {/* Empty state */}
          {todayTasks.length === 0 && (
            <p className="py-3 text-center text-sm text-muted-foreground">
              {t('tasks.dashboard.empty')}
            </p>
          )}
        </div>
      )}

      <Link
        to="/tasks"
        className="mt-3 flex items-center gap-1 text-xs font-medium text-[#7c3aed] transition-colors hover:text-[#5b21b6]"
      >
        {t('tasks.dashboard.viewAll')} <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

/* ── Recent Activity Card ───────────────────────────────────── */

export function RecentActivityCard() {
  const { t } = useI18n();

  return (
    <div
      className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
      style={{ animationDelay: '500ms' }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-[#7c3aed]" />
        <h3 className="font-serif text-sm font-semibold text-foreground">
          {t('dashboard.activity.title')}
        </h3>
      </div>
      <div className="flex flex-col gap-3">
        {activities.map((activity, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: activity.color }}
            >
              {activity.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{t(activity.descriptionKey)}</p>
              <p className="text-xs text-muted-foreground">{t(activity.timeKey)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
