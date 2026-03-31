/* eslint-disable i18next/no-literal-string */
/**
 * FE8: Bank Reconciliation Workspace — /finance/bank-reconciliation/$id
 *
 * Split-pane layout: bank transactions on left, journal lines on right.
 * Click-to-select on each side, then click "Match" to pair them.
 * Shows reconciliation summary header with balance differences.
 */

import { useMemo, useState } from 'react';
import { ArrowLeftRight, Check, Link2Off, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/templates/page-header';
import { cn } from '@/lib/utils';

import {
  useReconciliationSummary,
  useBankTransactions,
  useUnmatchedJournalLines,
  useMatchTransaction,
  useUnmatchTransaction,
} from '../hooks/use-bank-reconciliation';
import type { BankTransaction, JournalLineForMatching } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BankReconciliationPageProps {
  bankAccountId: string;
}

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

function ReconciliationSummaryCard({
  statementBalance,
  bookBalance,
  unmatchedBankCount,
  unmatchedJournalCount,
  difference,
}: {
  statementBalance: number;
  bookBalance: number;
  unmatchedBankCount: number;
  unmatchedJournalCount: number;
  difference: number;
}) {
  const isBalanced = Math.abs(difference) < 0.01;

  return (
    <div className="grid gap-4 sm:grid-cols-5">
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Statement Balance</p>
          <p className="font-mono text-lg font-bold tabular-nums">
            {formatCurrency(statementBalance)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Book Balance</p>
          <p className="font-mono text-lg font-bold tabular-nums">{formatCurrency(bookBalance)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Unmatched Bank</p>
          <p className="text-lg font-bold">{unmatchedBankCount}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Unmatched Journal</p>
          <p className="text-lg font-bold">{unmatchedJournalCount}</p>
        </CardContent>
      </Card>
      <Card
        className={
          isBalanced
            ? 'border-green-500/30 bg-green-50 dark:bg-green-950/20'
            : 'border-destructive/30 bg-destructive/5'
        }
      >
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Difference</p>
          <p
            className={cn(
              'font-mono text-lg font-bold tabular-nums',
              isBalanced ? 'text-green-700 dark:text-green-400' : 'text-destructive',
            )}
          >
            {formatCurrency(difference)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transaction Row
// ---------------------------------------------------------------------------

function TransactionRow({
  transaction,
  isSelected,
  onSelect,
  onUnmatch,
  isUnmatching,
}: {
  transaction: BankTransaction;
  isSelected: boolean;
  onSelect: () => void;
  onUnmatch?: () => void;
  isUnmatching?: boolean;
}) {
  const isMatched = transaction.status === 'MATCHED';

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors cursor-pointer',
        isSelected && 'ring-2 ring-primary bg-primary/5',
        isMatched && 'opacity-60 bg-muted/30',
        !isMatched && !isSelected && 'hover:bg-muted/50',
      )}
      onClick={isMatched ? undefined : onSelect}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isMatched) {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={isMatched ? -1 : 0}
      role="option"
      aria-selected={isSelected}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{formatDate(transaction.date)}</span>
          <Badge
            variant={transaction.type === 'CREDIT' ? 'default' : 'secondary'}
            className="text-[10px]"
          >
            {transaction.type}
          </Badge>
          {isMatched && (
            <Badge variant="outline" className="text-[10px]">
              <Check className="mr-1 size-3" />
              Matched
            </Badge>
          )}
        </div>
        <p className="truncate text-sm font-medium">{transaction.description}</p>
        {transaction.reference && (
          <p className="truncate text-xs text-muted-foreground">Ref: {transaction.reference}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p
          className={cn(
            'font-mono text-sm font-semibold tabular-nums',
            transaction.type === 'CREDIT'
              ? 'text-green-700 dark:text-green-400'
              : 'text-destructive',
          )}
        >
          {transaction.type === 'CREDIT' ? '+' : '-'}
          {formatCurrency(Math.abs(transaction.amount))}
        </p>
      </div>
      {isMatched && onUnmatch && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation();
            onUnmatch();
          }}
          disabled={isUnmatching}
          title="Unmatch"
        >
          <Link2Off className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Journal Line Row
// ---------------------------------------------------------------------------

function JournalLineRow({
  line,
  isSelected,
  onSelect,
}: {
  line: JournalLineForMatching;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors cursor-pointer',
        isSelected && 'ring-2 ring-primary bg-primary/5',
        'hover:bg-muted/50',
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      role="option"
      aria-selected={isSelected}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{formatDate(line.date)}</span>
          <span className="font-mono text-xs text-muted-foreground">{line.journalNumber}</span>
        </div>
        <p className="truncate text-sm font-medium">{line.description}</p>
        <p className="truncate text-xs text-muted-foreground">
          {line.accountCode} — {line.accountName}
          {line.reference ? ` | Ref: ${line.reference}` : ''}
        </p>
      </div>
      <div className="text-right shrink-0">
        {line.debit > 0 && (
          <p className="font-mono text-sm tabular-nums">Dr {formatCurrency(line.debit)}</p>
        )}
        {line.credit > 0 && (
          <p className="font-mono text-sm tabular-nums">Cr {formatCurrency(line.credit)}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function BankReconciliationPage({ bankAccountId }: BankReconciliationPageProps) {
  const [txFilter, setTxFilter] = useState<string>('UNMATCHED');
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  // --- Queries ---
  const { data: summary, isLoading: summaryLoading } = useReconciliationSummary(bankAccountId);
  const { data: transactions, isLoading: txLoading } = useBankTransactions(bankAccountId, {
    status: txFilter,
  });
  const { data: journalLines, isLoading: linesLoading } = useUnmatchedJournalLines(bankAccountId);

  // --- Mutations ---
  const matchMutation = useMatchTransaction(bankAccountId);
  const unmatchMutation = useUnmatchTransaction(bankAccountId);

  // --- Filtered transactions ---
  const filteredTransactions = useMemo(() => {
    return transactions ?? [];
  }, [transactions]);

  const filteredLines = useMemo(() => {
    return journalLines ?? [];
  }, [journalLines]);

  // --- Match handler ---
  const handleMatch = () => {
    if (!selectedTxId || !selectedLineId) return;
    matchMutation.mutate(
      { bankTransactionId: selectedTxId, journalLineId: selectedLineId },
      {
        onSuccess: () => {
          setSelectedTxId(null);
          setSelectedLineId(null);
        },
      },
    );
  };

  // --- Unmatch handler ---
  const handleUnmatch = (bankTransactionId: string) => {
    unmatchMutation.mutate(bankTransactionId);
  };

  const isLoading = summaryLoading || txLoading || linesLoading;

  if (isLoading) {
    return (
      <main className="flex flex-col gap-6" aria-label="Bank Reconciliation" aria-busy="true">
        <PageHeader
          title="Bank Reconciliation"
          breadcrumbs={[
            { label: 'Finance', path: '/finance' },
            { label: 'Bank Accounts', path: '/finance/bank-accounts' },
            { label: 'Reconciliation' },
          ]}
          isLoading
        />
        <div className="grid gap-4 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </main>
    );
  }

  const canMatch = selectedTxId !== null && selectedLineId !== null;

  return (
    <main className="flex flex-col gap-6" aria-label="Bank Reconciliation">
      <PageHeader
        title="Bank Reconciliation"
        subtitle={summary?.bankAccountName}
        breadcrumbs={[
          { label: 'Finance', path: '/finance' },
          { label: 'Bank Accounts', path: '/finance/bank-accounts' },
          { label: summary?.bankAccountName ?? 'Reconciliation' },
        ]}
      />

      {/* Summary cards */}
      {summary && (
        <ReconciliationSummaryCard
          statementBalance={summary.statementBalance}
          bookBalance={summary.bookBalance}
          unmatchedBankCount={summary.unmatchedBankCount}
          unmatchedJournalCount={summary.unmatchedJournalCount}
          difference={summary.difference}
        />
      )}

      {/* Match action bar */}
      <div className="flex items-center justify-center gap-4 rounded-lg border bg-muted/30 p-3">
        <div className="text-sm text-muted-foreground">
          {selectedTxId ? '1 bank transaction selected' : 'Select a bank transaction'}
        </div>
        <Button onClick={handleMatch} disabled={!canMatch || matchMutation.isPending} size="sm">
          {matchMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowLeftRight className="size-4" />
          )}
          Match Selected
        </Button>
        <div className="text-sm text-muted-foreground">
          {selectedLineId ? '1 journal line selected' : 'Select a journal line'}
        </div>
      </div>

      {/* Split pane */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Bank Transactions */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Bank Transactions</CardTitle>
              <Select value={txFilter} onValueChange={setTxFilter}>
                <SelectTrigger className="w-[140px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNMATCHED">Unmatched</SelectItem>
                  <SelectItem value="MATCHED">Matched</SelectItem>
                  <SelectItem value="">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div
              className="space-y-2 max-h-[600px] overflow-y-auto"
              role="listbox"
              aria-label="Bank transactions"
            >
              {filteredTransactions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No transactions found
                </p>
              ) : (
                filteredTransactions.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    transaction={tx}
                    isSelected={selectedTxId === tx.id}
                    onSelect={() => setSelectedTxId(selectedTxId === tx.id ? null : tx.id)}
                    onUnmatch={tx.status === 'MATCHED' ? () => handleUnmatch(tx.id) : undefined}
                    isUnmatching={unmatchMutation.isPending}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: Journal Lines */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Unmatched Journal Lines</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div
              className="space-y-2 max-h-[600px] overflow-y-auto"
              role="listbox"
              aria-label="Journal lines"
            >
              {filteredLines.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No unmatched journal lines
                </p>
              ) : (
                filteredLines.map((line) => (
                  <JournalLineRow
                    key={line.id}
                    line={line}
                    isSelected={selectedLineId === line.id}
                    onSelect={() => setSelectedLineId(selectedLineId === line.id ? null : line.id)}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
