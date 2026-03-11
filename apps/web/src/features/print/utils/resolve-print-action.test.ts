import { describe, it, expect } from 'vitest';

import { lookupResolvedPreference } from './resolve-print-action';
import type { PrintPreferenceItem } from '../api/use-print-preferences';

describe('lookupResolvedPreference', () => {
  const resolvedPreferences: PrintPreferenceItem[] = [
    { documentType: 'SALES_INVOICE', action: 'AUTO_DOWNLOAD', source: 'USER' },
    { documentType: 'CREDIT_NOTE', action: 'BROWSER_PRINT', source: 'COMPANY_DEFAULT' },
    { documentType: 'PURCHASE_ORDER', action: 'NONE', source: 'FALLBACK' },
  ];

  it('returns matching action for a known document type', () => {
    const result = lookupResolvedPreference('SALES_INVOICE', resolvedPreferences);
    expect(result).toBe('AUTO_DOWNLOAD');
  });

  it('returns NONE for unknown document type', () => {
    const result = lookupResolvedPreference('PAYSLIP', resolvedPreferences);
    expect(result).toBe('NONE');
  });

  it('returns NONE when preferences are undefined', () => {
    const result = lookupResolvedPreference('SALES_INVOICE', undefined);
    expect(result).toBe('NONE');
  });

  it('returns NONE when preferences are empty', () => {
    const result = lookupResolvedPreference('SALES_INVOICE', []);
    expect(result).toBe('NONE');
  });

  it('handles all 14 document types without error', () => {
    const allTypes = [
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
    ] as const;

    for (const docType of allTypes) {
      const result = lookupResolvedPreference(docType, resolvedPreferences);
      expect(['AUTO_DOWNLOAD', 'BROWSER_PRINT', 'NONE']).toContain(result);
    }
  });
});
