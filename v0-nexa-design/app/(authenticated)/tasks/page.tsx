'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Plus,
  Search,
  Play,
  Check,
  X,
  Trash2,
  ExternalLink,
  Pencil,
  CheckSquare,
} from 'lucide-react';
import {
  TaskStatusIcon,
  TaskPriorityBadge,
  TaskOverdueBadge,
  EntityLink,
  AssigneeAvatars,
} from '@/components/tasks/task-components';
import {
  MOCK_TASKS,
  STATUS_LABELS,
  type TaskItem,
  type TaskStatus,
  type TaskPriority,
} from '@/components/tasks/task-types';

type ViewFilter = 'all' | 'open' | 'in_progress' | 'overdue';

function cycleStatus(status: TaskStatus): TaskStatus {
  if (status === 'OPEN') return 'IN_PROGRESS';
  if (status === 'IN_PROGRESS') return 'COMPLETED';
  return status;
}

/* ─── Create Task Dialog ─── */
function CreateTaskDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (task: Partial<TaskItem>) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [dueDate, setDueDate] = useState('');

  const reset = () => {
    setTitle('');
    setDescription('');
    setPriority('NORMAL');
    setDueDate('');
  };

  const handleCreate = (keepOpen: boolean) => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      description,
      priority,
      dueDate: dueDate || null,
      status: 'OPEN',
    });
    reset();
    if (!keepOpen) onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[560px] animate-step-in">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">Create Task</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Title <span className="text-[#ef4444]">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chase Acme Ltd for outstanding payment"
              className="focus-visible:ring-[#7c3aed]/30"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Follow up on invoice INV-00234 which is 15 days overdue..."
              className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-[#7c3aed]/30"
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
              Assignees
            </Label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border p-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#ede9fe] px-2.5 py-1 text-xs font-medium text-[#5b21b6]">
                Sarah Chen{' '}
                <button className="ml-0.5 hover:text-[#ef4444]">
                  <X className="h-3 w-3" />
                </button>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#ede9fe] px-2.5 py-1 text-xs font-medium text-[#5b21b6]">
                Mike Davis{' '}
                <button className="ml-0.5 hover:text-[#ef4444]">
                  <X className="h-3 w-3" />
                </button>
              </span>
              <input
                placeholder="Search..."
                className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Linked Record
            </Label>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-[#f5f3ff] p-2.5 text-sm text-foreground">
              <span className="flex-1">No linked record</span>
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
            <Button
              variant="outline"
              onClick={() => handleCreate(true)}
              className="border-border hover:bg-[#f5f3ff]"
            >
              {'Create & Add Another'}
            </Button>
            <Button
              onClick={() => handleCreate(false)}
              className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
            >
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Task Detail Sheet ─── */
function TaskDetailSheet({
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

  const timeline = [
    { label: `Created by ${task.createdBy}`, date: task.createdAt },
    ...task.assignees.map((a) => ({ label: `Assigned to ${a.name}`, date: task.createdAt })),
    ...(task.completedAt
      ? [{ label: `Completed by ${task.completedBy}`, date: task.completedAt }]
      : []),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="shrink-0 border-b border-border px-5 py-4">
          <SheetTitle className="font-serif text-base">Task Detail</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-5 p-5">
            {/* Title */}
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

            {/* Status + Actions */}
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
                    <Check className="h-3.5 w-3.5" /> Completed{' '}
                    {task.completedAt && `on ${task.completedAt}`}
                  </span>
                )}
                {task.status === 'CANCELLED' && (
                  <span className="text-xs font-medium text-muted-foreground">Cancelled</span>
                )}
              </div>
            </div>

            {/* Details */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-sm ${task.isOverdue ? 'font-semibold text-[#ef4444]' : 'text-foreground'}`}
                  >
                    {task.dueDate || '\u2014'}
                  </span>
                  {task.isOverdue && <TaskOverdueBadge days={task.overdueDays} />}
                </div>
              </div>
            </div>

            {/* Assignees */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Assignees
              </p>
              <div className="flex flex-col gap-1.5">
                {task.assignees.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-accent"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ede9fe] text-[10px] font-semibold text-[#5b21b6]">
                        {a.initials}
                      </div>
                      <span className="text-sm text-foreground">{a.name}</span>
                    </div>
                    <button className="rounded p-0.5 text-muted-foreground hover:text-[#ef4444]">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-[#7c3aed] hover:bg-[#f5f3ff]">
                  <Plus className="h-3 w-3" /> Add Assignee
                </button>
              </div>
            </div>

            {/* Linked Record */}
            {task.record && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Linked Record
                </p>
                <Link
                  href={task.record.href}
                  className="flex items-center justify-between rounded-lg border border-border bg-[#f5f3ff] px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-[#ede9fe]"
                >
                  <span>{task.record.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#7c3aed]" />
                </Link>
              </div>
            )}

            {/* Activity Timeline */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Activity
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
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-5 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Created: {task.createdAt} by {task.createdBy}
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-[#ef4444] hover:bg-[#fee2e2] hover:text-[#ef4444]"
                >
                  <Trash2 className="h-3 w-3" /> Delete Task
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the task.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      onDelete(task.id);
                      onOpenChange(false);
                    }}
                    className="bg-[#ef4444] text-white hover:bg-[#dc2626]"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Main Page ─── */
export default function MyTasksPage() {
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const [view, setView] = useState<ViewFilter>('all');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailTask, setDetailTask] = useState<TaskItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      open: tasks.filter((t) => t.status === 'OPEN').length,
      in_progress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      overdue: tasks.filter(
        (t) => t.isOverdue && t.status !== 'COMPLETED' && t.status !== 'CANCELLED',
      ).length,
    }),
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (view === 'open') result = result.filter((t) => t.status === 'OPEN');
    else if (view === 'in_progress') result = result.filter((t) => t.status === 'IN_PROGRESS');
    else if (view === 'overdue')
      result = result.filter(
        (t) => t.isOverdue && t.status !== 'COMPLETED' && t.status !== 'CANCELLED',
      );
    if (priorityFilter !== 'all') result = result.filter((t) => t.priority === priorityFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (t) => t.title.toLowerCase().includes(s) || t.record?.code.toLowerCase().includes(s),
      );
    }
    return result;
  }, [tasks, view, priorityFilter, search]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allSelected = filteredTasks.length > 0 && filteredTasks.every((t) => selected.has(t.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filteredTasks.map((t) => t.id)));
  };

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
    if (detailTask?.id === id)
      setDetailTask((prev) =>
        prev
          ? {
              ...prev,
              status,
              isOverdue: status === 'COMPLETED' || status === 'CANCELLED' ? false : prev.isOverdue,
            }
          : null,
      );
  };

  const handleDelete = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const handleCreate = (partial: Partial<TaskItem>) => {
    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      title: partial.title || '',
      description: partial.description || '',
      priority: partial.priority || 'NORMAL',
      status: 'OPEN',
      dueDate: partial.dueDate || null,
      isOverdue: false,
      record: null,
      assignees: [{ id: 'u1', name: 'Sarah Chen', initials: 'SC' }],
      createdAt: '4 Mar 2026 15:00',
      createdBy: 'Sarah Chen',
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const batchComplete = () => {
    selected.forEach((id) => handleStatusChange(id, 'COMPLETED'));
    setSelected(new Set());
  };
  const batchCancel = () => {
    selected.forEach((id) => handleStatusChange(id, 'CANCELLED'));
    setSelected(new Set());
  };

  const views: { value: ViewFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'open', label: 'Open', count: counts.open },
    { value: 'in_progress', label: 'In Progress', count: counts.in_progress },
    { value: 'overdue', label: 'Overdue', count: counts.overdue },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb className="mb-4 animate-fade-in-up">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-1.5">
              <CheckSquare className="h-4 w-4" /> My Tasks
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div
        className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up"
        style={{ animationDelay: '50ms' }}
      >
        <h1 className="font-serif text-3xl font-bold text-foreground">My Tasks</h1>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
        >
          <Plus className="h-4 w-4" /> Create Task
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
            onClick={() => setView(v.value)}
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
            placeholder="Search tasks..."
            className="pl-9 focus-visible:ring-[#7c3aed]/30"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px] focus:ring-[#7c3aed]/30">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="NORMAL">Normal</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#7c3aed]/20 bg-[#f5f3ff] px-4 py-2.5 animate-slide-in">
          <span className="text-sm font-medium text-foreground">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              onClick={batchComplete}
              className="h-7 gap-1 bg-[#10b981] text-xs text-white hover:bg-[#059669]"
            >
              <Check className="h-3 w-3" /> Complete All
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-border hover:bg-[#f5f3ff]"
            >
              Reassign...
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={batchCancel}
              className="h-7 gap-1 text-xs border-border text-muted-foreground hover:bg-[#fee2e2]"
            >
              <X className="h-3 w-3" /> Cancel
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              className="h-7 text-xs text-muted-foreground"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Task Table */}
      <div
        className="animate-fade-in-up rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden"
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
                  Task
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Priority
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Due
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Record
                </th>
                <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                  Assignees
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <CheckSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">
                      No tasks match your filters
                    </p>
                    <button
                      onClick={() => setCreateOpen(true)}
                      className="mt-2 text-sm font-medium text-[#7c3aed] hover:underline"
                    >
                      + Create a task
                    </button>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
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
                        overdue={task.isOverdue}
                        onClick={() => handleStatusChange(task.id, cycleStatus(task.status))}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm font-medium ${task.status === 'COMPLETED' ? 'text-muted-foreground line-through' : task.status === 'CANCELLED' ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                      >
                        {task.title}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <TaskPriorityBadge priority={task.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium ${task.status === 'COMPLETED' ? 'text-[#10b981]' : task.status === 'IN_PROGRESS' ? 'text-[#3b82f6]' : task.status === 'CANCELLED' ? 'text-muted-foreground' : 'text-muted-foreground'}`}
                      >
                        {STATUS_LABELS[task.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-sm ${task.isOverdue ? 'font-semibold text-[#ef4444]' : 'text-muted-foreground'}`}
                        >
                          {task.dueDate || '\u2014'}
                        </span>
                        {task.isOverdue &&
                          task.status !== 'COMPLETED' &&
                          task.status !== 'CANCELLED' && (
                            <TaskOverdueBadge days={task.overdueDays} />
                          )}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {task.record ? (
                        <EntityLink code={task.record.code} href={task.record.href} />
                      ) : (
                        <span className="text-xs text-muted-foreground">{'\u2014'}</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <AssigneeAvatars assignees={task.assignees} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialogs + Sheets */}
      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreate} />
      <TaskDetailSheet
        task={detailTask}
        open={!!detailTask}
        onOpenChange={(open) => !open && setDetailTask(null)}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
      />
    </div>
  );
}
