// ---------------------------------------------------------------------------
// Integration tests — Default Templates PDF Generation & Seed Idempotency
// (E12-3 Task 8)
//
// 8.1: Real PDF rendering via Puppeteer for all 14 document type templates
// 8.2: Seed idempotency — re-running seed produces no duplicates
// 8.3: Seed upsert behaviour — seed updates existing records on re-run
// 8.4: Cross-company isolation — separate template sets per company
//
// NOTE: 8.1 tests require Puppeteer and are slower than unit tests (~30s total).
// ---------------------------------------------------------------------------

import { describe, expect, it, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Hoisted enum (used by mock factories below)
// ---------------------------------------------------------------------------

const { DOC_TYPES } = vi.hoisted(() => ({
  DOC_TYPES: {
    SALES_INVOICE: 'SALES_INVOICE',
    CREDIT_NOTE: 'CREDIT_NOTE',
    CASH_RECEIPT: 'CASH_RECEIPT',
    PROFORMA_INVOICE: 'PROFORMA_INVOICE',
    CUSTOMER_STATEMENT: 'CUSTOMER_STATEMENT',
    SALES_ORDER: 'SALES_ORDER',
    SALES_QUOTE: 'SALES_QUOTE',
    DELIVERY_NOTE: 'DELIVERY_NOTE',
    PURCHASE_ORDER: 'PURCHASE_ORDER',
    GOODS_RECEIPT_NOTE: 'GOODS_RECEIPT_NOTE',
    SUPPLIER_REMITTANCE: 'SUPPLIER_REMITTANCE',
    PAYSLIP: 'PAYSLIP',
    P45: 'P45',
    P60: 'P60',
  },
}));

// ---------------------------------------------------------------------------
// Mocks (hoisted before imports)
// ---------------------------------------------------------------------------

// @nexa/db mock — used by TemplateCompilerService, SampleDataGeneratorService
vi.mock('@nexa/db', () => ({ DocumentType: DOC_TYPES }));

// Generated Prisma client mock — used by seed file's DocumentType import.
// NOTE: This 7-level relative path resolves to packages/db/generated/prisma/client
// from apps/api/src/modules/system/templates/__tests__/. If either location moves,
// this mock will silently stop intercepting the seed's import.
vi.mock('../../../../../../../packages/db/generated/prisma/client', () => ({
  DocumentType: DOC_TYPES,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { DocumentType } from '@nexa/db';
import { TemplateCompilerService } from '../../services/template-compiler.service.js';
import { SampleDataGeneratorService } from '../../services/sample-data-generator.service.js';
import { PdfGeneratorService } from '../../services/pdf-generator.service.js';
import { SHARED_CSS } from '../shared-styles.js';

import { SALES_INVOICE_HTML } from '../sales-invoice.js';
import { CREDIT_NOTE_HTML } from '../credit-note.js';
import { CASH_RECEIPT_HTML } from '../cash-receipt.js';
import { PROFORMA_INVOICE_HTML } from '../proforma-invoice.js';
import { CUSTOMER_STATEMENT_HTML } from '../customer-statement.js';
import { SALES_ORDER_HTML } from '../sales-order.js';
import { SALES_QUOTE_HTML } from '../sales-quote.js';
import { DELIVERY_NOTE_HTML } from '../delivery-note.js';
import { PURCHASE_ORDER_HTML } from '../purchase-order.js';
import { GOODS_RECEIPT_NOTE_HTML } from '../goods-receipt-note.js';
import { SUPPLIER_REMITTANCE_HTML } from '../supplier-remittance.js';
import { PAYSLIP_HTML } from '../payslip.js';
import { P45_HTML } from '../p45.js';
import { P60_HTML } from '../p60.js';

import { seedDocumentTemplates } from '../../../../../../../packages/db/prisma/seeds/document-template-seed.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

interface TemplateTestConfig {
  type: string;
  label: string;
  html: string;
}

const TEMPLATE_CONFIGS: TemplateTestConfig[] = [
  { type: DocumentType.SALES_INVOICE, label: 'SALES_INVOICE', html: SALES_INVOICE_HTML },
  { type: DocumentType.CREDIT_NOTE, label: 'CREDIT_NOTE', html: CREDIT_NOTE_HTML },
  { type: DocumentType.CASH_RECEIPT, label: 'CASH_RECEIPT', html: CASH_RECEIPT_HTML },
  { type: DocumentType.PROFORMA_INVOICE, label: 'PROFORMA_INVOICE', html: PROFORMA_INVOICE_HTML },
  {
    type: DocumentType.CUSTOMER_STATEMENT,
    label: 'CUSTOMER_STATEMENT',
    html: CUSTOMER_STATEMENT_HTML,
  },
  { type: DocumentType.SALES_ORDER, label: 'SALES_ORDER', html: SALES_ORDER_HTML },
  { type: DocumentType.SALES_QUOTE, label: 'SALES_QUOTE', html: SALES_QUOTE_HTML },
  { type: DocumentType.DELIVERY_NOTE, label: 'DELIVERY_NOTE', html: DELIVERY_NOTE_HTML },
  { type: DocumentType.PURCHASE_ORDER, label: 'PURCHASE_ORDER', html: PURCHASE_ORDER_HTML },
  {
    type: DocumentType.GOODS_RECEIPT_NOTE,
    label: 'GOODS_RECEIPT_NOTE',
    html: GOODS_RECEIPT_NOTE_HTML,
  },
  {
    type: DocumentType.SUPPLIER_REMITTANCE,
    label: 'SUPPLIER_REMITTANCE',
    html: SUPPLIER_REMITTANCE_HTML,
  },
  { type: DocumentType.PAYSLIP, label: 'PAYSLIP', html: PAYSLIP_HTML },
  { type: DocumentType.P45, label: 'P45', html: P45_HTML },
  { type: DocumentType.P60, label: 'P60', html: P60_HTML },
];

/**
 * Stateful mock PrismaClient that simulates upsert on [companyId, documentType, name].
 * Records are stored in an in-memory Map for cross-call assertions.
 */
function createMockPrisma() {
  const store = new Map<string, Record<string, unknown>>();

  return {
    documentTemplate: {
      upsert: vi.fn(async (args: any) => {
        const { companyId, documentType, name } = args.where.companyId_documentType_name;
        const key = `${companyId}::${documentType}::${name}`;
        const existing = store.get(key);

        if (existing) {
          const updated = { ...existing, ...args.update };
          store.set(key, updated);
          return updated;
        }

        const created = { id: randomUUID(), ...args.create };
        store.set(key, created);
        return created;
      }),
    },
    _store: store,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration Tests — E12-3 Task 8', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 8.1 — PDF rendering for all 14 templates (AC #1, #6)
  // Real Puppeteer generates PDFs. Each must start with %PDF, be >1KB, <5s.
  // -----------------------------------------------------------------------

  describe('8.1 — PDF rendering for all 14 templates', () => {
    let compiler: TemplateCompilerService;
    let sampleDataGenerator: SampleDataGeneratorService;
    let pdfGenerator: PdfGeneratorService;

    beforeAll(async () => {
      compiler = new TemplateCompilerService(mockLogger as any);
      sampleDataGenerator = new SampleDataGeneratorService();
      pdfGenerator = new PdfGeneratorService(mockLogger as any);
      await pdfGenerator.init();
    }, 30_000);

    afterAll(async () => {
      await pdfGenerator.close();
    }, 10_000);

    it.each(TEMPLATE_CONFIGS)(
      '$label: produces valid PDF buffer (>1KB, renders within 5s)',
      async ({ type, html }) => {
        const sampleData = sampleDataGenerator.generateSampleData(type as any);
        const compiledHtml = compiler.compile(html, sampleData, SHARED_CSS);

        const start = performance.now();
        const pdfBuffer = await pdfGenerator.generatePdf(compiledHtml, {
          pageSize: 'A4',
          orientation: 'portrait',
          footerHtml:
            '<div style="font-size:8px;text-align:center;width:100%">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
        });
        const elapsed = performance.now() - start;

        // PDF header validation — must start with %PDF
        expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF');

        // Non-trivial size (>1KB)
        expect(pdfBuffer.length).toBeGreaterThan(1024);

        // Rendering within NFR3 threshold (5 seconds)
        expect(elapsed).toBeLessThan(5000);
      },
      30_000, // per-test timeout (Puppeteer can be slow on first render)
    );
  });

  // -----------------------------------------------------------------------
  // 8.2 — Seed idempotency (AC #5)
  // -----------------------------------------------------------------------

  describe('8.2 — Seed idempotency', () => {
    it('running seed twice produces exactly 14 templates (no duplicates)', async () => {
      const mockPrisma = createMockPrisma();
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // First run — creates 14 templates
      await seedDocumentTemplates(mockPrisma as any, 'company-a', 'user-1');
      expect(mockPrisma._store.size).toBe(14);

      // Second run — same company, same user
      await seedDocumentTemplates(mockPrisma as any, 'company-a', 'user-1');

      // Still 14 (upsert matched existing records, no duplicates)
      expect(mockPrisma._store.size).toBe(14);

      // Total upsert calls: 14 per run × 2 runs = 28
      expect(mockPrisma.documentTemplate.upsert).toHaveBeenCalledTimes(28);

      // logSpy restored by afterEach
    });
  });

  // -----------------------------------------------------------------------
  // 8.3 — Seed does not overwrite customisations (AC #5)
  // For MVP, upsert updates on conflict — this is expected behaviour.
  // -----------------------------------------------------------------------

  describe('8.3 — Seed upsert behaviour (MVP deviation from AC5: upsert overwrites customisations)', () => {
    it('upsert updates existing templates on re-run (MVP: AC5 preservation deferred — upsert is acceptable per Task 8.3 note)', async () => {
      const mockPrisma = createMockPrisma();
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // First run — create defaults
      await seedDocumentTemplates(mockPrisma as any, 'company-a', 'user-1');
      expect(mockPrisma._store.size).toBe(14);

      // Simulate tenant customisation: modify one template's htmlTemplate
      const key = 'company-a::SALES_INVOICE::Standard Invoice';
      const original = mockPrisma._store.get(key);
      expect(original).toBeDefined();
      mockPrisma._store.set(key, {
        ...original,
        htmlTemplate: '<html><body>CUSTOM TEMPLATE</body></html>',
      });

      // Second run — seed again (upsert updates on conflict)
      await seedDocumentTemplates(mockPrisma as any, 'company-a', 'user-1');

      // Verify the template was updated back to the seed default
      const updated = mockPrisma._store.get(key) as any;
      expect(updated).toBeDefined();
      expect(updated.htmlTemplate).not.toBe('<html><body>CUSTOM TEMPLATE</body></html>');
      expect(updated.htmlTemplate).toContain('Invoice');

      // logSpy restored by afterEach
    });
  });

  // -----------------------------------------------------------------------
  // 8.4 — Cross-company isolation (AC #1)
  // -----------------------------------------------------------------------

  describe('8.4 — Cross-company isolation', () => {
    it('separate companies get independent template sets (14 each, 28 total)', async () => {
      const mockPrisma = createMockPrisma();
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Seed company A
      await seedDocumentTemplates(mockPrisma as any, 'company-a', 'user-1');
      expect(mockPrisma._store.size).toBe(14);

      // Seed company B
      await seedDocumentTemplates(mockPrisma as any, 'company-b', 'user-2');
      expect(mockPrisma._store.size).toBe(28);

      // Count per company
      let companyACount = 0;
      let companyBCount = 0;
      for (const record of mockPrisma._store.values()) {
        const r = record as any;
        if (r.companyId === 'company-a') companyACount++;
        if (r.companyId === 'company-b') companyBCount++;
      }
      expect(companyACount).toBe(14);
      expect(companyBCount).toBe(14);

      // Templates are scoped — no overlap in IDs
      const companyAIds = new Set<string>();
      const companyBIds = new Set<string>();
      for (const record of mockPrisma._store.values()) {
        const r = record as any;
        if (r.companyId === 'company-a') companyAIds.add(r.id);
        if (r.companyId === 'company-b') companyBIds.add(r.id);
      }
      for (const id of companyBIds) {
        expect(companyAIds.has(id)).toBe(false);
      }

      // logSpy restored by afterEach
    });
  });
});
