/**
 * MyTasksPage — centralised task management page (T1 Entity List template).
 *
 * Replicated from v0 reference `MyTasksPage` with adaptations:
 *   - useMyTasks() React Query hook instead of local state
 *   - i18n for all labels
 *   - TanStack Router navigation
 *   - Skeleton loading state
 *   - Responsive: desktop=full table, tablet=hide Assignees, phone=card layout
 *   - Batch actions bar with Complete All, Reassign, Cancel
 *   - Status chip tabs with counts
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckSquare, Plus, Search, X } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import type { Task, ViewFilter } from '../types';
import { STATUS_I18N_KEYS, cycleStatus } from '../types';
import {
  useBatchCancelStatus,
  useBatchCompleteStatus,
  useChangeTaskStatus,
  useMyTasks,
} from '../hooks/use-tasks';
import { isOverdue, overdueDays, formatDueDate } from '../utils/task-helpers';
import { AssigneeAvatars } from '../components/AssigneeAvatars';
import { CreateTaskDialog } from '../components/CreateTaskDialog';
import { EntityLink } from '../components/EntityLink';
import { TaskDetailSheet } from '../components/TaskDetailSheet';
import { TaskOverdueBadge } from '../components/TaskOverdueBadge';
import { TaskPriorityBadge } from '../components/TaskPriorityBadge';
import { TaskStatusIcon } from '../components/TaskStatusIcon';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MyTasksPage() {
  const { t } = useI18n();

  // State
  const [view, setView] = useState<ViewFilter>('all');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Query — fetch all tasks, filter by priority/search server-side only.
  // Status and overdue filtering is done client-side so tab counts stay accurate.
  const queryParams = useMemo(() => {
    const params: Record<string, string | number | undefined> = {};
    if (priorityFilter !== 'all') params.priority = priorityFilter;
    if (search.trim()) params.search = search.trim();
    return params;
  }, [priorityFilter, search]);

  const { tasks, isLoading } = useMyTasks(queryParams);

  // Sync detailTask with fresh query data after mutations
  const detailTaskIdRef = useRef<string | null>(null);
  detailTaskIdRef.current = detailTask?.id ?? null;
  useEffect(() => {
    if (detailTaskIdRef.current) {
      const fresh = tasks.find((t) => t.id === detailTaskIdRef.current);
      if (fresh) setDetailTask(fresh);
    }
  }, [tasks]);

  // Mutations
  const changeStatus = useChangeTaskStatus();
  const batchComplete = useBatchCompleteStatus();
  const batchCancel = useBatchCancelStatus();

  // Derived data — counts computed from full dataset (before view filtering)
  const counts = useMemo(
    () => ({
      all: tasks.length,
      open: tasks.filter((t) => t.status === 'OPEN').length,
      in_progress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      overdue: tasks.filter((t) => isOverdue(t)).length,
    }),
    [tasks],
  );

  // Apply view tab filter client-side
  const filteredTasks = useMemo(() => {
    switch (view) {
      case 'open':
        return tasks.filter((t) => t.status === 'OPEN');
      case 'in_progress':
        return tasks.filter((t) => t.status === 'IN_PROGRESS');
      case 'overdue':
        return tasks.filter((t) => isOverdue(t));
      default:
        return tasks;
    }
  }, [tasks, view]);

  // Selection
  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const allSelected = filteredTasks.length > 0 && filteredTasks.every((t) => selected.has(t.id));
  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredTasks.map((t) => t.id)));
    }
  }, [allSelected, filteredTasks]);

  // Status cycle handler
  const handleCycleStatus = useCallback(
    (task: Task) => {
      const next = cycleStatus(task.status);
      if (next) {
        changeStatus.mutate({ id: task.id, status: next });
      }
    },
    [changeStatus],
  );

  // Batch actions
  const handleBatchComplete = useCallback(() => {
    const ids = Array.from(selected);
    batchComplete.mutate(ids);
    setSelected(new Set());
  }, [selected, batchComplete]);

  const handleBatchCancel = useCallback(() => {
    const ids = Array.from(selected);
    batchCancel.mutate(ids);
    setSelected(new Set());
  }, [selected, batchCancel]);

  // View tabs config
  const views: { value: ViewFilter; label: string; count: number }[] = [
    { value: 'all', label: t('tasks.tabs.all'), count: counts.all },
    { value: 'open', label: t('tasks.tabs.open'), count: counts.open },
    { value: 'in_progress', label: t('tasks.tabs.inProgress'), count: counts.in_progress },
    { value: 'overdue', label: t('tasks.tabs.overdue'), count: counts.overdue },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-4 animate-fade-in-up">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-1.5">
              <CheckSquare className="h-4 w-4" /> {t('tasks.title')}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div
        className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up"
        style={{ animationDelay: '50ms' }}
      >
        <h1 className="font-serif text-3xl font-bold text-foreground">{t('tasks.title')}</h1>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
        >
          <Plus className="h-4 w-4" /> {t('tasks.create.title')}
        </Button>
      </div>

      {/* View pills */}
      <div
        className="mb-4 flex items-center gap-1.5 animate-fade-in-up"
        style={{ animationDelay: '75ms' }}
      >
        {views.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => {
              setView(v.value);
              setSelected(new Set());
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              view === v.value
                ? 'bg-[#7c3aed] text-white'
                : 'bg-secondary text-muted-foreground hover:bg-accent'
            }`}
          >
            {v.label} ({v.count})
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div
        className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center animate-fade-in-up"
        style={{ animationDelay: '85ms' }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('tasks.search', 'Search tasks...')}
            className="pl-9 focus-visible:ring-[#7c3aed]/30"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px] focus:ring-[#7c3aed]/30">
            <SelectValue placeholder={t('tasks.create.priority')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('tasks.filter.allPriorities', 'All Priorities')}</SelectItem>
            <SelectItem value="URGENT">{t('tasks.priority.urgent')}</SelectItem>
            <SelectItem value="HIGH">{t('tasks.priority.high')}</SelectItem>
            <SelectItem value="NORMAL">{t('tasks.priority.normal')}</SelectItem>
            <SelectItem value="LOW">{t('tasks.priority.low')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#7c3aed]/20 bg-[#f5f3ff] px-4 py-2.5 animate-slide-in">
          <span className="text-sm font-medium text-foreground">
            {t('tasks.batch.selected', { count: selected.size })}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleBatchComplete}
              className="h-7 gap-1 bg-[#10b981] text-xs text-white hover:bg-[#059669]"
              disabled={batchComplete.isPending}
            >
              <Check className="h-3 w-3" /> {t('tasks.batch.completeAll')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-border hover:bg-[#f5f3ff]"
            >
              {t('tasks.batch.reassign')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBatchCancel}
              className="h-7 gap-1 text-xs border-border text-muted-foreground hover:bg-[#fee2e2]"
              disabled={batchCancel.isPending}
            >
              <X className="h-3 w-3" /> {t('tasks.batch.cancel')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              className="h-7 text-xs text-muted-foreground"
            >
              {t('tasks.batch.clear', 'Clear')}
            </Button>
          </div>
        </div>
      )}

      {/* Task Table — Desktop/Tablet */}
      <div
        className="hidden sm:block animate-fade-in-up rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden"
        style={{ animationDelay: '100ms' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-[rgba(107,114,128,0.04)]">
                <th className="w-10 px-3 py-2.5">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    className="data-[state=checked]:bg-[#7c3aed] data-[state=checked]:border-[#7c3aed]"
                  />
                </th>
                <th className="w-8 px-1 py-2.5" />
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('tasks.table.task', 'Task')}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('tasks.create.priority')}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('tasks.table.status', 'Status')}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('tasks.table.due', 'Due')}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('tasks.table.record', 'Record')}
                </th>
                <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                  {t('tasks.detail.assignees')}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows />
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <CheckSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('tasks.empty.noMatch')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="mt-2 text-sm font-medium text-[#7c3aed] hover:underline"
                    >
                      + {t('tasks.empty.createTask')}
                    </button>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const taskOverdue = isOverdue(task);
                  const taskOverdueDays = overdueDays(task);
                  const isTerminal = task.status === 'COMPLETED' || task.status === 'CANCELLED';

                  return (
                    <tr
                      key={task.id}
                      className="border-b border-border/50 transition-colors hover:bg-[#f5f3ff]/50 cursor-pointer last:border-b-0"
                      onClick={() => setDetailTask(task)}
                    >
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(task.id)}
                          onCheckedChange={() => toggleSelect(task.id)}
                          className="data-[state=checked]:bg-[#7c3aed] data-[state=checked]:border-[#7c3aed]"
                        />
                      </td>
                      <td className="px-1 py-3" onClick={(e) => e.stopPropagation()}>
                        <TaskStatusIcon
                          status={task.status}
                          overdue={taskOverdue}
                          onClick={() => handleCycleStatus(task)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm font-medium ${
                            isTerminal ? 'text-muted-foreground line-through' : 'text-foreground'
                          }`}
                        >
                          {task.title}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <TaskPriorityBadge priority={task.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium ${
                            task.status === 'COMPLETED'
                              ? 'text-[#10b981]'
                              : task.status === 'IN_PROGRESS'
                                ? 'text-[#3b82f6]'
                                : 'text-muted-foreground'
                          }`}
                        >
                          {t(STATUS_I18N_KEYS[task.status])}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-sm ${
                              taskOverdue ? 'font-semibold text-[#ef4444]' : 'text-muted-foreground'
                            }`}
                          >
                            {task.dueDate ? formatDueDate(task.dueDate) : '\u2014'}
                          </span>
                          {taskOverdue && !isTerminal && (
                            <TaskOverdueBadge days={taskOverdueDays} />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {task.entityType && task.entityId ? (
                          <EntityLink entityType={task.entityType} entityId={task.entityId} />
                        ) : (
                          <span className="text-xs text-muted-foreground">{'\u2014'}</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <AssigneeAvatars assignees={task.assignees} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task Cards — Phone (< sm) */}
      <div
        className="flex flex-col gap-3 sm:hidden animate-fade-in-up"
        style={{ animationDelay: '100ms' }}
      >
        {isLoading ? (
          <SkeletonCards />
        ) : filteredTasks.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <CheckSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">{t('tasks.empty.noMatch')}</p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-2 text-sm font-medium text-[#7c3aed] hover:underline"
            >
              + {t('tasks.empty.createTask')}
            </button>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const taskOverdue = isOverdue(task);
            const taskOverdueDays = overdueDays(task);
            const isTerminal = task.status === 'COMPLETED' || task.status === 'CANCELLED';

            return (
              <div
                key={task.id}
                className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)] transition-shadow cursor-pointer"
                onClick={() => setDetailTask(task)}
              >
                <div className="flex items-start gap-3">
                  <div onClick={(e) => e.stopPropagation()}>
                    <TaskStatusIcon
                      status={task.status}
                      overdue={taskOverdue}
                      onClick={() => handleCycleStatus(task)}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        isTerminal ? 'text-muted-foreground line-through' : 'text-foreground'
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <TaskPriorityBadge priority={task.priority} />
                      <span
                        className={`text-xs font-medium ${
                          task.status === 'COMPLETED'
                            ? 'text-[#10b981]'
                            : task.status === 'IN_PROGRESS'
                              ? 'text-[#3b82f6]'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {t(STATUS_I18N_KEYS[task.status])}
                      </span>
                      {task.dueDate && (
                        <span
                          className={`text-xs ${
                            taskOverdue ? 'font-semibold text-[#ef4444]' : 'text-muted-foreground'
                          }`}
                        >
                          {formatDueDate(task.dueDate)}
                        </span>
                      )}
                      {taskOverdue && !isTerminal && <TaskOverdueBadge days={taskOverdueDays} />}
                    </div>
                    {task.entityType && task.entityId && (
                      <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                        <EntityLink entityType={task.entityType} entityId={task.entityId} />
                      </div>
                    )}
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(task.id)}
                      onCheckedChange={() => toggleSelect(task.id)}
                      className="data-[state=checked]:bg-[#7c3aed] data-[state=checked]:border-[#7c3aed]"
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dialogs + Sheets */}
      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
      <TaskDetailSheet
        task={detailTask}
        open={!!detailTask}
        onOpenChange={(open) => {
          if (!open) setDetailTask(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Loading States
// ---------------------------------------------------------------------------

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-border/50">
          <td className="px-3 py-3">
            <Skeleton className="h-4 w-4" />
          </td>
          <td className="px-1 py-3">
            <Skeleton className="h-4.5 w-4.5 rounded-full" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-48" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-5 w-16 rounded-full" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-20" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-24" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-24" />
          </td>
          <td className="hidden px-4 py-3 lg:table-cell">
            <div className="flex -space-x-1.5">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

function SkeletonCards() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-4.5 w-4.5 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <Skeleton className="h-4 w-4" />
          </div>
        </div>
      ))}
    </>
  );
}
