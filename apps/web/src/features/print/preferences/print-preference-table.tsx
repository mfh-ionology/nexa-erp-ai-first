/**
 * PrintPreferenceTable — renders a table of document types with
 * Select dropdowns for choosing the print action per type.
 *
 * Rows: one per DocumentType (14 rows) with human-readable labels.
 * Columns: Document Type | Company Default (read-only, when provided) | My Preference (Select dropdown).
 * Shows "(company default)" or "(system default)" label when using inherited values.
 */

import { useMemo } from 'react';

import { useI18n } from '@nexa/i18n';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import type { DocumentType, PrintAction, PreferenceSource } from '../api/use-print-preferences';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PreferenceRow {
  documentType: DocumentType;
  action: PrintAction;
  source?: PreferenceSource;
}

export interface PrintPreferenceTableProps {
  preferences: PreferenceRow[];
  localState: Record<string, PrintAction>;
  onChange: (documentType: DocumentType, action: PrintAction) => void;
  isLoading?: boolean;
  /** When true, source labels are hidden (used for company defaults table) */
  hideSourceLabels?: boolean;
  /** Company-level defaults — shown as a read-only column when provided */
  companyDefaults?: Array<{ documentType: string; action: string }>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DOCUMENT_TYPE_ORDER: DocumentType[] = [
  'SALES_INVOICE',
  'CREDIT_NOTE',
  'CASH_RECEIPT',
  'PROFORMA_INVOICE',
  'CUSTOMER_STATEMENT',
  'SALES_ORDER',
  'SALES_QUOTE',
  'DELIVERY_NOTE',
  'PURCHASE_ORDER',
  'GOODS_RECEIPT_NOTE',
  'SUPPLIER_REMITTANCE',
  'PAYSLIP',
  'P45',
  'P60',
];

const PRINT_ACTIONS: PrintAction[] = ['AUTO_DOWNLOAD', 'BROWSER_PRINT', 'NONE'];

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-9 w-44 rounded-md" />
        </div>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function PrintPreferenceTable({
  preferences,
  localState,
  onChange,
  isLoading,
  hideSourceLabels = false,
  companyDefaults,
}: PrintPreferenceTableProps) {
  const { t } = useI18n('print');

  // Build a lookup from preferences for source info
  const sourceMap = useMemo(() => {
    const map: Record<string, PreferenceSource | undefined> = {};
    for (const pref of preferences) {
      map[pref.documentType] = pref.source;
    }
    return map;
  }, [preferences]);

  // Build a lookup for company default actions
  const companyDefaultMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (companyDefaults) {
      for (const d of companyDefaults) {
        map[d.documentType] = d.action;
      }
    }
    return map;
  }, [companyDefaults]);

  const showCompanyDefaultColumn = !!companyDefaults;

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div className="rounded-xl border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.1)]">
      {/* Column headers */}
      <div className="flex items-center border-b px-6 py-3">
        <div className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('preferences.columns.documentType')}
        </div>
        {showCompanyDefaultColumn && (
          <div className="w-44 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
            {t('preferences.columns.companyDefault')}
          </div>
        )}
        <div className="w-52 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
          {t('preferences.columns.myPreference')}
        </div>
      </div>

      {/* Preference rows */}
      {DOCUMENT_TYPE_ORDER.map((docType, index) => {
        const currentAction = localState[docType] ?? 'NONE';
        const source = sourceMap[docType];
        const isInherited =
          !hideSourceLabels && (source === 'COMPANY_DEFAULT' || source === 'FALLBACK');
        // Check if user has changed from the original loaded value
        const originalPref = preferences.find((p) => p.documentType === docType);
        const hasLocalChange = originalPref
          ? localState[docType] !== undefined && localState[docType] !== originalPref.action
          : false;

        return (
          <div
            key={docType}
            className="flex items-center border-b border-border/30 px-6 py-3 last:border-b-0 animate-step-in"
            style={{ animationDelay: `${50 + index * 30}ms` }}
          >
            {/* Document type label */}
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-sm text-foreground">{t(`documentTypes.${docType}`)}</p>
              {isInherited && !hasLocalChange && (
                <span className="text-[10px] text-muted-foreground">
                  {source === 'COMPANY_DEFAULT'
                    ? t('preferences.source.companyDefault')
                    : t('preferences.source.fallback')}
                </span>
              )}
            </div>

            {/* Company default column (read-only) */}
            {showCompanyDefaultColumn && (
              <div className="w-44 text-center">
                <span className="text-sm text-muted-foreground">
                  {t(`preferences.actions.${companyDefaultMap[docType] ?? 'NONE'}`)}
                </span>
              </div>
            )}

            {/* Action selector */}
            <div className="w-52">
              <Select
                value={currentAction}
                onValueChange={(value) => onChange(docType, value as PrintAction)}
              >
                <SelectTrigger
                  className={`w-full ${
                    isInherited && !hasLocalChange ? 'text-muted-foreground' : 'text-foreground'
                  }`}
                  size="sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRINT_ACTIONS.map((action) => (
                    <SelectItem key={action} value={action}>
                      {t(`preferences.actions.${action}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      })}
    </div>
  );
}
