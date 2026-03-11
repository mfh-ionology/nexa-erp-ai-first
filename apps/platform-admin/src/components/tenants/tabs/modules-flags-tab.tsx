// ---------------------------------------------------------------------------
// Modules & Flags Tab — Toggle module overrides and feature flags per tenant
// Story: E13b.2 Task 4
// AC: #2 (tabbed detail), #5 (module/flag toggle takes effect via webhook)
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

import { Switch } from '@/components/ui/switch';
import { useUpdateFeatureFlags, useUpdateModules } from '@/hooks/use-tenants';
import { canPerformAction } from '@/lib/platform-rbac';
import { usePlatformAuthStore } from '@/stores/auth-store';
import type { TenantDetail, TenantModuleOverride } from '@/types/tenant';

// ---------------------------------------------------------------------------
// Known MVP modules — the canonical list from project spec
// ---------------------------------------------------------------------------

const KNOWN_MODULES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'system', label: 'System' },
  { key: 'finance', label: 'Finance' },
  { key: 'ar', label: 'Accounts Receivable' },
  { key: 'ap', label: 'Accounts Payable' },
  { key: 'sales', label: 'Sales' },
  { key: 'purchasing', label: 'Purchasing' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'crm', label: 'CRM' },
  { key: 'hr', label: 'HR / Payroll' },
  { key: 'manufacturing', label: 'Manufacturing' },
  { key: 'reporting', label: 'Reporting' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ModulesFlagsTabProps {
  tenant: TenantDetail;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModulesFlagsTab({ tenant }: ModulesFlagsTabProps) {
  const userRole = usePlatformAuthStore((s) => s.user?.role);
  const canModifyModules = !!userRole && canPerformAction(userRole, 'modify_tenant_modules');
  const canModifyFlags = !!userRole && canPerformAction(userRole, 'modify_tenant_feature_flags');

  return (
    <div className="space-y-8" data-testid="modules-flags-tab">
      <ModuleOverridesSection tenant={tenant} canModify={canModifyModules} />
      <FeatureFlagsSection tenant={tenant} canModify={canModifyFlags} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Module Overrides Section
// ---------------------------------------------------------------------------

function ModuleOverridesSection({
  tenant,
  canModify,
}: {
  tenant: TenantDetail;
  canModify: boolean;
}) {
  const updateModules = useUpdateModules();
  const [reasonInput, setReasonInput] = useState<{ moduleKey: string; reason: string } | null>(
    null,
  );

  // Build a lookup of existing overrides by moduleKey
  const overrideMap = new Map<string, TenantModuleOverride>(
    tenant.moduleOverrides.map((o) => [o.moduleKey, o]),
  );

  function handleToggle(moduleKey: string, newEnabled: boolean) {
    // When disabling a module, prompt for optional reason
    if (!newEnabled && !reasonInput) {
      setReasonInput({ moduleKey, reason: '' });
      return;
    }

    // If a reason panel is open for a different module, ignore this toggle
    // to prevent silently discarding the user's in-progress reason text
    if (reasonInput && reasonInput.moduleKey !== moduleKey) {
      return;
    }

    const reason = reasonInput?.moduleKey === moduleKey ? reasonInput.reason : undefined;
    setReasonInput(null);

    updateModules.mutate(
      {
        id: tenant.id,
        modules: [{ moduleKey, enabled: newEnabled, reason: reason || undefined }],
      },
      {
        onSuccess: () => {
          toast.success(`Module "${moduleKey}" ${newEnabled ? 'enabled' : 'disabled'}`);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error
              ? `Failed to update module: ${err.message}`
              : 'Failed to update module',
          );
        },
      },
    );
  }

  function confirmDisable() {
    if (!reasonInput) return;
    handleToggleWithReason(reasonInput.moduleKey, false, reasonInput.reason);
  }

  function handleToggleWithReason(moduleKey: string, enabled: boolean, reason?: string) {
    setReasonInput(null);
    updateModules.mutate(
      {
        id: tenant.id,
        modules: [{ moduleKey, enabled, reason: reason || undefined }],
      },
      {
        onSuccess: () => {
          toast.success(`Module "${moduleKey}" ${enabled ? 'enabled' : 'disabled'}`);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error
              ? `Failed to update module: ${err.message}`
              : 'Failed to update module',
          );
        },
      },
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Module Overrides
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Toggle modules on or off for this tenant. Overrides take effect immediately via webhook.
      </p>

      <div className="divide-y divide-border" data-testid="module-overrides-list">
        {KNOWN_MODULES.map((mod) => {
          const override = overrideMap.get(mod.key);
          const isEnabled = override ? override.enabled : true; // default: enabled (inherited from plan)
          const hasOverride = !!override;

          return (
            <div key={mod.key}>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{mod.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{mod.key}</span>
                  {hasOverride ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      Override
                    </span>
                  ) : (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      Inherited
                    </span>
                  )}
                </div>

                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleToggle(mod.key, checked)}
                  disabled={!canModify || updateModules.isPending}
                  data-testid={`module-toggle-${mod.key}`}
                  aria-label={`Toggle ${mod.label}`}
                />
              </div>

              {/* Reason input when disabling a module */}
              {reasonInput?.moduleKey === mod.key && (
                <div className="flex items-end gap-2 pb-3" data-testid="module-reason-input">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Reason for disabling (optional)
                    </label>
                    <input
                      type="text"
                      value={reasonInput.reason}
                      onChange={(e) => setReasonInput({ ...reasonInput, reason: e.target.value })}
                      placeholder="e.g. Customer requested module removal"
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <button
                    onClick={confirmDisable}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setReasonInput(null)}
                    className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feature Flags Section
// ---------------------------------------------------------------------------

function FeatureFlagsSection({ tenant, canModify }: { tenant: TenantDetail; canModify: boolean }) {
  const updateFlags = useUpdateFeatureFlags();

  function handleToggle(featureKey: string, newEnabled: boolean) {
    updateFlags.mutate(
      {
        id: tenant.id,
        flags: [{ featureKey, enabled: newEnabled }],
      },
      {
        onSuccess: () => {
          toast.success(`Feature flag "${featureKey}" ${newEnabled ? 'enabled' : 'disabled'}`);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error
              ? `Failed to update flag: ${err.message}`
              : 'Failed to update feature flag',
          );
        },
      },
    );
  }

  if (tenant.featureFlags.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Feature Flags
        </h3>
        <div
          className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center"
          data-testid="feature-flags-empty"
        >
          <p className="text-sm text-muted-foreground">
            No feature flags configured for this tenant.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Feature Flags
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Toggle feature flags for this tenant. Changes take effect immediately via webhook.
      </p>

      <div className="divide-y divide-border" data-testid="feature-flags-list">
        {tenant.featureFlags.map((flag) => (
          <div key={flag.id} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm">{flag.featureKey}</span>
              <span className="text-xs text-muted-foreground">
                Changed {formatDistanceToNow(new Date(flag.changedAt), { addSuffix: true })}
              </span>
            </div>

            <Switch
              checked={flag.enabled}
              onCheckedChange={(checked) => handleToggle(flag.featureKey, checked)}
              disabled={!canModify || updateFlags.isPending}
              data-testid={`flag-toggle-${flag.featureKey}`}
              aria-label={`Toggle ${flag.featureKey}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
