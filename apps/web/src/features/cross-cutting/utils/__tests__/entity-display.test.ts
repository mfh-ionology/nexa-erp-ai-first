import { describe, it, expect } from 'vitest';
import {
  FileText,
  Image,
  FileSpreadsheet,
  File,
  FileCode,
  FileArchive,
  ShoppingCart,
  Package,
  Users,
  Boxes,
} from 'lucide-react';

import {
  getEntityTypeLabelKey,
  getEntityTypeLabel,
  getEntityTypeIcon,
  getEntityTypeRoute,
  getMimeTypeIcon,
  formatFileSize,
  VALID_ENTITY_TYPES,
} from '../entity-display';

// ---------------------------------------------------------------------------
// getEntityTypeLabelKey
// ---------------------------------------------------------------------------

describe('getEntityTypeLabelKey', () => {
  it('returns i18n key for known entity types', () => {
    expect(getEntityTypeLabelKey('CustomerInvoice')).toBe(
      'crossCutting.recordLinks.entityCustomerInvoice',
    );
    expect(getEntityTypeLabelKey('SalesOrder')).toBe('crossCutting.recordLinks.entitySalesOrder');
    expect(getEntityTypeLabelKey('Customer')).toBe('crossCutting.recordLinks.entityCustomer');
  });

  it('falls back to raw entity type string for unknown types', () => {
    expect(getEntityTypeLabelKey('UnknownEntity')).toBe('UnknownEntity');
  });
});

// ---------------------------------------------------------------------------
// getEntityTypeLabel
// ---------------------------------------------------------------------------

describe('getEntityTypeLabel', () => {
  it('inserts spaces before uppercase letters in camelCase', () => {
    expect(getEntityTypeLabel('CustomerInvoice')).toBe('Customer Invoice');
    expect(getEntityTypeLabel('SalesOrder')).toBe('Sales Order');
    expect(getEntityTypeLabel('PurchaseOrder')).toBe('Purchase Order');
    expect(getEntityTypeLabel('GoodsReceiptNote')).toBe('Goods Receipt Note');
  });

  it('handles single-word entity types', () => {
    expect(getEntityTypeLabel('Customer')).toBe('Customer');
    expect(getEntityTypeLabel('Employee')).toBe('Employee');
    expect(getEntityTypeLabel('Dispatch')).toBe('Dispatch');
  });
});

// ---------------------------------------------------------------------------
// getEntityTypeIcon
// ---------------------------------------------------------------------------

describe('getEntityTypeIcon', () => {
  it('returns correct icon for known entity types', () => {
    expect(getEntityTypeIcon('CustomerInvoice')).toBe(FileText);
    expect(getEntityTypeIcon('SalesOrder')).toBe(ShoppingCart);
    expect(getEntityTypeIcon('PurchaseOrder')).toBe(Package);
    expect(getEntityTypeIcon('Customer')).toBe(Users);
    expect(getEntityTypeIcon('InventoryItem')).toBe(Boxes);
  });

  it('returns generic File icon for unknown entity types', () => {
    expect(getEntityTypeIcon('UnknownEntity')).toBe(File);
    expect(getEntityTypeIcon('')).toBe(File);
  });
});

// ---------------------------------------------------------------------------
// getEntityTypeRoute
// ---------------------------------------------------------------------------

describe('getEntityTypeRoute', () => {
  it('returns full route path for known entity types', () => {
    expect(getEntityTypeRoute('CustomerInvoice', 'abc-123')).toBe('/finance/invoices/abc-123');
    expect(getEntityTypeRoute('SalesOrder', 'so-456')).toBe('/sales/orders/so-456');
    expect(getEntityTypeRoute('PurchaseOrder', 'po-789')).toBe('/purchasing/orders/po-789');
    expect(getEntityTypeRoute('Customer', 'cust-1')).toBe('/crm/customers/cust-1');
    expect(getEntityTypeRoute('InventoryItem', 'item-1')).toBe('/inventory/items/item-1');
    expect(getEntityTypeRoute('Employee', 'emp-1')).toBe('/hr/employees/emp-1');
  });

  it('returns undefined for unknown entity types', () => {
    expect(getEntityTypeRoute('UnknownEntity', 'id')).toBeUndefined();
    expect(getEntityTypeRoute('', 'id')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getMimeTypeIcon
// ---------------------------------------------------------------------------

describe('getMimeTypeIcon', () => {
  it('returns Image icon for image MIME types', () => {
    expect(getMimeTypeIcon('image/png')).toBe(Image);
    expect(getMimeTypeIcon('image/jpeg')).toBe(Image);
    expect(getMimeTypeIcon('image/svg+xml')).toBe(Image);
  });

  it('returns FileSpreadsheet for spreadsheet MIME types', () => {
    expect(getMimeTypeIcon('text/csv')).toBe(FileSpreadsheet);
    expect(
      getMimeTypeIcon('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe(FileSpreadsheet);
    expect(getMimeTypeIcon('application/vnd.ms-excel')).toBe(FileSpreadsheet);
  });

  it('returns FileText for PDF and text MIME types', () => {
    expect(getMimeTypeIcon('application/pdf')).toBe(FileText);
    expect(getMimeTypeIcon('text/plain')).toBe(FileText);
  });

  it('returns FileCode for code-related MIME types', () => {
    expect(getMimeTypeIcon('application/json')).toBe(FileCode);
    expect(getMimeTypeIcon('application/xml')).toBe(FileCode);
    expect(getMimeTypeIcon('application/javascript')).toBe(FileCode);
  });

  it('returns FileArchive for compressed MIME types', () => {
    expect(getMimeTypeIcon('application/zip')).toBe(FileArchive);
    expect(getMimeTypeIcon('application/x-tar')).toBe(FileArchive);
    expect(getMimeTypeIcon('application/x-compressed')).toBe(FileArchive);
  });

  it('returns generic File icon for unknown MIME types', () => {
    expect(getMimeTypeIcon('application/octet-stream')).toBe(File);
    expect(getMimeTypeIcon('video/mp4')).toBe(File);
    expect(getMimeTypeIcon('')).toBe(File);
  });
});

// ---------------------------------------------------------------------------
// formatFileSize
// ---------------------------------------------------------------------------

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(3)).toBe('3 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(156000)).toBe('152.3 KB');
    expect(formatFileSize(1024 * 500)).toBe('500.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(2500000)).toBe('2.4 MB');
    expect(formatFileSize(50 * 1024 * 1024)).toBe('50.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    expect(formatFileSize(1500000000)).toBe('1.4 GB');
  });
});

// ---------------------------------------------------------------------------
// VALID_ENTITY_TYPES
// ---------------------------------------------------------------------------

describe('VALID_ENTITY_TYPES', () => {
  it('contains all expected entity types', () => {
    expect(VALID_ENTITY_TYPES).toContain('Customer');
    expect(VALID_ENTITY_TYPES).toContain('CustomerInvoice');
    expect(VALID_ENTITY_TYPES).toContain('SalesOrder');
    expect(VALID_ENTITY_TYPES).toContain('PurchaseOrder');
    expect(VALID_ENTITY_TYPES).toContain('InventoryItem');
    expect(VALID_ENTITY_TYPES).toContain('Employee');
  });

  it('has 16 entity types', () => {
    expect(VALID_ENTITY_TYPES).toHaveLength(16);
  });
});
