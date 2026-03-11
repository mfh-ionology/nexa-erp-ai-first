// ---------------------------------------------------------------------------
// EnforcementDialog — Change enforcement action with state machine validation
// Valid transitions per BR-PLT-004:
//   NONE → WARNING only
//   WARNING → NONE, READ_ONLY
//   READ_ONLY → NONE, WARNING, SUSPENDED
//   SUSPENDED → NONE only
// Story: E13b.3 Task 4.4
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
import type { EnforcementAction } from '@/types/tenant';

// ---------------------------------------------------------------------------
// State machine — valid transitions (BR-PLT-004)
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<EnforcementAction, EnforcementAction[]> = {
  NONE: ['WARNING'],
  WARNING: ['NONE', 'READ_ONLY'],
  READ_ONLY: ['NONE', 'WARNING', 'SUSPENDED'],
  SUSPENDED: ['NONE'],
};

const ENFORCEMENT_LABELS: Record<EnforcementAction, string> = {
  NONE: 'None',
  WARNING: 'Warning',
  READ_ONLY: 'Read Only',
  SUSPENDED: 'Suspended',
};

const CONSEQUENCE_DESCRIPTIONS: Record<EnforcementAction, string> = {
  NONE: 'All restrictions will be removed. Normal operation will resume.',
  WARNING: "A warning banner will appear in the tenant's ERP within 30 seconds.",
  READ_ONLY:
    'All write operations will be blocked within 30 seconds. The tenant can still view data.',
  SUSPENDED:
    'The tenant will be fully suspended — login blocked, data inaccessible. This changes the tenant status to SUSPENDED.',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EnforcementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAction: EnforcementAction;
  onConfirm: (params: {
    enforcementAction: EnforcementAction;
    reason: string;
    gracePeriodDays?: number;
  }) => void;
  loading?: boolean;
}

export function EnforcementDialog({
  open,
  onOpenChange,
  currentAction,
  onConfirm,
  loading = false,
}: EnforcementDialogProps) {
  const validTargets = useMemo(() => VALID_TRANSITIONS[currentAction] ?? [], [currentAction]);

  const [selectedAction, setSelectedAction] = useState<EnforcementAction | ''>(
    validTargets[0] ?? '',
  );
  const [reason, setReason] = useState('');
  const [gracePeriodDays, setGracePeriodDays] = useState<string>('');

  // Reset state when dialog opens (controlled open — Radix doesn't fire onOpenChange for programmatic opens)
  useEffect(() => {
    if (open) {
      setSelectedAction(validTargets[0] ?? '');
      setReason('');
      setGracePeriodDays('');
    }
  }, [open, validTargets]);

  const canConfirm = !!selectedAction && reason.trim().length > 0 && !loading;

  function handleConfirm() {
    if (!canConfirm || !selectedAction) return;
    const parsedGrace = gracePeriodDays.trim() ? parseInt(gracePeriodDays, 10) : undefined;
    onConfirm({
      enforcementAction: selectedAction,
      reason: reason.trim(),
      ...(parsedGrace != null && !isNaN(parsedGrace) && { gracePeriodDays: parsedGrace }),
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change Enforcement Action</AlertDialogTitle>
          <AlertDialogDescription>
            Current enforcement: <strong>{ENFORCEMENT_LABELS[currentAction]}</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Target action select */}
          <div>
            <label htmlFor="enforcement-target" className="mb-1.5 block text-sm font-medium">
              New Enforcement Action
            </label>
            <select
              id="enforcement-target"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value as EnforcementAction)}
              disabled={loading}
              data-testid="enforcement-target-select"
            >
              {validTargets.map((action) => (
                <option key={action} value={action}>
                  {ENFORCEMENT_LABELS[action]}
                </option>
              ))}
            </select>
          </div>

          {/* Consequence description */}
          {selectedAction && (
            <div
              className={
                selectedAction === 'NONE'
                  ? 'rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700'
                  : selectedAction === 'WARNING'
                    ? 'rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700'
                    : 'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'
              }
              data-testid="enforcement-consequence"
            >
              {CONSEQUENCE_DESCRIPTIONS[selectedAction]}
            </div>
          )}

          {/* Reason (required) */}
          <div>
            <label htmlFor="enforcement-reason" className="mb-1.5 block text-sm font-medium">
              Reason <span className="text-destructive">*</span>
            </label>
            <textarea
              id="enforcement-reason"
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="e.g. Non-payment after 30-day grace period"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              data-testid="enforcement-reason-input"
            />
          </div>

          {/* Grace period days (optional) */}
          <div>
            <label htmlFor="enforcement-grace" className="mb-1.5 block text-sm font-medium">
              Grace Period (days){' '}
              <span className="text-muted-foreground font-normal">— optional</span>
            </label>
            <input
              id="enforcement-grace"
              type="number"
              min={0}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              placeholder="14"
              value={gracePeriodDays}
              onChange={(e) => setGracePeriodDays(e.target.value)}
              disabled={loading}
              data-testid="enforcement-grace-input"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button
            variant={
              selectedAction === 'SUSPENDED' || selectedAction === 'READ_ONLY'
                ? 'destructive'
                : 'default'
            }
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {loading ? 'Processing...' : 'Confirm Change'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
