'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckSquare, Clock, ArrowRight } from 'lucide-react';
import { TaskStatusIcon, TaskPriorityBadge } from '@/components/tasks/task-components';
import { MOCK_TASKS, type TaskItem, type TaskStatus } from '@/components/tasks/task-types';

const todayTasks = MOCK_TASKS.filter(
  (t) => (t.status === 'OPEN' || t.status === 'IN_PROGRESS') && t.dueDate,
).slice(0, 4);

interface Activity {
  initials: string;
  color: string;
  description: string;
  time: string;
}

const activities: Activity[] = [
  {
    initials: 'SC',
    color: '#7c3aed',
    description: 'Sarah approved PO-2026-0031',
    time: '2 hours ago',
  },
  {
    initials: 'AI',
    color: '#10b981',
    description: 'AI matched payment \u00A322,100 \u2192 INV-0055',
    time: '3 hours ago',
  },
  {
    initials: 'DM',
    color: '#3b82f6',
    description: 'David posted month-end journal JE-0412',
    time: 'Yesterday',
  },
];

export function TasksCard() {
  const [tasks, setTasks] = useState(todayTasks);

  const cycleStatus = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next: TaskStatus =
          t.status === 'OPEN' ? 'IN_PROGRESS' : t.status === 'IN_PROGRESS' ? 'COMPLETED' : t.status;
        return { ...t, status: next, isOverdue: next === 'COMPLETED' ? false : t.isOverdue };
      }),
    );
  };

  return (
    <div
      className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
      style={{ animationDelay: '450ms' }}
    >
      <div className="mb-4 flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-[#7c3aed]" />
        <h3 className="font-serif text-sm font-semibold text-foreground">
          Tasks Today ({tasks.filter((t) => t.status !== 'COMPLETED').length})
        </h3>
      </div>
      <div className="flex flex-col gap-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-[#f9fafb]"
          >
            <div className="flex items-center gap-3">
              <TaskStatusIcon
                status={task.status}
                overdue={task.isOverdue}
                onClick={() => cycleStatus(task.id)}
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
        {tasks.filter((t) => t.status !== 'COMPLETED').length === 0 && (
          <p className="py-3 text-center text-sm text-muted-foreground">
            {"No tasks due today \u2014 you're all clear!"}
          </p>
        )}
      </div>
      <Link
        href="/tasks"
        className="mt-3 flex items-center gap-1 text-xs font-medium text-[#7c3aed] transition-colors hover:text-[#5b21b6]"
      >
        View all tasks <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

export function RecentActivityCard() {
  return (
    <div
      className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
      style={{ animationDelay: '500ms' }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-[#7c3aed]" />
        <h3 className="font-serif text-sm font-semibold text-foreground">Recent Activity</h3>
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
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">{activity.description}</p>
              <p className="text-xs text-muted-foreground">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
