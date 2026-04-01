/* eslint-disable i18next/no-literal-string */
/**
 * AccountDetailPage — T2 Record Detail Page for a single GL Account.
 *
 * Two modes:
 * - View mode: displays account info in read-only fields
 * - Edit/Create mode: form with validation for editing or creating an account
 *
 * Tabs: Details, Children, Activity
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Pencil, Save, X } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/templates/page-header';
import { usePermission } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

import { useAccount, useCreateAccount, useUpdateAccount } from '../hooks/use-accounts';
import {
  useDimensionTypes,
  useMandatoryDimensions,
  useSetMandatoryDimensions,
} from '../dimensions/api';
import type { AccountType, NormalBalance, CreateAccountInput, UpdateAccountInput } from '../types';
import { ACCOUNT_TYPES, NORMAL_BALANCES } from '../types';

// ---------------------------------------------------------------------------
// Account type badge colors
// ---------------------------------------------------------------------------

const ACCOUNT_TYPE_STYLES: Record<AccountType, string> = {
  ASSET: 'bg-blue-100 text-blue-700 border-blue-200',
  LIABILITY: 'bg-red-100 text-red-700 border-red-200',
  EQUITY: 'bg-green-100 text-green-700 border-green-200',
  REVENUE: 'bg-purple-100 text-purple-700 border-purple-200',
  EXPENSE: 'bg-orange-100 text-orange-700 border-orange-200',
};

// ---------------------------------------------------------------------------
// Format currency
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Read-only field
// ---------------------------------------------------------------------------

function ReadOnlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || '\u2014'}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface AccountDetailPageProps {
  id: string;
}

export function AccountDetailPage({ id }: AccountDetailPageProps) {
  const { t } = useI18n('finance');
  const navigate = useNavigate();
  const isNew = id === 'new';

  // Permissions
  const perms = usePermission('finance.accounts');

  // Fetch account detail (skip for new)
  const { account, isLoading, error } = useAccount(isNew ? null : id);

  // Mutations
  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();

  // Edit state
  const [isEditing, setIsEditing] = useState(isNew);
  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    accountType: AccountType;
    normalBalance: NormalBalance;
    parentCode: string;
    isPostable: boolean;
    isControl: boolean;
    isBankAccount: boolean;
    isActive: boolean;
    taxCode: string;
    departmentCode: string;
    currencyCode: string;
    openingBalance: string;
  }>({
    code: '',
    name: '',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    parentCode: '',
    isPostable: true,
    isControl: false,
    isBankAccount: false,
    isActive: true,
    taxCode: '',
    departmentCode: '',
    currencyCode: '',
    openingBalance: '0',
  });

  // Populate form when account loads
  useEffect(() => {
    if (account && !isNew) {
      setFormData({
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        normalBalance: account.normalBalance,
        parentCode: account.parentCode ?? '',
        isPostable: account.isPostable,
        isControl: account.isControl,
        isBankAccount: account.isBankAccount,
        isActive: account.isActive,
        taxCode: account.taxCode ?? '',
        departmentCode: account.departmentCode ?? '',
        currencyCode: account.currencyCode ?? '',
        openingBalance: String(account.openingBalance),
      });
    }
  }, [account, isNew]);

  const handleFieldChange = useCallback((field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (isNew) {
      // Create
      const input: CreateAccountInput = {
        code: formData.code,
        name: formData.name,
        accountType: formData.accountType,
        normalBalance: formData.normalBalance,
        parentCode: formData.parentCode || undefined,
        isPostable: formData.isPostable,
        isControl: formData.isControl,
        isBankAccount: formData.isBankAccount,
        openingBalance: parseFloat(formData.openingBalance) || 0,
      };
      createMutation.mutate(input, {
        onSuccess: (data) => {
          void navigate({ to: '/finance/chart-of-accounts/$id', params: { id: data.id } });
        },
      });
    } else {
      // Update
      const input: UpdateAccountInput = {
        name: formData.name,
        accountType: formData.accountType,
        normalBalance: formData.normalBalance,
        parentCode: formData.parentCode || null,
        isPostable: formData.isPostable,
        isControl: formData.isControl,
        isBankAccount: formData.isBankAccount,
        isActive: formData.isActive,
        taxCode: formData.taxCode || null,
        departmentCode: formData.departmentCode || null,
        currencyCode: formData.currencyCode || null,
      };
      updateMutation.mutate(
        { id, input },
        {
          onSuccess: () => {
            setIsEditing(false);
          },
        },
      );
    }
  }, [isNew, formData, id, createMutation, updateMutation, navigate]);

  const handleCancel = useCallback(() => {
    if (isNew) {
      void navigate({ to: '/finance/chart-of-accounts' });
    } else {
      // Reset form to account data
      if (account) {
        setFormData({
          code: account.code,
          name: account.name,
          accountType: account.accountType,
          normalBalance: account.normalBalance,
          parentCode: account.parentCode ?? '',
          isPostable: account.isPostable,
          isControl: account.isControl,
          isBankAccount: account.isBankAccount,
          isActive: account.isActive,
          taxCode: account.taxCode ?? '',
          departmentCode: account.departmentCode ?? '',
          currencyCode: account.currencyCode ?? '',
          openingBalance: String(account.openingBalance),
        });
      }
      setIsEditing(false);
    }
  }, [isNew, account, navigate]);

  const handleBack = useCallback(() => {
    void navigate({ to: '/finance/chart-of-accounts' });
  }, [navigate]);

  // --- Loading state ---
  if (isLoading && !isNew) {
    return (
      <main className="flex flex-col gap-6" aria-label="Account Detail" aria-busy="true">
        <PageHeader
          title="Loading..."
          breadcrumbs={[
            { label: 'Finance', path: '/finance' },
            { label: 'Chart of Accounts', path: '/finance/chart-of-accounts' },
            { label: 'Loading...' },
          ]}
          isLoading
        />
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </main>
    );
  }

  // --- Error state ---
  if (error && !isNew) {
    return (
      <main className="flex flex-col gap-6" aria-label="Account Detail">
        <PageHeader
          title="Account Not Found"
          breadcrumbs={[
            { label: 'Finance', path: '/finance' },
            { label: 'Chart of Accounts', path: '/finance/chart-of-accounts' },
            { label: 'Error' },
          ]}
        />
        <Card className="rounded-xl border border-destructive/30 bg-destructive/5">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-destructive">
              This account could not be found or you do not have permission to view it.
            </p>
            <Button variant="outline" className="mt-4" onClick={handleBack}>
              <ArrowLeft className="size-4 mr-1" />
              Back to Chart of Accounts
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const pageTitle = isNew ? 'New Account' : `${account?.code ?? ''} - ${account?.name ?? ''}`;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <main className="flex flex-col gap-6" aria-label={pageTitle}>
      {/* Page header */}
      <PageHeader
        title={pageTitle}
        subtitle={
          isNew
            ? 'Create a new general ledger account'
            : (account?.classification?.name ?? undefined)
        }
        breadcrumbs={[
          { label: t('title', 'Finance'), path: '/finance' },
          {
            label: t('accounts.title', 'Chart of Accounts'),
            path: '/finance/chart-of-accounts',
          },
          { label: isNew ? 'New Account' : (account?.code ?? id) },
        ]}
        statusBadge={
          !isNew && account ? (
            <Badge
              variant="outline"
              className={cn(
                'text-xs font-semibold',
                account.isActive
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-gray-50 text-gray-500 border-gray-200',
              )}
            >
              {account.isActive ? 'Active' : 'Inactive'}
            </Badge>
          ) : undefined
        }
      />

      {/* Action bar */}
      <div className="flex items-center gap-2 animate-fade-in-up delay-1">
        <Button variant="outline" size="sm" onClick={handleBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>

        <div className="flex-1" />

        {!isNew && !isEditing && perms.canEdit && (
          <Button
            size="sm"
            onClick={() => setIsEditing(true)}
            className="bg-[#7c3aed] hover:bg-[#5b21b6]"
          >
            <Pencil className="size-4" />
            Edit
          </Button>
        )}

        {isEditing && (
          <>
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
              <X className="size-4" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !formData.code || !formData.name}
              className="bg-[#7c3aed] hover:bg-[#5b21b6]"
            >
              <Save className="size-4" />
              {isSaving ? 'Saving...' : isNew ? 'Create Account' : 'Save Changes'}
            </Button>
          </>
        )}
      </div>

      {/* Account type badge (view mode) */}
      {!isNew && account && !isEditing && (
        <div className="flex items-center gap-3 animate-fade-in-up delay-1">
          <Badge
            variant="outline"
            className={cn(
              'text-xs font-semibold uppercase tracking-wider',
              ACCOUNT_TYPE_STYLES[account.accountType],
            )}
          >
            {account.accountType}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Normal: {account.normalBalance}
          </Badge>
          {account.isSystemAccount && (
            <Badge
              variant="outline"
              className="text-xs bg-amber-50 text-amber-700 border-amber-200"
            >
              System Account
            </Badge>
          )}
          {account.isControl && (
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
              Control Account
            </Badge>
          )}
          {account.isBankAccount && (
            <Badge variant="outline" className="text-xs bg-cyan-50 text-cyan-700 border-cyan-200">
              Bank Account
            </Badge>
          )}
        </div>
      )}

      {/* Details card */}
      <Card className="rounded-xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)] animate-fade-in-up delay-2">
        <CardHeader className="border-b border-border/50 pb-3">
          <CardTitle className="text-base font-semibold">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {isEditing ? (
            /* ---- Edit mode ---- */
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Code (only editable on create) */}
              <div className="space-y-2">
                <Label htmlFor="code">Account Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleFieldChange('code', e.target.value)}
                  placeholder="e.g. 1000"
                  disabled={!isNew}
                  className={cn(!isNew && 'opacity-60')}
                />
                {!isNew && (
                  <p className="text-[10px] text-muted-foreground">
                    Account code cannot be changed after creation
                  </p>
                )}
              </div>

              {/* Name */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Account Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="e.g. Cash at Bank"
                />
              </div>

              {/* Account Type */}
              <div className="space-y-2">
                <Label>Account Type *</Label>
                <Select
                  value={formData.accountType}
                  onValueChange={(v) => handleFieldChange('accountType', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0) + type.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Normal Balance */}
              <div className="space-y-2">
                <Label>Normal Balance *</Label>
                <Select
                  value={formData.normalBalance}
                  onValueChange={(v) => handleFieldChange('normalBalance', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NORMAL_BALANCES.map((bal) => (
                      <SelectItem key={bal} value={bal}>
                        {bal.charAt(0) + bal.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Parent Code */}
              <div className="space-y-2">
                <Label htmlFor="parentCode">Parent Code</Label>
                <Input
                  id="parentCode"
                  value={formData.parentCode}
                  onChange={(e) => handleFieldChange('parentCode', e.target.value)}
                  placeholder="e.g. 1000"
                />
              </div>

              {/* Tax Code */}
              <div className="space-y-2">
                <Label htmlFor="taxCode">Tax Code</Label>
                <Input
                  id="taxCode"
                  value={formData.taxCode}
                  onChange={(e) => handleFieldChange('taxCode', e.target.value)}
                  placeholder="e.g. S"
                />
              </div>

              {/* Department Code */}
              <div className="space-y-2">
                <Label htmlFor="departmentCode">Department Code</Label>
                <Input
                  id="departmentCode"
                  value={formData.departmentCode}
                  onChange={(e) => handleFieldChange('departmentCode', e.target.value)}
                  placeholder="e.g. SALES"
                />
              </div>

              {/* Currency Code */}
              <div className="space-y-2">
                <Label htmlFor="currencyCode">Currency Code</Label>
                <Input
                  id="currencyCode"
                  value={formData.currencyCode}
                  onChange={(e) => handleFieldChange('currencyCode', e.target.value)}
                  placeholder="e.g. GBP"
                  maxLength={3}
                />
              </div>

              {/* Opening Balance (create only) */}
              {isNew && (
                <div className="space-y-2">
                  <Label htmlFor="openingBalance">Opening Balance</Label>
                  <Input
                    id="openingBalance"
                    type="number"
                    step="0.01"
                    value={formData.openingBalance}
                    onChange={(e) => handleFieldChange('openingBalance', e.target.value)}
                  />
                </div>
              )}

              {/* Boolean toggles */}
              <div className="col-span-full grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-border/50 pt-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="isPostable"
                    checked={formData.isPostable}
                    onCheckedChange={(v) => handleFieldChange('isPostable', v)}
                  />
                  <Label htmlFor="isPostable" className="text-sm">
                    Postable
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="isControl"
                    checked={formData.isControl}
                    onCheckedChange={(v) => handleFieldChange('isControl', v)}
                  />
                  <Label htmlFor="isControl" className="text-sm">
                    Control Account
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="isBankAccount"
                    checked={formData.isBankAccount}
                    onCheckedChange={(v) => handleFieldChange('isBankAccount', v)}
                  />
                  <Label htmlFor="isBankAccount" className="text-sm">
                    Bank Account
                  </Label>
                </div>
                {!isNew && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(v) => handleFieldChange('isActive', v)}
                    />
                    <Label htmlFor="isActive" className="text-sm">
                      Active
                    </Label>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ---- View mode ---- */
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <ReadOnlyField label="Account Code" value={account?.code} />
              <ReadOnlyField label="Account Name" value={account?.name} />
              <ReadOnlyField
                label="Account Type"
                value={
                  account ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-semibold uppercase tracking-wider',
                        ACCOUNT_TYPE_STYLES[account.accountType],
                      )}
                    >
                      {account.accountType}
                    </Badge>
                  ) : null
                }
              />
              <ReadOnlyField label="Normal Balance" value={account?.normalBalance} />
              <ReadOnlyField label="Parent Code" value={account?.parentCode} />
              <ReadOnlyField
                label="Classification"
                value={
                  account?.classification
                    ? `${account.classification.code} - ${account.classification.name}`
                    : null
                }
              />
              <ReadOnlyField label="Tax Code" value={account?.taxCode} />
              <ReadOnlyField label="Department Code" value={account?.departmentCode} />
              <ReadOnlyField label="Currency Code" value={account?.currencyCode} />

              {/* Flags */}
              <div className="col-span-full flex flex-wrap gap-3 border-t border-border/50 pt-4">
                <FlagChip label="Postable" active={account?.isPostable ?? false} />
                <FlagChip label="Control Account" active={account?.isControl ?? false} />
                <FlagChip label="Bank Account" active={account?.isBankAccount ?? false} />
                <FlagChip label="System Account" active={account?.isSystemAccount ?? false} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mandatory Dimensions card (view mode only, non-new) */}
      {!isNew && account && (
        <MandatoryDimensionsCard accountId={account.id} canEdit={perms.canEdit} />
      )}

      {/* Balances card (view mode only) */}
      {!isNew && account && !isEditing && (
        <Card className="rounded-xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)] animate-fade-in-up delay-3">
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="text-base font-semibold">Balances</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Opening Balance</p>
                <p className="text-lg font-semibold text-foreground font-mono tabular-nums">
                  {formatCurrency(account.openingBalance)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Current Balance</p>
                <p
                  className={cn(
                    'text-lg font-semibold font-mono tabular-nums',
                    account.currentBalance < 0 ? 'text-red-600' : 'text-foreground',
                  )}
                >
                  {formatCurrency(account.currentBalance)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Normal Balance Direction
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {account.normalBalance === 'DEBIT' ? 'Debit (Dr)' : 'Credit (Cr)'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Children accounts (view mode only) */}
      {!isNew && account?.children && account.children.length > 0 && !isEditing && (
        <Card className="rounded-xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)] animate-fade-in-up delay-4">
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="text-base font-semibold">
              Child Accounts ({account.children.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border/50">
              {account.children.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  className="flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-[#f5f3ff]"
                  onClick={() =>
                    void navigate({
                      to: '/finance/chart-of-accounts/$id',
                      params: { id: child.id },
                    })
                  }
                >
                  <span className="shrink-0 font-mono text-xs font-semibold text-muted-foreground tabular-nums">
                    {child.code}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-foreground">
                    {child.name}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider',
                      ACCOUNT_TYPE_STYLES[child.accountType],
                    )}
                  >
                    {child.accountType}
                  </Badge>
                  <span
                    className={cn(
                      'shrink-0 w-24 text-right font-mono text-sm tabular-nums',
                      child.currentBalance < 0 ? 'text-red-600' : 'text-foreground',
                    )}
                  >
                    {formatCurrency(child.currentBalance)}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata (view mode only) */}
      {!isNew && account && !isEditing && (
        <div className="flex items-center gap-4 px-1 text-xs text-muted-foreground animate-fade-in-up delay-4">
          <span>Created: {new Date(account.createdAt).toLocaleDateString('en-GB')}</span>
          <span>Updated: {new Date(account.updatedAt).toLocaleDateString('en-GB')}</span>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// MandatoryDimensionsCard — manage which dimension types are mandatory for this account
// ---------------------------------------------------------------------------

function MandatoryDimensionsCard({ accountId, canEdit }: { accountId: string; canEdit: boolean }) {
  const { t } = useI18n('finance');
  const { data: dimensionTypes } = useDimensionTypes({ isActive: true });
  const { data: mandatoryDims, isLoading } = useMandatoryDimensions(accountId);
  const setMandatoryMutation = useSetMandatoryDimensions();

  const activeTypes = useMemo(
    () =>
      (dimensionTypes ?? []).filter((dt) => dt.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [dimensionTypes],
  );

  const mandatoryTypeIds = useMemo(
    () => new Set((mandatoryDims ?? []).map((md) => md.dimensionTypeId)),
    [mandatoryDims],
  );

  const handleToggle = useCallback(
    (dimensionTypeId: string, checked: boolean) => {
      const current = new Set(mandatoryTypeIds);
      if (checked) {
        current.add(dimensionTypeId);
      } else {
        current.delete(dimensionTypeId);
      }
      setMandatoryMutation.mutate({
        accountId,
        dimensionTypeIds: Array.from(current),
      });
    },
    [accountId, mandatoryTypeIds, setMandatoryMutation],
  );

  if (activeTypes.length === 0) return null;

  return (
    <Card className="rounded-xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)] animate-fade-in-up delay-3">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-base font-semibold">
          {t('mandatoryDimensions.title', 'Mandatory Dimensions')}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t(
            'mandatoryDimensions.description',
            'Select which dimension types must be tagged when posting to this account',
          )}
        </p>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-6 w-48" />
          </div>
        ) : (
          <div className="space-y-2">
            {activeTypes.map((dt) => {
              const isChecked = mandatoryTypeIds.has(dt.id);
              return (
                <label
                  key={dt.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    canEdit ? 'cursor-pointer hover:bg-[#f5f3ff]' : 'cursor-default',
                    isChecked && 'bg-purple-50/50',
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => handleToggle(dt.id, !!checked)}
                    disabled={!canEdit || setMandatoryMutation.isPending}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{dt.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground font-mono">{dt.code}</span>
                  </div>
                  {isChecked && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-red-50 text-red-600 border-red-200"
                    >
                      Required
                    </Badge>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// FlagChip — small boolean indicator
// ---------------------------------------------------------------------------

function FlagChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        active
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-border bg-muted text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          active ? 'bg-green-500' : 'bg-muted-foreground/40',
        )}
      />
      {label}
    </span>
  );
}
