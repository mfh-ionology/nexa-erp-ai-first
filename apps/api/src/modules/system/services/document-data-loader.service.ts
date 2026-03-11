// ---------------------------------------------------------------------------
// Document Data Loader Service — E12-1 Task 5
// Loads structured data contexts for document PDF generation.
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import { DocumentType } from '@nexa/db';
import type { Logger } from 'pino';

// --- Public interfaces (AC #4) ---

export interface CompanyData {
  name: string;
  legalName: string;
  address: string;
  vatNumber: string;
  companyNumber: string;
  bankName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  logoUrl: string | null;
  email: string;
  phone: string;
  website: string;
}

export interface DocumentData {
  number: string;
  date: string;
  dueDate: string;
  reference: string;
  notes: string;
  status: string;
  currency: string;
}

export interface CounterpartyData {
  name: string;
  address: string;
  vatNumber: string;
  contactEmail: string;
}

export interface DocumentLine {
  lineNumber: number;
  itemCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  vatRate: number;
  vatAmount: number;
  lineTotal: number;
  /** Transaction date (used by statement lines, remittance allocations) */
  date?: string;
  /** Running balance (used by customer statement lines) */
  runningBalance?: number;
  /** Received quantity (used by GRN lines) */
  receivedQty?: number;
  /** Variance between ordered and received (used by GRN lines) */
  variance?: number;
  /** Transaction type label e.g. "Invoice", "Payment" (used by statement lines) */
  transactionType?: string;
}

export interface VatBreakdownEntry {
  rate: number;
  taxableAmount: number;
  vatAmount: number;
}

export interface TotalsData {
  subtotal: number;
  vatBreakdown: VatBreakdownEntry[];
  vatAmount: number;
  total: number;
  amountDue: number;
}

export interface MetadataData {
  paymentTerms: string;
  currencyCode: string;
  currencySymbol: string;
  formattedDate: string;
  formattedDueDate: string;
  /** Customer statement aging — current period amount */
  agingCurrent?: number;
  /** Customer statement aging — 30 days overdue */
  aging30?: number;
  /** Customer statement aging — 60 days overdue */
  aging60?: number;
  /** Customer statement aging — 90+ days overdue */
  aging90Plus?: number;
  /** Payslip YTD — gross pay year to date */
  grossPayYtd?: number;
  /** Payslip YTD — tax paid year to date */
  taxPaidYtd?: number;
  /** Payslip YTD — NI paid year to date */
  niPaidYtd?: number;
  /** Payslip YTD — pension year to date */
  pensionYtd?: number;
  /** P60 NI letter category */
  niLetter?: string;
  /** P60 earnings at Lower Earnings Limit */
  earningsLEL?: number;
  /** P60 earnings at Primary Threshold */
  earningsPT?: number;
  /** P60 earnings at Upper Earnings Limit */
  earningsUEL?: number;
  /** P60 employee NI contributions */
  employeeNI?: number;
  /** P60 employer NI contributions */
  employerNI?: number;
  /** Delivery note — delivery name (if different from counterparty) */
  deliveryName?: string;
  /** Delivery note — delivery address (if different from counterparty) */
  deliveryAddress?: string;
  /** Remittance/receipt — payment method */
  paymentMethod?: string;
  /** GRN — supplier delivery note reference */
  supplierReference?: string;
}

export interface BrandingData {
  showLogo: boolean;
  logoPosition: string;
  showBankDetails: boolean;
  showVatNumber: boolean;
  showCompanyReg: boolean;
}

export interface DocumentDataContext {
  company: CompanyData;
  document: DocumentData;
  counterparty: CounterpartyData;
  lines: DocumentLine[];
  totals: TotalsData;
  metadata: MetadataData;
  branding: BrandingData;
  /** True when the document type's source model is not yet implemented (stub data) */
  isStub: boolean;
}

export interface BrandingOptions {
  showLogo: boolean;
  logoPosition: string;
  showBankDetails: boolean;
  showVatNumber: boolean;
  showCompanyReg: boolean;
}

// Re-export for consumer convenience
export { DocumentType };

// ---------------------------------------------------------------------------
// Currency symbol map
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '\u00a3',
  USD: '$',
  EUR: '\u20ac',
  JPY: '\u00a5',
  CNY: '\u00a5',
  CHF: 'CHF',
  CAD: 'CA$',
  AUD: 'A$',
};

function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}

// ---------------------------------------------------------------------------
// Supported document types (models that exist in the schema)
// ---------------------------------------------------------------------------

// Document types whose source models exist and can be queried.
// Currently NONE exist — all business module models are built in later epics.
// This set will be extended as epics E14+ are completed.
const SUPPORTED_DOCUMENT_TYPES = new Set<DocumentType>([
  // Future: add types here as their source models are created
]);

// ---------------------------------------------------------------------------
// Date formatting helper (UK default DD/MM/YYYY)
// ---------------------------------------------------------------------------

function formatDateUK(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(String(date));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// ---------------------------------------------------------------------------
// Address formatting helper
// ---------------------------------------------------------------------------

function formatAddress(profile: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  county?: string | null;
  postcode?: string | null;
  countryCode?: string | null;
}): string {
  return [
    profile.addressLine1,
    profile.addressLine2,
    profile.city,
    profile.county,
    profile.postcode,
  ]
    .filter(Boolean)
    .join(', ');
}

// ---------------------------------------------------------------------------
// DocumentDataLoaderService
// ---------------------------------------------------------------------------

export class DocumentDataLoaderService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  // -------------------------------------------------------------------------
  // loadContext (Task 5.1 — main entry point, AC #4)
  // -------------------------------------------------------------------------

  /**
   * Load a complete data context for document generation.
   *
   * @param companyId    - Tenant company ID (scoping enforced)
   * @param documentType - The type of document to generate
   * @param recordId     - The ID of the source record
   * @param branding     - Optional branding overrides from the template
   * @returns Full data context or null if record not found / wrong company
   */
  async loadContext(
    companyId: string,
    documentType: DocumentType,
    recordId: string,
    branding?: BrandingOptions,
  ): Promise<DocumentDataContext | null> {
    // Load company data (Task 5.2)
    const companyData = await this.loadCompanyData(companyId);
    if (!companyData) {
      this.logger.warn({ companyId }, 'document-data-loader: company not found');
      return null;
    }

    // Load document-specific data (Task 5.3)
    const documentResult = await this.loadDocumentData(companyId, documentType, recordId);
    if (!documentResult) {
      return null;
    }

    // Calculate totals from line items (Task 5.5)
    const totals = this.calculateTotals(documentResult.lines, documentResult.paymentsReceived);

    // Build metadata
    const metadata: MetadataData = {
      paymentTerms: documentResult.paymentTerms,
      currencyCode: documentResult.currencyCode,
      currencySymbol: getCurrencySymbol(documentResult.currencyCode),
      formattedDate: formatDateUK(documentResult.document.date),
      formattedDueDate: formatDateUK(documentResult.document.dueDate),
    };

    // Build branding context (Task 5.6)
    const brandingData: BrandingData = branding
      ? {
          showLogo: branding.showLogo,
          logoPosition: branding.logoPosition,
          showBankDetails: branding.showBankDetails,
          showVatNumber: branding.showVatNumber,
          showCompanyReg: branding.showCompanyReg,
        }
      : {
          showLogo: true,
          logoPosition: 'top-left',
          showBankDetails: true,
          showVatNumber: true,
          showCompanyReg: true,
        };

    return {
      company: companyData,
      document: documentResult.document,
      counterparty: documentResult.counterparty,
      lines: documentResult.lines,
      totals,
      metadata,
      branding: brandingData,
      isStub: documentResult.isStub,
    };
  }

  // -------------------------------------------------------------------------
  // Company data loading (Task 5.2)
  // -------------------------------------------------------------------------

  private async loadCompanyData(companyId: string): Promise<CompanyData | null> {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { id: companyId },
    });

    if (!profile) {
      return null;
    }

    return {
      name: profile.name,
      legalName: profile.legalName ?? '',
      address: formatAddress(profile),
      vatNumber: profile.vatNumber ?? '',
      companyNumber: profile.registrationNumber ?? '',
      bankName: '', // Bank details not on CompanyProfile yet — future epic
      bankSortCode: '',
      bankAccountNumber: '',
      logoUrl: profile.logoUrl ?? '',
      email: profile.email ?? '',
      phone: profile.phone ?? '',
      website: profile.website ?? '',
    };
  }

  // -------------------------------------------------------------------------
  // Document type routing (Task 5.3)
  // -------------------------------------------------------------------------

  /**
   * Route to the appropriate data loader based on documentType.
   *
   * Returns null if the record is not found or doesn't belong to the company.
   * Returns a stub context for document types whose source models don't exist yet.
   */
  private async loadDocumentData(
    companyId: string,
    documentType: DocumentType,
    recordId: string,
  ): Promise<DocumentLoadResult | null> {
    // Check if this document type has a real loader
    if (!SUPPORTED_DOCUMENT_TYPES.has(documentType)) {
      this.logger.warn(
        { companyId, documentType, recordId },
        'document-data-loader: source model not yet implemented, returning stub context',
      );
      return this.buildStubContext(documentType, recordId);
    }

    // Future: route to real loaders as models become available
    // switch (documentType) {
    //   case DocumentType.SALES_INVOICE:
    //   case DocumentType.CREDIT_NOTE:
    //   case DocumentType.PROFORMA_INVOICE:
    //   case DocumentType.CASH_RECEIPT:
    //     return this.loadInvoiceData(companyId, recordId);
    //   case DocumentType.SALES_ORDER:
    //     return this.loadSalesOrderData(companyId, recordId);
    //   ...
    // }

    return this.buildStubContext(documentType, recordId);
  }

  // -------------------------------------------------------------------------
  // Stub context for unavailable models (Task 5.3 — MVP)
  // -------------------------------------------------------------------------

  private buildStubContext(_documentType: DocumentType, recordId: string): DocumentLoadResult {
    return {
      document: {
        number: `STUB-${recordId.slice(0, 8).toUpperCase()}`,
        date: new Date().toISOString(),
        dueDate: '',
        reference: '',
        notes: '',
        status: 'DRAFT',
        currency: 'GBP',
      },
      counterparty: {
        name: '',
        address: '',
        vatNumber: '',
        contactEmail: '',
      },
      lines: [],
      paymentTerms: '',
      currencyCode: 'GBP',
      paymentsReceived: 0,
      isStub: true,
    };
  }

  // -------------------------------------------------------------------------
  // Totals calculation (Task 5.5)
  // -------------------------------------------------------------------------

  /**
   * Calculate document totals from normalised line items.
   *
   * - subtotal: sum of lineTotal
   * - vatBreakdown: grouped by VAT rate
   * - vatAmount: total VAT
   * - total: subtotal + vatAmount
   * - amountDue: total - paymentsReceived
   */
  calculateTotals(lines: DocumentLine[], paymentsReceived = 0): TotalsData {
    // Accumulate in integer cents to avoid floating-point drift
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

    // Sort breakdown by rate ascending
    vatBreakdown.sort((a, b) => a.rate - b.rate);

    const totalCents = subtotalCents + totalVatCents;
    const paymentsReceivedCents = Math.round(paymentsReceived * 100);

    return {
      subtotal: subtotalCents / 100,
      vatBreakdown,
      vatAmount: totalVatCents / 100,
      total: totalCents / 100,
      amountDue: (totalCents - paymentsReceivedCents) / 100,
    };
  }

  // -------------------------------------------------------------------------
  // Line items normalisation helper (Task 5.4)
  // -------------------------------------------------------------------------

  /**
   * Normalise raw line items from any source model into the standard DocumentLine shape.
   * This is a utility method for future real loaders to use.
   */
  normaliseLines(
    rawLines: Array<{
      description?: string | null;
      itemCode?: string | null;
      quantity?: number | string | null;
      unitPrice?: number | string | null;
      discountPercent?: number | string | null;
      vatRate?: number | string | null;
      vatAmount?: number | string | null;
      lineTotal?: number | string | null;
    }>,
  ): DocumentLine[] {
    return rawLines.map((raw, index) => {
      const quantity = toNum(raw.quantity);
      const unitPrice = toNum(raw.unitPrice);
      const discountPercent = toNum(raw.discountPercent);
      const vatRate = toNum(raw.vatRate);

      // Calculate lineTotal if not provided
      const baseAmount = quantity * unitPrice;
      const discountAmount = baseAmount * (discountPercent / 100);
      const netAmount = baseAmount - discountAmount;
      const lineTotal = raw.lineTotal != null ? toNum(raw.lineTotal) : round2(netAmount);
      const vatAmount =
        raw.vatAmount != null ? toNum(raw.vatAmount) : round2(lineTotal * (vatRate / 100));

      return {
        lineNumber: index + 1,
        itemCode: raw.itemCode ?? '',
        description: raw.description ?? '',
        quantity: round2(quantity),
        unitPrice: round2(unitPrice),
        discountPercent: round2(discountPercent),
        vatRate: round2(vatRate),
        vatAmount: round2(vatAmount),
        lineTotal: round2(lineTotal),
      };
    });
  }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface DocumentLoadResult {
  document: DocumentData;
  counterparty: CounterpartyData;
  lines: DocumentLine[];
  paymentTerms: string;
  currencyCode: string;
  paymentsReceived: number;
  isStub: boolean;
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function toNum(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && 'toNumber' in value) {
    // Prisma Decimal
    return (value as { toNumber: () => number }).toNumber();
  }
  const n = parseFloat(String(value));
  return isNaN(n) ? 0 : n;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
