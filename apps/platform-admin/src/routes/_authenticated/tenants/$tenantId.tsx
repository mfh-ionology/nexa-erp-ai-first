// ---------------------------------------------------------------------------
// Tenant Detail Page — T2 Record Detail with 7-tab layout
// Story: E13b.2 Task 3
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Activity,
  BookOpen,
  Brain,
  CreditCard,
  LayoutDashboard,
  Settings2,
  Stethoscope,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImpersonationDialog } from '@/components/tenants/impersonation-dialog';
import { TenantActionBar } from '@/components/tenants/tenant-action-bar';
import { OverviewTab } from '@/components/tenants/tabs/overview-tab';
import { ModulesFlagsTab } from '@/components/tenants/tabs/modules-flags-tab';
import { UsersTab } from '@/components/tenants/tabs/users-tab';
import { AiUsageTab } from '@/components/tenants/tabs/ai-usage-tab';
import { BillingTab } from '@/components/tenants/tabs/billing-tab';
import { DiagnosticsTab } from '@/components/tenants/tabs/diagnostics-tab';
import { AuditTab } from '@/components/tenants/tabs/audit-tab';
import {
  useTenant,
  useSuspendTenant,
  useReactivateTenant,
  useArchiveTenant,
} from '@/hooks/use-tenants';

export const Route = createFileRoute('/_authenticated/tenants/$tenantId')({
  component: TenantDetailPage,
});

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'modules', label: 'Modules & Flags', icon: Settings2 },
  { value: 'users', label: 'Users', icon: Users },
  { value: 'ai-usage', label: 'AI Usage', icon: Brain },
  { value: 'billing', label: 'Billing', icon: CreditCard },
  { value: 'diagnostics', label: 'Diagnostics', icon: Stethoscope },
  { value: 'audit', label: 'Audit', icon: BookOpen },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TenantDetailPage() {
  const { tenantId } = Route.useParams();
  const { data: result, isLoading, isError, error } = useTenant(tenantId);
  const tenant = result?.data;

  // Dialog state
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [impersonateOpen, setImpersonateOpen] = useState(false);

  // Lifecycle mutations
  const suspendMutation = useSuspendTenant();
  const reactivateMutation = useReactivateTenant();
  const archiveMutation = useArchiveTenant();

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <div className="animate-fade-in-up p-8" data-testid="tenant-detail-loading">
        <div className="mb-1 text-sm text-muted-foreground">
          <Link to="/tenants" className="hover:underline">
            Platform Admin &gt; Tenants
          </Link>{' '}
          &gt; ...
        </div>
        <div className="space-y-4">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-lg border border-border bg-muted/30"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (isError || !tenant) {
    return (
      <div className="animate-fade-in-up p-8" data-testid="tenant-detail-error">
        <div className="mb-1 text-sm text-muted-foreground">
          <Link to="/tenants" className="hover:underline">
            Platform Admin &gt; Tenants
          </Link>{' '}
          &gt; Error
        </div>
        <div className="mx-auto max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <Activity className="mx-auto mb-3 size-8 text-destructive" />
          <h2 className="text-lg font-semibold text-destructive">Tenant not found</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'The requested tenant could not be loaded.'}
          </p>
          <Link
            to="/tenants"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Back to Tenants
          </Link>
        </div>
      </div>
    );
  }

  // --- Detail page ---
  return (
    <div className="animate-fade-in-up p-8" data-testid="tenant-detail">
      {/* Breadcrumb */}
      <div className="mb-1 text-sm text-muted-foreground">
        <Link to="/tenants" className="hover:underline">
          Platform Admin &gt; Tenants
        </Link>{' '}
        &gt; {tenant.displayName}
      </div>

      {/* Header row: title + status badge + action bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{tenant.displayName}</h1>
          <StatusBadge status={tenant.status} />
        </div>

        <TenantActionBar
          status={tenant.status}
          onSuspend={() => setSuspendOpen(true)}
          onReactivate={() => setReactivateOpen(true)}
          onArchive={() => setArchiveOpen(true)}
          onImpersonate={() => setImpersonateOpen(true)}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} data-testid={`tab-${tab.value}`}>
              <tab.icon className="size-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab tenant={tenant} />
        </TabsContent>

        <TabsContent value="modules">
          <ModulesFlagsTab tenant={tenant} />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab tenant={tenant} />
        </TabsContent>

        <TabsContent value="ai-usage">
          <AiUsageTab tenant={tenant} />
        </TabsContent>

        <TabsContent value="billing">
          <BillingTab tenant={tenant} />
        </TabsContent>

        <TabsContent value="diagnostics">
          <DiagnosticsTab tenant={tenant} />
        </TabsContent>

        <TabsContent value="audit">
          <AuditTab tenant={tenant} />
        </TabsContent>
      </Tabs>

      {/* ----- Lifecycle Action Dialogs (Task 5) ----- */}

      {/* 5.1 Suspend Tenant */}
      <ConfirmationDialog
        open={suspendOpen}
        onCancel={() => setSuspendOpen(false)}
        onConfirm={(reason) => {
          if (!reason) return;
          suspendMutation.mutate(
            { id: tenantId, reason },
            {
              onSuccess: () => {
                toast.success('Tenant suspended');
                setSuspendOpen(false);
              },
              onError: (err) => {
                toast.error(err instanceof Error ? err.message : 'Failed to suspend tenant');
              },
            },
          );
        }}
        title="Suspend Tenant"
        description={`Suspending ${tenant.displayName} will immediately block all ERP login and write operations for this tenant. The webhook fires within 30 seconds.`}
        confirmLabel="Suspend Tenant"
        variant="destructive"
        requireReason
        loading={suspendMutation.isPending}
      />

      {/* 5.2 Reactivate Tenant */}
      <ConfirmationDialog
        open={reactivateOpen}
        onCancel={() => setReactivateOpen(false)}
        onConfirm={() => {
          reactivateMutation.mutate(tenantId, {
            onSuccess: () => {
              toast.success('Tenant reactivated');
              setReactivateOpen(false);
            },
            onError: (err) => {
              toast.error(err instanceof Error ? err.message : 'Failed to reactivate tenant');
            },
          });
        }}
        title="Reactivate Tenant"
        description={`Reactivating ${tenant.displayName} will restore full ERP access. The entitlement cache will be refreshed within 30 seconds.`}
        confirmLabel="Reactivate"
        variant="default"
        loading={reactivateMutation.isPending}
      />

      {/* 5.3 Archive Tenant */}
      <ConfirmationDialog
        open={archiveOpen}
        onCancel={() => setArchiveOpen(false)}
        onConfirm={() => {
          archiveMutation.mutate(tenantId, {
            onSuccess: () => {
              toast.success('Tenant archived');
              setArchiveOpen(false);
            },
            onError: (err) => {
              toast.error(err instanceof Error ? err.message : 'Failed to archive tenant');
            },
          });
        }}
        title="Archive Tenant"
        description={`WARNING: Archiving ${tenant.displayName} is IRREVERSIBLE from the UI. The tenant database will be retained for regulatory compliance but the tenant cannot be reactivated. Only manual database intervention by engineering can restore an archived tenant.`}
        confirmLabel="Archive Tenant"
        variant="destructive"
        requireReason
        loading={archiveMutation.isPending}
      />

      {/* Impersonate Tenant (E13b.5 Task 4) */}
      <ImpersonationDialog
        open={impersonateOpen}
        onOpenChange={setImpersonateOpen}
        tenantId={tenantId}
        tenantName={tenant.displayName}
        tenantCode={tenant.code}
      />
    </div>
  );
}
