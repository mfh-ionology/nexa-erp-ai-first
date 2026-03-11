/**
 * TanStack Query hook for fetching resolved print preferences.
 *
 * Uses `useQuery` against `GET /system/print-preferences`.
 * Returns the user's preferences merged with company defaults.
 */

import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

// -- Types (must match @nexa/db Prisma enums: DocumentType, PrintAction) ------

export type DocumentType =
  | 'SALES_INVOICE'
  | 'CREDIT_NOTE'
  | 'CASH_RECEIPT'
  | 'PROFORMA_INVOICE'
  | 'CUSTOMER_STATEMENT'
  | 'SALES_ORDER'
  | 'SALES_QUOTE'
  | 'DELIVERY_NOTE'
  | 'PURCHASE_ORDER'
  | 'GOODS_RECEIPT_NOTE'
  | 'SUPPLIER_REMITTANCE'
  | 'PAYSLIP'
  | 'P45'
  | 'P60';

export type PrintAction = 'AUTO_DOWNLOAD' | 'BROWSER_PRINT' | 'NONE';

export type PreferenceSource = 'USER' | 'COMPANY_DEFAULT' | 'FALLBACK';

export interface PrintPreferenceItem {
  documentType: DocumentType;
  action: PrintAction;
  source: PreferenceSource;
}

// -- Hook ---------------------------------------------------------------------

/**
 * Query for the current user's resolved print preferences.
 *
 * Stale time: 5 minutes (preferences rarely change).
 */
export function usePrintPreferences() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.printPreferences.user(),
    queryFn: async () => {
      const result = await apiGet<PrintPreferenceItem[]>('/system/print-preferences');
      return result.data;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}
