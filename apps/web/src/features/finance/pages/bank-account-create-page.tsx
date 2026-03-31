/* eslint-disable i18next/no-literal-string */
/**
 * FE7: Bank Account Create Page — /finance/bank-accounts/new
 *
 * Simple form to create a new bank account.
 */

import { useCallback, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/templates/page-header';

import { useCreateBankAccount } from '../hooks/use-bank-accounts';
import { GlAccountPicker } from '../components/gl-account-picker';
import type { CreateBankAccountInput, AccountListItem } from '../types';

const INITIAL_FORM: CreateBankAccountInput = {
  name: '',
  bankName: '',
  accountNumber: '',
  sortCode: '',
  currencyCode: 'GBP',
  glAccountId: '',
};

export function BankAccountCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateBankAccount();
  const [form, setForm] = useState<CreateBankAccountInput>(INITIAL_FORM);

  const handleSubmit = useCallback(() => {
    createMutation.mutate(form, {
      onSuccess: (data) => {
        void navigate({
          to: '/finance/bank-accounts/$id',
          params: { id: data.id },
        });
      },
    });
  }, [form, createMutation, navigate]);

  const isValid =
    form.name.trim() !== '' &&
    form.bankName.trim() !== '' &&
    form.accountNumber.trim() !== '' &&
    form.sortCode.trim() !== '' &&
    form.glAccountId.trim() !== '';

  return (
    <main className="flex flex-col gap-6" aria-label="New Bank Account">
      <PageHeader
        title="New Bank Account"
        breadcrumbs={[
          { label: 'Finance', path: '/finance' },
          { label: 'Bank Accounts', path: '/finance/bank-accounts' },
          { label: 'New' },
        ]}
      />

      <div className="max-w-2xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Account Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Main Business Account"
            />
          </div>
          <div className="space-y-2">
            <Label>Bank Name *</Label>
            <Input
              value={form.bankName}
              onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
              placeholder="e.g. Barclays"
            />
          </div>
          <div className="space-y-2">
            <Label>Account Number *</Label>
            <Input
              value={form.accountNumber}
              onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
              placeholder="12345678"
            />
          </div>
          <div className="space-y-2">
            <Label>Sort Code *</Label>
            <Input
              value={form.sortCode}
              onChange={(e) => setForm((f) => ({ ...f, sortCode: e.target.value }))}
              placeholder="12-34-56"
            />
          </div>
          <div className="space-y-2">
            <Label>IBAN</Label>
            <Input
              value={form.iban ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value || undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label>BIC/SWIFT</Label>
            <Input
              value={form.bic ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, bic: e.target.value || undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Input
              value={form.currencyCode}
              onChange={(e) => setForm((f) => ({ ...f, currencyCode: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Opening Balance</Label>
            <Input
              type="number"
              value={form.openingBalance ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  openingBalance: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>GL Account *</Label>
          <GlAccountPicker
            value={form.glAccountId || null}
            onChange={(accountId: string | null, _account: AccountListItem | null) =>
              setForm((f) => ({ ...f, glAccountId: accountId ?? '' }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            value={form.notes ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || undefined }))}
            rows={3}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSubmit} disabled={!isValid || createMutation.isPending}>
            <Save className="size-4" />
            Create Bank Account
          </Button>
          <Button variant="ghost" onClick={() => void navigate({ to: '/finance/bank-accounts' })}>
            Cancel
          </Button>
        </div>
      </div>
    </main>
  );
}
