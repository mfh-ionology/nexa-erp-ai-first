/* eslint-disable i18next/no-literal-string */
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Building2, Calendar, Loader2 } from 'lucide-react';

import { apiGet } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/templates/page-header';

interface BankAccountSummary {
  id: string;
  name: string;
  bankName: string;
  sortCode: string | null;
  accountNumber: string | null;
  currencyCode: string;
  currentBalance: number;
  lastReconciledDate: string | null;
  glAccountCode: string;
}

function BankReconciliationListPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: bankAccounts, isLoading } = useQuery<BankAccountSummary[]>({
    queryKey: queryKeys.finance.bankAccounts(),
    queryFn: async () => {
      const result = await apiGet<BankAccountSummary[]>('/finance/bank-accounts');
      return result.data;
    },
    enabled: isAuthenticated,
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);

  const formatDate = (date: string | null) =>
    date ? new Date(date).toLocaleDateString('en-GB') : 'Never';

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Bank Reconciliation"
          subtitle="Match bank statement transactions to your ledger"
          breadcrumbs={[{ label: 'Finance', path: '/finance' }, { label: 'Bank Reconciliation' }]}
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const accounts = bankAccounts ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank Reconciliation"
        subtitle="Match bank statement transactions to your ledger"
        breadcrumbs={[{ label: 'Finance', path: '/finance' }, { label: 'Bank Reconciliation' }]}
      />

      {accounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="mb-4 size-12 text-muted-foreground/50" />
            <p className="mb-2 text-lg font-medium">No bank accounts found</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Create a bank account first, then you can start reconciling.
            </p>
            <Button
              onClick={() => void navigate({ to: '/finance/bank-accounts' as string })}
              variant="outline"
            >
              Go to Bank Accounts
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card
              key={account.id}
              className="cursor-pointer transition-shadow hover:shadow-lg hover:shadow-primary/10"
              onClick={() =>
                void navigate({
                  to: '/finance/bank-reconciliation/$id' as string,
                  params: { id: account.id },
                })
              }
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{account.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{account.bankName}</p>
                  </div>
                  <Building2 className="size-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Account details */}
                {account.sortCode && account.accountNumber && (
                  <p className="font-mono text-xs text-muted-foreground">
                    {account.sortCode.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3')}{' '}
                    {account.accountNumber}
                  </p>
                )}

                {/* Balance */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">GL Balance</span>
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {formatCurrency(account.currentBalance)}
                  </span>
                </div>

                {/* Last reconciled */}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="size-3.5" />
                    Last Reconciled
                  </span>
                  <span className="text-sm">{formatDate(account.lastReconciledDate)}</span>
                </div>

                {/* Reconcile button */}
                <Button
                  className="mt-2 w-full"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    void navigate({
                      to: '/finance/bank-reconciliation/$id' as string,
                      params: { id: account.id },
                    });
                  }}
                >
                  <ArrowLeftRight className="mr-2 size-4" />
                  Reconcile
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute('/_authenticated/finance/bank-reconciliation/')({
  component: BankReconciliationListPage,
});
