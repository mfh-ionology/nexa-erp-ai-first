// ---------------------------------------------------------------------------
// PlanFormDialog — Create or Edit a subscription plan
// Story: E13b.3 Task 3.3, 3.4
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useCreatePlan, useUpdatePlan } from '@/hooks/use-billing';
import { PlatformApiError } from '@/lib/api-client';
import type { Plan } from '@/types/tenant';

interface PlanFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** When provided, dialog is in edit mode with pre-populated values */
  plan?: Plan;
}

/** Known ERP module keys */
const AVAILABLE_MODULES = [
  { key: 'system', label: 'System' },
  { key: 'finance', label: 'Finance' },
  { key: 'ar', label: 'AR' },
  { key: 'ap', label: 'AP' },
  { key: 'sales', label: 'Sales' },
  { key: 'purchasing', label: 'Purchasing' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'crm', label: 'CRM' },
  { key: 'hr_payroll', label: 'HR/Payroll' },
  { key: 'manufacturing', label: 'Manufacturing' },
  { key: 'reporting', label: 'Reporting' },
] as const;

const CODE_REGEX = /^[a-z0-9_-]+$/;

interface FormState {
  code: string;
  displayName: string;
  maxUsers: string;
  maxCompanies: string;
  monthlyAiTokenAllowance: string;
  aiHardLimit: boolean;
  enabledModules: string[];
  apiRateLimit: string;
  isActive: boolean;
}

interface FormErrors {
  code?: string;
  displayName?: string;
  maxUsers?: string;
  maxCompanies?: string;
  monthlyAiTokenAllowance?: string;
  enabledModules?: string;
}

function getInitialState(plan?: Plan): FormState {
  if (plan) {
    return {
      code: plan.code,
      displayName: plan.displayName,
      maxUsers: String(plan.maxUsers ?? ''),
      maxCompanies: String(plan.maxCompanies ?? ''),
      monthlyAiTokenAllowance: plan.monthlyAiTokenAllowance,
      aiHardLimit: plan.aiHardLimit ?? true,
      enabledModules: plan.enabledModules ?? [],
      apiRateLimit: String(plan.apiRateLimit ?? 1000),
      isActive: plan.isActive,
    };
  }
  return {
    code: '',
    displayName: '',
    maxUsers: '',
    maxCompanies: '',
    monthlyAiTokenAllowance: '',
    aiHardLimit: true,
    enabledModules: [],
    apiRateLimit: '1000',
    isActive: true,
  };
}

function validate(form: FormState, isEdit: boolean): FormErrors {
  const errors: FormErrors = {};

  if (!isEdit) {
    if (!form.code.trim()) {
      errors.code = 'Code is required';
    } else if (!CODE_REGEX.test(form.code)) {
      errors.code = 'Lowercase alphanumeric, hyphens, and underscores only';
    } else if (form.code.length > 30) {
      errors.code = 'Maximum 30 characters';
    }
  }

  if (!form.displayName.trim()) {
    errors.displayName = 'Display name is required';
  } else if (form.displayName.length > 100) {
    errors.displayName = 'Maximum 100 characters';
  }

  const maxUsers = Number(form.maxUsers);
  if (!form.maxUsers || isNaN(maxUsers) || maxUsers < 1) {
    errors.maxUsers = 'Must be at least 1';
  }

  const maxCompanies = Number(form.maxCompanies);
  if (!form.maxCompanies || isNaN(maxCompanies) || maxCompanies < 1) {
    errors.maxCompanies = 'Must be at least 1';
  }

  const tokens = Number(form.monthlyAiTokenAllowance);
  if (form.monthlyAiTokenAllowance === '' || isNaN(tokens) || tokens < 0) {
    errors.monthlyAiTokenAllowance = 'Must be 0 or greater';
  }

  if (form.enabledModules.length === 0) {
    errors.enabledModules = 'At least one module is required';
  }

  return errors;
}

export function PlanFormDialog({ open, onClose, plan }: PlanFormDialogProps) {
  const isEdit = !!plan;
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();

  const [form, setForm] = useState<FormState>(() => getInitialState(plan));
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Reset form when dialog opens with different plan
  useEffect(() => {
    if (open) {
      setForm(getInitialState(plan));
      setErrors({});
      setServerError(null);
    }
  }, [open, plan]);

  const isPending = createPlan.isPending || updatePlan.isPending;

  function handleFieldChange(field: keyof FormState, value: string | boolean | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (field in errors) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    setServerError(null);
  }

  function toggleModule(moduleKey: string) {
    setForm((prev) => {
      const modules = prev.enabledModules.includes(moduleKey)
        ? prev.enabledModules.filter((m) => m !== moduleKey)
        : [...prev.enabledModules, moduleKey];
      return { ...prev, enabledModules: modules };
    });
    if (errors.enabledModules) {
      setErrors((prev) => ({ ...prev, enabledModules: undefined }));
    }
  }

  function handleSubmit() {
    const validationErrors = validate(form, isEdit);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (isEdit) {
      updatePlan.mutate(
        {
          id: plan!.id,
          displayName: form.displayName,
          maxUsers: Number(form.maxUsers),
          maxCompanies: Number(form.maxCompanies),
          monthlyAiTokenAllowance: Number(form.monthlyAiTokenAllowance),
          aiHardLimit: form.aiHardLimit,
          enabledModules: form.enabledModules,
          apiRateLimit: Number(form.apiRateLimit) || 1000,
          isActive: form.isActive,
        },
        {
          onSuccess: () => {
            toast.success(`Plan "${form.displayName}" updated`);
            onClose();
          },
          onError: (error: Error) => {
            setServerError(error.message || 'Failed to update plan');
          },
        },
      );
    } else {
      createPlan.mutate(
        {
          code: form.code.trim(),
          displayName: form.displayName.trim(),
          maxUsers: Number(form.maxUsers),
          maxCompanies: Number(form.maxCompanies),
          monthlyAiTokenAllowance: Number(form.monthlyAiTokenAllowance),
          aiHardLimit: form.aiHardLimit,
          enabledModules: form.enabledModules,
          apiRateLimit: Number(form.apiRateLimit) || 1000,
        },
        {
          onSuccess: () => {
            toast.success(`Plan "${form.displayName}" created`);
            onClose();
          },
          onError: (error: Error) => {
            if (error instanceof PlatformApiError && error.statusCode === 409) {
              setServerError('A plan with this code already exists');
            } else {
              setServerError(error.message || 'Failed to create plan');
            }
          },
        },
      );
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen && !isPending) {
      onClose();
    }
  }

  const inputCls =
    'w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';
  const labelCls = 'mb-1 block text-sm font-medium';
  const errorCls = 'mt-0.5 text-xs text-destructive';

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{isEdit ? 'Edit Plan' : 'Create Plan'}</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Server Error */}
          {serverError && (
            <div
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              data-testid="plan-form-error"
            >
              {serverError}
            </div>
          )}

          {/* Code (create only) */}
          {!isEdit && (
            <div>
              <label htmlFor="plan-code" className={labelCls}>
                Code <span className="text-destructive">*</span>
              </label>
              <input
                id="plan-code"
                type="text"
                className={inputCls}
                placeholder="e.g. pro, enterprise"
                value={form.code}
                onChange={(e) => handleFieldChange('code', e.target.value.toLowerCase())}
                disabled={isPending}
                maxLength={30}
                data-testid="plan-code-input"
              />
              {errors.code && <p className={errorCls}>{errors.code}</p>}
              <p className="mt-0.5 text-xs text-muted-foreground">
                Lowercase letters, numbers, hyphens, underscores. Cannot be changed later.
              </p>
            </div>
          )}

          {/* Display Name */}
          <div>
            <label htmlFor="plan-display-name" className={labelCls}>
              Display Name <span className="text-destructive">*</span>
            </label>
            <input
              id="plan-display-name"
              type="text"
              className={inputCls}
              placeholder="e.g. Professional"
              value={form.displayName}
              onChange={(e) => handleFieldChange('displayName', e.target.value)}
              disabled={isPending}
              maxLength={100}
              data-testid="plan-display-name-input"
            />
            {errors.displayName && <p className={errorCls}>{errors.displayName}</p>}
          </div>

          {/* Max Users + Max Companies (side by side) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="plan-max-users" className={labelCls}>
                Max Users <span className="text-destructive">*</span>
              </label>
              <input
                id="plan-max-users"
                type="number"
                className={inputCls}
                min={1}
                value={form.maxUsers}
                onChange={(e) => handleFieldChange('maxUsers', e.target.value)}
                disabled={isPending}
                data-testid="plan-max-users-input"
              />
              {errors.maxUsers && <p className={errorCls}>{errors.maxUsers}</p>}
            </div>
            <div>
              <label htmlFor="plan-max-companies" className={labelCls}>
                Max Companies <span className="text-destructive">*</span>
              </label>
              <input
                id="plan-max-companies"
                type="number"
                className={inputCls}
                min={1}
                value={form.maxCompanies}
                onChange={(e) => handleFieldChange('maxCompanies', e.target.value)}
                disabled={isPending}
                data-testid="plan-max-companies-input"
              />
              {errors.maxCompanies && <p className={errorCls}>{errors.maxCompanies}</p>}
            </div>
          </div>

          {/* Monthly AI Token Allowance */}
          <div>
            <label htmlFor="plan-token-allowance" className={labelCls}>
              Monthly AI Token Allowance <span className="text-destructive">*</span>
            </label>
            <input
              id="plan-token-allowance"
              type="number"
              className={inputCls}
              min={0}
              value={form.monthlyAiTokenAllowance}
              onChange={(e) => handleFieldChange('monthlyAiTokenAllowance', e.target.value)}
              disabled={isPending}
              data-testid="plan-token-allowance-input"
            />
            {errors.monthlyAiTokenAllowance && (
              <p className={errorCls}>{errors.monthlyAiTokenAllowance}</p>
            )}
          </div>

          {/* AI Hard Limit */}
          <div className="flex items-center gap-2">
            <input
              id="plan-ai-hard-limit"
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-primary"
              checked={form.aiHardLimit}
              onChange={(e) => handleFieldChange('aiHardLimit', e.target.checked)}
              disabled={isPending}
              data-testid="plan-ai-hard-limit-input"
            />
            <label htmlFor="plan-ai-hard-limit" className="text-sm font-medium">
              Enforce hard limit on AI tokens
            </label>
          </div>

          {/* API Rate Limit */}
          <div>
            <label htmlFor="plan-api-rate-limit" className={labelCls}>
              API Rate Limit (req/min)
            </label>
            <input
              id="plan-api-rate-limit"
              type="number"
              className={inputCls}
              min={1}
              value={form.apiRateLimit}
              onChange={(e) => handleFieldChange('apiRateLimit', e.target.value)}
              disabled={isPending}
              data-testid="plan-api-rate-limit-input"
            />
          </div>

          {/* Enabled Modules */}
          <div>
            <span className={labelCls}>
              Enabled Modules <span className="text-destructive">*</span>
            </span>
            <div className="mt-1.5 flex flex-wrap gap-2" data-testid="plan-modules-selector">
              {AVAILABLE_MODULES.map(({ key, label }) => {
                const selected = form.enabledModules.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={
                      selected
                        ? 'rounded-full bg-purple-600 px-3 py-1 text-xs font-medium text-white transition-colors'
                        : 'rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50'
                    }
                    onClick={() => toggleModule(key)}
                    disabled={isPending}
                    data-testid={`module-toggle-${key}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {errors.enabledModules && <p className={errorCls}>{errors.enabledModules}</p>}
          </div>

          {/* Is Active toggle (edit only) */}
          {isEdit && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 p-3">
              <input
                id="plan-is-active"
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-primary"
                checked={form.isActive}
                onChange={(e) => handleFieldChange('isActive', e.target.checked)}
                disabled={isPending}
                data-testid="plan-is-active-input"
              />
              <label htmlFor="plan-is-active" className="text-sm font-medium">
                Plan is active
              </label>
              <span className="text-xs text-muted-foreground">
                — Inactive plans cannot be assigned to new tenants
              </span>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={isPending}>
            Cancel
          </AlertDialogCancel>
          <Button onClick={handleSubmit} disabled={isPending} data-testid="plan-form-submit">
            {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Plan'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
