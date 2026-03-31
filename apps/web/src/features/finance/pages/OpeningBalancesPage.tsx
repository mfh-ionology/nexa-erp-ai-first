/* eslint-disable i18next/no-literal-string */
/**
 * FE14: Opening Balance Import Page — /finance/opening-balances
 *
 * CSV upload and manual entry form for opening balances.
 */

import { useState, useCallback, useRef } from 'react';

import { PageHeader } from '@/components/templates/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Upload, Plus, Trash2 } from 'lucide-react';

import {
  useOpeningBalances,
  useImportOpeningBalances,
  useManualOpeningBalances,
} from '../hooks/use-year-end';

interface ManualLine {
  accountId: string;
  debit: string;
  credit: string;
}

function formatCurrency(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num) || num === 0) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(num);
}

export function OpeningBalancesPage() {
  const { balances, isLoading } = useOpeningBalances();
  const importMutation = useImportOpeningBalances();
  const manualMutation = useManualOpeningBalances();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('current');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]!);
  const [manualLines, setManualLines] = useState<ManualLine[]>([
    { accountId: '', debit: '', credit: '' },
  ]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      importMutation.mutate(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [importMutation],
  );

  const handleAddLine = useCallback(() => {
    setManualLines((prev) => [...prev, { accountId: '', debit: '', credit: '' }]);
  }, []);

  const handleRemoveLine = useCallback((index: number) => {
    setManualLines((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleLineChange = useCallback((index: number, field: keyof ManualLine, value: string) => {
    setManualLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)),
    );
  }, []);

  const handleManualSubmit = useCallback(() => {
    const validLines = manualLines.filter((l) => l.accountId && (l.debit || l.credit));
    if (validLines.length === 0) return;

    manualMutation.mutate({
      date: manualDate,
      lines: validLines.map((l) => ({
        accountId: l.accountId,
        debit: l.debit || undefined,
        credit: l.credit || undefined,
      })),
    });
  }, [manualDate, manualLines, manualMutation]);

  // Calculate totals for manual entry
  const manualTotals = manualLines.reduce(
    (acc, line) => ({
      debit: acc.debit + (Number(line.debit) || 0),
      credit: acc.credit + (Number(line.credit) || 0),
    }),
    { debit: 0, credit: 0 },
  );
  const isBalanced = Math.abs(manualTotals.debit - manualTotals.credit) < 0.01;

  return (
    <main className="flex flex-col gap-6" aria-label="Opening Balances">
      <PageHeader
        title="Opening Balances"
        subtitle="Import or manually enter opening balances"
        breadcrumbs={[{ label: 'Finance', path: '/finance' }, { label: 'Opening Balances' }]}
        isLoading={isLoading}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="line">
          <TabsTrigger value="current">Current Balances</TabsTrigger>
          <TabsTrigger value="import">CSV Import</TabsTrigger>
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
        </TabsList>

        {/* Current balances */}
        <TabsContent value="current">
          <Card>
            <CardContent className="pt-6">
              {balances.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No opening balances have been set.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balances.map((b) => (
                      <TableRow key={b.accountId}>
                        <TableCell>
                          <span className="font-mono text-xs">{b.accountCode}</span>
                        </TableCell>
                        <TableCell>{b.accountName}</TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {formatCurrency(b.debit)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {formatCurrency(b.credit)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CSV Import */}
        <TabsContent value="import">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Upload CSV File</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with columns: AccountCode, Debit, Credit. The first row should be
                headers.
              </p>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importMutation.isPending}
                >
                  {importMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Choose File
                </Button>
              </div>

              {importMutation.isSuccess && importMutation.data && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-medium text-emerald-800">
                    Successfully imported {importMutation.data.imported} balances.
                  </p>
                  {importMutation.data.errors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-amber-700">
                        {importMutation.data.errors.length} errors:
                      </p>
                      {importMutation.data.errors.slice(0, 5).map((err) => (
                        <p key={err.row} className="text-xs text-amber-600">
                          Row {err.row}: {err.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Entry */}
        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Manual Opening Balances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Opening Date</Label>
                <Input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="max-w-xs"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account ID</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualLines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={line.accountId}
                          onChange={(e) => handleLineChange(index, 'accountId', e.target.value)}
                          placeholder="Account ID"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={line.debit}
                          onChange={(e) => handleLineChange(index, 'debit', e.target.value)}
                          placeholder="0.00"
                          className="h-8 text-right font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={line.credit}
                          onChange={(e) => handleLineChange(index, 'credit', e.target.value)}
                          placeholder="0.00"
                          className="h-8 text-right font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemoveLine(index)}
                          disabled={manualLines.length <= 1}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={handleAddLine}>
                  <Plus className="size-4" />
                  Add Line
                </Button>
                <div className="text-right text-sm">
                  <span className="text-muted-foreground">
                    Debit: {manualTotals.debit.toFixed(2)} | Credit:{' '}
                    {manualTotals.credit.toFixed(2)}
                  </span>
                  {!isBalanced && manualTotals.debit + manualTotals.credit > 0 && (
                    <p className="text-xs text-red-600">
                      Out of balance by{' '}
                      {Math.abs(manualTotals.debit - manualTotals.credit).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              <Button
                onClick={handleManualSubmit}
                disabled={manualMutation.isPending || !isBalanced}
                className="w-full"
              >
                {manualMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Save Opening Balances
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
