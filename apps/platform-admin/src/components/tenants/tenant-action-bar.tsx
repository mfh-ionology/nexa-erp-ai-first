// ---------------------------------------------------------------------------
// TenantActionBar — Status-driven lifecycle action buttons
// Respects BR-PLT-001 state machine and RBAC (canPerformAction)
// Story: E13b.2 Task 3.2
// ---------------------------------------------------------------------------

import { Archive, Play, ShieldOff, UserRoundCog } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { canPerformAction } from '@/lib/platform-rbac';
import { usePlatformAuthStore } from '@/stores/auth-store';
import type { TenantStatus } from '@/types/tenant';

interface TenantActionBarProps {
  status: TenantStatus;
  onSuspend: () => void;
  onReactivate: () => void;
  onArchive: () => void;
  onImpersonate?: () => void;
}

export function TenantActionBar({
  status,
  onSuspend,
  onReactivate,
  onArchive,
  onImpersonate,
}: TenantActionBarProps) {
  const userRole = usePlatformAuthStore((s) => s.user?.role);

  // PLATFORM_VIEWER and unauthenticated users see no action buttons
  if (!userRole || !canPerformAction(userRole, 'suspend_tenant')) {
    return null;
  }

  const canImpersonate = canPerformAction(userRole, 'impersonate');
  const isActive = status === 'ACTIVE';

  return (
    <div className="flex items-center gap-2" data-testid="tenant-action-bar">
      {/* Impersonate — PLATFORM_ADMIN only, disabled for non-ACTIVE tenants */}
      {canImpersonate && (
        <Button
          size="sm"
          className="bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
          onClick={onImpersonate}
          disabled={!isActive}
          title={!isActive ? 'Can only impersonate active tenants' : undefined}
          data-testid="impersonate-btn"
        >
          <UserRoundCog className="size-4" />
          Impersonate
        </Button>
      )}

      {/* ACTIVE → Suspend (BR-PLT-001) */}
      {status === 'ACTIVE' && (
        <Button variant="destructive" size="sm" onClick={onSuspend} data-testid="suspend-btn">
          <ShieldOff className="size-4" />
          Suspend
        </Button>
      )}

      {/* SUSPENDED → Reactivate (BR-PLT-001) */}
      {status === 'SUSPENDED' && (
        <Button size="sm" onClick={onReactivate} data-testid="reactivate-btn">
          <Play className="size-4" />
          Reactivate
        </Button>
      )}

      {/* SUSPENDED → Archive (BR-PLT-001, BR-PLT-003 — irreversible) */}
      {status === 'SUSPENDED' && (
        <Button variant="destructive" size="sm" onClick={onArchive} data-testid="archive-btn">
          <Archive className="size-4" />
          Archive
        </Button>
      )}

      {/* PROVISIONING, READ_ONLY, ARCHIVED — no actions (system-managed or terminal) */}
    </div>
  );
}
