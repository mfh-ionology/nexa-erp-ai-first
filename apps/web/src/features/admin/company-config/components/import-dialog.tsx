/**
 * Import Company Configuration Dialog.
 *
 * Accepts a JSON config file (via drag-and-drop, file browse, or pasted text),
 * supports dry-run preview before applying, and displays import results.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileUp, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { ApiError } from '@nexa/api-client';
import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { queryKeys } from '@/lib/query-keys';

import { useImportDefaults } from '../api/use-company-config-mutations';
import type {
  ExportDefaultsResponse,
  ImportDefaultsResponse,
} from '../api/types';

// --- Props ---

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// --- Dialog phase ---

type DialogPhase = 'input' | 'results';

// --- Summary row definition ---

interface SummaryRow {
  labelKey: string;
  created: number;
  updated: number;
}

// --- Helpers ---

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildSummaryRows(summary: ImportDefaultsResponse['summary']): SummaryRow[] {
  return [
    { labelKey: 'companyConfig.import.results.resources', created: summary.resourcesCreated, updated: summary.resourcesUpdated },
    { labelKey: 'companyConfig.import.results.accessGroups', created: summary.accessGroupsCreated, updated: summary.accessGroupsUpdated },
    { labelKey: 'companyConfig.import.results.permissions', created: summary.permissionsSet, updated: 0 },
    { labelKey: 'companyConfig.import.results.fieldOverrides', created: summary.fieldOverridesSet, updated: 0 },
    { labelKey: 'companyConfig.import.results.vatCodes', created: summary.vatCodesCreated, updated: summary.vatCodesUpdated },
    { labelKey: 'companyConfig.import.results.paymentTerms', created: summary.paymentTermsCreated, updated: summary.paymentTermsUpdated },
    { labelKey: 'companyConfig.import.results.numberSeries', created: summary.numberSeriesCreated, updated: summary.numberSeriesUpdated },
    { labelKey: 'companyConfig.import.results.currencies', created: summary.currenciesCreated, updated: summary.currenciesUpdated },
  ];
}

// --- Component ---

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportDefaults();
  const resetMutationRef = useRef(importMutation.reset);
  resetMutationRef.current = importMutation.reset;

  // --- State ---
  const [phase, setPhase] = useState<DialogPhase>('input');
  const [parsedData, setParsedData] = useState<ExportDefaultsResponse | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isDryRun, setIsDryRun] = useState(true);
  const [importResult, setImportResult] = useState<ImportDefaultsResponse | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // --- Reset state when dialog closes ---
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setPhase('input');
        setParsedData(null);
        setFileName(null);
        setFileSize(null);
        setFileError(null);
        setJsonText('');
        setJsonError(null);
        setIsDryRun(true);
        setImportResult(null);
        setImportError(null);
        setIsDragOver(false);
        resetMutationRef.current();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  // --- File handling ---

  const processFile = useCallback(
    (file: File) => {
      setJsonText('');
      setJsonError(null);
      setFileError(null);
      setImportError(null);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string) as ExportDefaultsResponse;
          setParsedData(data);
          setFileName(file.name);
          setFileSize(file.size);
          setFileError(null);
        } catch {
          setParsedData(null);
          setFileName(file.name);
          setFileSize(file.size);
          setFileError(t('companyConfig.import.invalidFile'));
        }
      };
      reader.readAsText(file);
    },
    [t],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset input value so re-selecting the same file triggers onChange
      e.target.value = '';
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDropZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDropZoneKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [],
  );

  // --- JSON textarea handling ---

  const handleJsonChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setJsonText(value);
      // Clear file selection when typing in textarea
      setFileName(null);
      setFileSize(null);
      setFileError(null);
      setImportError(null);

      // Clear previous validation error while typing
      if (jsonError) setJsonError(null);

      // Auto-validate if non-empty
      if (value.trim()) {
        try {
          const data = JSON.parse(value) as ExportDefaultsResponse;
          setParsedData(data);
          setJsonError(null);
        } catch {
          setParsedData(null);
          // Don't show error while typing — show on blur
        }
      } else {
        setParsedData(null);
      }
    },
    [jsonError],
  );

  const handleJsonBlur = useCallback(() => {
    if (jsonText.trim() && !parsedData) {
      setJsonError(t('companyConfig.import.invalidJson'));
    }
  }, [jsonText, parsedData, t]);

  // --- Import action ---

  const handleImport = useCallback(
    async (dryRun: boolean) => {
      if (!parsedData) return;

      setImportError(null);

      try {
        const result = await importMutation.mutateAsync({
          data: parsedData,
          dryRun,
        });

        setImportResult(result);
        setPhase('results');

        if (result.status === 'APPLIED') {
          toast.success(t('companyConfig.toast.importSuccess'));
          // Invalidate all system queries — resources, access groups, permissions, etc.
          void queryClient.invalidateQueries({ queryKey: queryKeys.system.all });
        }
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 400) {
          if (error.code === 'UNSUPPORTED_VERSION') {
            setImportError(t('companyConfig.import.unsupportedVersion'));
          } else {
            setImportError(error.message);
          }
        }
        // Unexpected errors are handled by the mutation's onError (generic toast)
      }
    },
    [parsedData, importMutation, queryClient, t],
  );

  const handleImportClick = useCallback(() => {
    handleImport(isDryRun);
  }, [handleImport, isDryRun]);

  const handleApplyClick = useCallback(() => {
    handleImport(false);
  }, [handleImport]);

  // --- Derived state ---

  const hasValidData = parsedData !== null;
  const isLoading = importMutation.isPending;
  const isInputPhase = phase === 'input';
  const isResultsPhase = phase === 'results';
  const isDryRunResult = importResult?.status === 'DRY_RUN';
  const isAppliedResult = importResult?.status === 'APPLIED';
  const summaryRows = useMemo(
    () => (importResult ? buildSummaryRows(importResult.summary) : []),
    [importResult],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('companyConfig.import.title')}</DialogTitle>
          <DialogDescription>
            {t('companyConfig.import.description')}
          </DialogDescription>
        </DialogHeader>

        {/* --- Input phase --- */}
        {isInputPhase && (
          <div className="space-y-4">
            {/* File drop zone */}
            <div
              role="button"
              tabIndex={0}
              aria-label={t('companyConfig.import.dropZoneLabel')}
              className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              } ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={handleDropZoneClick}
              onKeyDown={handleDropZoneKeyDown}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileInputChange}
                disabled={isLoading}
              />
              {fileName && !fileError ? (
                <>
                  <FileUp className="size-8 text-primary" />
                  <p className="text-sm font-medium">
                    {t('companyConfig.import.fileName', {
                      name: fileName,
                      size: fileSize ? formatFileSize(fileSize) : '',
                    })}
                  </p>
                </>
              ) : (
                <>
                  <Upload className="size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {isDragOver
                      ? t('companyConfig.import.dropZoneActive')
                      : t('companyConfig.import.dropZoneLabel')}
                  </p>
                </>
              )}
            </div>

            {/* File error */}
            {fileError && (
              <p className="text-sm text-destructive">{fileError}</p>
            )}

            {/* OR separator */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground uppercase">
                {t('companyConfig.import.orSeparator')}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* JSON textarea */}
            <Textarea
              placeholder={t('companyConfig.import.pasteJsonPlaceholder')}
              value={jsonText}
              onChange={handleJsonChange}
              onBlur={handleJsonBlur}
              disabled={isLoading}
              rows={6}
              className="font-mono text-xs"
            />

            {/* JSON error */}
            {jsonError && (
              <p className="text-sm text-destructive">{jsonError}</p>
            )}

            {/* Dry run checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="dry-run-checkbox"
                checked={isDryRun}
                onCheckedChange={(checked) => setIsDryRun(checked === true)}
                disabled={isLoading}
              />
              <label
                htmlFor="dry-run-checkbox"
                className="text-sm cursor-pointer select-none"
              >
                {t('companyConfig.import.dryRunLabel')}
              </label>
            </div>

            {/* Import error banner */}
            {importError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
                <p className="text-sm text-destructive">{importError}</p>
              </div>
            )}
          </div>
        )}

        {/* --- Results phase --- */}
        {isResultsPhase && importResult && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">
              {isDryRunResult
                ? t('companyConfig.import.results.dryRunTitle')
                : t('companyConfig.import.results.title')}
            </h3>

            {/* Summary table */}
            <Card className="py-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('companyConfig.import.results.entityType')}</TableHead>
                      <TableHead className="text-right">{t('companyConfig.import.results.created')}</TableHead>
                      <TableHead className="text-right">{t('companyConfig.import.results.updated')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryRows.map((row) => (
                      <TableRow key={row.labelKey}>
                        <TableCell>{t(row.labelKey)}</TableCell>
                        <TableCell className="text-right">{row.created}</TableCell>
                        <TableCell className="text-right">{row.updated}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-medium">
                        {t('companyConfig.import.results.total')}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {summaryRows.reduce((sum, r) => sum + r.created, 0)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {summaryRows.reduce((sum, r) => sum + r.updated, 0)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>

            {/* Warnings */}
            {importResult.warnings.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3">
                <AlertTriangle className="size-4 shrink-0 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500">
                    {t('companyConfig.import.results.warnings')}
                  </p>
                  <ul className="list-disc pl-4 text-sm text-yellow-600 dark:text-yellow-500">
                    {importResult.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Apply error (if apply after dry-run fails) */}
            {importError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
                <p className="text-sm text-destructive">{importError}</p>
              </div>
            )}
          </div>
        )}

        {/* --- Footer buttons --- */}
        <DialogFooter>
          {isInputPhase && (
            <>
              <Button
                variant="ghost"
                onClick={() => handleOpenChange(false)}
              >
                {t('common:cancel')}
              </Button>
              <Button
                onClick={handleImportClick}
                disabled={!hasValidData || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {t('companyConfig.import.importButton')}
                  </>
                ) : (
                  t('companyConfig.import.importButton')
                )}
              </Button>
            </>
          )}

          {isResultsPhase && isDryRunResult && (
            <>
              <Button
                variant="ghost"
                onClick={() => handleOpenChange(false)}
              >
                {t('common:close')}
              </Button>
              <Button
                onClick={handleApplyClick}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {t('companyConfig.import.applyButton')}
                  </>
                ) : (
                  t('companyConfig.import.applyButton')
                )}
              </Button>
            </>
          )}

          {isResultsPhase && isAppliedResult && (
            <Button onClick={() => handleOpenChange(false)}>
              {t('companyConfig.import.doneButton')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
