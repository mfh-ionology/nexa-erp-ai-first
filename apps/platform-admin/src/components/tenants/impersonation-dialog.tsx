// ---------------------------------------------------------------------------
// ImpersonationDialog — Modal for starting an impersonation session
// Requires mandatory reason (min 10 chars, BR-PLT-012) and configurable
// duration (BR-PLT-013). RBAC: only rendered for PLATFORM_ADMIN.
// Story: E13b.5 Task 4.1
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';

import { usePlatformAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

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
import { apiPost } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StartImpersonationResponse {
  sessionId: string;
  token: string;
  expiresAt: string;
}

export interface ImpersonationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName: string;
  tenantCode?: string;
}

// ---------------------------------------------------------------------------
// Duration options (minutes)
// ---------------------------------------------------------------------------

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
  { value: 480, label: '8 hours' },
] as const;

// ---------------------------------------------------------------------------
// ERP URL — dev default, override via env var in production
// ---------------------------------------------------------------------------

const ERP_WEB_URL = import.meta.env.VITE_ERP_WEB_URL ?? 'http://localhost:5110';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImpersonationDialog({
  open,
  onOpenChange,
  tenantId,
  tenantName,
  tenantCode,
}: ImpersonationDialogProps) {
  const [reason, setReason] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const adminEmail = usePlatformAuthStore((s) => s.user?.email ?? '');

  const mutation = useMutation({
    mutationFn: (payload: { reason: string; durationMinutes: number }) =>
      apiPost<StartImpersonationResponse>(`/admin/tenants/${tenantId}/impersonate`, payload),
    onSuccess: (result) => {
      toast.success('Impersonation session started');
      resetAndClose();
      // E13b.5 Fix: Use URL hash fragment instead of query parameters to avoid
      // leaking the JWT token in server logs, Referer headers, and proxy logs.
      // Hash fragments are NOT sent to the server.
      const params = new URLSearchParams({
        impersonation_token: result.data.token,
        admin_email: adminEmail,
        tenant_name: tenantName,
        reason,
        ...(tenantCode ? { tenant_code: tenantCode } : {}),
      });
      window.open(`${ERP_WEB_URL}#${params.toString()}`, '_blank');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to start impersonation');
    },
  });

  const canSubmit = reason.trim().length >= 10 && !mutation.isPending;

  function resetAndClose() {
    setReason('');
    setDurationMinutes(60);
    onOpenChange(false);
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      if (mutation.isPending) return; // prevent close during submission
      resetAndClose();
    }
  }

  function handleSubmit() {
    if (!canSubmit) return;
    mutation.mutate({ reason: reason.trim(), durationMinutes });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Impersonate Tenant</AlertDialogTitle>
          <AlertDialogDescription>
            Start an impersonation session for <strong>{tenantName}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Warning banner */}
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            You will be redirected to the tenant's ERP. All actions will be audited and recorded
            against your platform admin identity.
          </span>
        </div>

        {/* Reason field (min 10 chars, BR-PLT-012) */}
        <div>
          <label htmlFor="impersonation-reason" className="mb-1.5 block text-sm font-medium">
            Reason <span className="text-destructive">*</span>
          </label>
          <textarea
            id="impersonation-reason"
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Describe why you need to impersonate this tenant (min 10 characters)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={mutation.isPending}
            data-testid="impersonation-reason"
          />
          {reason.length > 0 && reason.trim().length < 10 && (
            <p className="mt-1 text-xs text-destructive">Reason must be at least 10 characters</p>
          )}
        </div>

        {/* Duration selector (BR-PLT-013) */}
        <div>
          <label htmlFor="impersonation-duration" className="mb-1.5 block text-sm font-medium">
            Session Duration
          </label>
          <select
            id="impersonation-duration"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            disabled={mutation.isPending}
            data-testid="impersonation-duration"
          >
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={resetAndClose} disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <Button
            className="bg-amber-600 text-white hover:bg-amber-700"
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="impersonation-submit"
          >
            {mutation.isPending ? 'Starting...' : 'Start Impersonation'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
