// ---------------------------------------------------------------------------
// Sample Data Generator Service — E12-2 Task 5
// Generates realistic mock data per document type for template preview.
// Returns data in the same DocumentDataContext shape used by
// DocumentDataLoaderService (E12-1 Task 5).
// ---------------------------------------------------------------------------

import { DocumentType } from '@nexa/db';

import type {
  DocumentDataContext,
  CompanyData,
  CounterpartyData,
  DocumentLine,
  TotalsData,
  VatBreakdownEntry,
  BrandingData,
} from './document-data-loader.service.js';

// Re-export for consumer convenience
export { DocumentType };

// ---------------------------------------------------------------------------
// Shared sample company data (UK format)
// ---------------------------------------------------------------------------

const SAMPLE_COMPANY: CompanyData = {
  name: 'Acme Ltd',
  legalName: 'Acme Trading Limited',
  address: 'Unit 12, Business Park\n123 High Street\nLondon\nEC1A 1BB',
  vatNumber: 'GB 123 456 789',
  companyNumber: '12345678',
  bankName: 'Barclays Bank',
  bankSortCode: '20-00-00',
  bankAccountNumber: '12345678',
  email: 'accounts@acme.co.uk',
  phone: '+44 20 7946 0958',
  logoUrl: null,
  website: 'www.acme.co.uk',
};

// ---------------------------------------------------------------------------
// Default branding (all flags on — preview shows everything)
// ---------------------------------------------------------------------------

const DEFAULT_BRANDING: BrandingData = {
  showLogo: true,
  logoPosition: 'top-left',
  showBankDetails: true,
  showVatNumber: true,
  showCompanyReg: true,
};

// ---------------------------------------------------------------------------
// Sample counterparties
// ---------------------------------------------------------------------------

const SAMPLE_CUSTOMER: CounterpartyData = {
  name: 'Widget Corp Ltd',
  address: '45 Commerce Road\nManchester\nM1 2AB',
  vatNumber: 'GB 987 654 321',
  contactEmail: 'purchasing@widgetcorp.co.uk',
};

const SAMPLE_SUPPLIER: CounterpartyData = {
  name: 'Global Supplies Ltd',
  address: '88 Industrial Way\nBirmingham\nB4 7XY',
  vatNumber: 'GB 555 666 777',
  contactEmail: 'sales@globalsupplies.co.uk',
};

const SAMPLE_EMPLOYEE: CounterpartyData = {
  name: 'Jane Smith',
  address: '12 Elm Street\nLeeds\nLS1 4AP',
  vatNumber: '',
  contactEmail: 'jane.smith@email.co.uk',
};

// ---------------------------------------------------------------------------
// Line item builders
// ---------------------------------------------------------------------------

function buildSalesLines(): DocumentLine[] {
  return [
    {
      lineNumber: 1,
      itemCode: 'WIDGET-A',
      description: 'Standard Widget Type A',
      quantity: 100,
      unitPrice: 50.0,
      discountPercent: 0,
      vatRate: 20,
      vatAmount: 1000.0,
      lineTotal: 5000.0,
    },
    {
      lineNumber: 2,
      itemCode: 'WIDGET-B',
      description: 'Premium Widget Type B',
      quantity: 25,
      unitPrice: 120.0,
      discountPercent: 0,
      vatRate: 20,
      vatAmount: 600.0,
      lineTotal: 3000.0,
    },
    {
      lineNumber: 3,
      itemCode: 'SHIPPING',
      description: 'Express Delivery',
      quantity: 1,
      unitPrice: 45.0,
      discountPercent: 0,
      vatRate: 0,
      vatAmount: 0,
      lineTotal: 45.0,
    },
  ];
}

function buildPurchaseLines(): DocumentLine[] {
  return [
    {
      lineNumber: 1,
      itemCode: 'RAW-STEEL',
      description: 'Steel Sheet 2mm (per metre)',
      quantity: 50,
      unitPrice: 32.0,
      discountPercent: 0,
      vatRate: 20,
      vatAmount: 320.0,
      lineTotal: 1600.0,
    },
    {
      lineNumber: 2,
      itemCode: 'RAW-PLASTIC',
      description: 'ABS Plastic Granules (25kg bag)',
      quantity: 10,
      unitPrice: 85.0,
      discountPercent: 5,
      vatRate: 20,
      vatAmount: 161.5,
      lineTotal: 807.5,
    },
    {
      lineNumber: 3,
      itemCode: 'TOOLING-BIT',
      description: 'Carbide Drill Bit Set',
      quantity: 2,
      unitPrice: 125.0,
      discountPercent: 0,
      vatRate: 20,
      vatAmount: 50.0,
      lineTotal: 250.0,
    },
  ];
}

function buildPayrollLines(): DocumentLine[] {
  return [
    {
      lineNumber: 1,
      itemCode: 'BASIC',
      description: 'Basic Salary',
      quantity: 1,
      unitPrice: 3500.0,
      discountPercent: 0,
      vatRate: 0,
      vatAmount: 0,
      lineTotal: 3500.0,
    },
    {
      lineNumber: 2,
      itemCode: 'BONUS',
      description: 'Performance Bonus',
      quantity: 1,
      unitPrice: 500.0,
      discountPercent: 0,
      vatRate: 0,
      vatAmount: 0,
      lineTotal: 500.0,
    },
    {
      lineNumber: 3,
      itemCode: 'PAYE',
      description: 'Income Tax (PAYE)',
      quantity: 1,
      unitPrice: -640.0,
      discountPercent: 0,
      vatRate: 0,
      vatAmount: 0,
      lineTotal: -640.0,
    },
    {
      lineNumber: 4,
      itemCode: 'NI',
      description: 'National Insurance',
      quantity: 1,
      unitPrice: -337.64,
      discountPercent: 0,
      vatRate: 0,
      vatAmount: 0,
      lineTotal: -337.64,
    },
  ];
}

// ---------------------------------------------------------------------------
// Totals calculators
// ---------------------------------------------------------------------------

function calculateTotals(lines: DocumentLine[]): TotalsData {
  let subtotalCents = 0;
  const vatByRate = new Map<number, { taxableCents: number; vatCents: number }>();

  for (const line of lines) {
    subtotalCents += Math.round(line.lineTotal * 100);
    const rate = line.vatRate;
    const existing = vatByRate.get(rate);
    if (existing) {
      existing.taxableCents += Math.round(line.lineTotal * 100);
      existing.vatCents += Math.round(line.vatAmount * 100);
    } else {
      vatByRate.set(rate, {
        taxableCents: Math.round(line.lineTotal * 100),
        vatCents: Math.round(line.vatAmount * 100),
      });
    }
  }

  const vatBreakdown: VatBreakdownEntry[] = [];
  let totalVatCents = 0;
  for (const [rate, entry] of vatByRate.entries()) {
    vatBreakdown.push({
      rate,
      taxableAmount: entry.taxableCents / 100,
      vatAmount: entry.vatCents / 100,
    });
    totalVatCents += entry.vatCents;
  }
  vatBreakdown.sort((a, b) => a.rate - b.rate);

  const totalCents = subtotalCents + totalVatCents;

  return {
    subtotal: subtotalCents / 100,
    vatBreakdown,
    vatAmount: totalVatCents / 100,
    total: totalCents / 100,
    amountDue: totalCents / 100,
  };
}

// ---------------------------------------------------------------------------
// SampleDataGeneratorService
// ---------------------------------------------------------------------------

export class SampleDataGeneratorService {
  /**
   * Generate realistic sample data for a given document type.
   * Returns the same DocumentDataContext shape used by DocumentDataLoaderService.
   */
  generateSampleData(documentType: DocumentType): DocumentDataContext {
    switch (documentType) {
      case DocumentType.SALES_INVOICE:
        return this.buildSalesInvoiceSample();
      case DocumentType.CREDIT_NOTE:
        return this.buildCreditNoteSample();
      case DocumentType.PROFORMA_INVOICE:
        return this.buildProformaInvoiceSample();
      case DocumentType.CASH_RECEIPT:
        return this.buildCashReceiptSample();
      case DocumentType.CUSTOMER_STATEMENT:
        return this.buildCustomerStatementSample();
      case DocumentType.SALES_ORDER:
        return this.buildSalesOrderSample();
      case DocumentType.SALES_QUOTE:
        return this.buildSalesQuoteSample();
      case DocumentType.DELIVERY_NOTE:
        return this.buildDeliveryNoteSample();
      case DocumentType.PURCHASE_ORDER:
        return this.buildPurchaseOrderSample();
      case DocumentType.GOODS_RECEIPT_NOTE:
        return this.buildGoodsReceiptNoteSample();
      case DocumentType.SUPPLIER_REMITTANCE:
        return this.buildSupplierRemittanceSample();
      case DocumentType.PAYSLIP:
        return this.buildPayslipSample();
      case DocumentType.P45:
        return this.buildP45Sample();
      case DocumentType.P60:
        return this.buildP60Sample();
      default:
        return this.buildGenericSample(documentType);
    }
  }

  // -------------------------------------------------------------------------
  // Sales-side documents
  // -------------------------------------------------------------------------

  private buildSalesInvoiceSample(): DocumentDataContext {
    const lines = buildSalesLines();
    const totals = calculateTotals(lines);
    return {
      company: SAMPLE_COMPANY,
      document: {
        number: 'INV-00042',
        date: '15/02/2026',
        dueDate: '17/03/2026',
        reference: 'PO-12345',
        notes: 'Thank you for your business.',
        status: 'POSTED',
        currency: 'GBP',
      },
      counterparty: SAMPLE_CUSTOMER,
      lines,
      totals,
      metadata: {
        paymentTerms: 'Net 30 days',
        currencyCode: 'GBP',
        currencySymbol: '£',
        formattedDate: '15/02/2026',
        formattedDueDate: '17/03/2026',
      },
      branding: DEFAULT_BRANDING,
      isStub: false,
    };
  }

  private buildCreditNoteSample(): DocumentDataContext {
    const lines: DocumentLine[] = [
      {
        lineNumber: 1,
        itemCode: 'WIDGET-A',
        description: 'Standard Widget Type A — returned damaged',
        quantity: 10,
        unitPrice: 50.0,
        discountPercent: 0,
        vatRate: 20,
        vatAmount: 100.0,
        lineTotal: 500.0,
      },
    ];
    const totals = calculateTotals(lines);
    return {
      company: SAMPLE_COMPANY,
      document: {
        number: 'CN-00015',
        date: '20/02/2026',
        dueDate: '',
        reference: 'INV-00042',
        notes: 'Credit for returned goods.',
        status: 'POSTED',
        currency: 'GBP',
      },
      counterparty: SAMPLE_CUSTOMER,
      lines,
      totals,
      metadata: {
        paymentTerms: '',
        currencyCode: 'GBP',
        currencySymbol: '£',
        formattedDate: '20/02/2026',
        formattedDueDate: '',
      },
      branding: DEFAULT_BRANDING,
      isStub: false,
    };
  }

  private buildProformaInvoiceSample(): DocumentDataContext {
    const lines = buildSalesLines();
    const totals = calculateTotals(lines);
    return {
      company: SAMPLE_COMPANY,
      document: {
        number: 'PI-00008',
        date: '10/02/2026',
        dueDate: '10/03/2026',
        reference: 'RFQ-2026-001',
        notes: 'This is a proforma invoice — not a demand for payment.',
        status: 'DRAFT',
        currency: 'GBP',
      },
      counterparty: SAMPLE_CUSTOMER,
      lines,
      totals,
      metadata: {
        paymentTerms: 'Net 30 days',
        currencyCode: 'GBP',
        currencySymbol: '£',
        formattedDate: '10/02/2026',
        formattedDueDate: '10/03/2026',
      },
      branding: DEFAULT_BRANDING,
      isStub: false,
    };
  }

  private buildCashReceiptSample(): DocumentDataContext {
    return {
      company: SAMPLE_COMPANY,
      document: {
        number: 'REC-00023',
        date: '18/02/2026',
        dueDate: '',
        reference: 'INV-00042',
        notes: 'Payment received with thanks.',
        status: 'POSTED',
        currency: 'GBP',
      },
      counterparty: SAMPLE_CUSTOMER,
      lines: [
        {
          lineNumber: 1,
          itemCode: 'PMT',
          description: 'Payment received — Invoice INV-00042',
          quantity: 1,
          unitPrice: 9645.0,
          discountPercent: 0,
          vatRate: 0,
          vatAmount: 0,
          lineTotal: 9645.0,
        },
      ],
      totals: {
        subtotal: 9645.0,
        vatBreakdown: [],
        vatAmount: 0,
        total: 9645.0,
        amountDue: 0,
      },
      metadata: {
        paymentTerms: '',
        currencyCode: 'GBP',
        currencySymbol: '£',
        formattedDate: '18/02/2026',
        formattedDueDate: '',
      },
      branding: DEFAULT_BRANDING,
      isStub: false,
    };
  }

  private buildCustomerStatementSample(): DocumentDataContext {
    const lines: DocumentLine[] = [
      {
        lineNumber: 1,
        itemCode: 'INV-00038',
        description: 'Widgets order — January',
        quantity: 1,
        unitPrice: 2400.0,
        discountPercent: 0,
        vatRate: 0,
        vatAmount: 0,
        lineTotal: 2400.0,
        date: '01/01/2026',
        transactionType: 'Invoice',
        runningBalance: 2400.0,
      },
      {
        lineNumber: 2,
        itemCode: 'PMT-00011',
        description: 'Payment received — thank you',
        quantity: 1,
        unitPrice: -2400.0,
        discountPercent: 0,
        vatRate: 0,
        vatAmount: 0,
        lineTotal: -2400.0,
        date: '15/01/2026',
        transactionType: 'Payment',
        runningBalance: 0,
      },
      {
        lineNumber: 3,
        itemCode: 'INV-00042',
        description: 'Premium widgets order — February',
        quantity: 1,
        unitPrice: 9645.0,
        discountPercent: 0,
        vatRate: 0,
        vatAmount: 0,
        lineTotal: 9645.0,
        date: '15/02/2026',
        transactionType: 'Invoice',
        runningBalance: 9645.0,
      },
    ];
    return {
      company: SAMPLE_COMPANY,
      document: {
        number: 'STMT-2026-02',
        date: '01/02/2026',
        dueDate: '28/02/2026',
        reference: '',
        notes: 'Statement of account as at 28/02/2026.',
        status: 'POSTED',
        currency: 'GBP',
      },
      counterparty: SAMPLE_CUSTOMER,
      lines,
      totals: {
        subtotal: 9645.0,
        vatBreakdown: [],
        vatAmount: 0,
        total: 9645.0,
        amountDue: 9645.0,
      },
      metadata: {
        paymentTerms: 'Net 30 days',
        currencyCode: 'GBP',
        currencySymbol: '£',
        formattedDate: '01/02/2026',
        formattedDueDate: '28/02/2026',
        agingCurrent: 9645.0,
        aging30: 0,
        aging60: 0,
        aging90Plus: 0,
      },
      branding: DEFAULT_BRANDING,
      isStub: false,
    };
  }

  private buildSalesOrderSample(): DocumentDataContext {
    const lines = buildSalesLines();
    const totals = calculateTotals(lines);
    return {
      company: SAMPLE_COMPANY,
      document: {
        number: 'SO-00019',
        date: '05/02/2026',
        dueDate: '19/02/2026',
        reference: 'PO-12345',
        notes: 'Delivery to main warehouse.',
        status: 'CONFIRMED',
        currency: 'GBP',
      },
      counterparty: SAMPLE_CUSTOMER,
      lines,
      totals,
      metadata: {
        paymentTerms: 'Net 30 days',
        currencyCode: 'GBP',
        currencySymbol: '£',
        formattedDate: '05/02/2026',
        formattedDueDate: '19/02/2026',
      },
      branding: DEFAULT_BRANDING,
      isStub: false,
    };
  }

  private buildSalesQuoteSample(): DocumentDataContext {
    const lines = buildSalesLines();
    const totals = calculateTotals(lines);
    return {
      company: SAMPLE_COMPANY,
      document: {
        number: 'QT-00031',
        date: '01/02/2026',
        dueDate: '01/03/2026',
        reference: 'RFQ-2026-001',
        notes: 'Quote valid for 30 days.',
        status: 'SENT',
        currency: 'GBP',
      },
      counterparty: SAMPLE_CUSTOMER,
      lines,
      totals,
      metadata: {
        paymentTerms: 'Net 30 days',
        currencyCode: 'GBP',
        currencySymbol: '£',
        formattedDate: '01/02/2026',
        formattedDueDate: '01/03/2026',
      },
      branding: DEFAULT_BRANDING,
      isStub: false,
    };
  }

  private buildDeliveryNoteSample(): DocumentDataContext {
    const lines: DocumentLine[] = [
      {
        lineNumber: 1,
        itemCode: 'WIDGET-A',
        description: 'Standard Widget Type A',
        quantity: 100,
        unitPrice: 0,
        discountPercent: 0,
        vatRate: 0,
        vatAmount: 0,
        lineTotal: 0,
      },
      {
        lineNumber: 2,
        itemCode: 'WIDGET-B',
        description: 'Premium Widget Type B',
        quantity: 25,
        unitPrice: 0,
        discountPercent: 0,
        vatRate: 0,
        vatAmount: 0,
        lineTotal: 0,
      },
    ];
    return {
      company: SAMPLE_COMPANY,
      document: {
        number: 'DN-00027',
        date: '12/02/2026',
        dueDate: '',
        reference: 'SO-00019',
        notes: 'Please check goods on receipt and sign below.',
        status: 'DISPATCHED',
        currency: 'GBP',
      },
      counterparty: SAMPLE_CUSTOMER,
      lines,
      totals: {
        subtotal: 0,
        vatBreakdown: [],
        vatAmount: 0,
        total: 0,
        amountDue: 0,
      },
      metadata: {
        paymentTerms: '',
        currencyCode: 'GBP',
        currencySymbol: '£',
        formattedDate: '12/02/2026',
        formattedDueDate: '',
        deliveryName: 'Widget Corp — Warehouse',
        deliveryAddress: '99 Logistics Lane\nManchester\nM2 3CD',
      },
      branding: DEFAULT_BRANDING,
      isStub: false,
    };
  }

  // -------------------------------------------------------------------------
  // Purchase-side documents
  // -------------------------------------------------------------------------

  private buildPurchaseOrderSample(): DocumentDataContext {
    const lines = buildPurchaseLines();
    const totals = calculateTotals(lines);
    return {
      company: SAMPLE_COMPANY,
      document: {
        number: 'PO-00054',
        date: '03/02/2026',
        dueDate: '03/03/2026',
        reference: 'QT-SUP-789',
        notes: 'Deliver to Unit 12, Business Park.',
        status: 'SENT',
        currency: 'GBP',
      },
      counterparty: SAMPLE_SUPPLIER,
      lines,
      totals,
      metadata: {
        paymentTerms: 'Net 30 days',
        currencyCode: 'GBP',
        currencySymbol: '£',
        formattedDate: '03/02/2026',
        formattedDueDate: '03/03/2026',
      },
      branding: DEFAULT_BRANDING,
      isStub: false,
    };
  }

  private buildGoodsReceiptNoteSample(): DocumentDataContext {
    const lines: DocumentLine[] = [
      {
        lineNumber: 1,
        itemCode: 'RAW-STEEL',
        description: 'Steel Sheet 2mm (per metre)',
        quantity: 50,
        unitPrice: 0,
        discountPercent: 0,
        vatRate: 0,
        vatAmount: 0,
        lineTotal: 0,
        receivedQty: 48,
        variance: -2,
      },
      {
        lineNumber: 2,
        itemCode: 'RAW-PLASTIC',
        description: 'ABS Plastic Granules (25kg bag)',
        quantity: 10,
        unitPrice: 0,
        discountPercent: 0,
        vatRate: 0,
        vatAmount: 0,
        lineTotal: 0,
        receivedQty: 10,
        variance: 0,
      },
    ];
    return {
      company: SAMPLE_COMPANY,
      document: {
        number: 'GRN-00016',
        date: '08/02/2026',
        dueDate: '',
        reference: 'PO-00054',
        notes: 'All items inspected and accepted.',
        status: 'RECEIVED',
        currency: 'GBP',
      },
      counterparty: SAMPLE_SUPPLIER,
      lines,
      totals: {
        subtotal: 0,
        vatBreakdown: [],
        vatAmount: 0,
        total: 0,
        amountDue: 0,
      },
      metadata: {
        paymentTerms: '',
        currencyCode: 'GBP',
        currencySymbol: '£',
        formattedDate: '08/02/2026',
        formattedDueDate: '',
        supplierReference: 'DEL-SUP-4521',
      },
      branding: DEFAULT_BRANDING,
      isStub: false,
    };
  }

  private buildSupplierRemittanceSample(): DocumentDataContext {
    const lines: DocumentLine[] = [
      {
        lineNumber: 1,
        itemCode: 'SINV-1001',
        description: 'Raw materials — January order',
        quantity: 1,
        unitPrice: 3195.0,
        discountPercent: 0,
        vatRate: 0,
        vatAmount: 0,
        lineTotal: 3195.0,
        date: '10/01/2026',
      },
      {
        lineNumber: 2,
        itemCode: 'SINV-1015',
        description: 'Tooling supplies — January',
        quantity: 1,
        unitPrice: 1250.0,
        discountPercent: 0,
        vatRate: 0,
        vatAmount: 0,
        lineTotal: 1250.0,
        date: '25/01/2026',
      },
    ];
    return {
      company: SAMPLE_COMPANY,
      document: {
        number: 'REM-00009',
        date: '28/02/2026',
        dueDate: '',
        reference: 'BACS-20260228',
        notes: 'Payment sent via BACS.',
        status: 'PAID',
        currency: 'GBP',
      },
      counterparty: SAMPLE_SUPPLIER,
      lines,
      totals: {
        subtotal: 4445.0,
        vatBreakdown: [],
        vatAmount: 0,
        total: 4445.0,
        amountDue: 0,
      },
      metadata: {
        paymentTerms: '',
        currencyCode: 'GBP',
        currencySymbol: '£',
        formattedDate: '28/02/2026',
        formattedDueDate: '',
        paymentMethod: 'BACS',
      },
      branding: DEFAULT_BRANDING,
      isStub: false,
    };
  }

  // -------------------------------------------------------------------------
  // Payroll documents (placeholder values — complex layouts)
  // -------------------------------------------------------------------------

  private buildPayslipSample(): DocumentDataContext {
    const lines = buildPayrollLines();
    const netPay = 3500 + 500 - 640 - 337.64;
    return {
      company: SAMPLE_COMPANY,
      document: {
        number: 'PAY-2026-02-JS',
        date: '28/02/2026',
        dueDate: '',
        reference: 'Payroll February 2026',
        notes: 'Tax code: 1257L | NI category: A',
        status: 'FINALISED',
        currency: 'GBP',
      },
      counterparty: SAMPLE_EMPLOYEE,
      lines,
      totals: {
        subtotal: 4000.0,
        vatBreakdown: [],
        vatAmount: 0,
        total: netPay,
        amountDue: netPay,
      },
      metadata: {
        paymentTerms: '',
        currencyCode: 'GBP',
        currencySymbol: '£',
        formattedDate: '28/02/2026',
        formattedDueDate: '',
        grossPayYtd: 8000.0,
        taxPaidYtd: 1280.0,
        niPaidYtd: 675.28,
        pensionYtd: 400.0,
      },
      branding: DEFAULT_BRANDING,
      isStub: false,
    };
  }

  private buildP45Sample(): DocumentDataContext {
    return {
      company: SAMPLE_COMPANY,
      document: {
        number: 'P45-2026-JS',
        date: '15/02/2026',
        dueDate: '',
        reference: 'Leaving date: 15/02/2026',
        notes: 'Tax code at leaving: 1257L | NI number: AB 12 34 56 C',
        status: 'ISSUED',
        currency: 'GBP',
      },
      counterparty: SAMPLE_EMPLOYEE,
      lines: [
        {
          lineNumber: 1,
          itemCode: 'TOTAL-PAY',
          description: 'Total pay in this employment',
          quantity: 1,
          unitPrice: 38500.0,
          discountPercent: 0,
          vatRate: 0,
          vatAmount: 0,
          lineTotal: 38500.0,
        },
        {
          lineNumber: 2,
          itemCode: 'TOTAL-TAX',
          description: 'Total tax deducted',
          quantity: 1,
          unitPrice: 5240.0,
          discountPercent: 0,
          vatRate: 0,
          vatAmount: 0,
          lineTotal: 5240.0,
        },
      ],
      totals: {
        subtotal: 38500.0,
        vatBreakdown: [],
        vatAmount: 0,
        total: 38500.0,
        amountDue: 0,
      },
      metadata: {
        paymentTerms: '',
        currencyCode: 'GBP',
        currencySymbol: '£',
        formattedDate: '15/02/2026',
        formattedDueDate: '',
      },
      branding: DEFAULT_BRANDING,
      isStub: false,
    };
  }

  private buildP60Sample(): DocumentDataContext {
    return {
      company: SAMPLE_COMPANY,
      document: {
        number: 'P60-2025-26-JS',
        date: '05/04/2026',
        dueDate: '',
        reference: 'Tax year: 2025-26',
        notes: 'NI number: AB 12 34 56 C | Tax code: 1257L',
        status: 'ISSUED',
        currency: 'GBP',
      },
      counterparty: SAMPLE_EMPLOYEE,
      lines: [
        {
          lineNumber: 1,
          itemCode: 'TOTAL-PAY',
          description: 'Total pay for the year',
          quantity: 1,
          unitPrice: 48000.0,
          discountPercent: 0,
          vatRate: 0,
          vatAmount: 0,
          lineTotal: 48000.0,
        },
        {
          lineNumber: 2,
          itemCode: 'TOTAL-TAX',
          description: 'Total tax deducted',
          quantity: 1,
          unitPrice: 7100.0,
          discountPercent: 0,
          vatRate: 0,
          vatAmount: 0,
          lineTotal: 7100.0,
        },
        {
          lineNumber: 3,
          itemCode: 'TOTAL-NI',
          description: 'Employee NI contributions',
          quantity: 1,
          unitPrice: 4051.68,
          discountPercent: 0,
          vatRate: 0,
          vatAmount: 0,
          lineTotal: 4051.68,
        },
      ],
      totals: {
        subtotal: 48000.0,
        vatBreakdown: [],
        vatAmount: 0,
        total: 48000.0,
        amountDue: 0,
      },
      metadata: {
        paymentTerms: '',
        currencyCode: 'GBP',
        currencySymbol: '£',
        formattedDate: '05/04/2026',
        formattedDueDate: '',
        niLetter: 'A',
        earningsLEL: 6396.0,
        earningsPT: 12570.0,
        earningsUEL: 48000.0,
        employeeNI: 4051.68,
        employerNI: 5765.52,
      },
      branding: DEFAULT_BRANDING,
      isStub: false,
    };
  }

  // -------------------------------------------------------------------------
  // Fallback for any unexpected document type
  // -------------------------------------------------------------------------

  private buildGenericSample(documentType: string): DocumentDataContext {
    const lines = buildSalesLines();
    const totals = calculateTotals(lines);
    return {
      company: SAMPLE_COMPANY,
      document: {
        number: `${documentType}-SAMPLE`,
        date: '15/02/2026',
        dueDate: '17/03/2026',
        reference: 'SAMPLE-REF',
        notes: 'Sample document for template preview.',
        status: 'DRAFT',
        currency: 'GBP',
      },
      counterparty: SAMPLE_CUSTOMER,
      lines,
      totals,
      metadata: {
        paymentTerms: 'Net 30 days',
        currencyCode: 'GBP',
        currencySymbol: '£',
        formattedDate: '15/02/2026',
        formattedDueDate: '17/03/2026',
      },
      branding: DEFAULT_BRANDING,
      isStub: false,
    };
  }
}
