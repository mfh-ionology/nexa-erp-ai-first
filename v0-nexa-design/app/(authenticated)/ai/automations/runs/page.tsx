'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Search, CheckCircle2, XCircle, Clock, RotateCw } from 'lucide-react';

/* ── Types ── */
interface Run {
  id: string;
  automation: string;
  status: 'Success' | 'Failed' | 'Running' | 'Retried';
  startedAt: string;
  duration: string;
  stepsCompleted: number;
  stepsTotal: number;
  trigger: string;
}

/* ── Data ── */
const runs: Run[] = [
  {
    id: 'run-001',
    automation: 'Daily Invoice Reminder',
    status: 'Success',
    startedAt: '08:00:02 Today',
    duration: '1.2s',
    stepsCompleted: 3,
    stepsTotal: 3,
    trigger: 'Schedule',
  },
  {
    id: 'run-002',
    automation: 'Sync Inventory Levels',
    status: 'Success',
    startedAt: '07:45:12 Today',
    duration: '3.8s',
    stepsCompleted: 5,
    stepsTotal: 5,
    trigger: 'Webhook',
  },
  {
    id: 'run-003',
    automation: 'Overdue Escalation',
    status: 'Failed',
    startedAt: '10:00:05 Today',
    duration: '0.8s',
    stepsCompleted: 2,
    stepsTotal: 4,
    trigger: 'Schedule',
  },
  {
    id: 'run-004',
    automation: 'Weekly Finance Report',
    status: 'Running',
    startedAt: 'Just now',
    duration: '-',
    stepsCompleted: 1,
    stepsTotal: 3,
    trigger: 'Manual',
  },
  {
    id: 'run-005',
    automation: 'Daily Invoice Reminder',
    status: 'Success',
    startedAt: '08:00:01 Yesterday',
    duration: '1.1s',
    stepsCompleted: 3,
    stepsTotal: 3,
    trigger: 'Schedule',
  },
  {
    id: 'run-006',
    automation: 'Overdue Escalation',
    status: 'Retried',
    startedAt: '10:00:03 Yesterday',
    duration: '2.4s',
    stepsCompleted: 4,
    stepsTotal: 4,
    trigger: 'Schedule',
  },
  {
    id: 'run-007',
    automation: 'Sync Inventory Levels',
    status: 'Success',
    startedAt: '07:45:08 Yesterday',
    duration: '3.2s',
    stepsCompleted: 5,
    stepsTotal: 5,
    trigger: 'Webhook',
  },
  {
    id: 'run-008',
    automation: 'Daily Invoice Reminder',
    status: 'Failed',
    startedAt: '08:00:02 2 days ago',
    duration: '0.5s',
    stepsCompleted: 1,
    stepsTotal: 3,
    trigger: 'Schedule',
  },
];

const statusConfig = {
  Success: { icon: CheckCircle2, color: 'text-[#065f46]', bg: 'bg-[#d1fae5]', dot: 'bg-[#10b981]' },
  Failed: { icon: XCircle, color: 'text-[#991b1b]', bg: 'bg-[#fee2e2]', dot: 'bg-[#ef4444]' },
  Running: { icon: Clock, color: 'text-[#1e40af]', bg: 'bg-[#dbeafe]', dot: 'bg-[#3b82f6]' },
  Retried: { icon: RotateCw, color: 'text-[#92400e]', bg: 'bg-[#fef3c7]', dot: 'bg-[#f59e0b]' },
};

export default function AutomationRunsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    let result = runs;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (r) => r.automation.toLowerCase().includes(s) || r.id.toLowerCase().includes(s),
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
    }
    return result;
  }, [search, statusFilter]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up flex items-center gap-3">
        <Link
          href="/ai/automations"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Automation Runs</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            History of all automation executions.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by automation or run ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg pl-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 rounded-lg">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Success">Success</SelectItem>
            <SelectItem value="Failed">Failed</SelectItem>
            <SelectItem value="Running">Running</SelectItem>
            <SelectItem value="Retried">Retried</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Runs table */}
      <div
        className="animate-fade-in-up overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        style={{ animationDelay: '60ms' }}
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Run ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Automation
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                Started
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                Duration
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                Steps
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const cfg = statusConfig[r.status];
              return (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-[#f5f3ff]"
                >
                  <td className="px-4 py-3">
                    <code className="font-mono text-xs text-foreground">{r.id}</code>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{r.automation}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      {r.status}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                    {r.startedAt}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground md:table-cell">
                    {r.duration}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {r.stepsCompleted}/{r.stepsTotal}
                    </span>
                    <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full ${r.status === 'Failed' ? 'bg-[#ef4444]' : 'bg-[#7c3aed]'}`}
                        style={{ width: `${(r.stepsCompleted / r.stepsTotal) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No runs match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
