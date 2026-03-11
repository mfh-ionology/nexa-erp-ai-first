'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  CheckSquare,
  Play,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Pencil,
  Trash2,
} from 'lucide-react';
import { TaskStatusIcon, TaskPriorityBadge, TaskOverdueBadge } from './task-components';
import {
  MOCK_TASKS,
  STATUS_LABELS,
  type TaskItem,
  type TaskStatus,
  type TaskPriority,
} from './task-types';

/* ─── Task Panel Item ─── */
function TaskPanelItem({
  task,
  onStatusChange,
  onClick,
}: {
  task: TaskItem;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onClick: () => void;
}) {
  const isActive = task.status === 'OPEN' || task.status === 'IN_PROGRESS';

  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border border-border/60 p-3 transition-all hover:bg-[#f5f3ff]/50 hover:shadow-sm cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
          <TaskStatusIcon
            status={task.status}
            overdue={task.isOverdue}
            onClick={() => {
              if (task.status === 'OPEN') onStatusChange(task.id, 'IN_PROGRESS');
              else if (task.status === 'IN_PROGRESS') onStatusChange(task.id, 'COMPLETED');
            }}
          />
        </div>
        <span
          className={`flex-1 text-sm font-medium leading-snug ${task.status === 'COMPLETED' ? 'text-muted-foreground line-through' : 'text-foreground'}`}
        >
          {task.title}
          {task.isOverdue && isActive && (
            <span className="ml-1.5 text-xs font-semibold text-[#ef4444]">
              {'\u2014'} overdue {task.overdueDays}d
            </span>
          )}
        </span>
        <TaskPriorityBadge priority={task.priority} />
      </div>
      <div className="flex items-center gap-3 pl-6 text-xs text-muted-foreground">
        {task.status === 'COMPLETED' ? (
          <span>
            Completed by {task.completedBy} {'\u00B7'} {task.completedAt}
          </span>
        ) : (
          <>
            <span className="flex items-center gap-0.5">
              {task.assignees.map((a) => a.name).join(', ')}
            </span>
            {task.dueDate && <span>Due: {task.dueDate}</span>}
          </>
        )}
      </div>
      {isActive && (
        <div className="flex items-center gap-1.5 pl-6 pt-0.5" onClick={(e) => e.stopPropagation()}>
          {task.status === 'OPEN' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusChange(task.id, 'IN_PROGRESS')}
              className="h-6 gap-1 rounded-md px-2 text-[10px] border-border hover:bg-[#dbeafe] hover:text-[#3b82f6] hover:border-[#93c5fd]"
            >
              <Play className="h-2.5 w-2.5" /> Start
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onStatusChange(task.id, 'COMPLETED')}
            className="h-6 gap-1 rounded-md px-2 text-[10px] border-border hover:bg-[#d1fae5] hover:text-[#10b981] hover:border-[#6ee7b7]"
          >
            <Check className="h-2.5 w-2.5" /> Complete
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─── Inline Create Dialog ─── */
function PanelCreateDialog({
  open,
  onOpenChange,
  entityLabel,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityLabel: string;
  onCreate: (task: Partial<TaskItem>) => void;
}) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [dueDate, setDueDate] = useState('');

  const reset = () => {
    setTitle('');
    setPriority('NORMAL');
    setDueDate('');
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    onCreate({ title: title.trim(), priority, dueDate: dueDate || null });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[480px] animate-step-in">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">Add Task</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Title <span className="text-[#ef4444]">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              className="focus-visible:ring-[#7c3aed]/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Priority
              </Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="focus:ring-[#7c3aed]/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Due Date
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="focus-visible:ring-[#7c3aed]/30"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Linked Record
            </Label>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-[#f5f3ff] px-3 py-2.5 text-sm text-foreground">
              {entityLabel}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
              Add Task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Task Detail Sheet (Panel version) ─── */
function PanelDetailSheet({
  task,
  open,
  onOpenChange,
  onStatusChange,
  onDelete,
}: {
  task: TaskItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}) {
  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="shrink-0 border-b border-border px-5 py-4">
          <SheetTitle className="font-serif text-base">Task Detail</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-2">
              <h2
                className={`flex-1 text-base font-semibold leading-snug ${task.status === 'COMPLETED' ? 'text-muted-foreground line-through' : 'text-foreground'}`}
              >
                {task.title}
              </h2>
              <button className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="rounded-lg border border-border bg-[#f9fafb] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status: {STATUS_LABELS[task.status]}
              </p>
              <div className="flex items-center gap-2">
                {task.status === 'OPEN' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => onStatusChange(task.id, 'IN_PROGRESS')}
                      className="h-7 gap-1 bg-[#3b82f6] text-xs text-white hover:bg-[#2563eb]"
                    >
                      <Play className="h-3 w-3" /> Start
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onStatusChange(task.id, 'COMPLETED')}
                      className="h-7 gap-1 text-xs border-border hover:bg-[#d1fae5]"
                    >
                      <Check className="h-3 w-3" /> Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onStatusChange(task.id, 'CANCELLED')}
                      className="h-7 gap-1 text-xs border-border text-muted-foreground hover:bg-[#fee2e2]"
                    >
                      <X className="h-3 w-3" /> Cancel
                    </Button>
                  </>
                )}
                {task.status === 'IN_PROGRESS' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onStatusChange(task.id, 'COMPLETED')}
                      className="h-7 gap-1 text-xs border-border hover:bg-[#d1fae5]"
                    >
                      <Check className="h-3 w-3" /> Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onStatusChange(task.id, 'CANCELLED')}
                      className="h-7 gap-1 text-xs border-border text-muted-foreground hover:bg-[#fee2e2]"
                    >
                      <X className="h-3 w-3" /> Cancel
                    </Button>
                  </>
                )}
                {task.status === 'COMPLETED' && (
                  <span className="flex items-center gap-1 text-xs font-medium text-[#10b981]">
                    <Check className="h-3.5 w-3.5" /> Completed
                  </span>
                )}
                {task.status === 'CANCELLED' && (
                  <span className="text-xs font-medium text-muted-foreground">Cancelled</span>
                )}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Description
              </p>
              <p className="text-sm leading-relaxed text-foreground">
                {task.description || 'No description.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Priority
                </p>
                <TaskPriorityBadge priority={task.priority} />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Due Date
                </p>
                <span
                  className={`text-sm ${task.isOverdue ? 'font-semibold text-[#ef4444]' : 'text-foreground'}`}
                >
                  {task.dueDate || '\u2014'}
                </span>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Assignees
              </p>
              {task.assignees.map((a) => (
                <div key={a.id} className="flex items-center gap-2 py-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ede9fe] text-[10px] font-semibold text-[#5b21b6]">
                    {a.initials}
                  </div>
                  <span className="text-sm text-foreground">{a.name}</span>
                </div>
              ))}
            </div>

            {task.record && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Linked Record
                </p>
                <Link
                  href={task.record.href}
                  className="flex items-center justify-between rounded-lg border border-border bg-[#f5f3ff] px-3 py-2.5 text-sm text-foreground hover:bg-[#ede9fe]"
                >
                  <span>{task.record.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-[#7c3aed]" />
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border px-5 py-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Created: {task.createdAt}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onDelete(task.id);
              onOpenChange(false);
            }}
            className="h-7 gap-1 text-xs text-[#ef4444] hover:bg-[#fee2e2] hover:text-[#ef4444]"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Main TaskPanel ─── */
export function TaskPanel({
  entityType,
  entityId,
  entityLabel,
}: {
  entityType: string;
  entityId: string;
  entityLabel?: string;
}) {
  // Filter mock tasks that are linked to this entity type
  const [tasks, setTasks] = useState<TaskItem[]>(() =>
    MOCK_TASKS.filter((t) => t.record?.type === entityType).slice(0, 4),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<TaskItem | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const activeTasks = tasks.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'CANCELLED');

  const handleStatusChange = (id: string, status: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status,
              isOverdue: status === 'COMPLETED' || status === 'CANCELLED' ? false : t.isOverdue,
              completedAt: status === 'COMPLETED' ? '4 Mar 2026 15:00' : t.completedAt,
              completedBy: status === 'COMPLETED' ? 'Sarah Chen' : t.completedBy,
            }
          : t,
      ),
    );
    if (detailTask?.id === id) setDetailTask(null);
  };

  const handleDelete = (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const handleCreate = (partial: Partial<TaskItem>) => {
    const newTask: TaskItem = {
      id: `task-panel-${Date.now()}`,
      title: partial.title || '',
      description: '',
      priority: partial.priority || 'NORMAL',
      status: 'OPEN',
      dueDate: partial.dueDate || null,
      isOverdue: false,
      record: { type: entityType, code: entityId, label: entityLabel || entityId, href: '#' },
      assignees: [{ id: 'u1', name: 'Sarah Chen', initials: 'SC' }],
      createdAt: '4 Mar 2026 15:00',
      createdBy: 'Sarah Chen',
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  return (
    <div className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-[#7c3aed]" />
          <h3 className="font-serif text-sm font-semibold text-foreground">
            Tasks ({activeTasks.length})
          </h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setCreateOpen(true)}
          className="h-7 gap-1 text-xs border-border text-foreground hover:bg-[#f5f3ff]"
        >
          <Plus className="h-3 w-3" /> Add Task
        </Button>
      </div>

      {/* Active tasks */}
      {activeTasks.length === 0 && completedTasks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <CheckSquare className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No tasks for this record</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreateOpen(true)}
            className="h-7 gap-1 text-xs border-border text-[#7c3aed] hover:bg-[#f5f3ff]"
          >
            <Plus className="h-3 w-3" /> Add Task
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {activeTasks.map((task) => (
            <TaskPanelItem
              key={task.id}
              task={task}
              onStatusChange={handleStatusChange}
              onClick={() => setDetailTask(task)}
            />
          ))}
        </div>
      )}

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent"
          >
            <span>Completed ({completedTasks.length})</span>
            {showCompleted ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {showCompleted && (
            <div className="mt-2 flex flex-col gap-2">
              {completedTasks.map((task) => (
                <TaskPanelItem
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                  onClick={() => setDetailTask(task)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <PanelCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        entityLabel={entityLabel || `${entityType} ${entityId}`}
        onCreate={handleCreate}
      />

      {/* Detail Sheet */}
      <PanelDetailSheet
        task={detailTask}
        open={!!detailTask}
        onOpenChange={(open) => !open && setDetailTask(null)}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
      />
    </div>
  );
}
