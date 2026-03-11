// ---------------------------------------------------------------------------
// Users Tab — Placeholder until tenant user management endpoint is available
// Story: E13b.2 Task 6.1
// ---------------------------------------------------------------------------

import { Users } from 'lucide-react';

import { usePlatformAuthStore } from '@/stores/auth-store';
import { canPerformAction } from '@/lib/platform-rbac';
import type { TenantDetail } from '@/types/tenant';

interface UsersTabProps {
  tenant: TenantDetail;
}

export function UsersTab({ tenant }: UsersTabProps) {
  const userRole = usePlatformAuthStore((s) => s.user?.role);
  const canManageUsers = !!userRole && canPerformAction(userRole, 'edit_platform_user');

  return (
    <div data-testid="users-tab">
      {/* Placeholder — backend GET /admin/tenants/:id/users not yet available */}
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
        <Users className="mb-3 size-10 text-muted-foreground/50" />
        <h3 className="text-sm font-semibold text-foreground">User management coming soon</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Tenant user listing for <span className="font-medium">{tenant.displayName}</span> will be
          available once the user management API is implemented.
        </p>

        {canManageUsers && (
          <p className="mt-3 text-xs text-muted-foreground">
            Actions (Force Password Reset, Lock Account, Revoke Sessions) will appear here for
            administrators.
          </p>
        )}
      </div>
    </div>
  );
}
