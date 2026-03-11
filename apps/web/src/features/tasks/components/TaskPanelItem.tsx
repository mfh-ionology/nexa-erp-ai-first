/**
 * TaskPanelItem — compact task row for embedded TaskPanel on record detail pages.
 *
 * Replicated from v0 reference `TaskPanelItem` in `task-panel.tsx` with adaptations:
 *   - Real Task type (not mock TaskItem)
 *   - useChangeTaskStatus mutation for status cycling and quick actions
 *   - i18n for labels
 *   - Overdue computation from dueDate
 */

import { Check, Play } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';

import type { Task, TaskStatus } from '../types';
import { useChangeTaskStatus } from '../hooks/use-tasks';
import { isOverdue, overdueDays, formatDueDate } from '../utils/task-helpers';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { TaskStatusIcon } from './TaskStatusIcon';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAssigneeNames(task: Task): string {
  return task.assignees.map((a) => a.displayName ?? a.email ?? 'Unknown').join(', ');
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TaskPanelItemProps {
  task: Task;
  onClick: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskPanelItem({ task, onClick }: TaskPanelItemProps) {
  const { t } = useI18n();
  const changeStatus = useChangeTaskStatus();

  const isActive = task.status === 'OPEN' || task.status === 'IN_PROGRESS';
  const taskOverdue = isOverdue(task);
  const taskOverdueDays = overdueDays(task);

  const handleStatusChange = (status: TaskStatus) => {
    changeStatus.mutate({ id: task.id, status });
  };

  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border border-border/60 p-3 transition-all hover:bg-[#f5f3ff]/50 hover:shadow-sm cursor-pointer"
      onClick={onClick}
    >
      {/* Primary row: status icon, title, priority */}
      <div className="flex items-start gap-2">
        <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
          <TaskStatusIcon
            status={task.status}
            overdue={taskOverdue}
            onClick={() => {
              if (task.status === 'OPEN') handleStatusChange('IN_PROGRESS');
              else if (task.status === 'IN_PROGRESS') handleStatusChange('COMPLETED');
            }}
          />
        </div>
        <span
          className={`flex-1 text-sm font-medium leading-snug ${
            task.status === 'COMPLETED' ? 'text-muted-foreground line-through' : 'text-foreground'
          }`}
        >
          {task.title}
          {taskOverdue && isActive && (
            <span className="ml-1.5 text-xs font-semibold text-[#ef4444]">
              {'\u2014'} {t('tasks.overdueDays', { count: taskOverdueDays })}
            </span>
          )}
        </span>
        <TaskPriorityBadge priority={task.priority} />
      </div>

      {/* Secondary row: assignees + due date */}
      <div className="flex items-center gap-3 pl-6 text-xs text-muted-foreground">
        {task.status === 'COMPLETED' ? (
          <span>
            {t('tasks.status.completed')}
            {task.completedAt && ` \u00B7 ${formatDueDate(task.completedAt)}`}
          </span>
        ) : (
          <>
            {task.assignees.length > 0 && (
              <span className="flex items-center gap-0.5">{getAssigneeNames(task)}</span>
            )}
            {task.dueDate && (
              <span>{t('tasks.panel.dueLabel', { date: formatDueDate(task.dueDate) })}</span>
            )}
          </>
        )}
      </div>

      {/* Quick action buttons */}
      {isActive && (
        <div className="flex items-center gap-1.5 pl-6 pt-0.5" onClick={(e) => e.stopPropagation()}>
          {task.status === 'OPEN' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusChange('IN_PROGRESS')}
              disabled={changeStatus.isPending}
              className="h-6 gap-1 rounded-md px-2 text-[10px] border-border hover:bg-[#dbeafe] hover:text-[#3b82f6] hover:border-[#93c5fd]"
            >
              <Play className="h-2.5 w-2.5" /> {t('tasks.detail.start', 'Start')}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStatusChange('COMPLETED')}
            disabled={changeStatus.isPending}
            className="h-6 gap-1 rounded-md px-2 text-[10px] border-border hover:bg-[#d1fae5] hover:text-[#10b981] hover:border-[#6ee7b7]"
          >
            <Check className="h-2.5 w-2.5" /> {t('tasks.detail.complete', 'Complete')}
          </Button>
        </div>
      )}
    </div>
  );
}
