/**
 * TaskDetailSheet — slide-in panel for viewing and editing a single task.
 *
 * Used by MyTasksPage (full mode) and TaskPanel (panel mode via deleteMode/showTimeline props).
 * All mutations wired via React Query hooks, all strings i18n'd.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CalendarIcon, Check, ExternalLink, Pencil, Play, Plus, Trash2, X } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

import type { Task, TaskPriority, TaskStatus } from '../types';
import { STATUS_I18N_KEYS } from '../types';
import {
  useAddAssignee,
  useChangeTaskStatus,
  useDeleteTask,
  useRemoveAssignee,
  useUpdateTask,
} from '../hooks/use-tasks';
import { getEntityDisplayName, getEntityRoute } from '../utils/entity-routes';
import {
  formatDueDate,
  formatDateTime,
  getInitials,
  isOverdue,
  overdueDays,
} from '../utils/task-helpers';
import { TaskOverdueBadge } from './TaskOverdueBadge';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { UserMultiSelect } from './UserMultiSelect';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TaskDetailSheetProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'alert-dialog' (default) uses an AlertDialog; 'confirm' uses window.confirm. */
  deleteMode?: 'alert-dialog' | 'confirm';
  /** Whether to show the activity timeline section. Default true. */
  showTimeline?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  deleteMode = 'alert-dialog',
  showTimeline = true,
}: TaskDetailSheetProps) {
  const { t } = useI18n();

  // Mutations
  const updateTask = useUpdateTask();
  const changeStatus = useChangeTaskStatus();
  const addAssignee = useAddAssignee();
  const removeAssignee = useRemoveAssignee();
  const deleteTaskMutation = useDeleteTask();

  // Inline title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Inline description editing
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');

  // Popovers
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);

  // Reset editing state when task changes
  useEffect(() => {
    setIsEditingTitle(false);
    setIsEditingDesc(false);
    setAssigneePopoverOpen(false);
  }, [task?.id]);

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Handlers
  const handleStatusChange = useCallback(
    (status: TaskStatus) => {
      if (!task) return;
      changeStatus.mutate({ id: task.id, status });
    },
    [task, changeStatus],
  );

  const handleTitleSave = useCallback(() => {
    if (!task) return;
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title) {
      updateTask.mutate({ id: task.id, input: { title: trimmed } });
    }
    setIsEditingTitle(false);
  }, [task, editTitle, updateTask]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleTitleSave();
      if (e.key === 'Escape') setIsEditingTitle(false);
    },
    [handleTitleSave],
  );

  const handleDescSave = useCallback(() => {
    if (!task) return;
    const trimmed = editDesc.trim();
    if (trimmed !== (task.description ?? '')) {
      updateTask.mutate({ id: task.id, input: { description: trimmed || undefined } });
    }
    setIsEditingDesc(false);
  }, [task, editDesc, updateTask]);

  const handlePriorityChange = useCallback(
    (value: string) => {
      if (!task) return;
      updateTask.mutate({ id: task.id, input: { priority: value as TaskPriority } });
    },
    [task, updateTask],
  );

  const handleDueDateChange = useCallback(
    (date: Date | undefined) => {
      if (!task) return;
      updateTask.mutate({
        id: task.id,
        input: { dueDate: date ? date.toISOString() : undefined },
      });
      setCalendarOpen(false);
    },
    [task, updateTask],
  );

  const handleAddAssignee = useCallback(
    (userIds: string[]) => {
      if (!task) return;
      const existingIds = new Set(task.assignees.map((a) => a.userId));
      for (const userId of userIds) {
        if (!existingIds.has(userId)) {
          addAssignee.mutate({ taskId: task.id, userId });
        }
      }
      setAssigneePopoverOpen(false);
    },
    [task, addAssignee],
  );

  const handleRemoveAssignee = useCallback(
    (userId: string) => {
      if (!task) return;
      removeAssignee.mutate({ taskId: task.id, userId });
    },
    [task, removeAssignee],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!task) return;
    deleteTaskMutation.mutate(task.id);
    onOpenChange(false);
  }, [task, deleteTaskMutation, onOpenChange]);

  const handleDeleteClick = useCallback(() => {
    if (deleteMode === 'confirm') {
      if (window.confirm(t('tasks.detail.deleteConfirm'))) {
        handleDeleteConfirm();
      }
    }
  }, [deleteMode, t, handleDeleteConfirm]);

  if (!task) return null;

  const taskOverdue = isOverdue(task);
  const taskOverdueDays = overdueDays(task);
  const isTerminal = task.status === 'COMPLETED' || task.status === 'CANCELLED';
  const linkedRecordRoute =
    task.entityType && task.entityId ? getEntityRoute(task.entityType, task.entityId) : null;
  const linkedRecordLabel =
    task.entityType && task.entityId
      ? `${getEntityDisplayName(task.entityType)} ${task.entityId}`
      : null;

  // Build activity timeline from timestamped metadata only.
  // Assignee entries are omitted because the API doesn't provide per-assignee
  // timestamps — they are already shown in the Assignees section above.
  const timeline: { label: string; date: string }[] = showTimeline
    ? [
        { label: t('tasks.detail.taskCreated'), date: formatDateTime(task.createdAt) },
        ...(task.completedAt
          ? [{ label: t('tasks.detail.taskCompleted'), date: formatDateTime(task.completedAt) }]
          : []),
      ]
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="shrink-0 border-b border-border px-5 py-4">
          <SheetTitle className="font-serif text-base">{t('tasks.detail.title')}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-5 p-5">
            {/* Title — inline editable */}
            <div className="flex items-start gap-2">
              {isEditingTitle ? (
                <Input
                  ref={titleInputRef}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={handleTitleKeyDown}
                  className="flex-1 text-base font-semibold focus-visible:ring-[#7c3aed]/30"
                />
              ) : (
                <h2
                  className={`flex-1 text-base font-semibold leading-snug ${
                    isTerminal ? 'text-muted-foreground line-through' : 'text-foreground'
                  }`}
                >
                  {task.title}
                </h2>
              )}
              {!isTerminal && !isEditingTitle && (
                <button
                  type="button"
                  onClick={() => {
                    setEditTitle(task.title);
                    setIsEditingTitle(true);
                  }}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status + Actions */}
            <div className="rounded-lg border border-border bg-[#f9fafb] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('tasks.detail.status')}: {t(STATUS_I18N_KEYS[task.status])}
              </p>
              <div className="flex items-center gap-2">
                {task.status === 'OPEN' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleStatusChange('IN_PROGRESS')}
                      className="h-7 gap-1 bg-[#3b82f6] text-xs text-white hover:bg-[#2563eb]"
                      disabled={changeStatus.isPending}
                    >
                      <Play className="h-3 w-3" /> {t('tasks.detail.start')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange('COMPLETED')}
                      className="h-7 gap-1 text-xs border-border hover:bg-[#d1fae5]"
                      disabled={changeStatus.isPending}
                    >
                      <Check className="h-3 w-3" /> {t('tasks.detail.complete')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange('CANCELLED')}
                      className="h-7 gap-1 text-xs border-border text-muted-foreground hover:bg-[#fee2e2]"
                      disabled={changeStatus.isPending}
                    >
                      <X className="h-3 w-3" /> {t('tasks.detail.cancel')}
                    </Button>
                  </>
                )}
                {task.status === 'IN_PROGRESS' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange('COMPLETED')}
                      className="h-7 gap-1 text-xs border-border hover:bg-[#d1fae5]"
                      disabled={changeStatus.isPending}
                    >
                      <Check className="h-3 w-3" /> {t('tasks.detail.complete')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange('CANCELLED')}
                      className="h-7 gap-1 text-xs border-border text-muted-foreground hover:bg-[#fee2e2]"
                      disabled={changeStatus.isPending}
                    >
                      <X className="h-3 w-3" /> {t('tasks.detail.cancel')}
                    </Button>
                  </>
                )}
                {task.status === 'COMPLETED' && (
                  <span className="flex items-center gap-1 text-xs font-medium text-[#10b981]">
                    <Check className="h-3.5 w-3.5" />{' '}
                    {task.completedAt
                      ? t('tasks.detail.completedOn', { date: formatDateTime(task.completedAt) })
                      : t('tasks.status.completed')}
                  </span>
                )}
                {task.status === 'CANCELLED' && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('tasks.status.cancelled')}
                  </span>
                )}
              </div>
            </div>

            {/* Description — inline editable */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('tasks.create.description')}
                </p>
                {!isTerminal && !isEditingDesc && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditDesc(task.description ?? '');
                      setIsEditingDesc(true);
                    }}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
              {isEditingDesc ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-[#7c3aed]/30"
                    autoFocus
                  />
                  <div className="flex justify-end gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingDesc(false)}
                      className="h-7 text-xs"
                    >
                      {t('tasks.detail.cancel')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleDescSave}
                      className="h-7 bg-[#7c3aed] text-xs text-white hover:bg-[#5b21b6]"
                    >
                      {t('tasks.detail.save')}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-foreground">
                  {task.description || t('tasks.detail.noDescription')}
                </p>
              )}
            </div>

            {/* Details grid: Priority + Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('tasks.create.priority')}
                </p>
                {isTerminal ? (
                  <TaskPriorityBadge priority={task.priority} />
                ) : (
                  <Select value={task.priority} onValueChange={handlePriorityChange}>
                    <SelectTrigger className="h-8 w-full text-xs focus:ring-[#7c3aed]/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="URGENT">{t('tasks.priority.urgent')}</SelectItem>
                      <SelectItem value="HIGH">{t('tasks.priority.high')}</SelectItem>
                      <SelectItem value="NORMAL">{t('tasks.priority.normal')}</SelectItem>
                      <SelectItem value="LOW">{t('tasks.priority.low')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('tasks.create.dueDate')}
                </p>
                {isTerminal ? (
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-sm ${taskOverdue ? 'font-semibold text-[#ef4444]' : 'text-foreground'}`}
                    >
                      {task.dueDate ? formatDueDate(task.dueDate) : '\u2014'}
                    </span>
                  </div>
                ) : (
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={`h-8 w-full justify-start text-left text-xs font-normal focus:ring-[#7c3aed]/30 ${
                          !task.dueDate ? 'text-muted-foreground' : ''
                        } ${taskOverdue ? 'text-[#ef4444] font-semibold' : ''}`}
                      >
                        <CalendarIcon className="mr-1.5 h-3 w-3" />
                        {task.dueDate ? formatDueDate(task.dueDate) : t('tasks.detail.setDate')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={task.dueDate ? new Date(task.dueDate) : undefined}
                        onSelect={handleDueDateChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
                {taskOverdue && <TaskOverdueBadge days={taskOverdueDays} />}
              </div>
            </div>

            {/* Assignees */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('tasks.detail.assignees')}
              </p>
              <div className="flex flex-col gap-1.5">
                {task.assignees.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-accent"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ede9fe] text-[10px] font-semibold text-[#5b21b6]">
                        {getInitials(a.displayName, a.email)}
                      </div>
                      <span className="text-sm text-foreground">
                        {a.displayName ?? a.email ?? 'Unknown'}
                      </span>
                    </div>
                    {!isTerminal && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAssignee(a.userId)}
                        className="rounded p-0.5 text-muted-foreground hover:text-[#ef4444]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {!isTerminal && (
                  <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-[#7c3aed] hover:bg-[#f5f3ff]"
                      >
                        <Plus className="h-3 w-3" /> {t('tasks.detail.addAssignee')}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2" align="start" sideOffset={4}>
                      <UserMultiSelect
                        value={task.assignees.map((a) => a.userId)}
                        onChange={handleAddAssignee}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>

            {/* Linked Record */}
            {task.entityType && task.entityId && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('tasks.detail.linkedRecord')}
                </p>
                {linkedRecordRoute ? (
                  <Link
                    to={linkedRecordRoute}
                    className="flex items-center justify-between rounded-lg border border-border bg-[#f5f3ff] px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-[#ede9fe]"
                  >
                    <span>{linkedRecordLabel}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#7c3aed]" />
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">{linkedRecordLabel}</span>
                )}
              </div>
            )}

            {/* Activity Timeline */}
            {showTimeline && timeline.length > 0 && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('tasks.detail.activity')}
                </p>
                <div className="relative flex flex-col">
                  {timeline.map((entry, idx) => (
                    <div key={idx} className="relative flex gap-3 pb-4 last:pb-0">
                      {idx < timeline.length - 1 && (
                        <div className="absolute left-[7px] top-4 h-full w-px bg-[#ede9fe]" />
                      )}
                      <div className="relative z-10 mt-0.5">
                        <span className="block h-4 w-4 rounded-full border-[2.5px] border-[#7c3aed] bg-card" />
                      </div>
                      <div>
                        <p className="text-sm text-foreground">{entry.label}</p>
                        <p className="text-xs text-muted-foreground">{entry.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-5 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {t('tasks.detail.created')} {formatDateTime(task.createdAt)}
            </p>
            {deleteMode === 'alert-dialog' ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-[#ef4444] hover:bg-[#fee2e2] hover:text-[#ef4444]"
                  >
                    <Trash2 className="h-3 w-3" /> {t('tasks.detail.delete')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('tasks.detail.delete')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('tasks.detail.deleteConfirm')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('tasks.detail.deleteCancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteConfirm}
                      className="bg-[#ef4444] text-white hover:bg-[#dc2626]"
                    >
                      {t('tasks.detail.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteClick}
                className="h-7 gap-1 text-xs text-[#ef4444] hover:bg-[#fee2e2] hover:text-[#ef4444]"
              >
                <Trash2 className="h-3 w-3" /> {t('tasks.detail.delete')}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
