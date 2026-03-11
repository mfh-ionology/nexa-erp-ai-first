// ---------------------------------------------------------------------------
// AssignPlanDialog — Plan assignment with side-by-side comparison view
// Shows current vs new plan limits with red/green highlighting for changes
// Story: E13b.3 Task 4.5
// ---------------------------------------------------------------------------

import { useEffect, useState, useMemo } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Plan, PlanSummary } from '@/types/tenant';

interface AssignPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: PlanSummary;
  availablePlans: Plan[];
  onConfirm: (params: { planId: string; reason?: string }) => void;
  loading?: boolean;
}

function formatTokens(value: string | number | undefined): string {
  if (value == null) return '—';
  return Number(value).toLocaleString();
}

interface LimitRowProps {
  label: string;
  current: string | number | undefined;
  next: string | number | undefined;
  format?: (v: string | number | undefined) => string;
}

function LimitRow({ label, current, next, format: fmt }: LimitRowProps) {
  const formatFn = fmt ?? ((v: string | number | undefined) => String(v ?? '—'));
  const currentNum = Number(current ?? 0);
  const nextNum = Number(next ?? 0);
  const diff = nextNum - currentNum;

  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-center font-mono">{formatFn(current)}</span>
      <span
        className={cn(
          'text-center font-mono font-medium',
          diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-foreground',
        )}
      >
        {formatFn(next)}
        {diff !== 0 && (
          <span className="ml-1 text-xs">
            ({diff > 0 ? '+' : ''}
            {diff})
          </span>
        )}
      </span>
    </div>
  );
}

export function AssignPlanDialog({
  open,
  onOpenChange,
  currentPlan,
  availablePlans,
  onConfirm,
  loading = false,
}: AssignPlanDialogProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [reason, setReason] = useState('');

  // Reset state when dialog opens (controlled open — Radix doesn't fire onOpenChange for programmatic opens)
  useEffect(() => {
    if (open) {
      setSelectedPlanId('');
      setReason('');
    }
  }, [open]);

  // Filter out current plan and inactive plans
  const eligiblePlans = useMemo(
    () => availablePlans.filter((p) => p.isActive && p.id !== currentPlan.id),
    [availablePlans, currentPlan.id],
  );

  const selectedPlan = useMemo(
    () => eligiblePlans.find((p) => p.id === selectedPlanId),
    [eligiblePlans, selectedPlanId],
  );

  function handleConfirm() {
    if (!selectedPlanId || loading) return;
    onConfirm({
      planId: selectedPlanId,
      ...(reason.trim() && { reason: reason.trim() }),
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change Subscription Plan</AlertDialogTitle>
          <AlertDialogDescription>
            Current plan: <strong>{currentPlan.displayName}</strong> ({currentPlan.code})
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Plan selector */}
          <div>
            <label htmlFor="plan-select" className="mb-1.5 block text-sm font-medium">
              New Plan
            </label>
            <select
              id="plan-select"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              disabled={loading}
              data-testid="plan-select"
            >
              <option value="">Select a plan...</option>
              {eligiblePlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.displayName} ({plan.code})
                </option>
              ))}
            </select>
          </div>

          {/* Comparison view */}
          {selectedPlan && (
            <div
              className="rounded-md border border-border bg-slate-50 p-3"
              data-testid="plan-comparison"
            >
              <div className="mb-2 grid grid-cols-3 gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <span>Limit</span>
                <span className="text-center">Current</span>
                <span className="text-center">New</span>
              </div>
              <div className="space-y-2">
                <LimitRow
                  label="Max Users"
                  current={currentPlan.maxUsers}
                  next={selectedPlan.maxUsers}
                />
                <LimitRow
                  label="Max Companies"
                  current={currentPlan.maxCompanies}
                  next={selectedPlan.maxCompanies}
                />
                <LimitRow
                  label="AI Token Allowance"
                  current={currentPlan.monthlyAiTokenAllowance}
                  next={selectedPlan.monthlyAiTokenAllowance}
                  format={formatTokens}
                />
                <LimitRow
                  label="API Rate Limit"
                  current={currentPlan.apiRateLimit}
                  next={selectedPlan.apiRateLimit}
                />
              </div>
            </div>
          )}

          {/* Warning about immediate effect */}
          {selectedPlan && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Plan changes take effect immediately via webhook. Module entitlements and limits will
              update within 30 seconds.
            </div>
          )}

          {/* Reason (optional) */}
          <div>
            <label htmlFor="plan-reason" className="mb-1.5 block text-sm font-medium">
              Reason <span className="text-muted-foreground font-normal">— optional</span>
            </label>
            <textarea
              id="plan-reason"
              className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="e.g. Upgrading due to user growth"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              data-testid="plan-reason-input"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button onClick={handleConfirm} disabled={!selectedPlanId || loading}>
            {loading ? 'Processing...' : 'Confirm Plan Change'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
