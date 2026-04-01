/* eslint-disable i18next/no-literal-string */
/**
 * Bank Reconciliation Workspace — /finance/bank-reconciliation/$id
 *
 * Shows reconciliation session: bank transactions on left, journal lines on right.
 * Click to select, then Match. Shows balance summary.
 * Rule suggestions shown for unmatched bank transactions.
 */

import { useMemo, useState } from 'react';
import { ArrowLeftRight, Check, Loader2, Plus, Wand2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/templates/page-header';

import {
  useReconciliationList,
  useReconciliationDetail,
  useCreateReconciliation,
  useMatchTransaction,
  // useUnmatchTransaction is available but not used in current workspace view
} from '../hooks/use-bank-reconciliation';

import { useApplyRules, useCreateJournalFromRule } from '../hooks/use-bank-recon-rules';

import type { RuleSuggestion } from '../api/bank-recon-rules-api';

interface BankReconciliationPageProps {
  bankAccountId: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(value);
}

export function BankReconciliationPage({ bankAccountId }: BankReconciliationPageProps) {
  // Fetch reconciliation sessions for this bank account
  const { data: sessions, isLoading: sessionsLoading } = useReconciliationList(bankAccountId);
  const createRecon = useCreateReconciliation(bankAccountId);
  const matchMutation = useMatchTransaction(bankAccountId);

  // Rule suggestions
  const { data: suggestions } = useApplyRules(bankAccountId);
  const createJournalFromRule = useCreateJournalFromRule(bankAccountId);

  // Build a map of bankTransactionId -> suggestion
  const suggestionMap = useMemo(() => {
    const map = new Map<string, RuleSuggestion>();
    if (suggestions) {
      for (const s of suggestions) {
        map.set(s.bankTransactionId, s);
      }
    }
    return map;
  }, [suggestions]);

  // Find active (IN_PROGRESS) session
  const activeSession = useMemo(
    () => sessions?.find((s) => s.status === 'IN_PROGRESS'),
    [sessions],
  );

  // Fetch detail for active session
  const { data: detail, isLoading: detailLoading } = useReconciliationDetail(
    bankAccountId,
    activeSession?.id,
  );

  // Selection state
  const [selectedBankTxId, setSelectedBankTxId] = useState<string | null>(null);
  const [selectedJournalLineId, setSelectedJournalLineId] = useState<string | null>(null);

  // Create session form
  const [statementBalance, setStatementBalance] = useState('');
  const today = new Date().toISOString().split('T')[0]!;

  const handleCreateSession = () => {
    createRecon.mutate({
      statementDate: today,
      statementBalance: parseFloat(statementBalance) || 0,
    });
  };

  const handleMatch = () => {
    if (!selectedBankTxId || !selectedJournalLineId) return;
    matchMutation.mutate(
      { bankTransactionId: selectedBankTxId, journalLineId: selectedJournalLineId },
      {
        onSuccess: () => {
          setSelectedBankTxId(null);
          setSelectedJournalLineId(null);
        },
      },
    );
  };

  const handleCreateJournalFromRule = (suggestion: RuleSuggestion) => {
    createJournalFromRule.mutate({
      bankTransactionId: suggestion.bankTransactionId,
      ruleId: suggestion.ruleId,
      accountCode: suggestion.suggestedAccountCode,
      description: suggestion.suggestedDescription ?? undefined,
    });
  };

  const breadcrumbs = [
    { label: 'Finance', path: '/finance' },
    { label: 'Bank Reconciliation', path: '/finance/bank-reconciliation' },
    { label: 'Workspace' },
  ];

  // Loading
  if (sessionsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Bank Reconciliation" breadcrumbs={breadcrumbs} isLoading />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // No active session — show create form
  if (!activeSession) {
    return (
      <div className="space-y-6">
        <PageHeader title="Bank Reconciliation" breadcrumbs={breadcrumbs} />
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle>Start Reconciliation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Statement Balance (£)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Enter bank statement closing balance"
                value={statementBalance}
                onChange={(e) => setStatementBalance(e.target.value)}
              />
            </div>
            <Button
              onClick={handleCreateSession}
              disabled={createRecon.isPending}
              className="w-full"
            >
              {createRecon.isPending ? (
                <Loader2 className="animate-spin mr-2 size-4" />
              ) : (
                <Plus className="mr-2 size-4" />
              )}
              Start Reconciliation
            </Button>

            {sessions && sessions.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Previous sessions:</p>
                {sessions.map((s) => (
                  <div key={s.id} className="flex justify-between text-sm py-1">
                    <span>{s.statementDate?.toString().slice(0, 10)}</span>
                    <Badge variant="outline">{s.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active session — show workspace
  if (detailLoading || !detail) {
    return (
      <div className="space-y-6">
        <PageHeader title="Bank Reconciliation" breadcrumbs={breadcrumbs} />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const unmatchedBank = detail.unmatchedBankTransactions ?? [];
  const matchedBank = detail.matchedTransactions ?? [];
  const unmatchedJournal = detail.unmatchedJournalLines ?? [];

  // Count how many unmatched transactions have rule suggestions
  const suggestCount = unmatchedBank.filter((tx) => suggestionMap.has(tx.id)).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Bank Reconciliation" breadcrumbs={breadcrumbs} />

      {/* Rule suggestion banner */}
      {suggestCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <Wand2 className="size-5 text-primary" />
          <p className="text-sm font-medium">
            {suggestCount} transaction{suggestCount !== 1 ? 's' : ''} can be auto-journaled from
            rules
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Statement Balance</p>
            <p className="text-lg font-semibold font-mono">
              {formatCurrency(detail.statementBalance ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">GL Balance</p>
            <p className="text-lg font-semibold font-mono">
              {formatCurrency(detail.glBalance ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Unmatched Bank</p>
            <p className="text-lg font-semibold">{unmatchedBank.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Difference</p>
            <p
              className={`text-lg font-semibold font-mono ${(detail.difference ?? 0) !== 0 ? 'text-destructive' : 'text-green-600'}`}
            >
              {formatCurrency(detail.difference ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Match action bar */}
      {(selectedBankTxId || selectedJournalLineId) && (
        <div className="flex items-center justify-center gap-4 py-3 px-4 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm">
            {selectedBankTxId ? '1 bank transaction' : 'Select bank transaction'}
          </span>
          <ArrowLeftRight className="size-4 text-muted-foreground" />
          <span className="text-sm">
            {selectedJournalLineId ? '1 journal line' : 'Select journal line'}
          </span>
          <Button
            size="sm"
            onClick={handleMatch}
            disabled={!selectedBankTxId || !selectedJournalLineId || matchMutation.isPending}
          >
            {matchMutation.isPending ? (
              <Loader2 className="animate-spin size-4" />
            ) : (
              <Check className="size-4 mr-1" />
            )}
            Match
          </Button>
        </div>
      )}

      {/* Split pane */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Bank Transactions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Bank Transactions ({unmatchedBank.length} unmatched)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto">
              {unmatchedBank.length === 0 && matchedBank.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No bank transactions imported
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-right p-2">Amount</th>
                      <th className="text-center p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatchedBank.map((tx) => {
                      const suggestion = suggestionMap.get(tx.id);
                      return (
                        <tr
                          key={tx.id}
                          className={`border-t cursor-pointer hover:bg-primary/5 ${selectedBankTxId === tx.id ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}
                          onClick={() =>
                            setSelectedBankTxId(selectedBankTxId === tx.id ? null : tx.id)
                          }
                        >
                          <td className="p-2 font-mono text-xs">
                            {String(tx.transactionDate).slice(0, 10)}
                          </td>
                          <td className="p-2">
                            <div>{tx.description}</div>
                            {suggestion && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  Rule: {suggestion.suggestedAccountCode}
                                  {suggestion.suggestedDescription
                                    ? ` — ${suggestion.suggestedDescription}`
                                    : ''}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCreateJournalFromRule(suggestion);
                                  }}
                                  disabled={createJournalFromRule.isPending}
                                >
                                  {createJournalFromRule.isPending ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <Wand2 className="size-3 mr-1" />
                                  )}
                                  Create Journal
                                </Button>
                              </div>
                            )}
                          </td>
                          <td
                            className={`p-2 text-right font-mono tabular-nums ${tx.amount < 0 ? 'text-destructive' : 'text-green-600'}`}
                          >
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="p-2 text-center">
                            <Badge variant="outline" className="text-xs">
                              Unmatched
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                    {matchedBank.map((tx) => (
                      <tr key={tx.id} className="border-t opacity-50">
                        <td className="p-2 font-mono text-xs">
                          {String(tx.transactionDate).slice(0, 10)}
                        </td>
                        <td className="p-2">{tx.description}</td>
                        <td className="p-2 text-right font-mono tabular-nums">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant="secondary" className="text-xs">
                            Matched
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: Journal Lines */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Journal Lines ({unmatchedJournal.length} unmatched)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto">
              {unmatchedJournal.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No unmatched journal lines
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-right p-2">Debit</th>
                      <th className="text-right p-2">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatchedJournal.map((line) => (
                      <tr
                        key={line.id}
                        className={`border-t cursor-pointer hover:bg-primary/5 ${selectedJournalLineId === line.id ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}
                        onClick={() =>
                          setSelectedJournalLineId(
                            selectedJournalLineId === line.id ? null : line.id,
                          )
                        }
                      >
                        <td className="p-2 font-mono text-xs">
                          {String(line.transactionDate ?? '').slice(0, 10)}
                        </td>
                        <td className="p-2">{line.description ?? line.journalDescription ?? ''}</td>
                        <td className="p-2 text-right font-mono tabular-nums">
                          {line.debit > 0 ? formatCurrency(line.debit) : '\u2014'}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums">
                          {line.credit > 0 ? formatCurrency(line.credit) : '\u2014'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
