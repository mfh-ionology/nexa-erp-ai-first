/* eslint-disable i18next/no-literal-string */
/**
 * Dashboard bottom cards — Tasks Today + Recent Activity.
 * Visual design from v0 Concept D prototype.
 */

import { useState } from 'react';
import { CheckSquare, Clock } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { useI18n } from '@nexa/i18n';

/* ── Static data ────────────────────────────────────────────── */

interface Task {
  id: string;
  descriptionKey: string;
  priorityKey: string;
  priorityColor: string;
  priorityBg: string;
}

const tasks: Task[] = [
  {
    id: 'task-1',
    descriptionKey: 'dashboard.tasks.chaseAcme',
    priorityKey: 'dashboard.priority.urgent',
    priorityColor: '#dc2626',
    priorityBg: '#fee2e2',
  },
  {
    id: 'task-2',
    descriptionKey: 'dashboard.tasks.reviewPricing',
    priorityKey: 'dashboard.priority.high',
    priorityColor: '#d97706',
    priorityBg: '#fef3c7',
  },
  {
    id: 'task-3',
    descriptionKey: 'dashboard.tasks.approvePurchaseOrders',
    priorityKey: 'dashboard.priority.medium',
    priorityColor: '#3b82f6',
    priorityBg: '#dbeafe',
  },
  {
    id: 'task-4',
    descriptionKey: 'dashboard.tasks.payrollPrep',
    priorityKey: 'dashboard.priority.normal',
    priorityColor: '#6b7280',
    priorityBg: '#f3f4f6',
  },
];

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

/* ── Tasks Card ─────────────────────────────────────────────── */

export function TasksCard() {
  const { t } = useI18n();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  return (
    <div
      className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
      style={{ animationDelay: '450ms' }}
    >
      <div className="mb-4 flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-[#7c3aed]" />
        <h3 className="font-serif text-sm font-semibold text-foreground">
          {t('dashboard.tasks.title')}
        </h3>
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
                onCheckedChange={(val) => {
                  setChecked((prev) => ({ ...prev, [task.id]: !!val }));
                }}
                className="data-[state=checked]:bg-[#7c3aed] data-[state=checked]:border-[#7c3aed]"
              />
              <span
                className={`text-sm ${
                  checked[task.id] ? 'text-muted-foreground line-through' : 'text-foreground'
                }`}
              >
                {t(task.descriptionKey)}
              </span>
            </div>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: task.priorityBg,
                color: task.priorityColor,
              }}
            >
              {t(task.priorityKey)}
            </span>
          </label>
        ))}
      </div>
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
