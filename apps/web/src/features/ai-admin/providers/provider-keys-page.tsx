/* eslint-disable i18next/no-literal-string */
/**
 * AI Provider Keys — manage API keys for AI providers.
 * Stores encrypted keys in the database via SystemSetting.
 */

import { useState } from 'react';
import { Key, Check, X, Loader2, Trash2, Eye, EyeOff } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/templates/page-header';

import { useProviderStatus, useSetProviderKey, useRemoveProviderKey } from './api';
import type { ProviderStatus } from './api';

// ─── Provider logos / icons ─────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#d97706',
  openai: '#10b981',
  deepseek: '#3b82f6',
  google: '#ef4444',
};

// ─── Provider card ──────────────────────────────────────────────────────────

function ProviderCard({ provider }: { provider: ProviderStatus }) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const setKeyMutation = useSetProviderKey();
  const removeKeyMutation = useRemoveProviderKey();

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    await setKeyMutation.mutateAsync({ providerId: provider.id, apiKey: apiKey.trim() });
    setApiKey('');
    setIsEditing(false);
  };

  const handleRemove = async () => {
    await removeKeyMutation.mutateAsync(provider.id);
    setIsEditing(false);
  };

  const color = PROVIDER_COLORS[provider.id] ?? '#7c3aed';
  const isSaving = setKeyMutation.isPending;
  const isRemoving = removeKeyMutation.isPending;

  return (
    <Card className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 items-center justify-center rounded-lg text-white font-bold text-sm"
            style={{ backgroundColor: color }}
          >
            {provider.name.charAt(0)}
          </div>
          <div>
            <CardTitle className="text-base font-semibold">{provider.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{provider.description}</p>
          </div>
        </div>
        {provider.hasKey ? (
          <Badge className="bg-[#10b981] text-white hover:bg-[#059669]">
            <Check className="mr-1 size-3" />
            Configured
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            <X className="mr-1 size-3" />
            Not configured
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {provider.hasKey && !isEditing ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border bg-muted/30 px-3 py-2 font-mono text-sm text-muted-foreground">
              {'*'.repeat(32)}...{provider.maskedKey?.replace('****', '') ?? ''}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="shrink-0"
            >
              <Key className="mr-1 size-3" />
              Update
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={isRemoving}
              className="shrink-0 text-destructive hover:text-destructive"
            >
              {isRemoving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder={`Enter ${provider.name} API key`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10 font-mono text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!apiKey.trim() || isSaving}
              className="shrink-0 bg-[#7c3aed] hover:bg-[#5b21b6]"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Save
            </Button>
            {isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setApiKey('');
                }}
                className="shrink-0"
              >
                Cancel
              </Button>
            )}
          </div>
        )}
        {provider.updatedAt && (
          <p className="text-xs text-muted-foreground">
            Last updated:{' '}
            {new Date(provider.updatedAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export function ProviderKeysPage() {
  const { data: providers, isLoading, isError } = useProviderStatus();

  const breadcrumbs = [{ label: 'AI Administration', path: '/ai/admin' }, { label: 'Providers' }];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Providers" breadcrumbs={breadcrumbs} isLoading />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="rounded-xl">
              <CardContent className="space-y-3 pt-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !providers) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Providers" breadcrumbs={breadcrumbs} />
        <Card className="rounded-xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load provider configuration.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Providers"
        breadcrumbs={breadcrumbs}
        subtitle="Configure API keys for AI model providers. Keys are encrypted and stored in the database."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>
    </div>
  );
}
