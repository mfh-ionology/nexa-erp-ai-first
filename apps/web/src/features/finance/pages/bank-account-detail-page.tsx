/* eslint-disable i18next/no-literal-string */
/**
 * FE7: Bank Account Detail Page — /finance/bank-accounts/$id
 *
 * Uses T2 (RecordDetailPage) template with tabs:
 *   - Details: bank account fields
 *   - GL Mapping: linked GL account info
 *   - Reconciliation: link to reconciliation workspace
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRight, Edit, Save, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RecordDetailPage } from '@/components/templates/record-detail-page';

import { useBankAccount, useUpdateBankAccount } from '../hooks/use-bank-accounts';
import { GlAccountPicker } from '../components/gl-account-picker';
import type { UpdateBankAccountInput, BankAccountStatus, AccountListItem } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BankAccountDetailPageProps {
  id: string;
}

// ---------------------------------------------------------------------------
// Status badge variant
// ---------------------------------------------------------------------------

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  CLOSED: 'destructive',
};

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BankAccountDetailPage({ id }: BankAccountDetailPageProps) {
  const navigate = useNavigate();
  const { data: bankAccount, isLoading } = useBankAccount(id);
  const updateMutation = useUpdateBankAccount(id);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<UpdateBankAccountInput>({});
  const [activeTab, setActiveTab] = useState('details');

  // Initialise form from data
  useEffect(() => {
    if (bankAccount) {
      setForm({
        name: bankAccount.name,
        bankName: bankAccount.bankName,
        accountNumber: bankAccount.accountNumber,
        sortCode: bankAccount.sortCode,
        iban: bankAccount.iban,
        bic: bankAccount.bic,
        currencyCode: bankAccount.currencyCode,
        glAccountId: bankAccount.glAccountId,
        status: bankAccount.status,
        contactName: bankAccount.contactName,
        contactPhone: bankAccount.contactPhone,
        notes: bankAccount.notes,
      });
    }
  }, [bankAccount]);

  const handleSave = useCallback(() => {
    updateMutation.mutate(form, {
      onSuccess: () => setIsEditing(false),
    });
  }, [form, updateMutation]);

  const handleCancel = useCallback(() => {
    if (bankAccount) {
      setForm({
        name: bankAccount.name,
        bankName: bankAccount.bankName,
        accountNumber: bankAccount.accountNumber,
        sortCode: bankAccount.sortCode,
        iban: bankAccount.iban,
        bic: bankAccount.bic,
        currencyCode: bankAccount.currencyCode,
        glAccountId: bankAccount.glAccountId,
        status: bankAccount.status,
        contactName: bankAccount.contactName,
        contactPhone: bankAccount.contactPhone,
        notes: bankAccount.notes,
      });
    }
    setIsEditing(false);
  }, [bankAccount]);

  // --- Details Tab ---
  const detailsTab = (
    <div className="space-y-6">
      {/* Bank Details */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Account Name</Label>
          {isEditing ? (
            <Input
              value={form.name ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          ) : (
            <p className="text-sm">{bankAccount?.name ?? '—'}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Bank Name</Label>
          {isEditing ? (
            <Input
              value={form.bankName ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
            />
          ) : (
            <p className="text-sm">{bankAccount?.bankName ?? '—'}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Account Number</Label>
          {isEditing ? (
            <Input
              value={form.accountNumber ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
            />
          ) : (
            <p className="font-mono text-sm">{bankAccount?.accountNumber ?? '—'}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Sort Code</Label>
          {isEditing ? (
            <Input
              value={form.sortCode ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, sortCode: e.target.value }))}
            />
          ) : (
            <p className="font-mono text-sm">{bankAccount?.sortCode ?? '—'}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>IBAN</Label>
          {isEditing ? (
            <Input
              value={form.iban ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value || null }))}
            />
          ) : (
            <p className="font-mono text-sm">{bankAccount?.iban ?? '—'}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>BIC/SWIFT</Label>
          {isEditing ? (
            <Input
              value={form.bic ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, bic: e.target.value || null }))}
            />
          ) : (
            <p className="font-mono text-sm">{bankAccount?.bic ?? '—'}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          {isEditing ? (
            <Input
              value={form.currencyCode ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, currencyCode: e.target.value }))}
            />
          ) : (
            <p className="text-sm">{bankAccount?.currencyCode ?? '—'}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          {isEditing ? (
            <Select
              value={form.status ?? 'ACTIVE'}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v as BankAccountStatus }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge variant={STATUS_VARIANT[bankAccount?.status ?? ''] ?? 'outline'}>
              {bankAccount?.status ?? '—'}
            </Badge>
          )}
        </div>
      </div>

      {/* Balances */}
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-semibold">Balances</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Current Balance</p>
            <p className="font-mono text-lg font-bold tabular-nums">
              {formatCurrency(bankAccount?.currentBalance ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Reconciled Balance</p>
            <p className="font-mono text-lg tabular-nums">
              {formatCurrency(bankAccount?.lastReconciledBalance ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Reconciled Date</p>
            <p className="text-sm">{formatDate(bankAccount?.lastReconciledDate ?? null)}</p>
          </div>
        </div>
      </div>

      {/* Contact & Notes */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Contact Name</Label>
          {isEditing ? (
            <Input
              value={form.contactName ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  contactName: e.target.value || null,
                }))
              }
            />
          ) : (
            <p className="text-sm">{bankAccount?.contactName ?? '—'}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Contact Phone</Label>
          {isEditing ? (
            <Input
              value={form.contactPhone ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  contactPhone: e.target.value || null,
                }))
              }
            />
          ) : (
            <p className="text-sm">{bankAccount?.contactPhone ?? '—'}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        {isEditing ? (
          <Textarea
            value={form.notes ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))}
            rows={3}
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap">{bankAccount?.notes ?? '—'}</p>
        )}
      </div>
    </div>
  );

  // --- GL Mapping Tab ---
  const glMappingTab = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Linked GL Account</Label>
        {isEditing ? (
          <GlAccountPicker
            value={form.glAccountId ?? null}
            onChange={(accountId: string | null, _account: AccountListItem | null) =>
              setForm((f) => ({
                ...f,
                glAccountId: accountId ?? undefined,
              }))
            }
          />
        ) : (
          <div className="rounded-lg border p-4">
            <p className="font-mono text-sm">{bankAccount?.glAccountCode ?? '—'}</p>
            <p className="text-sm text-muted-foreground">{bankAccount?.glAccountName ?? ''}</p>
          </div>
        )}
      </div>
    </div>
  );

  // --- Reconciliation Tab ---
  const reconciliationTab = (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Open the bank reconciliation workspace to match bank transactions with journal entries.
      </p>
      <Button
        onClick={() =>
          void navigate({
            to: '/finance/bank-reconciliation/$id',
            params: { id },
          })
        }
      >
        <ArrowRight className="size-4" />
        Open Reconciliation
      </Button>
    </div>
  );

  // --- Action bar ---
  const actionBar = (
    <div className="flex items-center gap-2">
      {isEditing ? (
        <>
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <X className="size-4" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="size-4" />
            Save
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
          <Edit className="size-4" />
          Edit
        </Button>
      )}
    </div>
  );

  return (
    <RecordDetailPage
      title={bankAccount?.name ?? 'Bank Account'}
      subtitle={bankAccount ? `${bankAccount.bankName} — ${bankAccount.accountNumber}` : undefined}
      breadcrumbs={[
        { label: 'Finance', path: '/finance' },
        { label: 'Bank Accounts', path: '/finance/bank-accounts' },
        { label: bankAccount?.name ?? '...' },
      ]}
      entityType="bankAccount"
      status={bankAccount?.status}
      isLoading={isLoading}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      actionBarSlot={actionBar}
      tabs={[
        {
          key: 'details',
          labelKey: 'Details',
          content: detailsTab,
        },
        {
          key: 'gl-mapping',
          labelKey: 'GL Mapping',
          content: glMappingTab,
        },
        {
          key: 'reconciliation',
          labelKey: 'Reconciliation',
          content: reconciliationTab,
        },
      ]}
    />
  );
}
