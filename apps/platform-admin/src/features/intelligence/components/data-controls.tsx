import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useTriggerAggregation, useTriggerInsightsGeneration } from '@/api/use-intelligence';
import { RequirePlatformRole } from '@/components/auth/require-platform-role';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataControlsProps {
  lastAggregatedAt?: string | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Confirmation dialog (inline)
// ---------------------------------------------------------------------------

function ConfirmDialog({
  title,
  description,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Save the previously focused element and focus the dialog
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Focus the first focusable element (Cancel button)
    const timer = setTimeout(() => {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
      focusable?.[0]?.focus();
    }, 0);

    return () => {
      clearTimeout(timer);
      // Restore focus on unmount
      previousFocusRef.current?.focus();
    };
  }, []);

  // Focus trap + Escape to cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={dialogRef}
        className="mx-4 w-full max-w-md rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-dropdown)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
      >
        <h3 id="confirm-title" className="text-lg font-semibold text-foreground font-serif">
          {title}
        </h3>
        <p id="confirm-desc" className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-[var(--radius-button)] border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-[var(--radius-button)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-[var(--primary-dark)]"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataControls({ lastAggregatedAt, className }: DataControlsProps) {
  const aggregation = useTriggerAggregation();
  const insightsGeneration = useTriggerInsightsGeneration();

  const [confirmAction, setConfirmAction] = useState<'aggregate' | 'insights' | null>(null);

  const formattedDate = lastAggregatedAt
    ? new Date(lastAggregatedAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never';

  function handleConfirm() {
    if (confirmAction === 'aggregate') {
      aggregation.mutate(undefined, {
        onSuccess: (result) => {
          toast.success(
            `Aggregation complete — ${result.processedTenants} tenants processed, ${result.patternsCreated} patterns created`,
          );
        },
        onError: () => {
          toast.error('Aggregation failed — please try again');
        },
      });
    } else if (confirmAction === 'insights') {
      insightsGeneration.mutate(undefined, {
        onSuccess: (result) => {
          toast.success(`Generated ${result.insightsGenerated} new insights`);
        },
        onError: () => {
          toast.error('Insight generation failed — please try again');
        },
      });
    }
    setConfirmAction(null);
  }

  const isRunning = aggregation.isPending || insightsGeneration.isPending;

  return (
    <>
      <div className={cn('flex flex-wrap items-center gap-3', className)}>
        {/* Last aggregated timestamp */}
        <span className="text-sm text-muted-foreground">
          Last aggregated: <span className="mono-amount font-medium">{formattedDate}</span>
        </span>

        {/* Admin-only action buttons */}
        <RequirePlatformRole roles={['PLATFORM_ADMIN']}>
          <button
            onClick={() => setConfirmAction('aggregate')}
            disabled={isRunning}
            className={cn(
              'flex items-center gap-1.5 rounded-[var(--radius-button)] border border-border px-3 py-1.5 text-sm font-medium',
              'text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {aggregation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Run Aggregation
          </button>

          <button
            onClick={() => setConfirmAction('insights')}
            disabled={isRunning}
            className={cn(
              'flex items-center gap-1.5 rounded-[var(--radius-button)] border border-border px-3 py-1.5 text-sm font-medium',
              'text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {insightsGeneration.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Generate Insights
          </button>
        </RequirePlatformRole>
      </div>

      {/* Confirmation dialog */}
      {confirmAction === 'aggregate' && (
        <ConfirmDialog
          title="Run Aggregation"
          description="This will collect and aggregate anonymised AI data from all contributing tenants. This may take a few minutes."
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === 'insights' && (
        <ConfirmDialog
          title="Generate Insights"
          description="This will analyse aggregated data and generate new insights including feature gaps, workflow opportunities, and default candidates."
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
}
