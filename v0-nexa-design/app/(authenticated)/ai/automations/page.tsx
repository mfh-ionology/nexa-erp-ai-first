'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Workflow, Plus, Play, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

const automations = [
  {
    id: 'daily-reminder',
    name: 'Daily Invoice Reminder',
    trigger: 'Schedule',
    cron: '0 8 * * 1-5',
    status: 'Active' as const,
    lastRun: '08:00 Today',
    runs: 142,
  },
  {
    id: 'sync-inventory',
    name: 'Sync Inventory Levels',
    trigger: 'Webhook',
    cron: '',
    status: 'Active' as const,
    lastRun: '07:45 Today',
    runs: 89,
  },
  {
    id: 'weekly-report',
    name: 'Weekly Finance Report',
    trigger: 'Schedule',
    cron: '0 9 * * 1',
    status: 'Active' as const,
    lastRun: 'Mon 09:00',
    runs: 24,
  },
  {
    id: 'vendor-onboard',
    name: 'Vendor Onboarding Flow',
    trigger: 'Event',
    cron: '',
    status: 'Draft' as const,
    lastRun: 'Never',
    runs: 0,
  },
  {
    id: 'overdue-escalate',
    name: 'Overdue Escalation',
    trigger: 'Schedule',
    cron: '0 10 * * *',
    status: 'Active' as const,
    lastRun: '10:00 Today',
    runs: 67,
  },
];

const stats = [
  { label: 'Active', value: '4', icon: Play, color: '#10b981' },
  { label: 'Runs Today', value: '12', icon: Clock, color: '#7c3aed' },
  { label: 'Failures (7d)', value: '2', icon: AlertTriangle, color: '#ef4444' },
  { label: 'Success Rate', value: '97%', icon: CheckCircle2, color: '#10b981' },
];

export default function AutomationsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="animate-fade-in-up flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Workflow className="h-3.5 w-3.5 text-[#7c3aed]" />
            <span>AI &gt; Automations</span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Automations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build and monitor autonomous AI workflows.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-lg" asChild>
            <Link href="/ai/automations/runs">View Runs</Link>
          </Button>
          <Button size="sm" className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Automation
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="animate-fade-in-up rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center gap-2">
              <s.icon className="h-4 w-4" style={{ color: s.color }} />
              <span className="text-xs font-semibold tracking-wider text-muted-foreground">
                {s.label}
              </span>
            </div>
            <p className="mt-1 font-mono text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Automations table */}
      <div
        className="animate-fade-in-up overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        style={{ animationDelay: '180ms' }}
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Name
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                Trigger
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                Last Run
              </th>
              <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                Runs
              </th>
            </tr>
          </thead>
          <tbody>
            {automations.map((a) => (
              <tr
                key={a.id}
                className="border-b border-border last:border-0 transition-colors hover:bg-[#f5f3ff]"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/ai/automations/${a.id}`}
                    className="text-sm font-medium text-foreground hover:text-[#7c3aed]"
                  >
                    {a.name}
                  </Link>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <Badge variant="secondary" className="rounded-md text-[10px]">
                    {a.trigger}
                  </Badge>
                  {a.cron && (
                    <code className="ml-1.5 text-[10px] text-muted-foreground">{a.cron}</code>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium ${a.status === 'Active' ? 'text-[#065f46]' : 'text-muted-foreground'}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${a.status === 'Active' ? 'bg-[#10b981]' : 'bg-[#9ca3af]'}`}
                    />
                    {a.status}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                  {a.lastRun}
                </td>
                <td className="hidden px-4 py-3 text-right font-mono text-sm text-muted-foreground lg:table-cell">
                  {a.runs}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
