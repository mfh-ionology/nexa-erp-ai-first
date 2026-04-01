/* eslint-disable i18next/no-literal-string */
/**
 * BulkAssignMandatoryDimensions — Bulk assign mandatory dimension types to accounts.
 *
 * Two modes for account selection:
 * - "Select accounts" — multi-select checkboxes
 * - "Account range" — from/to account code inputs
 *
 * Applies selected dimension types to all matched accounts.
 */

import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/templates/page-header';
import { cn } from '@/lib/utils';

import { useDimensionTypes, useBulkAssignMandatoryDimensions } from './api';
import { useAccountsList } from '../hooks/use-accounts';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type SelectionMode = 'accounts' | 'range';

export function BulkAssignMandatoryDimensions() {
  const { t } = useI18n('finance');
  const navigate = useNavigate();

  // Data
  const { data: dimensionTypes } = useDimensionTypes({ isActive: true });
  const { accounts } = useAccountsList({ limit: 500 });
  const bulkAssignMutation = useBulkAssignMandatoryDimensions();

  // State
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('accounts');
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [selectedTypeIds, setSelectedTypeIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{
    accountsAffected: number;
    dimensionTypesApplied: number;
  } | null>(null);

  const activeTypes = useMemo(
    () =>
      (dimensionTypes ?? []).filter((dt) => dt.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [dimensionTypes],
  );

  const sortedAccounts = useMemo(
    () => (accounts ?? []).slice().sort((a, b) => a.code.localeCompare(b.code)),
    [accounts],
  );

  const handleToggleAccount = useCallback((accountId: string, checked: boolean) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(accountId);
      else next.delete(accountId);
      return next;
    });
  }, []);

  const handleToggleType = useCallback((typeId: string, checked: boolean) => {
    setSelectedTypeIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(typeId);
      else next.delete(typeId);
      return next;
    });
  }, []);

  const handleSelectAllAccounts = useCallback(() => {
    setSelectedAccountIds(new Set(sortedAccounts.map((a) => a.id)));
  }, [sortedAccounts]);

  const handleDeselectAllAccounts = useCallback(() => {
    setSelectedAccountIds(new Set());
  }, []);

  const canApply = useMemo(() => {
    if (selectedTypeIds.size === 0) return false;
    if (selectionMode === 'accounts') return selectedAccountIds.size > 0;
    if (selectionMode === 'range') return rangeFrom.trim() !== '' && rangeTo.trim() !== '';
    return false;
  }, [selectedTypeIds, selectionMode, selectedAccountIds, rangeFrom, rangeTo]);

  const handleApply = useCallback(() => {
    const input: {
      dimensionTypeIds: string[];
      accountIds?: string[];
      accountRange?: { from: string; to: string };
    } = {
      dimensionTypeIds: Array.from(selectedTypeIds),
    };

    if (selectionMode === 'accounts') {
      input.accountIds = Array.from(selectedAccountIds);
    } else {
      input.accountRange = { from: rangeFrom.trim(), to: rangeTo.trim() };
    }

    bulkAssignMutation.mutate(input, {
      onSuccess: (data) => {
        setResult(data);
      },
    });
  }, [selectedTypeIds, selectionMode, selectedAccountIds, rangeFrom, rangeTo, bulkAssignMutation]);

  const handleBack = useCallback(() => {
    void navigate({ to: '/finance/dimensions/requirements' });
  }, [navigate]);

  return (
    <main className="flex flex-col gap-6" aria-label="Bulk Assign Mandatory Dimensions">
      <PageHeader
        title={t('mandatoryDimensions.bulkAssign.title', 'Bulk Assign Mandatory Dimensions')}
        breadcrumbs={[
          { label: t('title', 'Finance'), path: '/finance' },
          { label: t('dimensions.title', 'Dimensions'), path: '/finance/dimensions' },
          { label: t('mandatoryDimensions.bulkAssign.title', 'Bulk Assign') },
        ]}
      />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </div>

      {/* Success result */}
      {result && (
        <Card className="rounded-xl border border-green-200 bg-green-50 shadow-[0_1px_3px_rgba(0,0,0,0.06)] animate-fade-in-up">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-1.5">
              <Check className="size-4 text-green-600" />
            </div>
            <p className="text-sm font-medium text-green-800">
              {t('mandatoryDimensions.bulkAssign.success', {
                count: result.dimensionTypesApplied,
                accounts: result.accountsAffected,
              }) ||
                `Applied ${String(result.dimensionTypesApplied)} dimension types to ${String(result.accountsAffected)} accounts`}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Account Selection */}
        <Card className="rounded-xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)] animate-fade-in-up delay-1">
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="text-base font-semibold">
              {t('mandatoryDimensions.bulkAssign.selectAccounts', 'Select Accounts')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Mode toggle */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={selectionMode === 'accounts' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectionMode('accounts')}
                className={selectionMode === 'accounts' ? 'bg-[#7c3aed] hover:bg-[#5b21b6]' : ''}
              >
                {t('mandatoryDimensions.bulkAssign.selectAccounts', 'Select Accounts')}
              </Button>
              <Button
                variant={selectionMode === 'range' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectionMode('range')}
                className={selectionMode === 'range' ? 'bg-[#7c3aed] hover:bg-[#5b21b6]' : ''}
              >
                {t('mandatoryDimensions.bulkAssign.accountRange', 'Account Range')}
              </Button>
            </div>

            {selectionMode === 'accounts' ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">
                    {selectedAccountIds.size} selected
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={handleSelectAllAccounts}
                    >
                      Select all
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={handleDeselectAllAccounts}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto space-y-0.5 border rounded-lg p-1">
                  {sortedAccounts.map((account) => (
                    <label
                      key={account.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer hover:bg-[#f5f3ff]"
                    >
                      <Checkbox
                        checked={selectedAccountIds.has(account.id)}
                        onCheckedChange={(checked) => handleToggleAccount(account.id, !!checked)}
                      />
                      <span className="font-mono text-xs text-muted-foreground tabular-nums w-16 shrink-0">
                        {account.code}
                      </span>
                      <span className="truncate">{account.name}</span>
                    </label>
                  ))}
                  {sortedAccounts.length === 0 && (
                    <p className="text-xs text-muted-foreground p-4 text-center">
                      No accounts found
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rangeFrom">
                    {t('mandatoryDimensions.bulkAssign.from', 'From')}
                  </Label>
                  <Input
                    id="rangeFrom"
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    placeholder="e.g. 1000"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rangeTo">{t('mandatoryDimensions.bulkAssign.to', 'To')}</Label>
                  <Input
                    id="rangeTo"
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                    placeholder="e.g. 1999"
                    className="font-mono"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Dimension Type Selection */}
        <Card className="rounded-xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)] animate-fade-in-up delay-2">
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="text-base font-semibold">
              {t('mandatoryDimensions.bulkAssign.selectTypes', 'Select Dimension Types')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-1">
              {activeTypes.map((dt) => (
                <label
                  key={dt.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors hover:bg-[#f5f3ff]',
                    selectedTypeIds.has(dt.id) && 'bg-purple-50/50',
                  )}
                >
                  <Checkbox
                    checked={selectedTypeIds.has(dt.id)}
                    onCheckedChange={(checked) => handleToggleType(dt.id, !!checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{dt.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground font-mono">{dt.code}</span>
                  </div>
                  {selectedTypeIds.has(dt.id) && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-purple-50 text-purple-600 border-purple-200"
                    >
                      Selected
                    </Badge>
                  )}
                </label>
              ))}
              {activeTypes.length === 0 && (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  No active dimension types configured
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Apply button */}
      <div className="flex justify-end">
        <Button
          onClick={handleApply}
          disabled={!canApply || bulkAssignMutation.isPending}
          className="bg-[#7c3aed] hover:bg-[#5b21b6]"
        >
          {bulkAssignMutation.isPending && <Loader2 className="size-4 animate-spin mr-1" />}
          {t('mandatoryDimensions.bulkAssign.apply', 'Apply')}
        </Button>
      </div>
    </main>
  );
}
