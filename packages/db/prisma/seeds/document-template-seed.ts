// ---------------------------------------------------------------------------
// Document Template Seed — E12-3 Task 6
// Seeds all 14 default DocumentTemplate records for a company.
// Idempotent via upsert on compound unique [companyId, documentType, name].
// ---------------------------------------------------------------------------

import type { PrismaClient } from '../../generated/prisma/client';
import { DocumentType } from '../../generated/prisma/client';

// Import template HTML constants from apps/api (co-located in monorepo).
// NOTE: This cross-package import inverts the normal dependency direction
// (apps/api depends on packages/db, not the reverse). This works because the
// seed runs standalone via tsx, not as part of the packages/db build. If build
// isolation is needed, move template constants to a shared package.
import { SALES_INVOICE_HTML } from '../../../../apps/api/src/modules/system/templates/sales-invoice.js';
import { CREDIT_NOTE_HTML } from '../../../../apps/api/src/modules/system/templates/credit-note.js';
import { CASH_RECEIPT_HTML } from '../../../../apps/api/src/modules/system/templates/cash-receipt.js';
import { PROFORMA_INVOICE_HTML } from '../../../../apps/api/src/modules/system/templates/proforma-invoice.js';
import { CUSTOMER_STATEMENT_HTML } from '../../../../apps/api/src/modules/system/templates/customer-statement.js';
import { SALES_ORDER_HTML } from '../../../../apps/api/src/modules/system/templates/sales-order.js';
import { SALES_QUOTE_HTML } from '../../../../apps/api/src/modules/system/templates/sales-quote.js';
import { DELIVERY_NOTE_HTML } from '../../../../apps/api/src/modules/system/templates/delivery-note.js';
import { PURCHASE_ORDER_HTML } from '../../../../apps/api/src/modules/system/templates/purchase-order.js';
import { GOODS_RECEIPT_NOTE_HTML } from '../../../../apps/api/src/modules/system/templates/goods-receipt-note.js';
import { SUPPLIER_REMITTANCE_HTML } from '../../../../apps/api/src/modules/system/templates/supplier-remittance.js';
import { PAYSLIP_HTML } from '../../../../apps/api/src/modules/system/templates/payslip.js';
import { P45_HTML } from '../../../../apps/api/src/modules/system/templates/p45.js';
import { P60_HTML } from '../../../../apps/api/src/modules/system/templates/p60.js';
import { SHARED_CSS } from '../../../../apps/api/src/modules/system/templates/shared-styles.js';

// ---------------------------------------------------------------------------
// Template Configuration Type
// ---------------------------------------------------------------------------

export interface DefaultTemplateConfig {
  documentType: DocumentType;
  name: string;
  description: string;
  htmlTemplate: string;
  cssStyles: string;
  headerHtml?: string;
  footerHtml: string;
  pageSize: string;
  orientation: string;
  showLogo: boolean;
  showBankDetails: boolean;
  showVatNumber: boolean;
  showCompanyReg: boolean;
}

// ---------------------------------------------------------------------------
// Puppeteer footer with page numbers (uses special CSS classes)
// ---------------------------------------------------------------------------

const PAGE_FOOTER_HTML =
  '<div style="font-size:8px;text-align:center;width:100%">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>';

// ---------------------------------------------------------------------------
// 14 Default Template Configurations (AC #1, #4)
// ---------------------------------------------------------------------------

export const DEFAULT_TEMPLATES: DefaultTemplateConfig[] = [
  // ── Sales Documents ────────────────────────────────────────────────────
  {
    documentType: DocumentType.SALES_INVOICE,
    name: 'Standard Invoice',
    description:
      'Default professional invoice template with line items, VAT breakdown, bank details, and payment terms.',
    htmlTemplate: SALES_INVOICE_HTML,
    cssStyles: SHARED_CSS,
    footerHtml: PAGE_FOOTER_HTML,
    pageSize: 'A4',
    orientation: 'portrait',
    showLogo: true,
    showBankDetails: true,
    showVatNumber: true,
    showCompanyReg: true,
  },
  {
    documentType: DocumentType.CREDIT_NOTE,
    name: 'Standard Credit Note',
    description:
      'Default credit note template with reference to original invoice and credited line items.',
    htmlTemplate: CREDIT_NOTE_HTML,
    cssStyles: SHARED_CSS,
    footerHtml: PAGE_FOOTER_HTML,
    pageSize: 'A4',
    orientation: 'portrait',
    showLogo: true,
    showBankDetails: true,
    showVatNumber: true,
    showCompanyReg: true,
  },
  {
    documentType: DocumentType.CASH_RECEIPT,
    name: 'Standard Receipt',
    description: 'Compact receipt template showing payment amount, method, and invoice reference.',
    htmlTemplate: CASH_RECEIPT_HTML,
    cssStyles: SHARED_CSS,
    footerHtml: PAGE_FOOTER_HTML,
    pageSize: 'A4',
    orientation: 'portrait',
    showLogo: true,
    showBankDetails: false,
    showVatNumber: true,
    showCompanyReg: false,
  },
  {
    documentType: DocumentType.PROFORMA_INVOICE,
    name: 'Standard Proforma Invoice',
    description:
      'Proforma invoice template with "not a VAT invoice" notice, line items, and indicative totals.',
    htmlTemplate: PROFORMA_INVOICE_HTML,
    cssStyles: SHARED_CSS,
    footerHtml: PAGE_FOOTER_HTML,
    pageSize: 'A4',
    orientation: 'portrait',
    showLogo: true,
    // Intentional deviation from story spec: bank details hidden because
    // proforma invoices are not a demand for payment — no need to expose bank info.
    showBankDetails: false,
    showVatNumber: true,
    showCompanyReg: true,
  },
  {
    documentType: DocumentType.CUSTOMER_STATEMENT,
    name: 'Standard Statement',
    description:
      'Customer account statement with transaction list, running balance, and aging bands.',
    htmlTemplate: CUSTOMER_STATEMENT_HTML,
    cssStyles: SHARED_CSS,
    footerHtml: PAGE_FOOTER_HTML,
    pageSize: 'A4',
    orientation: 'portrait',
    showLogo: true,
    showBankDetails: true,
    showVatNumber: true,
    showCompanyReg: false,
  },
  {
    documentType: DocumentType.SALES_ORDER,
    name: 'Standard Sales Order',
    description: 'Sales order confirmation template with delivery date, line items, and terms.',
    htmlTemplate: SALES_ORDER_HTML,
    cssStyles: SHARED_CSS,
    footerHtml: PAGE_FOOTER_HTML,
    pageSize: 'A4',
    orientation: 'portrait',
    showLogo: true,
    showBankDetails: true,
    showVatNumber: true,
    showCompanyReg: true,
  },
  {
    documentType: DocumentType.SALES_QUOTE,
    name: 'Standard Quotation',
    description:
      'Quotation template with validity date, line items, and "not a binding contract" disclaimer.',
    htmlTemplate: SALES_QUOTE_HTML,
    cssStyles: SHARED_CSS,
    footerHtml: PAGE_FOOTER_HTML,
    pageSize: 'A4',
    orientation: 'portrait',
    showLogo: true,
    // Intentional deviation from story spec: bank details hidden because
    // quotes are pre-sale — no payment expected, no need to expose bank info.
    showBankDetails: false,
    showVatNumber: true,
    showCompanyReg: true,
  },
  {
    documentType: DocumentType.DELIVERY_NOTE,
    name: 'Standard Delivery Note',
    description:
      'Delivery note template with quantities only (no pricing), delivery address, and signature area.',
    htmlTemplate: DELIVERY_NOTE_HTML,
    cssStyles: SHARED_CSS,
    footerHtml: PAGE_FOOTER_HTML,
    pageSize: 'A4',
    orientation: 'portrait',
    showLogo: true,
    showBankDetails: false,
    showVatNumber: false,
    showCompanyReg: false,
  },

  // ── Purchasing Documents ───────────────────────────────────────────────
  {
    documentType: DocumentType.PURCHASE_ORDER,
    name: 'Standard Purchase Order',
    description:
      'Purchase order template with supplier details, delivery address, line items, and authorisation area.',
    htmlTemplate: PURCHASE_ORDER_HTML,
    cssStyles: SHARED_CSS,
    footerHtml: PAGE_FOOTER_HTML,
    pageSize: 'A4',
    orientation: 'portrait',
    showLogo: true,
    // Intentional deviation from story spec: bank details hidden because
    // POs are sent to suppliers — should not expose the buyer's bank details.
    showBankDetails: false,
    showVatNumber: true,
    showCompanyReg: true,
  },
  {
    documentType: DocumentType.GOODS_RECEIPT_NOTE,
    name: 'Standard Goods Receipt Note',
    description:
      'Goods received note template with ordered vs received quantities, inspection notes, and signature area.',
    htmlTemplate: GOODS_RECEIPT_NOTE_HTML,
    cssStyles: SHARED_CSS,
    footerHtml: PAGE_FOOTER_HTML,
    pageSize: 'A4',
    orientation: 'portrait',
    showLogo: true,
    showBankDetails: true,
    showVatNumber: true,
    showCompanyReg: true,
  },
  {
    documentType: DocumentType.SUPPLIER_REMITTANCE,
    name: 'Standard Remittance Advice',
    description:
      'Remittance advice template with payment details, invoice allocations table, and total paid.',
    htmlTemplate: SUPPLIER_REMITTANCE_HTML,
    cssStyles: SHARED_CSS,
    footerHtml: PAGE_FOOTER_HTML,
    pageSize: 'A4',
    orientation: 'portrait',
    showLogo: true,
    showBankDetails: true,
    showVatNumber: true,
    showCompanyReg: true,
  },

  // ── Payroll Documents ──────────────────────────────────────────────────
  {
    documentType: DocumentType.PAYSLIP,
    name: 'Standard Payslip',
    description:
      'Employee payslip template with earnings, deductions, net pay, and year-to-date totals.',
    htmlTemplate: PAYSLIP_HTML,
    cssStyles: SHARED_CSS,
    footerHtml: PAGE_FOOTER_HTML,
    pageSize: 'A4',
    orientation: 'portrait',
    showLogo: true,
    showBankDetails: false,
    showVatNumber: false,
    showCompanyReg: true,
  },
  {
    documentType: DocumentType.P45,
    name: 'Standard P45',
    description:
      'HMRC P45 format template — employee leaving details, tax code, total pay and tax to date.',
    htmlTemplate: P45_HTML,
    cssStyles: SHARED_CSS,
    footerHtml: PAGE_FOOTER_HTML,
    pageSize: 'A4',
    orientation: 'portrait',
    showLogo: true,
    showBankDetails: false,
    showVatNumber: false,
    showCompanyReg: true,
  },
  {
    documentType: DocumentType.P60,
    name: 'Standard P60',
    description:
      'HMRC P60 end-of-year certificate template — total pay, tax deducted, NI contributions.',
    htmlTemplate: P60_HTML,
    cssStyles: SHARED_CSS,
    footerHtml: PAGE_FOOTER_HTML,
    pageSize: 'A4',
    orientation: 'portrait',
    showLogo: true,
    showBankDetails: false,
    showVatNumber: false,
    showCompanyReg: true,
  },
];

// ---------------------------------------------------------------------------
// Seed Function — idempotent upsert on [companyId, documentType, name]
// ---------------------------------------------------------------------------

export async function seedDocumentTemplates(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
): Promise<void> {
  let count = 0;

  for (const config of DEFAULT_TEMPLATES) {
    await prisma.documentTemplate.upsert({
      where: {
        companyId_documentType_name: {
          companyId,
          documentType: config.documentType,
          name: config.name,
        },
      },
      update: {
        htmlTemplate: config.htmlTemplate,
        cssStyles: config.cssStyles,
        headerHtml: config.headerHtml ?? null,
        footerHtml: config.footerHtml,
        description: config.description,
        pageSize: config.pageSize,
        orientation: config.orientation,
        isDefault: true,
        isActive: true,
        showLogo: config.showLogo,
        showBankDetails: config.showBankDetails,
        showVatNumber: config.showVatNumber,
        showCompanyReg: config.showCompanyReg,
      },
      create: {
        companyId,
        documentType: config.documentType,
        name: config.name,
        description: config.description,
        htmlTemplate: config.htmlTemplate,
        cssStyles: config.cssStyles,
        headerHtml: config.headerHtml ?? null,
        footerHtml: config.footerHtml,
        pageSize: config.pageSize,
        orientation: config.orientation,
        isDefault: true,
        isActive: true,
        showLogo: config.showLogo,
        showBankDetails: config.showBankDetails,
        showVatNumber: config.showVatNumber,
        showCompanyReg: config.showCompanyReg,
        createdBy: userId,
      },
    });

    console.log(`Seeded default template: ${config.name} (${config.documentType})`);
    count++;
  }

  console.log(`Seeded ${count} default document templates`);
}
