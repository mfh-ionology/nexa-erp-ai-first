'use client';

import { useState } from 'react';
import { CheckSquare, Clock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface Task {
  id: string;
  description: string;
  priority: string;
  priorityColor: string;
  priorityBg: string;
}

const tasks: Task[] = [
  {
    id: 'task-1',
    description: 'Chase Acme Corp (\u00A331k overdue)',
    priority: 'Urgent',
    priorityColor: '#dc2626',
    priorityBg: '#fee2e2',
  },
  {
    id: 'task-2',
    description: 'Review Widget-B pricing',
    priority: 'High',
    priorityColor: '#d97706',
    priorityBg: '#fef3c7',
  },
  {
    id: 'task-3',
    description: 'Approve 2 purchase orders',
    priority: 'Medium',
    priorityColor: '#3b82f6',
    priorityBg: '#dbeafe',
  },
  {
    id: 'task-4',
    description: 'Payroll prep \u2014 5 days',
    priority: 'Normal',
    priorityColor: '#6b7280',
    priorityBg: '#f3f4f6',
  },
];

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
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  return (
    <div
      className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
      style={{ animationDelay: '450ms' }}
    >
      <div className="mb-4 flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-[#7c3aed]" />
        <h3 className="font-serif text-sm font-semibold text-foreground">Tasks Today</h3>
      </div>
      <div className="flex flex-col gap-1">
        {tasks.map((task) => (
          <label
            key={task.id}
            className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-[#f9fafb]"
          >
            <div className="flex items-center gap-3">
              <Checkbox
                checked={!!checked[task.id]}
                onCheckedChange={(val) => setChecked((prev) => ({ ...prev, [task.id]: !!val }))}
                className="data-[state=checked]:bg-[#7c3aed] data-[state=checked]:border-[#7c3aed]"
              />
              <span
                className={`text-sm ${
                  checked[task.id] ? 'text-muted-foreground line-through' : 'text-foreground'
                }`}
              >
                {task.description}
              </span>
            </div>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: task.priorityBg,
                color: task.priorityColor,
              }}
            >
              {task.priority}
            </span>
          </label>
        ))}
      </div>
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
