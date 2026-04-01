/* eslint-disable i18next/no-literal-string */
/**
 * ExportButtons — CSV + Excel download buttons using export API endpoints.
 *
 * Uses fetch + blob download pattern (not apiGet) because export endpoints
 * return binary data, not JSON.
 */

import { useState } from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportButtonsProps {
  /** Base API path, e.g. '/finance/reports/trial-balance/export' or '/finance/accounts/export' */
  exportPath: string;
  /** Query params to append (report filters, etc.) */
  params?: Record<string, string | number | boolean | null | undefined>;
  /** Whether the export is currently allowed (e.g. report has results) */
  disabled?: boolean;
  /** Optional label prefix for accessibility */
  label?: string;
  /** Variant — 'icon' for icon-only buttons, 'default' for labelled */
  variant?: 'icon' | 'default';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildExportUrl(
  basePath: string,
  params?: Record<string, unknown>,
  format?: string,
): string {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
  const entries: [string, string][] = [];

  if (format) entries.push(['format', format]);

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        entries.push([k, String(v)]);
      }
    }
  }

  const qs = entries.length > 0 ? `?${new URLSearchParams(entries).toString()}` : '';
  return `${baseUrl}/api/v1${basePath}${qs}`;
}

async function downloadBlob(url: string, accessToken: string | null, filename: string) {
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExportButtons({
  exportPath,
  params,
  disabled = false,
  label = 'Export',
  variant = 'default',
}: ExportButtonsProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [csvLoading, setCsvLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);

  const handleExport = async (format: 'csv' | 'excel') => {
    const setLoading = format === 'csv' ? setCsvLoading : setExcelLoading;
    const ext = format === 'csv' ? 'csv' : 'xlsx';
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `export-${timestamp}.${ext}`;

    setLoading(true);
    try {
      const url = buildExportUrl(exportPath, params, format);
      await downloadBlob(url, accessToken, filename);
    } catch {
      // Silently fail — could add toast notification here
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'icon') {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void handleExport('csv')}
          disabled={disabled || csvLoading}
          aria-label={`${label} CSV`}
          title="Export CSV"
        >
          {csvLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void handleExport('excel')}
          disabled={disabled || excelLoading}
          aria-label={`${label} Excel`}
          title="Export Excel"
        >
          {excelLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="size-4" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void handleExport('csv')}
        disabled={disabled || csvLoading}
      >
        {csvLoading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void handleExport('excel')}
        disabled={disabled || excelLoading}
      >
        {excelLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="size-4" />
        )}
        Excel
      </Button>
    </div>
  );
}
