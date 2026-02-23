import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { AiOrchestrator } from './orchestrator.js';
import type {
  AiRequestContext,
  CashFlowForecast,
  CashFlowPeriod,
  CashFlowAlert,
  AnomalyResult,
  DuplicatePair,
  ConfidenceScoreResponse,
  ExplainResponse,
} from './ai.types.js';
import { getConfidenceLevel } from './ai.types.js';

// ─── Decimal String Arithmetic (avoids float precision loss for Decimal(19,4)) ──

/** Convert a decimal string like "1234.5678" to BigInt units of 0.0001 */
function decimalToBigInt(value: string): bigint {
  const trimmed = value.trim();
  const negative = trimmed.startsWith('-');
  const abs = negative ? trimmed.slice(1) : trimmed;
  const dotIndex = abs.indexOf('.');

  let whole: string;
  let frac: string;

  if (dotIndex === -1) {
    whole = abs || '0';
    frac = '0000';
  } else {
    whole = abs.slice(0, dotIndex) || '0';
    frac = abs.slice(dotIndex + 1).padEnd(4, '0').slice(0, 4);
  }

  const result = BigInt(whole + frac);
  return negative ? -result : result;
}

/** Convert BigInt units of 0.0001 back to a decimal string with 4 decimal places */
function bigIntToDecimal(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const str = abs.toString().padStart(5, '0');
  const whole = str.slice(0, -4) || '0';
  const frac = str.slice(-4);
  return (negative ? '-' : '') + whole + '.' + frac;
}

/** Add two decimal strings without floating-point precision loss */
function addDecimals(a: string, b: string): string {
  return bigIntToDecimal(decimalToBigInt(a) + decimalToBigInt(b));
}

/** Subtract two decimal strings: a - b */
function subtractDecimals(a: string, b: string): string {
  return bigIntToDecimal(decimalToBigInt(a) - decimalToBigInt(b));
}

/** Compare two decimal strings: returns -1 (a<b), 0 (a==b), or 1 (a>b) */
function compareDecimals(a: string, b: string): number {
  const bigA = decimalToBigInt(a);
  const bigB = decimalToBigInt(b);
  if (bigA < bigB) return -1;
  if (bigA > bigB) return 1;
  return 0;
}

/** Multiply a decimal string by a fraction (numerator/denominator), truncating to 4 dp */
function multiplyDecimalByInt(a: string, numerator: number, denominator: number): string {
  const bigA = decimalToBigInt(a);
  return bigIntToDecimal(bigA * BigInt(numerator) / BigInt(denominator));
}

// ─── Prompt size limits ────────────────────────────────────────────────────
// Cap records sent to the AI to avoid exceeding token limits.
// 200 records ≈ ~40KB JSON ≈ ~10K tokens — well within model limits.
const MAX_PROMPT_RECORDS = 200;

// ─── Allowed Prisma model names for dynamic access ────────────────────────
// Only models in this allowlist can be queried dynamically (E5.1 Issue #1)
const ALLOWED_FINANCIAL_MODELS = new Set([
  'customerInvoice',
  'supplierInvoice',
  'purchaseOrder',
  'payment',
  'bankAccount',
  'recurringPayment',
  'customer',
  'supplier',
  'contact',
]);

// ─── Valid anomaly types (must match API contract enum) ────────────────────
const VALID_ANOMALY_TYPES = new Set([
  'DUPLICATE_AMOUNT',
  'UNUSUAL_AMOUNT',
  'TIMING_ANOMALY',
  'NEW_SUPPLIER_LARGE_AMOUNT',
  'SEQUENTIAL_INVOICES',
  'ROUND_NUMBER_BIAS',
]);

/** Internal type for financial data gathered from DB */
export interface FinancialContext {
  currentBalance: string;
  currency: string;
  arOutstanding: Array<{ id: string; displayRef: string; amount: string; dueDate: string; customerName: string }>;
  apOutstanding: Array<{ id: string; displayRef: string; amount: string; dueDate: string; supplierName: string }>;
  committedPOs: Array<{ id: string; displayRef: string; amount: string; expectedDate: string }>;
  recurringPayments: Array<{ description: string; amount: string; frequency: string; nextDate: string }>;
}

/** Internal type for transaction data gathered from DB for anomaly analysis */
export interface TransactionContext {
  payments: Array<{
    id: string;
    displayRef: string;
    amount: string;
    date: string;
    supplierName: string;
    supplierInvoiceId?: string;
  }>;
  invoices: Array<{
    id: string;
    displayRef: string;
    amount: string;
    date: string;
    supplierName: string;
    invoiceNumber: string;
  }>;
  totalRecords: number;
}

export class PredictionService {
  constructor(
    private orchestrator: AiOrchestrator,
    private db: PrismaClient,
    private logger: Logger,
  ) {}

  /**
   * Generate a cash flow forecast for the given date range.
   * Gathers AR/AP/PO data from the database, sends context
   * to the AI orchestrator, and parses the structured forecast response.
   */
  async forecastCashFlow(params: {
    startDate: string;
    endDate: string;
    bankAccountIds?: string[];
    includeCommittedPOs: boolean;
    includeRecurring: boolean;
    context: AiRequestContext;
  }): Promise<CashFlowForecast> {
    // 1. Gather financial context from tenant DB
    const financialContext = await this.gatherFinancialContext({
      companyId: params.context.companyId,
      startDate: params.startDate,
      endDate: params.endDate,
      bankAccountIds: params.bankAccountIds,
      includeCommittedPOs: params.includeCommittedPOs,
      includeRecurring: params.includeRecurring,
    });

    // 2. Build AI request with prediction prompt
    const { systemPrompt, userMessage } = this.buildPredictionPrompt('forecast', {
      financialContext,
      startDate: params.startDate,
      endDate: params.endDate,
      currency: financialContext.currency,
    });

    // 3. Call orchestrator directly (bypasses agent resolution; prediction prompts are built programmatically)
    const aiResponse = await this.orchestrator.processDirect({
      systemPrompt,
      userMessage,
      routingTags: ['reasoning'],
      context: params.context,
      intent: 'forecast',
    });

    // 4. Parse AI response into typed forecast
    const forecast = this.parseForecastResponse(
      aiResponse.content ?? '{}',
      financialContext.currency,
      financialContext.currentBalance,
    );

    // 5. Generate alerts from parsed periods
    forecast.alerts = this.generateAlerts(forecast.periods);

    return forecast;
  }

  /**
   * Gather financial context data from the tenant DB for forecast input.
   * Collects:
   * - Current bank balances
   * - AR outstanding invoices (amounts, due dates)
   * - AP outstanding bills (amounts, due dates)
   * - Committed POs not yet billed (if includeCommittedPOs)
   * - Recurring payments (if includeRecurring)
   *
   * NOTE: Business module models may not exist yet (E7+).
   * Uses graceful degradation — returns empty arrays when models are missing.
   */
  private async gatherFinancialContext(params: {
    companyId: string;
    startDate: string;
    endDate: string;
    bankAccountIds?: string[];
    includeCommittedPOs: boolean;
    includeRecurring: boolean;
  }): Promise<FinancialContext> {
    const { companyId } = params;

    // Default context with empty data
    const context: FinancialContext = {
      currentBalance: '0.0000',
      currency: 'GBP',
      arOutstanding: [],
      apOutstanding: [],
      committedPOs: [],
      recurringPayments: [],
    };

    // Bank accounts — gather current balance
    try {
      const bankAccounts = await this.safeModelQuery('bankAccount', {
        where: {
          companyId,
          ...(params.bankAccountIds?.length ? { id: { in: params.bankAccountIds } } : {}),
          isActive: true,
        },
        select: { id: true, balance: true, currency: true },
      });

      if (bankAccounts && bankAccounts.length > 0) {
        // Determine the primary currency (most common among accounts)
        const currencyCounts = new Map<string, number>();
        for (const account of bankAccounts) {
          const cur = String(account.currency ?? 'GBP');
          currencyCounts.set(cur, (currencyCounts.get(cur) ?? 0) + 1);
        }
        let primaryCurrency = 'GBP';
        let maxCount = 0;
        for (const [cur, count] of currencyCounts) {
          if (count > maxCount) {
            primaryCurrency = cur;
            maxCount = count;
          }
        }
        context.currency = primaryCurrency;

        // Only sum balances from accounts matching the primary currency
        // (mixing currencies without conversion would produce incorrect totals)
        let totalBalance = '0.0000';
        let skippedCount = 0;
        for (const account of bankAccounts) {
          const cur = String(account.currency ?? 'GBP');
          if (cur === primaryCurrency) {
            totalBalance = addDecimals(totalBalance, String(account.balance ?? '0'));
          } else {
            skippedCount++;
          }
        }
        if (skippedCount > 0) {
          this.logger.warn(
            { companyId, primaryCurrency, skippedCount },
            `Skipped ${skippedCount} bank account(s) with different currency — only ${primaryCurrency} accounts included in forecast balance`,
          );
        }
        context.currentBalance = totalBalance;
      }
    } catch {
      this.logger.warn({ companyId }, 'BankAccount model not available — using default balance');
    }

    // AR outstanding invoices
    try {
      const arInvoices = await this.safeModelQuery('customerInvoice', {
        where: {
          companyId,
          status: { in: ['APPROVED', 'SENT', 'OVERDUE'] },
          dueDate: { gte: new Date(params.startDate), lte: new Date(params.endDate) },
        },
        select: { id: true, invoiceNumber: true, totalAmount: true, dueDate: true, customerName: true },
        take: 500,
      });

      if (arInvoices) {
        context.arOutstanding = arInvoices.map((inv: any) => ({
          id: String(inv.id),
          displayRef: String(inv.invoiceNumber ?? inv.id),
          amount: String(inv.totalAmount ?? '0'),
          dueDate: inv.dueDate instanceof Date ? inv.dueDate.toISOString().split('T')[0]! : String(inv.dueDate),
          customerName: String(inv.customerName ?? 'Unknown'),
        }));
      }
    } catch {
      this.logger.warn({ companyId }, 'CustomerInvoice model not available — AR data empty');
    }

    // AP outstanding bills
    try {
      const apBills = await this.safeModelQuery('supplierInvoice', {
        where: {
          companyId,
          status: { in: ['APPROVED', 'RECEIVED', 'OVERDUE'] },
          dueDate: { gte: new Date(params.startDate), lte: new Date(params.endDate) },
        },
        select: { id: true, invoiceNumber: true, totalAmount: true, dueDate: true, supplierName: true },
        take: 500,
      });

      if (apBills) {
        context.apOutstanding = apBills.map((bill: any) => ({
          id: String(bill.id),
          displayRef: String(bill.invoiceNumber ?? bill.id),
          amount: String(bill.totalAmount ?? '0'),
          dueDate: bill.dueDate instanceof Date ? bill.dueDate.toISOString().split('T')[0]! : String(bill.dueDate),
          supplierName: String(bill.supplierName ?? 'Unknown'),
        }));
      }
    } catch {
      this.logger.warn({ companyId }, 'SupplierInvoice model not available — AP data empty');
    }

    // Committed POs (if requested)
    if (params.includeCommittedPOs) {
      try {
        const pos = await this.safeModelQuery('purchaseOrder', {
          where: {
            companyId,
            status: { in: ['APPROVED', 'SENT'] },
            expectedDate: { gte: new Date(params.startDate), lte: new Date(params.endDate) },
          },
          select: { id: true, orderNumber: true, totalAmount: true, expectedDate: true },
          take: 500,
        });

        if (pos) {
          context.committedPOs = pos.map((po: any) => ({
            id: String(po.id),
            displayRef: String(po.orderNumber ?? po.id),
            amount: String(po.totalAmount ?? '0'),
            expectedDate: po.expectedDate instanceof Date ? po.expectedDate.toISOString().split('T')[0]! : String(po.expectedDate),
          }));
        }
      } catch {
        this.logger.warn({ companyId }, 'PurchaseOrder model not available — PO data empty');
      }
    }

    // Recurring payments (if requested)
    if (params.includeRecurring) {
      try {
        const recurring = await this.safeModelQuery('recurringPayment', {
          where: {
            companyId,
            isActive: true,
            nextDate: { gte: new Date(params.startDate), lte: new Date(params.endDate) },
          },
          select: { description: true, amount: true, frequency: true, nextDate: true },
          take: 100,
        });

        if (recurring) {
          context.recurringPayments = recurring.map((r: any) => ({
            description: String(r.description ?? 'Recurring payment'),
            amount: String(r.amount ?? '0'),
            frequency: String(r.frequency ?? 'MONTHLY'),
            nextDate: r.nextDate instanceof Date ? r.nextDate.toISOString().split('T')[0]! : String(r.nextDate),
          }));
        }
      } catch {
        this.logger.warn({ companyId }, 'RecurringPayment model not available — recurring data empty');
      }
    }

    return context;
  }

  /**
   * Parse the AI structured output into a typed CashFlowForecast.
   * Validates periods have required fields, generates alerts
   * for negative/low balance periods.
   */
  private parseForecastResponse(
    aiContent: string,
    currency: string,
    currentBalance: string,
  ): CashFlowForecast {
    const forecast: CashFlowForecast = {
      generatedAt: new Date().toISOString(),
      currency,
      currentBalance,
      periods: [],
      alerts: [],
    };

    let parsed: any;
    try {
      parsed = JSON.parse(aiContent);
    } catch {
      this.logger.warn('Failed to parse AI forecast response as JSON — returning empty forecast');
      return forecast;
    }

    // Extract periods array from parsed JSON (may be at root or nested)
    const rawPeriods = Array.isArray(parsed) ? parsed : (parsed.periods ?? []);

    for (const raw of rawPeriods) {
      if (!this.isValidPeriod(raw)) {
        this.logger.warn({ raw }, 'Skipping malformed forecast period — missing required fields');
        continue;
      }

      const period: CashFlowPeriod = {
        periodStart: String(raw.periodStart),
        periodEnd: String(raw.periodEnd),
        openingBalance: String(raw.openingBalance),
        inflows: String(raw.inflows),
        outflows: String(raw.outflows),
        netFlow: String(raw.netFlow),
        closingBalance: String(raw.closingBalance),
        inflowDetails: Array.isArray(raw.inflowDetails)
          ? raw.inflowDetails.map((d: any) => ({
              source: String(d.source ?? ''),
              amount: String(d.amount ?? '0'),
              description: String(d.description ?? ''),
            }))
          : [],
        outflowDetails: Array.isArray(raw.outflowDetails)
          ? raw.outflowDetails.map((d: any) => ({
              source: String(d.source ?? ''),
              amount: String(d.amount ?? '0'),
              description: String(d.description ?? ''),
            }))
          : [],
      };

      forecast.periods.push(period);
    }

    return forecast;
  }

  /**
   * Generate alerts from forecast periods.
   * - NEGATIVE_BALANCE: closingBalance < 0
   * - LOW_BALANCE: closingBalance < 10% of first period's openingBalance
   * - COLLECTION_OPPORTUNITY: inflows >> outflows with upcoming receivables
   */
  private generateAlerts(periods: CashFlowPeriod[]): CashFlowAlert[] {
    if (periods.length === 0) return [];

    const alerts: CashFlowAlert[] = [];
    const firstOpeningBalance = periods[0]!.openingBalance;
    // 10% threshold: openingBalance * 1 / 10
    const lowBalanceThreshold = compareDecimals(firstOpeningBalance, '0.0000') > 0
      ? multiplyDecimalByInt(firstOpeningBalance, 1, 10)
      : '0.0000';

    for (const period of periods) {
      const periodRange = `${period.periodStart} – ${period.periodEnd}`;

      // NEGATIVE_BALANCE: closingBalance < 0
      if (compareDecimals(period.closingBalance, '0.0000') < 0) {
        alerts.push({
          type: 'NEGATIVE_BALANCE',
          message: `Projected negative balance of ${period.closingBalance} in period ${periodRange}`,
          period: periodRange,
          amount: period.closingBalance,
          suggestedAction: 'Accelerate collections or defer non-essential payments to avoid cash shortfall',
        });
      }
      // LOW_BALANCE: closingBalance < 10% of first period's opening (only when opening > 0)
      else if (
        compareDecimals(firstOpeningBalance, '0.0000') > 0 &&
        compareDecimals(period.closingBalance, lowBalanceThreshold) < 0
      ) {
        alerts.push({
          type: 'LOW_BALANCE',
          message: `Projected low balance of ${period.closingBalance} (below 10% of opening balance) in period ${periodRange}`,
          period: periodRange,
          amount: period.closingBalance,
          suggestedAction: 'Review upcoming receivables and consider accelerating collections',
        });
      }

      // COLLECTION_OPPORTUNITY: total inflows exceed outflows significantly (>150%)
      // outflows > 0 AND inflows > outflows * 1.5 (i.e., inflows * 2 > outflows * 3)
      const outflowsPositive = compareDecimals(period.outflows, '0.0000') > 0;
      const inflowsTimesTwo = multiplyDecimalByInt(period.inflows, 2, 1);
      const outflowsTimesThree = multiplyDecimalByInt(period.outflows, 3, 1);
      if (outflowsPositive && compareDecimals(inflowsTimesTwo, outflowsTimesThree) > 0 && period.inflowDetails.length > 0) {
        alerts.push({
          type: 'COLLECTION_OPPORTUNITY',
          message: `Strong collection opportunity in period ${periodRange} — projected inflows (${period.inflows}) significantly exceed outflows (${period.outflows})`,
          period: periodRange,
          amount: subtractDecimals(period.inflows, period.outflows),
          suggestedAction: 'Consider early payment discounts to suppliers or investing surplus cash',
        });
      }
    }

    return alerts;
  }

  // ─── Anomaly Detection ───────────────────────────────────────────────────

  /**
   * Analyse recent transactions for suspicious patterns.
   * Collects transaction data from lookback period, sends to AI
   * for pattern analysis, and returns flagged items with confidence.
   */
  async detectAnomalies(params: {
    lookbackDays: number;
    entityTypes?: string[];
    minConfidence: number;
    context: AiRequestContext;
  }): Promise<{
    generatedAt: string;
    lookbackDays: number;
    totalAnalysed: number;
    anomalies: AnomalyResult[];
  }> {
    // 1. Gather transaction data scoped by companyId
    const transactionContext = await this.gatherTransactionContext({
      companyId: params.context.companyId,
      lookbackDays: params.lookbackDays,
      entityTypes: params.entityTypes,
    });

    // Cap records sent to AI to avoid exceeding token limits
    const cappedContext: TransactionContext = {
      payments: transactionContext.payments.slice(0, MAX_PROMPT_RECORDS),
      invoices: transactionContext.invoices.slice(0, MAX_PROMPT_RECORDS),
      totalRecords: transactionContext.totalRecords,
    };
    if (transactionContext.payments.length > MAX_PROMPT_RECORDS || transactionContext.invoices.length > MAX_PROMPT_RECORDS) {
      this.logger.warn(
        { payments: transactionContext.payments.length, invoices: transactionContext.invoices.length, cap: MAX_PROMPT_RECORDS },
        `Anomaly detection capped records sent to AI at ${MAX_PROMPT_RECORDS} per type`,
      );
    }

    // 2. Build AI request with anomaly detection prompt
    const { systemPrompt, userMessage } = this.buildPredictionPrompt('anomaly-detect', {
      transactionData: cappedContext,
      lookbackDays: params.lookbackDays,
    });

    // 3. Call orchestrator directly (bypasses agent resolution; prediction prompts are built programmatically)
    const aiResponse = await this.orchestrator.processDirect({
      systemPrompt,
      userMessage,
      routingTags: ['reasoning'],
      context: params.context,
      intent: 'anomaly-detect',
    });

    // 4. Parse AI response into anomaly results
    const rawAnomalies = this.parseAnomalyResponse(aiResponse.content ?? '[]');

    // 5. Filter by minConfidence and apply confidence levels
    const filtered = rawAnomalies
      .filter((a) => a.confidence >= params.minConfidence)
      .map((a) => ({
        ...a,
        confidenceLevel: getConfidenceLevel(a.confidence),
      }));

    // 6. Sort by confidence descending
    filtered.sort((a, b) => b.confidence - a.confidence);

    return {
      generatedAt: new Date().toISOString(),
      lookbackDays: params.lookbackDays,
      totalAnalysed: transactionContext.totalRecords,
      anomalies: filtered,
    };
  }

  /**
   * Gather recent transaction data for anomaly analysis.
   * Scoped by companyId, limited to lookbackDays.
   *
   * NOTE: Business module models may not exist yet (E7+).
   * Uses graceful degradation — returns empty arrays when models are missing.
   */
  private async gatherTransactionContext(params: {
    companyId: string;
    lookbackDays: number;
    entityTypes?: string[];
  }): Promise<TransactionContext> {
    const { companyId, lookbackDays, entityTypes } = params;
    const lookbackDate = new Date(Date.now() - lookbackDays * 86_400_000);

    const context: TransactionContext = {
      payments: [],
      invoices: [],
      totalRecords: 0,
    };

    // Determine which entity types to query
    const queryPayments = !entityTypes || entityTypes.includes('Payment');
    const queryInvoices = !entityTypes || entityTypes.includes('SupplierInvoice');

    // Payments
    if (queryPayments) {
      try {
        const payments = await this.safeModelQuery('payment', {
          where: {
            companyId,
            createdAt: { gte: lookbackDate },
          },
          select: {
            id: true,
            paymentNumber: true,
            amount: true,
            createdAt: true,
            supplierName: true,
            supplierInvoiceId: true,
          },
          take: 500,
          orderBy: { createdAt: 'desc' },
        });

        if (payments) {
          context.payments = payments.map((p: any) => ({
            id: String(p.id),
            displayRef: String(p.paymentNumber ?? p.id),
            amount: String(p.amount ?? '0'),
            date: p.createdAt instanceof Date
              ? p.createdAt.toISOString()
              : String(p.createdAt),
            supplierName: String(p.supplierName ?? 'Unknown'),
            supplierInvoiceId: p.supplierInvoiceId ? String(p.supplierInvoiceId) : undefined,
          }));
        }
      } catch {
        this.logger.warn({ companyId }, 'Payment model not available — payment data empty');
      }
    }

    // Supplier Invoices
    if (queryInvoices) {
      try {
        const invoices = await this.safeModelQuery('supplierInvoice', {
          where: {
            companyId,
            createdAt: { gte: lookbackDate },
          },
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            createdAt: true,
            supplierName: true,
          },
          take: 500,
          orderBy: { createdAt: 'desc' },
        });

        if (invoices) {
          context.invoices = invoices.map((inv: any) => ({
            id: String(inv.id),
            displayRef: String(inv.invoiceNumber ?? inv.id),
            amount: String(inv.totalAmount ?? '0'),
            date: inv.createdAt instanceof Date
              ? inv.createdAt.toISOString()
              : String(inv.createdAt),
            supplierName: String(inv.supplierName ?? 'Unknown'),
            invoiceNumber: String(inv.invoiceNumber ?? ''),
          }));
        }
      } catch {
        this.logger.warn({ companyId }, 'SupplierInvoice model not available — invoice data empty for anomaly analysis');
      }
    }

    context.totalRecords = context.payments.length + context.invoices.length;

    return context;
  }

  /**
   * Parse the AI structured output into AnomalyResult[].
   * Validates each item has required fields. Skips malformed entries.
   */
  private parseAnomalyResponse(aiContent: string): AnomalyResult[] {
    let parsed: any;
    try {
      parsed = JSON.parse(aiContent);
    } catch {
      this.logger.warn('Failed to parse AI anomaly response as JSON — returning empty results');
      return [];
    }

    // Extract anomalies array from parsed JSON (may be at root or nested)
    const rawAnomalies: any[] = Array.isArray(parsed) ? parsed : (parsed.anomalies ?? []);
    const results: AnomalyResult[] = [];

    for (const raw of rawAnomalies) {
      if (!this.isValidAnomaly(raw)) {
        this.logger.warn({ raw }, 'Skipping malformed anomaly result — missing required fields');
        continue;
      }

      results.push({
        id: String(raw.id ?? randomUUID()),
        entityType: String(raw.entityType),
        entityId: String(raw.entityId),
        displayRef: String(raw.displayRef ?? raw.entityId),
        anomalyType: raw.anomalyType,
        description: String(raw.description),
        confidence: Number(raw.confidence),
        confidenceLevel: getConfidenceLevel(Number(raw.confidence)),
        relatedEntities: Array.isArray(raw.relatedEntities)
          ? raw.relatedEntities.map((re: any) => ({
              entityType: String(re.entityType ?? ''),
              entityId: String(re.entityId ?? ''),
              displayRef: String(re.displayRef ?? ''),
              relationship: String(re.relationship ?? ''),
            }))
          : undefined,
        metadata: raw.metadata ?? {},
      });
    }

    return results;
  }

  /**
   * Validate that a raw anomaly object has all required fields.
   */
  private isValidAnomaly(raw: any): boolean {
    return (
      raw != null &&
      typeof raw === 'object' &&
      raw.entityType != null &&
      raw.entityId != null &&
      raw.anomalyType != null &&
      VALID_ANOMALY_TYPES.has(raw.anomalyType) &&
      raw.description != null &&
      raw.confidence != null &&
      typeof raw.confidence === 'number' &&
      raw.confidence >= 0 &&
      raw.confidence <= 1
    );
  }

  // ─── Duplicate Detection ─────────────────────────────────────────────────

  /**
   * Detect potential duplicate entities using AI fuzzy matching.
   * Accepts entity type (Customer, Supplier, Contact), loads all
   * active records, and sends to AI for similarity analysis.
   */
  async detectDuplicates(params: {
    entityType: 'Customer' | 'Supplier' | 'Contact';
    minSimilarity: number;
    limit: number;
    context: AiRequestContext;
  }): Promise<{
    generatedAt: string;
    entityType: string;
    totalScanned: number;
    duplicates: DuplicatePair[];
  }> {
    // 1. Load entity data scoped by companyId
    const allEntities = await this.loadEntitiesForDuplicateCheck({
      entityType: params.entityType,
      companyId: params.context.companyId,
    });

    // Cap records sent to AI to avoid exceeding token limits
    const entities = allEntities.slice(0, MAX_PROMPT_RECORDS);
    if (allEntities.length > MAX_PROMPT_RECORDS) {
      this.logger.warn(
        { entityType: params.entityType, total: allEntities.length, sent: MAX_PROMPT_RECORDS },
        `Duplicate detection capped at ${MAX_PROMPT_RECORDS} records (${allEntities.length} total) — increase limit or paginate for full coverage`,
      );
    }

    // 2. Build AI request with duplicate detection prompt
    const { systemPrompt, userMessage } = this.buildPredictionPrompt('duplicate-detect', {
      entities,
      entityType: params.entityType,
    });

    // 3. Call orchestrator directly (bypasses agent resolution; prediction prompts are built programmatically)
    const aiResponse = await this.orchestrator.processDirect({
      systemPrompt,
      userMessage,
      routingTags: ['standard'],
      context: params.context,
      intent: 'duplicate-detect',
    });

    // 4. Parse AI response into duplicate pairs
    const rawDuplicates = this.parseDuplicateResponse(aiResponse.content ?? '[]');

    // 5. Filter by minSimilarity and apply confidence levels
    const filtered = rawDuplicates
      .filter((d) => d.overallSimilarity >= params.minSimilarity)
      .map((d) => ({
        ...d,
        confidenceLevel: getConfidenceLevel(d.overallSimilarity),
      }));

    // 6. Sort by similarity descending and limit
    filtered.sort((a, b) => b.overallSimilarity - a.overallSimilarity);
    const limited = filtered.slice(0, params.limit);

    return {
      generatedAt: new Date().toISOString(),
      entityType: params.entityType,
      totalScanned: allEntities.length,
      duplicates: limited,
    };
  }

  /**
   * Load entity data for duplicate analysis.
   * Selects fields relevant for duplicate detection:
   * name, address, VAT number, bank details, email, phone.
   *
   * NOTE: Customer/Supplier/Contact models may not exist yet (E7+).
   * Uses graceful degradation — returns empty array when models are missing.
   */
  private async loadEntitiesForDuplicateCheck(params: {
    entityType: 'Customer' | 'Supplier' | 'Contact';
    companyId: string;
  }): Promise<Array<{ id: string; displayRef: string; data: Record<string, unknown> }>> {
    const { entityType, companyId } = params;

    // Map entity type to Prisma model name (lowercase first char)
    const modelName = entityType.charAt(0).toLowerCase() + entityType.slice(1);

    try {
      const records = await this.safeModelQuery(modelName, {
        where: {
          companyId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          vatNumber: true,
          address1: true,
          address2: true,
          city: true,
          postCode: true,
          country: true,
          bankAccount: true,
        },
        take: 1000,
      });

      if (!records) {
        return [];
      }

      return records.map((r: any) => ({
        id: String(r.id),
        displayRef: String(r.name ?? r.id),
        data: {
          name: r.name ?? null,
          email: r.email ?? null,
          phone: r.phone ?? null,
          vatNumber: r.vatNumber ?? null,
          address1: r.address1 ?? null,
          address2: r.address2 ?? null,
          city: r.city ?? null,
          postCode: r.postCode ?? null,
          country: r.country ?? null,
          bankAccount: r.bankAccount ?? null,
        },
      }));
    } catch {
      this.logger.warn({ entityType, companyId }, `${entityType} model not available — duplicate detection returning empty results`);
      return [];
    }
  }

  /**
   * Parse the AI structured output into DuplicatePair[].
   * Validates each pair has required fields. Skips malformed entries.
   */
  private parseDuplicateResponse(aiContent: string): DuplicatePair[] {
    let parsed: any;
    try {
      parsed = JSON.parse(aiContent);
    } catch {
      this.logger.warn('Failed to parse AI duplicate response as JSON — returning empty results');
      return [];
    }

    // Extract duplicates array from parsed JSON (may be at root or nested)
    const rawDuplicates: any[] = Array.isArray(parsed) ? parsed : (parsed.duplicates ?? []);
    const results: DuplicatePair[] = [];

    for (const raw of rawDuplicates) {
      if (!this.isValidDuplicatePair(raw)) {
        this.logger.warn({ raw }, 'Skipping malformed duplicate pair — missing required fields');
        continue;
      }

      results.push({
        entityA: {
          entityType: String(raw.entityA.entityType ?? ''),
          entityId: String(raw.entityA.entityId ?? ''),
          displayRef: String(raw.entityA.displayRef ?? ''),
          data: raw.entityA.data ?? {},
        },
        entityB: {
          entityType: String(raw.entityB.entityType ?? ''),
          entityId: String(raw.entityB.entityId ?? ''),
          displayRef: String(raw.entityB.displayRef ?? ''),
          data: raw.entityB.data ?? {},
        },
        overallSimilarity: Number(raw.overallSimilarity),
        confidenceLevel: getConfidenceLevel(Number(raw.overallSimilarity)),
        fieldComparisons: Array.isArray(raw.fieldComparisons)
          ? raw.fieldComparisons.map((fc: any) => ({
              field: String(fc.field ?? ''),
              valueA: String(fc.valueA ?? ''),
              valueB: String(fc.valueB ?? ''),
              similarity: Number(fc.similarity ?? 0),
            }))
          : [],
      });
    }

    return results;
  }

  /**
   * Validate that a raw duplicate pair object has all required fields.
   */
  private isValidDuplicatePair(raw: any): boolean {
    return (
      raw != null &&
      typeof raw === 'object' &&
      raw.entityA != null &&
      typeof raw.entityA === 'object' &&
      raw.entityA.entityId != null &&
      raw.entityB != null &&
      typeof raw.entityB === 'object' &&
      raw.entityB.entityId != null &&
      raw.overallSimilarity != null &&
      typeof raw.overallSimilarity === 'number' &&
      raw.overallSimilarity >= 0 &&
      raw.overallSimilarity <= 1
    );
  }

  // ─── Confidence Scoring & Explainability ─────────────────────────────────

  /**
   * Find the AiMessage whose toolCalls reference the given entityId.
   * Uses structured traversal of toolCalls JSON to match entityId in
   * known fields (entityId, input.entityId) rather than fragile string matching.
   * Scans up to 1000 messages (desc by createdAt) for the company.
   */
  private async findAiMessageForEntity(
    companyId: string,
    entityId: string,
  ): Promise<{ content: string | null; toolCalls: unknown; confidence: any; createdAt: Date } | null> {
    const messages = await this.db.aiMessage.findMany({
      where: {
        conversation: {
          companyId,
        },
      },
      select: {
        content: true,
        confidence: true,
        toolCalls: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    for (const msg of messages) {
      const toolCalls = msg.toolCalls as unknown;
      if (!toolCalls || typeof toolCalls !== 'object') continue;

      if (this.toolCallsReferenceEntity(toolCalls, entityId)) {
        return msg;
      }
    }

    return null;
  }

  /**
   * Check whether a toolCalls JSON structure references the given entityId.
   * Traverses the structure looking for the entityId as a value in known fields
   * (entityId, input.entityId, arguments.entityId) rather than using fragile
   * JSON.stringify().includes() which could match entityId in unrelated fields.
   */
  private toolCallsReferenceEntity(toolCalls: unknown, entityId: string): boolean {
    const calls = Array.isArray(toolCalls) ? toolCalls : [toolCalls];

    for (const call of calls) {
      if (!call || typeof call !== 'object') continue;
      const c = call as Record<string, any>;

      // Check direct entityId field on the call
      if (c.entityId === entityId) return true;

      // Check input.entityId (standard tool call format)
      const input = c.input ?? c.arguments;
      if (input && typeof input === 'object') {
        if (input.entityId === entityId) return true;
        // Check nested result fields
        if (input.result && typeof input.result === 'object' && input.result.entityId === entityId) return true;
      }

      // Check result.entityId (tool call result format)
      if (c.result && typeof c.result === 'object' && c.result.entityId === entityId) return true;
    }

    return false;
  }

  /**
   * Retrieve stored confidence scores for an AI-created entity.
   * Looks up AiMessage records that contain confidence data
   * for the specified entity (via toolCalls JSON referencing entityType/entityId).
   *
   * Returns null if no AI-created record exists for the entity (manual creation).
   */
  async getConfidence(params: {
    entityType: string;
    entityId: string;
    context: AiRequestContext;
  }): Promise<ConfidenceScoreResponse | null> {
    const { entityType, entityId, context } = params;

    try {
      const msg = await this.findAiMessageForEntity(context.companyId, entityId);
      if (!msg) return null;

      // Extract field-level confidence from toolCalls
      const fieldConfidence = this.extractFieldConfidence(msg.toolCalls, entityType, entityId);

      // Use message-level confidence if available, otherwise compute from field confidences
      let overallConfidence = msg.confidence ? Number(msg.confidence) : 0;
      if (overallConfidence === 0 && Object.keys(fieldConfidence).length > 0) {
        const values = Object.values(fieldConfidence);
        overallConfidence = values.reduce((sum, v) => sum + v, 0) / values.length;
      }

      return {
        entityType,
        entityId,
        overallConfidence,
        confidenceLevel: getConfidenceLevel(overallConfidence),
        fieldConfidence,
        lastUpdated: msg.createdAt.toISOString(),
      };
    } catch (error) {
      this.logger.warn(
        { entityType, entityId, error: (error as Error).message },
        'Failed to retrieve confidence scores — returning null',
      );
      return null;
    }
  }

  /**
   * Generate a human-readable explanation of AI reasoning
   * for a given decision (creation, anomaly, or forecast).
   * Calls the AI with an 'explain' intent and the original
   * decision context.
   */
  async explain(params: {
    entityType: string;
    entityId: string;
    decisionType: 'creation' | 'anomaly' | 'forecast';
    context: AiRequestContext;
  }): Promise<ExplainResponse> {
    const { entityType, entityId, decisionType, context } = params;

    // 1. Load entity data for context (graceful degradation if model doesn't exist)
    const entityData = await this.loadEntityForExplanation(entityType, entityId, context.companyId);

    // 2. Load original AiMessage that created/flagged the entity (if available)
    let originalAiContext: Record<string, unknown> | null = null;
    try {
      const msg = await this.findAiMessageForEntity(context.companyId, entityId);
      if (msg) {
        originalAiContext = {
          content: msg.content,
          toolCalls: msg.toolCalls,
          confidence: msg.confidence ? Number(msg.confidence) : null,
          createdAt: msg.createdAt.toISOString(),
        };
      }
    } catch {
      this.logger.warn({ entityType, entityId }, 'Could not load original AI context for explanation');
    }

    // 3. Build AI request with explain intent
    const { systemPrompt, userMessage } = this.buildPredictionPrompt('explain', {
      entityData,
      entityType,
      entityId,
      decisionType,
      originalAiContext,
    });

    // 4. Call orchestrator directly (bypasses agent resolution; prediction prompts are built programmatically)
    const aiResponse = await this.orchestrator.processDirect({
      systemPrompt,
      userMessage,
      routingTags: ['standard'],
      context,
      intent: 'explain',
    });

    // 5. Parse AI response into ExplainResponse
    return this.parseExplainResponse(aiResponse.content ?? '{}');
  }

  /**
   * Extract field-level confidence from toolCalls JSON.
   * Looks for confidence data associated with the given entityType and entityId.
   */
  private extractFieldConfidence(
    toolCalls: unknown,
    _entityType: string,
    _entityId: string,
  ): Record<string, number> {
    const fieldConfidence: Record<string, number> = {};

    try {
      // toolCalls can be an array of tool call objects or a single object
      const calls = Array.isArray(toolCalls) ? toolCalls : [toolCalls];

      for (const call of calls) {
        if (!call || typeof call !== 'object') continue;

        const input = (call as any).input ?? (call as any).arguments ?? call;

        // Look for confidence field in the tool call input
        if (input.confidence && typeof input.confidence === 'object') {
          for (const [field, value] of Object.entries(input.confidence)) {
            if (typeof value === 'number') {
              fieldConfidence[field] = value;
            }
          }
        }
      }
    } catch {
      // If parsing fails, return empty field confidence
    }

    return fieldConfidence;
  }

  /**
   * Load entity data for explanation context.
   * Uses graceful degradation — returns empty object if model doesn't exist.
   */
  private async loadEntityForExplanation(
    entityType: string,
    entityId: string,
    companyId: string,
  ): Promise<Record<string, unknown>> {
    // Map entity type to Prisma model name (lowercase first char)
    const modelName = entityType.charAt(0).toLowerCase() + entityType.slice(1);

    try {
      const records = await this.safeModelQuery(modelName, {
        where: {
          id: entityId,
          companyId,
        },
        take: 1,
      });

      if (records && records.length > 0) {
        return records[0] as Record<string, unknown>;
      }
    } catch {
      this.logger.warn(
        { entityType, entityId },
        `${entityType} model not available — explanation will use limited context`,
      );
    }

    return {};
  }

  /**
   * Parse the AI structured output into an ExplainResponse.
   * Validates the response has required fields. Returns defaults for missing data.
   */
  private parseExplainResponse(aiContent: string): ExplainResponse {
    let parsed: any;
    try {
      parsed = JSON.parse(aiContent);
    } catch {
      this.logger.warn('Failed to parse AI explain response as JSON — returning default explanation');
      return {
        summary: 'Unable to generate explanation — AI response was not valid.',
        reasoning: [],
        dataPoints: [],
      };
    }

    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'No summary available.',
      reasoning: Array.isArray(parsed.reasoning)
        ? parsed.reasoning.filter((r: unknown) => typeof r === 'string')
        : [],
      dataPoints: Array.isArray(parsed.dataPoints)
        ? parsed.dataPoints
            .filter(
              (dp: any) =>
                dp != null &&
                typeof dp === 'object' &&
                typeof dp.field === 'string',
            )
            .map((dp: any) => ({
              field: String(dp.field),
              value: String(dp.value ?? ''),
              confidence: typeof dp.confidence === 'number' ? dp.confidence : 0,
              source: String(dp.source ?? 'unknown'),
            }))
        : [],
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Build prediction prompts programmatically (inline, no DB lookup).
   * Database-backed prompt management will be added in a future epic.
   */
  private buildPredictionPrompt(
    type: 'forecast' | 'anomaly-detect' | 'duplicate-detect' | 'explain',
    templateData: Record<string, unknown>,
  ): { systemPrompt: string; userMessage: string } {
    switch (type) {
      case 'forecast': {
        const financialContext = templateData.financialContext as FinancialContext;
        return {
          systemPrompt: [
            'You are a financial analyst AI assistant for an ERP system.',
            'Generate a period-by-period cash flow forecast based on the financial data provided.',
            'Return your response as valid JSON with the following structure:',
            '{ "periods": [{ "periodStart": "YYYY-MM-DD", "periodEnd": "YYYY-MM-DD",',
            '  "openingBalance": "0.0000", "inflows": "0.0000", "outflows": "0.0000",',
            '  "netFlow": "0.0000", "closingBalance": "0.0000",',
            '  "inflowDetails": [{ "source": "", "amount": "0.0000", "description": "" }],',
            '  "outflowDetails": [{ "source": "", "amount": "0.0000", "description": "" }] }] }',
            '',
            'Rules:',
            '- All monetary values MUST be strings with 4 decimal places (e.g., "1234.5678")',
            '- closingBalance = openingBalance + netFlow',
            '- netFlow = inflows - outflows',
            '- Each period\'s openingBalance = previous period\'s closingBalance',
            '- Break the date range into weekly periods',
            '- Distribute AR/AP amounts into the periods based on their due dates',
          ].join('\n'),
          userMessage: [
            `Forecast cash flow from ${templateData.startDate} to ${templateData.endDate} in ${templateData.currency}.`,
            '',
            `Current bank balance: ${financialContext.currentBalance} ${financialContext.currency}`,
            '',
            `AR Outstanding (${financialContext.arOutstanding.length} invoices):`,
            JSON.stringify(financialContext.arOutstanding, null, 2),
            '',
            `AP Outstanding (${financialContext.apOutstanding.length} bills):`,
            JSON.stringify(financialContext.apOutstanding, null, 2),
            '',
            `Committed POs (${financialContext.committedPOs.length}):`,
            JSON.stringify(financialContext.committedPOs, null, 2),
            '',
            `Recurring Payments (${financialContext.recurringPayments.length}):`,
            JSON.stringify(financialContext.recurringPayments, null, 2),
          ].join('\n'),
        };
      }

      case 'anomaly-detect': {
        const txContext = templateData.transactionData as TransactionContext;
        return {
          systemPrompt: [
            'You are a fraud detection AI assistant for an ERP system.',
            'Analyse the provided transactions for suspicious patterns.',
            'Return your response as valid JSON with the following structure:',
            '{ "anomalies": [{ "entityType": "Payment|SupplierInvoice", "entityId": "uuid",',
            '  "displayRef": "PAY-001", "anomalyType": "DUPLICATE_AMOUNT|UNUSUAL_AMOUNT|TIMING_ANOMALY|NEW_SUPPLIER_LARGE_AMOUNT|SEQUENTIAL_INVOICES|ROUND_NUMBER_BIAS",',
            '  "description": "Human-readable description", "confidence": 0.85,',
            '  "relatedEntities": [{ "entityType": "", "entityId": "", "displayRef": "", "relationship": "" }],',
            '  "metadata": {} }] }',
            '',
            'Anomaly types to check for:',
            '- DUPLICATE_AMOUNT: Same amount paid to same supplier within close date proximity',
            '- UNUSUAL_AMOUNT: Amount significantly deviates from historical average for that supplier',
            '- TIMING_ANOMALY: Payments on unusual days (weekends, holidays) or unusual frequency',
            '- NEW_SUPPLIER_LARGE_AMOUNT: First-time supplier with unusually large payment',
            '- SEQUENTIAL_INVOICES: Sequential invoice numbers from same supplier in short time window',
            '- ROUND_NUMBER_BIAS: All amounts from a supplier are round numbers (ending .00)',
            '',
            'Rules:',
            '- confidence must be a number between 0.0 and 1.0',
            '- Only flag genuine suspicious patterns, not normal business activity',
            '- Include related entities when an anomaly involves multiple records',
          ].join('\n'),
          userMessage: [
            `Analyse transactions from the last ${templateData.lookbackDays} days for suspicious patterns.`,
            '',
            `Payments (${txContext.payments.length} records):`,
            JSON.stringify(txContext.payments, null, 2),
            '',
            `Supplier Invoices (${txContext.invoices.length} records):`,
            JSON.stringify(txContext.invoices, null, 2),
          ].join('\n'),
        };
      }

      case 'duplicate-detect': {
        const entities = templateData.entities as Array<{ id: string; displayRef: string; data: Record<string, unknown> }>;
        const entityType = templateData.entityType as string;
        return {
          systemPrompt: [
            'You are a data quality AI assistant for an ERP system.',
            'Compare entity records for potential duplicates using fuzzy matching.',
            'Return your response as valid JSON with the following structure:',
            '{ "duplicates": [{ "entityA": { "entityType": "", "entityId": "", "displayRef": "", "data": {} },',
            '  "entityB": { "entityType": "", "entityId": "", "displayRef": "", "data": {} },',
            '  "overallSimilarity": 0.85,',
            '  "fieldComparisons": [{ "field": "name", "valueA": "", "valueB": "", "similarity": 0.9 }] }] }',
            '',
            'Fields to compare for similarity:',
            '- name: Compare business/contact names using fuzzy string matching',
            '- address: Compare address1, address2, city, postCode, country for overlap',
            '- vatNumber: Exact match comparison (high weight if both present)',
            '- bankAccount: Exact match comparison (high weight if both present)',
            '- email: Compare email addresses (normalise case, domain similarity)',
            '- phone: Compare phone numbers (normalise formatting)',
            '',
            'Rules:',
            '- overallSimilarity must be a number between 0.0 and 1.0',
            '- VAT number and bank account matches should heavily influence overall similarity',
            '- Only flag genuine potential duplicates, not merely similar records',
            '- Include per-field comparisons showing what matched and how closely',
          ].join('\n'),
          userMessage: [
            `Detect potential duplicate ${entityType} records. Compare all pairs for similarity.`,
            '',
            `${entityType} Records (${entities.length} total):`,
            JSON.stringify(entities, null, 2),
          ].join('\n'),
        };
      }

      case 'explain': {
        const entityData = templateData.entityData as Record<string, unknown>;
        const decisionType = templateData.decisionType as string;
        const originalAiContext = templateData.originalAiContext as Record<string, unknown> | null;
        return {
          systemPrompt: [
            'You are an explainability AI assistant for an ERP system.',
            'Explain the AI reasoning behind a decision in plain English.',
            'Return your response as valid JSON with the following structure:',
            '{ "summary": "Plain English explanation of the decision",',
            '  "reasoning": ["Step 1 of reasoning", "Step 2 of reasoning", ...],',
            '  "dataPoints": [{ "field": "fieldName", "value": "fieldValue",',
            '    "confidence": 0.85, "source": "extracted|inferred|default|historical" }] }',
            '',
            'Rules:',
            '- summary should be 1-2 sentences explaining what happened and why',
            '- reasoning should be a bulleted list of logical steps',
            '- dataPoints should list each field that influenced the decision',
            '- confidence for each data point should be 0.0-1.0',
            '- source indicates where the data came from:',
            '  - "extracted": directly from user input or document',
            '  - "inferred": derived from patterns or related data',
            '  - "default": system default value was used',
            '  - "historical": based on historical patterns',
          ].join('\n'),
          userMessage: [
            `Explain the AI ${decisionType} decision for ${templateData.entityType} (ID: ${templateData.entityId}).`,
            '',
            'Entity Data:',
            JSON.stringify(entityData, null, 2),
            '',
            ...(originalAiContext
              ? [
                  'Original AI Context (when the decision was made):',
                  JSON.stringify(originalAiContext, null, 2),
                ]
              : ['No original AI context available — entity may have been created manually.']),
          ].join('\n'),
        };
      }
    }
  }

  /**
   * Safely query a Prisma model that may not exist yet.
   * Returns the query result or null if the model doesn't exist.
   * Only allows models in the ALLOWED_FINANCIAL_MODELS allowlist.
   */
  private async safeModelQuery(
    modelName: string,
    queryArgs: Record<string, unknown>,
  ): Promise<any[] | null> {
    if (!ALLOWED_FINANCIAL_MODELS.has(modelName)) {
      this.logger.warn({ modelName }, 'Model not in allowlist — skipping query');
      return null;
    }

    const model = (this.db as any)[modelName];
    if (!model || typeof model.findMany !== 'function') {
      this.logger.warn({ modelName }, 'Model not available in Prisma client — graceful degradation');
      return null;
    }

    return model.findMany(queryArgs);
  }

  /**
   * Validate that a raw period object has all required fields.
   */
  private isValidPeriod(raw: any): boolean {
    return (
      raw != null &&
      typeof raw === 'object' &&
      raw.periodStart != null &&
      raw.periodEnd != null &&
      raw.openingBalance != null &&
      raw.inflows != null &&
      raw.outflows != null &&
      raw.netFlow != null &&
      raw.closingBalance != null
    );
  }
}
