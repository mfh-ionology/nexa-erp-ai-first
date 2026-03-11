// ---------------------------------------------------------------------------
// Quota Settings Editor — Inline form for PLATFORM_ADMIN to edit quota
// Story E13b-4 Task 6.4 (AC#2)
// Uses PATCH /admin/tenants/:id/ai/quota (existing endpoint)
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useUpdateTenantQuota, type TenantQuotaData } from '../hooks/use-ai-usage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuotaSettingsEditorProps {
  tenantId: string;
  currentQuota: TenantQuotaData;
  onClose: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuotaSettingsEditor({
  tenantId,
  currentQuota,
  onClose,
  onSaved,
}: QuotaSettingsEditorProps) {
  const [tokenAllowance, setTokenAllowance] = useState(currentQuota.tokenAllowance);
  const [softLimitPct, setSoftLimitPct] = useState(currentQuota.softLimitPct);
  const [hardLimitPct, setHardLimitPct] = useState(currentQuota.hardLimitPct);
  const [validationError, setValidationError] = useState<string | null>(null);

  const updateMutation = useUpdateTenantQuota();

  function validate(): boolean {
    if (tokenAllowance <= 0) {
      setValidationError('Token allowance must be greater than 0.');
      return false;
    }
    if (softLimitPct < 1 || softLimitPct > 100) {
      setValidationError('Soft limit must be between 1% and 100%.');
      return false;
    }
    if (hardLimitPct < 1 || hardLimitPct > 200) {
      setValidationError('Hard limit must be between 1% and 200%.');
      return false;
    }
    if (softLimitPct >= hardLimitPct) {
      setValidationError('Soft limit must be less than hard limit.');
      return false;
    }
    setValidationError(null);
    return true;
  }

  function handleSave() {
    if (!validate()) return;

    updateMutation.mutate(
      { tenantId, tokenAllowance, softLimitPct, hardLimitPct },
      {
        onSuccess: () => onSaved(),
        onError: (err) => {
          setValidationError(
            err instanceof Error ? err.message : 'Failed to update quota settings.',
          );
        },
      },
    );
  }

  return (
    <div data-testid="quota-settings-editor">
      <h4 className="mb-3 text-sm font-semibold text-foreground">Edit Quota Settings</h4>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Token Allowance */}
        <div>
          <label
            htmlFor="tokenAllowance"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Token Allowance
          </label>
          <input
            id="tokenAllowance"
            type="number"
            min={1}
            value={tokenAllowance}
            onChange={(e) => setTokenAllowance(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Soft Limit % */}
        <div>
          <label
            htmlFor="softLimitPct"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Soft Limit (%)
          </label>
          <input
            id="softLimitPct"
            type="number"
            min={1}
            max={100}
            value={softLimitPct}
            onChange={(e) => setSoftLimitPct(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Hard Limit % */}
        <div>
          <label
            htmlFor="hardLimitPct"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Hard Limit (%)
          </label>
          <input
            id="hardLimitPct"
            type="number"
            min={1}
            max={200}
            value={hardLimitPct}
            onChange={(e) => setHardLimitPct(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Validation error */}
      {validationError && (
        <p className="mt-2 text-sm text-destructive" data-testid="quota-validation-error">
          {validationError}
        </p>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={updateMutation.isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
