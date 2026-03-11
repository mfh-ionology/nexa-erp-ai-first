// ---------------------------------------------------------------------------
// Providers Tab — Vendor API key management for platform-level AI providers
// Story E13b-4 Task 7.1 (AC#6)
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Key, Loader2, ServerCog } from 'lucide-react';
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

import { useAiProviders, useUpdateProviderKey, useToggleProvider } from '../hooks/use-ai-providers';
import type { VendorProvider } from '../hooks/use-ai-providers';

// ---------------------------------------------------------------------------
// Update Key Modal
// ---------------------------------------------------------------------------

function UpdateKeyModal({
  open,
  provider,
  onClose,
}: {
  open: boolean;
  provider: VendorProvider | null;
  onClose: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const updateKeyMutation = useUpdateProviderKey();

  function handleSubmit() {
    if (!provider || !apiKey.trim()) return;
    updateKeyMutation.mutate(
      { providerId: provider.providerId, apiKey: apiKey.trim() },
      {
        onSuccess: () => {
          setApiKey('');
          onClose();
        },
      },
    );
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setApiKey('');
      updateKeyMutation.reset();
      onClose();
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update API Key — {provider?.displayName}</AlertDialogTitle>
          <AlertDialogDescription>
            Enter the new API key for this provider. The key will be encrypted before storage.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div>
          <label htmlFor="provider-api-key" className="mb-1.5 block text-sm font-medium">
            API Key
          </label>
          <input
            id="provider-api-key"
            type="password"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={updateKeyMutation.isPending}
            autoComplete="off"
          />
          {updateKeyMutation.isError && (
            <p className="mt-1.5 text-xs text-destructive">
              {updateKeyMutation.error?.message ?? 'Failed to update key'}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={updateKeyMutation.isPending}>Cancel</AlertDialogCancel>
          <Button onClick={handleSubmit} disabled={!apiKey.trim() || updateKeyMutation.isPending}>
            {updateKeyMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Key'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Provider Row
// ---------------------------------------------------------------------------

function ProviderRow({
  provider,
  onUpdateKey,
}: {
  provider: VendorProvider;
  onUpdateKey: (provider: VendorProvider) => void;
}) {
  const toggleMutation = useToggleProvider();

  function handleToggle(checked: boolean) {
    toggleMutation.mutate({ providerId: provider.providerId, isActive: checked });
  }

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-[var(--radius-card)] border border-border bg-card p-4',
        'transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]',
      )}
      data-testid={`provider-row-${provider.providerId}`}
    >
      {/* Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100">
        <ServerCog className="h-5 w-5 text-purple-700" aria-hidden="true" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{provider.displayName}</span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
              provider.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500',
            )}
            data-testid={`provider-status-${provider.providerId}`}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                provider.isActive ? 'bg-green-600' : 'bg-slate-400',
              )}
            />
            {provider.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="font-mono" data-testid={`provider-key-${provider.providerId}`}>
            {provider.hasApiKey ? (
              <>
                <Key className="mr-1 inline h-3 w-3" />
                API Key: ****
              </>
            ) : (
              'No API key configured'
            )}
          </span>
          {provider.lastUsedAt && (
            <span>
              Last used {formatDistanceToNow(new Date(provider.lastUsedAt), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      {/* Actions — PLATFORM_ADMIN only */}
      <RequirePlatformRole roles={['PLATFORM_ADMIN']}>
        <div className="flex items-center gap-3">
          <Switch
            checked={provider.isActive}
            onCheckedChange={handleToggle}
            disabled={toggleMutation.isPending}
            aria-label={`Toggle ${provider.displayName} active`}
            data-testid={`provider-toggle-${provider.providerId}`}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdateKey(provider)}
            data-testid={`update-key-btn-${provider.providerId}`}
          >
            <Key className="h-3.5 w-3.5" />
            Update Key
          </Button>
        </div>
      </RequirePlatformRole>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyProviders() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <ServerCog className="mb-3 h-12 w-12 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">No providers configured</p>
      <p className="mt-1 text-xs text-muted-foreground">
        AI providers will appear here once configured.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ProvidersTab() {
  const { data: providers, isLoading, error, refetch } = useAiProviders();
  const [updateKeyTarget, setUpdateKeyTarget] = useState<VendorProvider | null>(null);

  return (
    <div className="space-y-4 animate-fade-in-up" data-testid="providers-tab">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Vendor AI Providers</h3>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-destructive">
          <p className="text-sm">Failed to load providers</p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : !providers || providers.length === 0 ? (
        <EmptyProviders />
      ) : (
        <div className="space-y-3" role="list" aria-label="AI providers">
          {providers.map((provider) => (
            <div key={provider.providerId} role="listitem">
              <ProviderRow provider={provider} onUpdateKey={setUpdateKeyTarget} />
            </div>
          ))}
        </div>
      )}

      {/* Update Key Modal */}
      <UpdateKeyModal
        open={updateKeyTarget !== null}
        provider={updateKeyTarget}
        onClose={() => setUpdateKeyTarget(null)}
      />
    </div>
  );
}
