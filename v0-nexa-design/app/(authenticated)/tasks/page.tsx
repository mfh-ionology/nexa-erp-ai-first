'use client';

import { useState } from 'react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Plus, Circle, CircleDot, CheckCircle2, XCircle } from 'lucide-react';

type TaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
type TaskPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';

interface Task {
  id: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  isOverdue: boolean;
  record: string | null;
  assignees: string[];
  description?: string;
}

const priorityConfig: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  URGENT: { label: 'URGENT', color: '#ef4444', bg: '#fee2e2' },
  HIGH: { label: 'HIGH', color: '#ef4444', bg: '#fee2e2' },
  NORMAL: { label: 'NORMAL', color: '#f59e0b', bg: '#fef3c7' },
  LOW: { label: 'LOW', color: '#3b82f6', bg: '#dbeafe' },
};

const statusIcon: Record<TaskStatus, typeof Circle> = {
  open: Circle,
  in_progress: CircleDot,
  completed: CheckCircle2,
  cancelled: XCircle,
};

const initialTasks: Task[] = [
  {
    id: '1',
    title: 'Chase payment',
    priority: 'HIGH',
    status: 'open',
    dueDate: 'Overdue',
    isOverdue: true,
    record: 'INV-00234',
    assignees: ['Sarah', 'Mike'],
    description: 'Chase payment for overdue invoice.',
  },
  {
    id: '2',
    title: 'Review credit terms',
    priority: 'NORMAL',
    status: 'in_progress',
    dueDate: '5 Mar',
    isOverdue: false,
    record: 'CUST-0045',
    assignees: ['Sarah'],
    description: 'Review and update credit terms for the customer.',
  },
  {
    id: '3',
    title: 'Prepare Q1 report',
    priority: 'LOW',
    status: 'open',
    dueDate: '15 Mar',
    isOverdue: false,
    record: null,
    assignees: ['Sarah'],
    description: 'Compile Q1 financial report.',
  },
  {
    id: '4',
    title: 'Update supplier address',
    priority: 'NORMAL',
    status: 'open',
    dueDate: '10 Mar',
    isOverdue: false,
    record: 'SUP-0012',
    assignees: ['Mike'],
    description: 'Update supplier address in the system.',
  },
  {
    id: '5',
    title: 'Send welcome email',
    priority: 'LOW',
    status: 'completed',
    dueDate: '1 Mar',
    isOverdue: false,
    record: 'CUST-0048',
    assignees: ['Mike'],
    description: 'Send welcome email to new customer.',
  },
  {
    id: '6',
    title: 'Follow up delivery',
    priority: 'NORMAL',
    status: 'open',
    dueDate: '8 Mar',
    isOverdue: false,
    record: 'DN-00045',
    assignees: ['Sarah'],
    description: 'Follow up on delivery status.',
  },
];

type ViewFilter = 'all' | 'open' | 'in_progress' | 'overdue';

export default function MyTasksPage() {
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState<ViewFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filteredTasks = tasks.filter((t) => {
    if (view === 'open') return t.status === 'open';
    if (view === 'in_progress') return t.status === 'in_progress';
    if (view === 'overdue') return t.isOverdue;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const cycleStatus = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const order: TaskStatus[] = ['open', 'in_progress', 'completed'];
        const idx = order.indexOf(t.status);
        return { ...t, status: order[(idx + 1) % order.length], isOverdue: false };
      }),
    );
  };

  const views: { value: ViewFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'overdue', label: 'Overdue' },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb className="mb-4 animate-fade-in-up">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>My Tasks</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div
        className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up"
        style={{ animationDelay: '50ms' }}
      >
        <h1 className="font-serif text-3xl font-bold text-foreground">My Tasks</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
              <Plus className="h-4 w-4" /> Create Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Create Task</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-2">
                <Label>Title</Label>
                <Input placeholder="Task title..." />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Description</Label>
                <textarea
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-[#7c3aed]"
                  placeholder="Optional description..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Priority</Label>
                  <Select defaultValue="NORMAL">
                    <SelectTrigger>
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
                <div className="flex flex-col gap-2">
                  <Label>Due Date</Label>
                  <Input type="date" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setCreateOpen(false)}
                  className="text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setCreateOpen(false)}
                  className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
                >
                  Create Task
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
            {v.label}
          </button>
        ))}
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-border hover:bg-[#f5f3ff]"
            >
              Complete All
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-border hover:bg-[#f5f3ff]"
            >
              Reassign
            </Button>
          </div>
        )}
      </div>

      {/* Task Table */}
      <div
        className="animate-fade-in-up rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden"
        style={{ animationDelay: '100ms' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-[rgba(107,114,128,0.04)]">
                <th className="w-10 px-3 py-2.5" />
                <th className="w-8 px-1 py-2.5" />
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Task
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Priority
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Due
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Record
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const StatusIcon = statusIcon[task.status];
                const pri = priorityConfig[task.priority];
                const statusColor =
                  task.status === 'completed'
                    ? '#10b981'
                    : task.status === 'in_progress'
                      ? '#3b82f6'
                      : task.isOverdue
                        ? '#ef4444'
                        : '#9ca3af';
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
                    <td
                      className="px-1 py-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        cycleStatus(task.id);
                      }}
                    >
                      <StatusIcon
                        className="h-4 w-4 cursor-pointer"
                        style={{ color: statusColor }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm font-medium ${task.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                      >
                        {task.title}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: pri.bg, color: pri.color }}
                      >
                        {pri.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm ${task.isOverdue ? 'font-semibold text-[#ef4444]' : 'text-muted-foreground'}`}
                      >
                        {task.dueDate}
                      </span>
                      {task.isOverdue && (
                        <span className="ml-1.5 rounded bg-[#fee2e2] px-1.5 py-0.5 text-[10px] font-semibold text-[#ef4444]">
                          Overdue
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {task.record ? (
                        <span className="font-mono text-xs text-[#7c3aed]">{task.record}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{'\u2014'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task Detail Sheet */}
      <Sheet open={!!detailTask} onOpenChange={(open) => !open && setDetailTask(null)}>
        <SheetContent className="w-[400px] p-0 sm:max-w-[400px]">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="text-sm font-semibold">{detailTask?.title}</SheetTitle>
          </SheetHeader>
          {detailTask && (
            <div className="flex flex-col gap-4 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </p>
                  <p className="mt-1 text-sm capitalize text-foreground">
                    {detailTask.status.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Priority
                  </p>
                  <span
                    className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: priorityConfig[detailTask.priority].bg,
                      color: priorityConfig[detailTask.priority].color,
                    }}
                  >
                    {detailTask.priority}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Due Date
                  </p>
                  <p
                    className={`mt-1 text-sm ${detailTask.isOverdue ? 'text-[#ef4444] font-semibold' : 'text-foreground'}`}
                  >
                    {detailTask.dueDate}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Record
                  </p>
                  <p className="mt-1 font-mono text-sm text-[#7c3aed]">
                    {detailTask.record || '\u2014'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Assigned To
                </p>
                <p className="mt-1 text-sm text-foreground">{detailTask.assignees.join(', ')}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </p>
                <p className="mt-1 text-sm leading-relaxed text-foreground">
                  {detailTask.description || 'No description.'}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                {detailTask.status === 'open' && (
                  <Button size="sm" className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
                    Start
                  </Button>
                )}
                {detailTask.status !== 'completed' && (
                  <Button size="sm" variant="outline" className="border-border hover:bg-[#f5f3ff]">
                    Complete
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
