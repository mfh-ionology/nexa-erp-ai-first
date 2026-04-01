/* eslint-disable i18next/no-literal-string */
/**
 * Finance Import Page — /finance/import
 *
 * 4 tabs: Accounts, Journals, Budgets, Exchange Rates.
 * Each tab: CSV upload + preview + import button + error display.
 */

import { useCallback, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileUp, Loader2, Upload } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/templates/page-header';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; field?: string; message: string }>;
}

interface PreviewRow {
  [key: string]: string;
}

type ImportEntity = 'accounts' | 'journals' | 'budgets' | 'exchange-rates';

const ENTITY_CONFIG: Record<
  ImportEntity,
  { label: string; endpoint: string; description: string; templateColumns: string[] }
> = {
  accounts: {
    label: 'Chart of Accounts',
    endpoint: '/finance/accounts/import',
    description:
      'Import GL accounts from CSV. Required columns: code, name, accountType, normalBalance.',
    templateColumns: ['code', 'name', 'accountType', 'normalBalance', 'parentCode', 'isPostable'],
  },
  journals: {
    label: 'Journal Entries',
    endpoint: '/finance/journals/import',
    description:
      'Import journal entries from CSV. Each row is a journal line. Required columns: date, description, accountCode, debit, credit.',
    templateColumns: [
      'date',
      'description',
      'reference',
      'accountCode',
      'debit',
      'credit',
      'vatCode',
    ],
  },
  budgets: {
    label: 'Budgets',
    endpoint: '/finance/budgets/import',
    description:
      'Import budget lines from CSV. Required columns: budgetName, fiscalYear, accountCode, period1..period12.',
    templateColumns: [
      'budgetName',
      'fiscalYear',
      'accountCode',
      'period1',
      'period2',
      'period3',
      'period4',
      'period5',
      'period6',
      'period7',
      'period8',
      'period9',
      'period10',
      'period11',
      'period12',
    ],
  },
  'exchange-rates': {
    label: 'Exchange Rates',
    endpoint: '/finance/exchange-rates/import',
    description:
      'Import exchange rates from CSV. Required columns: fromCurrency, toCurrency, rate, effectiveDate.',
    templateColumns: ['fromCurrency', 'toCurrency', 'rate', 'effectiveDate'],
  },
};

// ---------------------------------------------------------------------------
// CSV parser (basic)
// ---------------------------------------------------------------------------

function parseCSV(text: string): { headers: string[]; rows: PreviewRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0]!.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: PreviewRow = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });

  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Import Tab Component
// ---------------------------------------------------------------------------

function ImportTab({ entity }: { entity: ImportEntity }) {
  const config = ENTITY_CONFIG[entity];
  const accessToken = useAuthStore((s) => s.accessToken);
  const companyId = useAuthStore((s) => s.activeCompanyId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: PreviewRow[] } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    const text = await selectedFile.text();
    const parsed = parseCSV(text);
    setPreview(parsed);
  }, []);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected');

      const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
      const formData = new FormData();
      formData.append('file', file);

      const headers: Record<string, string> = {};
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
      if (companyId) headers['X-Company-Id'] = companyId;

      const response = await fetch(`${baseUrl}/api/v1${config.endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Import failed' }));
        throw new Error(err.message ?? `Import failed: ${response.status}`);
      }

      return response.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    const csv = config.templateColumns.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entity}-import-template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{config.description}</p>

      {/* Upload area */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => void handleFileSelect(e)}
              className="hidden"
              id={`file-${entity}`}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="size-4" />
              {file ? 'Change File' : 'Select CSV File'}
            </Button>
            {file && (
              <div className="flex items-center gap-2">
                <FileUp className="size-4 text-muted-foreground" />
                <span className="text-sm">{file.name}</span>
                <Badge variant="secondary">{preview?.rows.length ?? 0} rows</Badge>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  Clear
                </Button>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownloadTemplate}
              className="ml-auto text-xs"
            >
              Download Template
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview table */}
      {preview && preview.rows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Preview — first {Math.min(preview.rows.length, 10)} of {preview.rows.length} rows
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-1.5 text-left text-muted-foreground">#</th>
                    {preview.headers.map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.rows.slice(0, 10).map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1.5 text-muted-foreground">{idx + 1}</td>
                      {preview.headers.map((h) => (
                        <td key={h} className="px-2 py-1.5 font-mono">
                          {row[h] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import button */}
      {file && preview && preview.rows.length > 0 && !result && (
        <div className="flex items-center gap-4">
          <Button
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
            className="bg-[#7c3aed] hover:bg-[#5b21b6]"
          >
            {importMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Import {preview.rows.length} rows
          </Button>
          {importMutation.isError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {importMutation.error.message}
            </div>
          )}
        </div>
      )}

      {/* Result display */}
      {result && (
        <Card className={result.errors.length > 0 ? 'border-amber-300' : 'border-green-300'}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 mb-3">
              {result.errors.length === 0 ? (
                <CheckCircle2 className="size-5 text-green-600" />
              ) : (
                <AlertCircle className="size-5 text-amber-600" />
              )}
              <span className="font-medium">
                {result.imported} imported, {result.skipped} skipped
                {result.errors.length > 0 && `, ${result.errors.length} errors`}
              </span>
              <Button variant="outline" size="sm" onClick={handleClear}>
                Import Another
              </Button>
            </div>

            {/* Error details */}
            {result.errors.length > 0 && (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {result.errors.map((err, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <Badge variant="destructive" className="shrink-0 text-xs">
                      Row {err.row}
                    </Badge>
                    <span className="text-muted-foreground">
                      {err.field && <span className="font-medium">{err.field}: </span>}
                      {err.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function FinanceImportPage() {
  return (
    <main className="flex flex-col gap-6" aria-label="Finance Import">
      <PageHeader
        title="Import Data"
        subtitle="Import accounts, journals, budgets, and exchange rates from CSV files"
        breadcrumbs={[{ label: 'Finance', path: '/finance' }, { label: 'Import' }]}
      />

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="journals">Journals</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="exchange-rates">Exchange Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4">
          <ImportTab entity="accounts" />
        </TabsContent>
        <TabsContent value="journals" className="mt-4">
          <ImportTab entity="journals" />
        </TabsContent>
        <TabsContent value="budgets" className="mt-4">
          <ImportTab entity="budgets" />
        </TabsContent>
        <TabsContent value="exchange-rates" className="mt-4">
          <ImportTab entity="exchange-rates" />
        </TabsContent>
      </Tabs>
    </main>
  );
}
