// ---------------------------------------------------------------------------
// Tenant AI Usage Detail — Per-tenant drill-down with KPIs, charts, quota
// Story E13b-4 Task 6.2 (AC#2)
// ---------------------------------------------------------------------------

import { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import { Coins, Calendar, TrendingUp, Loader2, Settings2, Key, Plus, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { cn } from '@/lib/utils';
import { RequirePlatformRole } from '@/components/auth/require-platform-role';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { KpiCard } from '@/features/intelligence/components/kpi-card';

import {
  useTenantAiUsage,
  useTenantAiUsageByFeature,
  useTenantAiQuota,
} from '../hooks/use-ai-usage';
import type {
  DailyTrendItem,
  ProviderBreakdown,
  FeatureUsage,
  ByokSplit,
} from '../hooks/use-ai-usage';
import {
  useTenantByokKeys,
  useAddByokKey,
  useRemoveByokKey,
  useToggleByokKey,
} from '../hooks/use-tenant-byok';
import { useAiProviders } from '../hooks/use-ai-providers';
import { QuotaProgressBar } from './quota-progress-bar';
import { QuotaSettingsEditor } from './quota-settings-editor';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TenantAiUsageDetailProps {
  tenantId: string;
  /** Tenant plan code — used to determine Enterprise tier for BYOK section */
  planCode?: string;
}

// ---------------------------------------------------------------------------
// Number formatting helpers
// ---------------------------------------------------------------------------

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-GB');
}

function formatGbp(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(num);
}

// ---------------------------------------------------------------------------
// Chart colours
// ---------------------------------------------------------------------------

const PROVIDER_COLOURS = ['#7c3aed', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'];
const FEATURE_COLOURS = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626'];
const BYOK_COLOURS = ['#7c3aed', '#e5e7eb'];

// ---------------------------------------------------------------------------
// Tooltip components
// ---------------------------------------------------------------------------

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: DailyTrendItem }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const first = payload[0];
  if (!first) return null;
  const item = first.payload;

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card px-3 py-2 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{formatTokens(item.tokens)} tokens</p>
      <p className="text-xs text-muted-foreground">{formatGbp(item.cost)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FeatureBreakdownChart({ features }: { features: FeatureUsage[] }) {
  if (features.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No feature usage data available.
      </p>
    );
  }

  const chartData = features.map((f) => ({
    ...f,
    label: f.featureKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(features.length * 40, 120)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(val: number) => formatTokens(val)}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        />
        <Tooltip
          formatter={(value: number | undefined) => [formatTokens(value ?? 0), 'Tokens']}
          contentStyle={{
            borderRadius: 'var(--radius-card)',
            border: '1px solid hsl(var(--border))',
            backgroundColor: 'hsl(var(--card))',
          }}
        />
        <Bar dataKey="tokens" radius={[0, 4, 4, 0]}>
          {chartData.map((_, idx) => (
            <Cell key={idx} fill={FEATURE_COLOURS[idx % FEATURE_COLOURS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ProviderBreakdownChart({ providers }: { providers: ProviderBreakdown[] }) {
  if (providers.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No provider usage data available.
      </p>
    );
  }

  const chartData = providers.map((p) => ({
    ...p,
    name: p.provider.charAt(0).toUpperCase() + p.provider.slice(1),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="tokens"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={(props: PieLabelRenderProps) =>
            `${String(props.name ?? '')} (${Number((props as PieLabelRenderProps & { pct?: number }).pct ?? 0).toFixed(0)}%)`
          }
          labelLine={false}
        >
          {chartData.map((_, idx) => (
            <Cell key={idx} fill={PROVIDER_COLOURS[idx % PROVIDER_COLOURS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number | undefined) => [formatTokens(value ?? 0), 'Tokens']}
          contentStyle={{
            borderRadius: 'var(--radius-card)',
            border: '1px solid hsl(var(--border))',
            backgroundColor: 'hsl(var(--card))',
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ByokSplitChart({ byokSplit }: { byokSplit: ByokSplit }) {
  const data = [
    { name: 'BYOK', value: byokSplit.byokTokens },
    { name: 'Vendor', value: byokSplit.vendorTokens },
  ];

  const total = byokSplit.byokTokens + byokSplit.vendorTokens;
  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No BYOK usage data available.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          label={(props: PieLabelRenderProps) =>
            `${String(props.name ?? '')}: ${formatTokens(Number(props.value ?? 0))}`
          }
          labelLine={false}
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={BYOK_COLOURS[idx % BYOK_COLOURS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number | undefined) => [formatTokens(value ?? 0), 'Tokens']}
          contentStyle={{
            borderRadius: 'var(--radius-card)',
            border: '1px solid hsl(var(--border))',
            backgroundColor: 'hsl(var(--card))',
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Add BYOK Key Modal
// ---------------------------------------------------------------------------

function AddByokKeyModal({
  open,
  tenantId,
  existingProviderIds,
  onClose,
}: {
  open: boolean;
  tenantId: string;
  existingProviderIds: string[];
  onClose: () => void;
}) {
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const { data: providers } = useAiProviders();
  const addByokMutation = useAddByokKey();

  const availableProviders = (providers ?? []).filter(
    (p) => !existingProviderIds.includes(p.providerId),
  );

  function handleSubmit() {
    if (!selectedProvider || !apiKey.trim()) return;
    addByokMutation.mutate(
      { tenantId, providerId: selectedProvider, apiKey: apiKey.trim() },
      {
        onSuccess: () => {
          setSelectedProvider('');
          setApiKey('');
          onClose();
        },
      },
    );
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setSelectedProvider('');
      setApiKey('');
      addByokMutation.reset();
      onClose();
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Add BYOK API Key</AlertDialogTitle>
          <AlertDialogDescription>
            Add a Bring Your Own Key (BYOK) API key for this tenant. Only available for Enterprise
            plan tenants.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div>
            <label htmlFor="byok-provider-select" className="mb-1.5 block text-sm font-medium">
              Provider
            </label>
            <select
              id="byok-provider-select"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              disabled={addByokMutation.isPending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select a provider...</option>
              {availableProviders.map((p) => (
                <option key={p.providerId} value={p.providerId}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="byok-api-key" className="mb-1.5 block text-sm font-medium">
              API Key
            </label>
            <input
              id="byok-api-key"
              type="password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={addByokMutation.isPending}
              autoComplete="off"
            />
          </div>

          {addByokMutation.isError && (
            <p className="text-xs text-destructive">
              {addByokMutation.error?.message ?? 'Failed to add BYOK key'}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={addByokMutation.isPending}>Cancel</AlertDialogCancel>
          <Button
            onClick={handleSubmit}
            disabled={!selectedProvider || !apiKey.trim() || addByokMutation.isPending}
          >
            {addByokMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              'Add Key'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// BYOK Management Section (Enterprise only)
// ---------------------------------------------------------------------------

function ByokManagementSection({ tenantId }: { tenantId: string }) {
  const { data: byokKeys, isLoading } = useTenantByokKeys(tenantId);
  const { data: providers } = useAiProviders();
  const toggleMutation = useToggleByokKey();
  const removeMutation = useRemoveByokKey();

  const [showAddModal, setShowAddModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    providerId: string;
    displayName: string;
  } | null>(null);
  const [togglingProviderId, setTogglingProviderId] = useState<string | null>(null);

  const providerMap = new Map((providers ?? []).map((p) => [p.providerId, p.displayName]));

  function handleToggle(providerId: string, isActive: boolean) {
    setTogglingProviderId(providerId);
    toggleMutation.mutate(
      { tenantId, providerId, isActive },
      { onSettled: () => setTogglingProviderId(null) },
    );
  }

  function handleRemoveConfirm() {
    if (!removeTarget) return;
    removeMutation.mutate(
      { tenantId, providerId: removeTarget.providerId },
      { onSuccess: () => setRemoveTarget(null) },
    );
  }

  return (
    <div data-testid="byok-management-section">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">BYOK API Keys</h3>
        <RequirePlatformRole roles={['PLATFORM_ADMIN']}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddModal(true)}
            data-testid="add-byok-key-btn"
          >
            <Plus className="h-3.5 w-3.5" />
            Add BYOK Key
          </Button>
        </RequirePlatformRole>
      </div>

      {isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !byokKeys || byokKeys.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No BYOK keys configured for this tenant.
        </p>
      ) : (
        <div className="space-y-2" role="list" aria-label="BYOK keys">
          {byokKeys.map((key) => (
            <div
              key={key.providerId}
              role="listitem"
              className={cn(
                'flex items-center gap-3 rounded-md border border-border bg-background px-4 py-3',
                'transition-shadow duration-200 hover:shadow-sm',
              )}
              data-testid={`byok-row-${key.providerId}`}
            >
              <Key className="h-4 w-4 shrink-0 text-purple-600" aria-hidden="true" />

              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-foreground">
                  {providerMap.get(key.providerId) ?? key.providerId}
                </span>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                      key.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        key.isActive ? 'bg-green-600' : 'bg-slate-400',
                      )}
                    />
                    {key.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {key.lastUsedAt && (
                    <span>
                      Last used {formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>

              <RequirePlatformRole roles={['PLATFORM_ADMIN']}>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={key.isActive}
                    onCheckedChange={(checked) => handleToggle(key.providerId, checked)}
                    disabled={togglingProviderId === key.providerId}
                    aria-label={`Toggle ${providerMap.get(key.providerId) ?? key.providerId} BYOK key`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setRemoveTarget({
                        providerId: key.providerId,
                        displayName: providerMap.get(key.providerId) ?? key.providerId,
                      })
                    }
                    data-testid={`remove-byok-btn-${key.providerId}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </RequirePlatformRole>
            </div>
          ))}
        </div>
      )}

      {/* Add BYOK Key Modal */}
      <AddByokKeyModal
        open={showAddModal}
        tenantId={tenantId}
        existingProviderIds={(byokKeys ?? []).map((k) => k.providerId)}
        onClose={() => setShowAddModal(false)}
      />

      {/* Remove BYOK Key Confirmation */}
      <ConfirmationDialog
        open={removeTarget !== null}
        onConfirm={handleRemoveConfirm}
        onCancel={() => setRemoveTarget(null)}
        title="Remove BYOK Key"
        description={`Are you sure you want to remove the BYOK key for ${removeTarget?.displayName ?? 'this provider'}? This tenant will fall back to vendor keys for this provider.`}
        confirmLabel="Remove Key"
        variant="destructive"
        loading={removeMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function TenantAiUsageDetail({ tenantId, planCode }: TenantAiUsageDetailProps) {
  const {
    data: usage,
    isLoading: usageLoading,
    error: usageError,
    refetch: refetchUsage,
  } = useTenantAiUsage(tenantId);
  const {
    data: featureData,
    isLoading: featureLoading,
    error: featureError,
    refetch: refetchFeature,
  } = useTenantAiUsageByFeature(tenantId);
  const {
    data: quota,
    isLoading: quotaLoading,
    refetch: refetchQuota,
  } = useTenantAiQuota(tenantId);

  const [showQuotaEditor, setShowQuotaEditor] = useState(false);

  const isEnterprise = planCode?.toLowerCase() === 'enterprise';
  const hasByok = isEnterprise && usage && usage.byokSplit.byokTokens > 0;

  return (
    <div className="space-y-6 animate-fade-in-up" data-testid="tenant-ai-usage-detail">
      {/* KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Tenant AI Usage KPIs">
        <KpiCard
          label="Tokens Today"
          value={usage?.tokensToday ?? null}
          icon={Coins}
          isLoading={usageLoading}
          error={usageError ?? undefined}
          onRetry={() => void refetchUsage()}
          className="animate-fade-in-up"
        />
        <KpiCard
          label="Tokens This Month"
          value={usage?.tokensThisMonth ?? null}
          icon={Calendar}
          isLoading={usageLoading}
          error={usageError ?? undefined}
          onRetry={() => void refetchUsage()}
          className="animate-fade-in-up delay-1"
        />
        <KpiCard
          label="Cost Estimate"
          value={usage ? formatGbp(usage.costEstimate) : null}
          icon={TrendingUp}
          isLoading={usageLoading}
          error={usageError ?? undefined}
          onRetry={() => void refetchUsage()}
          className="animate-fade-in-up delay-2"
        />
      </section>

      {/* Quota Progress Bar */}
      {quota && !quotaLoading && (
        <section
          className={cn(
            'rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)]',
            'animate-fade-in-up delay-2',
          )}
          aria-label="Token quota"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Quota Status</h3>
            <RequirePlatformRole roles={['PLATFORM_ADMIN']}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQuotaEditor(!showQuotaEditor)}
                data-testid="edit-quota-btn"
              >
                <Settings2 className="h-4 w-4" />
                Edit Quota
              </Button>
            </RequirePlatformRole>
          </div>

          <QuotaProgressBar
            tokensUsed={quota.tokensUsed}
            tokenAllowance={quota.tokenAllowance}
            softLimitPct={quota.softLimitPct}
            hardLimitPct={quota.hardLimitPct}
          />

          {showQuotaEditor && (
            <div className="mt-4 border-t border-border pt-4">
              <QuotaSettingsEditor
                tenantId={tenantId}
                currentQuota={quota}
                onClose={() => setShowQuotaEditor(false)}
                onSaved={() => {
                  setShowQuotaEditor(false);
                  void refetchQuota();
                }}
              />
            </div>
          )}
        </section>
      )}

      {/* Daily Trend Chart */}
      <section
        className={cn(
          'rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)]',
          'animate-fade-in-up delay-3',
        )}
        aria-label="Daily usage trend"
      >
        <h3 className="mb-4 text-sm font-semibold text-foreground">Daily Token Usage (30 days)</h3>
        {usageLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : usageError ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-destructive">
            <p className="text-sm">Failed to load chart data</p>
            <Button variant="ghost" size="sm" onClick={() => void refetchUsage()}>
              Retry
            </Button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={usage?.dailyTrend ?? []}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="tenantPurpleGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(val: string) => {
                  const d = new Date(val);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(val: number) => formatTokens(val)}
                width={60}
              />
              <Tooltip content={<TrendTooltip />} />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="#7c3aed"
                strokeWidth={2}
                fill="url(#tenantPurpleGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Usage by Feature */}
      <section
        className={cn(
          'rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)]',
          'animate-fade-in-up delay-3',
        )}
        aria-label="Usage by feature"
      >
        <h3 className="mb-4 text-sm font-semibold text-foreground">Usage by Feature</h3>
        {featureLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : featureError ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-destructive">
            <p className="text-sm">Failed to load feature data</p>
            <Button variant="ghost" size="sm" onClick={() => void refetchFeature()}>
              Retry
            </Button>
          </div>
        ) : (
          <FeatureBreakdownChart features={featureData?.features ?? []} />
        )}
      </section>

      {/* Usage by Provider */}
      <section
        className={cn(
          'rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)]',
          'animate-fade-in-up delay-3',
        )}
        aria-label="Usage by provider"
      >
        <h3 className="mb-4 text-sm font-semibold text-foreground">Usage by Provider</h3>
        {usageLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : usageError ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-destructive">
            <p className="text-sm">Failed to load</p>
            <Button variant="ghost" size="sm" onClick={() => void refetchUsage()}>
              Retry
            </Button>
          </div>
        ) : (
          <ProviderBreakdownChart providers={usage?.byProvider ?? []} />
        )}
      </section>

      {/* BYOK vs Vendor Split — Enterprise only */}
      {hasByok && (
        <section
          className={cn(
            'rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)]',
            'animate-fade-in-up delay-3',
          )}
          aria-label="BYOK vs vendor usage"
          data-testid="byok-split-section"
        >
          <h3 className="mb-4 text-sm font-semibold text-foreground">BYOK vs Vendor Key Usage</h3>
          <ByokSplitChart byokSplit={usage.byokSplit} />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            BYOK: {usage.byokSplit.byokPct.toFixed(1)}% of total tokens
          </p>
        </section>
      )}

      {/* BYOK Key Management — Enterprise only (AC#7) */}
      {isEnterprise && (
        <section
          className={cn(
            'rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)]',
            'animate-fade-in-up delay-3',
          )}
          aria-label="BYOK key management"
        >
          <ByokManagementSection tenantId={tenantId} />
        </section>
      )}
    </div>
  );
}
