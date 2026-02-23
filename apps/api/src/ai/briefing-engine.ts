import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type Redis from 'ioredis';
import type { AiOrchestrator } from './orchestrator.js';
import type { ContextEngine } from './context-engine.js';
import {
  resolveRole as resolveRoleShared,
  type AiRequestContext,
  type BriefingRole,
  type BriefingItem,
  type BriefingAction,
  type DailyBriefing,
} from './ai.types.js';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum records per data category sent to AI prompt */
const MAX_RECORDS_PER_CATEGORY = 100;

/** Cache TTL: 24 hours in seconds */
const BRIEFING_CACHE_TTL = 86_400;

/** Staleness threshold in milliseconds (24 hours) */
const STALENESS_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** Allowed Prisma model names for briefing data queries */
const ALLOWED_BRIEFING_MODELS = new Set([
  'customerInvoice',
  'supplierInvoice',
  'bankAccount',
  'purchaseOrder',
  'user',
]);

// ─── Role Template Definitions ──────────────────────────────────────────────

/** Data categories each role's briefing should include */
const ROLE_TEMPLATES: Record<BriefingRole, string[]> = {
  OWNER: ['approvals', 'revenue', 'overdue_receivables', 'cash_position', 'anomaly_alerts', 'opportunities'],
  FINANCE: ['approvals_finance', 'overdue_invoices', 'overdue_bills', 'cash_position', 'payment_runs', 'anomaly_alerts'],
  SALES: ['pipeline', 'pending_quotes', 'overdue_invoices_own', 'new_leads', 'upcoming_activities'],
  HR: ['leave_requests', 'contract_renewals', 'headcount', 'payroll_status'],
  WAREHOUSE: ['low_stock', 'pending_deliveries', 'picking_queue', 'dispatch_schedule'],
  ADMIN: ['system_health', 'user_activity', 'access_requests', 'audit_alerts'],
};

// ─── Briefing Context Types ─────────────────────────────────────────────────

/** Aggregated data gathered from the database for briefing generation */
export interface BriefingContext {
  pendingApprovals: number;
  overdueInvoices: { count: number; totalAmount: string };
  overdueBills: { count: number; totalAmount: string };
  cashPosition: { totalBalance: string; currency: string; accountCount: number };
  upcomingPaymentRuns: number;
  userName: string;
  userRole: string;
  companyName: string;
  currency: string;
}

// ─── BriefingEngine ─────────────────────────────────────────────────────────

export class BriefingEngine {
  constructor(
    private orchestrator: AiOrchestrator,
    private contextEngine: ContextEngine,
    private db: PrismaClient,
    private redis: Redis,
    private logger: Logger,
  ) {}

  // ─── Cache Key Helpers ──────────────────────────────────────────────────

  /**
   * Build Redis cache key for a user's daily briefing.
   * Pattern: {tenantId}:briefing:{userId}:{companyId}
   */
  getCacheKey(userId: string, companyId: string, tenantId: string): string {
    return `${tenantId}:briefing:${userId}:${companyId}`;
  }

  /**
   * Build Redis key pattern for all briefings in a company.
   * Pattern: {tenantId}:briefing:*:{companyId}
   */
  getCompanyCachePattern(companyId: string, tenantId: string): string {
    return `${tenantId}:briefing:*:${companyId}`;
  }

  /**
   * Generate a daily briefing for the given user.
   * Checks Redis cache first; returns cached if valid and forceRefresh is false.
   * Gathers role-appropriate data from the database, sends context
   * to the AI orchestrator, and parses the structured briefing response.
   *
   * Never throws — returns a degraded briefing on failure (IMP-006).
   */
  async generateBriefing(
    userId: string,
    companyId: string,
    tenantId: string,
    forceRefresh = false,
  ): Promise<DailyBriefing> {
    const cacheKey = this.getCacheKey(userId, companyId, tenantId);

    // 0. Check cache (unless forceRefresh)
    if (!forceRefresh) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          const briefing: DailyBriefing = JSON.parse(cached);
          // Staleness detection
          this.applyStalenessMark(briefing);
          this.logger.debug({ userId, companyId }, 'BriefingEngine: returning cached briefing');
          return briefing;
        }
      } catch (error) {
        this.logger.warn(
          { userId, companyId, error: (error as Error).message },
          'BriefingEngine: cache read failed — proceeding to generate',
        );
      }
    }

    let briefingRole: BriefingRole | undefined;

    try {
      // 1. Get user context for role resolution and personalisation
      const userContext = await this.contextEngine.getUserContext(userId, companyId, tenantId);

      // 2. Resolve user role to briefing role
      briefingRole = this.resolveRole(userContext.user.role);

      const context: AiRequestContext = {
        userId,
        companyId,
        tenantId,
        locale: userContext.preferences?.locale ?? 'en-GB',
      };

      // 3. Gather cross-module data based on role template
      const briefingContext = await this.gatherBriefingData(companyId, briefingRole, userContext);

      // 4. Build AI prompt for briefing generation
      const { systemPrompt, userMessage } = this.buildBriefingPrompt(briefingRole, briefingContext);

      // 5. Call orchestrator directly (inline prompt, no agent resolution)
      const aiResponse = await this.orchestrator.processDirect({
        systemPrompt,
        userMessage,
        routingTags: ['briefing'],
        context,
        intent: 'briefing',
      });

      // 6. Parse AI response into DailyBriefing
      const briefing = this.parseBriefingResponse(
        aiResponse.content ?? '{}',
        userId,
        briefingRole,
        userContext.user.name,
      );

      // 7. Store in Redis cache
      briefing.cachedAt = new Date().toISOString();
      try {
        await this.redis.set(cacheKey, JSON.stringify(briefing), 'EX', BRIEFING_CACHE_TTL);
        this.logger.debug({ userId, companyId }, 'BriefingEngine: briefing cached');
      } catch (cacheError) {
        this.logger.warn(
          { userId, companyId, error: (cacheError as Error).message },
          'BriefingEngine: failed to cache briefing — returning uncached',
        );
      }

      return briefing;
    } catch (error) {
      this.logger.warn(
        { userId, companyId, error: (error as Error).message },
        'BriefingEngine: failed to generate briefing — returning fallback',
      );

      return this.createFallbackBriefing(userId, briefingRole ?? 'ADMIN');
    }
  }

  // ─── Cache Invalidation ──────────────────────────────────────────────────

  /**
   * Invalidate a specific user's cached briefing.
   */
  async invalidateBriefing(userId: string, companyId: string, tenantId: string): Promise<void> {
    const cacheKey = this.getCacheKey(userId, companyId, tenantId);
    try {
      await this.redis.del(cacheKey);
      this.logger.debug({ userId, companyId }, 'BriefingEngine: invalidated user briefing cache');
    } catch (error) {
      this.logger.warn(
        { userId, companyId, error: (error as Error).message },
        'BriefingEngine: failed to invalidate user briefing cache',
      );
    }
  }

  /**
   * Invalidate all cached briefings for a company.
   * Used when bulk data changes (e.g., approval completed, invoice posted).
   * Uses SCAN to avoid blocking Redis with KEYS on large datasets.
   */
  async invalidateCompanyBriefings(companyId: string, tenantId: string): Promise<number> {
    const pattern = this.getCompanyCachePattern(companyId, tenantId);
    let deleted = 0;

    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redis.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== '0');

      this.logger.debug(
        { companyId, tenantId, deleted },
        'BriefingEngine: invalidated company briefing caches',
      );
    } catch (error) {
      this.logger.warn(
        { companyId, tenantId, error: (error as Error).message },
        'BriefingEngine: failed to invalidate company briefing caches',
      );
    }

    return deleted;
  }

  // ─── Staleness Detection ─────────────────────────────────────────────────

  /**
   * Check if a cached briefing is stale (older than 24h) and mark it.
   * Edge case: Redis TTL hasn't expired but briefing is logically stale.
   * Mutates the briefing in place for efficiency.
   */
  private applyStalenessMark(briefing: DailyBriefing): void {
    if (!briefing.cachedAt) {
      briefing.isStale = true;
      return;
    }

    const cachedTime = new Date(briefing.cachedAt).getTime();
    const now = Date.now();
    briefing.isStale = (now - cachedTime) >= STALENESS_THRESHOLD_MS;
  }

  // ─── Role Resolution ──────────────────────────────────────────────────────

  /**
   * Map user's resolved role to a BriefingRole.
   * Uses the user's system role as primary signal.
   * Fallback: ADMIN (most generic briefing template).
   */
  resolveRole(userRole: string): BriefingRole {
    return resolveRoleShared(userRole);
  }

  /**
   * Get the data categories for a given briefing role.
   */
  getRoleCategories(role: BriefingRole): string[] {
    return ROLE_TEMPLATES[role] ?? ROLE_TEMPLATES.ADMIN;
  }

  // ─── Cross-Module Data Gathering ──────────────────────────────────────────

  /**
   * Gather aggregate data from the database for briefing generation.
   * Uses safeModelQuery pattern — returns empty/default values when
   * business module models don't exist yet (pre-E14).
   *
   * All queries are scoped by companyId and capped to avoid excessive data.
   */
  async gatherBriefingData(
    companyId: string,
    role: BriefingRole,
    userContext: { user: { name: string; role: string }; tenant: { companyName: string; baseCurrency: string } },
  ): Promise<BriefingContext> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const context: BriefingContext = {
      pendingApprovals: 0,
      overdueInvoices: { count: 0, totalAmount: '0.00' },
      overdueBills: { count: 0, totalAmount: '0.00' },
      cashPosition: { totalBalance: '0.00', currency: userContext.tenant.baseCurrency, accountCount: 0 },
      upcomingPaymentRuns: 0,
      userName: userContext.user.name,
      userRole: userContext.user.role,
      companyName: userContext.tenant.companyName,
      currency: userContext.tenant.baseCurrency,
    };

    // Determine which data categories this role needs
    const categories = ROLE_TEMPLATES[role] ?? [];
    const needsInvoiceData = categories.some(c => c.includes('overdue') || c.includes('receivable') || c.includes('invoice') || c.includes('revenue'));
    const needsBillData = categories.some(c => c.includes('bill'));
    const needsCashData = categories.some(c => c.includes('cash'));
    const needsApprovalData = categories.some(c => c.includes('approval'));
    const needsPaymentRunData = categories.some(c => c.includes('payment'));

    // Overdue customer invoices
    if (needsInvoiceData) {
      try {
        const overdueInvoices = await this.safeModelQuery('customerInvoice', {
          where: {
            companyId,
            status: { in: ['SENT', 'OVERDUE'] },
            dueDate: { lt: today },
          },
          select: { id: true, totalAmount: true },
          take: MAX_RECORDS_PER_CATEGORY,
        });

        if (overdueInvoices && overdueInvoices.length > 0) {
          context.overdueInvoices.count = overdueInvoices.length;
          context.overdueInvoices.totalAmount = this.sumAmounts(
            overdueInvoices.map(inv => String(inv.totalAmount ?? '0')),
          );
        }
      } catch {
        this.logger.warn({ companyId }, 'BriefingEngine: CustomerInvoice model not available — overdue data empty');
      }
    }

    // Overdue supplier bills
    if (needsBillData) {
      try {
        const overdueBills = await this.safeModelQuery('supplierInvoice', {
          where: {
            companyId,
            status: { in: ['APPROVED', 'OVERDUE'] },
            dueDate: { lt: today },
          },
          select: { id: true, totalAmount: true },
          take: MAX_RECORDS_PER_CATEGORY,
        });

        if (overdueBills && overdueBills.length > 0) {
          context.overdueBills.count = overdueBills.length;
          context.overdueBills.totalAmount = this.sumAmounts(
            overdueBills.map(bill => String(bill.totalAmount ?? '0')),
          );
        }
      } catch {
        this.logger.warn({ companyId }, 'BriefingEngine: SupplierInvoice model not available — overdue bills data empty');
      }
    }

    // Cash position from bank accounts
    if (needsCashData) {
      try {
        const bankAccounts = await this.safeModelQuery('bankAccount', {
          where: {
            companyId,
            isActive: true,
          },
          select: { id: true, balance: true, currency: true },
          take: MAX_RECORDS_PER_CATEGORY,
        });

        if (bankAccounts && bankAccounts.length > 0) {
          const matchingAmounts: string[] = [];
          for (const account of bankAccounts) {
            const cur = String(account.currency ?? context.currency);
            if (cur === context.currency) {
              matchingAmounts.push(String(account.balance ?? '0'));
            }
          }
          context.cashPosition.accountCount = matchingAmounts.length;
          context.cashPosition.totalBalance = this.sumAmounts(matchingAmounts);
          context.cashPosition.currency = context.currency;
        }
      } catch {
        this.logger.warn({ companyId }, 'BriefingEngine: BankAccount model not available — cash position data empty');
      }
    }

    // Pending approvals (purchase orders awaiting approval)
    if (needsApprovalData) {
      try {
        const pendingPOs = await this.safeModelQuery('purchaseOrder', {
          where: {
            companyId,
            status: 'PENDING_APPROVAL',
          },
          select: { id: true },
          take: MAX_RECORDS_PER_CATEGORY,
        });

        if (pendingPOs) {
          context.pendingApprovals = pendingPOs.length;
        }
      } catch {
        this.logger.warn({ companyId }, 'BriefingEngine: PurchaseOrder model not available — approval data empty');
      }
    }

    // Upcoming payment runs (approved supplier invoices due within 7 days)
    if (needsPaymentRunData) {
      try {
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);

        const upcomingBills = await this.safeModelQuery('supplierInvoice', {
          where: {
            companyId,
            status: 'APPROVED',
            dueDate: { gte: today, lte: nextWeek },
          },
          select: { id: true },
          take: MAX_RECORDS_PER_CATEGORY,
        });

        if (upcomingBills) {
          context.upcomingPaymentRuns = upcomingBills.length;
        }
      } catch {
        this.logger.warn({ companyId }, 'BriefingEngine: SupplierInvoice model not available — payment run data empty');
      }
    }

    return context;
  }

  // ─── AI Prompt Building ───────────────────────────────────────────────────

  /**
   * Build the system and user prompts for briefing generation.
   * System prompt defines the role template and expected output format.
   * User message contains the gathered data as JSON.
   */
  buildBriefingPrompt(
    role: BriefingRole,
    context: BriefingContext,
  ): { systemPrompt: string; userMessage: string } {
    const categories = this.getRoleCategories(role);

    const systemPrompt = [
      'You are an AI business briefing assistant for an ERP system.',
      `Generate a personalised daily briefing for a user with the "${role}" role.`,
      '',
      'The briefing should focus on these categories:',
      ...categories.map((c) => `- ${c.replace(/_/g, ' ')}`),
      '',
      'Return your response as valid JSON with this exact structure:',
      '{',
      '  "summary": "1-2 sentence overview of the day",',
      '  "items": [',
      '    {',
      '      "id": "unique-id",',
      '      "title": "Short title",',
      '      "description": "Descriptive text with specific numbers",',
      '      "category": "category_name",',
      '      "priority": "high|medium|low",',
      '      "metric": {',
      '        "value": "£12,400",',
      '        "delta": "+12%",',
      '        "trend": "up|down|flat",',
      '        "comparisonPeriod": "vs last month"',
      '      },',
      '      "actions": [',
      '        {',
      '          "label": "Review",',
      '          "actionType": "navigate|approve|chase|dismiss",',
      '          "route": "/ar/invoices?status=overdue"',
      '        }',
      '      ],',
      '      "entityLink": {',
      '        "entityType": "CustomerInvoice",',
      '        "route": "/ar/invoices?status=overdue"',
      '      }',
      '    }',
      '  ]',
      '}',
      '',
      'Rules:',
      '- Each item MUST have: id, title, description, category, priority, and at least one action',
      '- Priority should reflect business impact (overdue = high, informational = low)',
      '- Actions should be specific and actionable (approve, chase, review, navigate)',
      '- Include route paths for navigation actions',
      '- Use real numbers from the provided data — do not invent data',
      '- If a data category has no items (count=0), either skip it or note "No items"',
      '- Format monetary values with currency symbol and commas',
      '- Generate 3-8 briefing items depending on available data',
    ].join('\n');

    // Build data lines conditional on which categories this role needs
    const dataLines: string[] = [];
    const needsInvoiceData = categories.some(c => c.includes('overdue') || c.includes('receivable') || c.includes('invoice') || c.includes('revenue'));
    const needsBillData = categories.some(c => c.includes('bill'));
    const needsCashData = categories.some(c => c.includes('cash'));
    const needsApprovalData = categories.some(c => c.includes('approval'));
    const needsPaymentRunData = categories.some(c => c.includes('payment'));

    if (needsInvoiceData) {
      dataLines.push(`Overdue Customer Invoices: ${context.overdueInvoices.count} invoices totalling ${context.currency} ${context.overdueInvoices.totalAmount}`);
    }
    if (needsBillData) {
      dataLines.push(`Overdue Supplier Bills: ${context.overdueBills.count} bills totalling ${context.currency} ${context.overdueBills.totalAmount}`);
    }
    if (needsCashData) {
      dataLines.push(`Cash Position: ${context.currency} ${context.cashPosition.totalBalance} across ${context.cashPosition.accountCount} account(s)`);
    }
    if (needsApprovalData) {
      dataLines.push(`Pending Approvals: ${context.pendingApprovals}`);
    }
    if (needsPaymentRunData) {
      dataLines.push(`Upcoming Payment Runs: ${context.upcomingPaymentRuns}`);
    }

    // Flag role-specific categories that have no data source yet
    const coveredCategories = new Set<string>();
    if (needsInvoiceData) { coveredCategories.add('overdue_invoices'); coveredCategories.add('overdue_receivables'); coveredCategories.add('revenue'); coveredCategories.add('overdue_invoices_own'); }
    if (needsBillData) { coveredCategories.add('overdue_bills'); }
    if (needsCashData) { coveredCategories.add('cash_position'); }
    if (needsApprovalData) { coveredCategories.add('approvals'); coveredCategories.add('approvals_finance'); }
    if (needsPaymentRunData) { coveredCategories.add('payment_runs'); }

    const unavailableCategories = categories.filter(c => !coveredCategories.has(c));
    if (unavailableCategories.length > 0) {
      dataLines.push('');
      dataLines.push(`Note: The following categories have no data available yet: ${unavailableCategories.join(', ')}. Do not fabricate data for these — mention them as "coming soon" or skip them.`);
    }

    const userMessage = [
      `Generate a daily briefing for ${context.userName} (${role} role) at ${context.companyName}.`,
      `Currency: ${context.currency}`,
      '',
      'Current business data:',
      '',
      ...dataLines,
    ].join('\n');

    return { systemPrompt, userMessage };
  }

  // ─── Response Parsing ─────────────────────────────────────────────────────

  /**
   * Parse the AI structured output into a typed DailyBriefing.
   * Validates each BriefingItem has required fields (title, category, priority, at least one action).
   * Skips malformed items with warning log (same pattern as PredictionService).
   */
  parseBriefingResponse(
    aiContent: string,
    userId: string,
    role: BriefingRole,
    userName: string,
  ): DailyBriefing {
    const now = new Date();
    const greeting = this.generateGreeting(userName, now);

    const briefing: DailyBriefing = {
      generatedAt: now.toISOString(),
      userId,
      role,
      greeting,
      summary: '',
      items: [],
    };

    let parsed: any;
    try {
      parsed = JSON.parse(aiContent);
    } catch {
      this.logger.warn('BriefingEngine: Failed to parse AI briefing response as JSON — returning empty briefing');
      briefing.summary = 'Unable to generate briefing summary at this time.';
      return briefing;
    }

    // Extract summary
    briefing.summary = typeof parsed.summary === 'string'
      ? parsed.summary
      : 'Your daily briefing is ready.';

    // Extract items array (may be at root or nested)
    const rawItems: any[] = Array.isArray(parsed.items)
      ? parsed.items
      : (Array.isArray(parsed) ? parsed : []);

    for (const raw of rawItems) {
      if (!this.isValidBriefingItem(raw)) {
        this.logger.warn({ raw }, 'BriefingEngine: Skipping malformed briefing item — missing required fields');
        continue;
      }

      const item: BriefingItem = {
        id: String(raw.id ?? randomUUID()),
        title: String(raw.title),
        description: String(raw.description),
        category: String(raw.category),
        priority: this.normalisePriority(raw.priority),
        actions: this.parseActions(raw.actions),
      };

      // Optional metric
      if (raw.metric && typeof raw.metric === 'object') {
        item.metric = {
          value: String(raw.metric.value ?? ''),
          delta: raw.metric.delta != null ? String(raw.metric.delta) : undefined,
          trend: this.normaliseTrend(raw.metric.trend),
          comparisonPeriod: raw.metric.comparisonPeriod != null ? String(raw.metric.comparisonPeriod) : undefined,
        };
      }

      // Optional entity link
      if (raw.entityLink && typeof raw.entityLink === 'object') {
        item.entityLink = {
          entityType: String(raw.entityLink.entityType ?? ''),
          entityId: raw.entityLink.entityId != null ? String(raw.entityLink.entityId) : undefined,
          route: String(raw.entityLink.route ?? ''),
        };
      }

      briefing.items.push(item);
    }

    return briefing;
  }

  // ─── Greeting Generation ──────────────────────────────────────────────────

  /**
   * Generate a time-of-day greeting for the user.
   */
  generateGreeting(userName: string, now: Date): string {
    const hour = now.getHours();
    const firstName = userName.split(' ')[0] ?? userName;

    if (hour < 12) return `Good morning, ${firstName}.`;
    if (hour < 17) return `Good afternoon, ${firstName}.`;
    return `Good evening, ${firstName}.`;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Sum decimal string values using BigInt arithmetic to preserve
   * Decimal(19,4) precision without floating-point errors.
   */
  private sumAmounts(values: string[]): string {
    const SCALE = 10000n; // 4 decimal places to match Decimal(19,4)
    let total = 0n;

    for (const v of values) {
      const trimmed = v.trim();
      if (trimmed === '' || trimmed === 'NaN') continue;

      const isNegative = trimmed.startsWith('-');
      const absStr = isNegative ? trimmed.slice(1) : trimmed;
      const dotIdx = absStr.indexOf('.');

      let intPart: string;
      let fracPart: string;
      if (dotIdx === -1) {
        intPart = absStr;
        fracPart = '0000';
      } else {
        intPart = absStr.slice(0, dotIdx);
        fracPart = absStr.slice(dotIdx + 1).padEnd(4, '0').slice(0, 4);
      }

      if (!/^\d+$/.test(intPart) || !/^\d+$/.test(fracPart)) continue;

      const scaledValue = BigInt(intPart) * SCALE + BigInt(fracPart);
      total += isNegative ? -scaledValue : scaledValue;
    }

    const isNegative = total < 0n;
    const absTotal = isNegative ? -total : total;
    const integerPart = absTotal / SCALE;
    const fractionalPart = absTotal % SCALE;
    const sign = isNegative ? '-' : '';
    return `${sign}${integerPart}.${fractionalPart.toString().padStart(4, '0')}`;
  }

  /**
   * Safely query a Prisma model that may not exist yet.
   * Returns the query result or null if the model doesn't exist.
   * Only allows models in the ALLOWED_BRIEFING_MODELS allowlist.
   */
  private async safeModelQuery(
    modelName: string,
    queryArgs: Record<string, unknown>,
  ): Promise<any[] | null> {
    if (!ALLOWED_BRIEFING_MODELS.has(modelName)) {
      this.logger.warn({ modelName }, 'BriefingEngine: Model not in allowlist — skipping query');
      return null;
    }

    const model = (this.db as any)[modelName];
    if (!model || typeof model.findMany !== 'function') {
      this.logger.warn({ modelName }, 'BriefingEngine: Model not available in Prisma client — graceful degradation');
      return null;
    }

    return model.findMany(queryArgs);
  }

  /**
   * Validate that a raw briefing item has all required fields.
   */
  private isValidBriefingItem(raw: any): boolean {
    return (
      raw != null &&
      typeof raw === 'object' &&
      raw.title != null &&
      raw.description != null &&
      raw.category != null &&
      raw.priority != null &&
      Array.isArray(raw.actions) &&
      raw.actions.length > 0
    );
  }

  /**
   * Parse actions array from raw AI response.
   * Validates each action has required fields.
   */
  private parseActions(rawActions: any[]): BriefingAction[] {
    if (!Array.isArray(rawActions)) return [];

    const actions: BriefingAction[] = [];
    for (const raw of rawActions) {
      if (!raw || typeof raw !== 'object' || !raw.label || !raw.actionType) {
        continue;
      }

      const validTypes = ['navigate', 'approve', 'chase', 'dismiss'];
      const actionType = validTypes.includes(raw.actionType)
        ? raw.actionType as BriefingAction['actionType']
        : 'navigate';

      const action: BriefingAction = {
        label: String(raw.label),
        actionType,
      };

      if (raw.route != null) action.route = String(raw.route);
      if (raw.entityType != null) action.entityType = String(raw.entityType);
      if (Array.isArray(raw.entityIds)) {
        action.entityIds = raw.entityIds.map((id: any) => String(id));
      }

      actions.push(action);
    }

    return actions;
  }

  /**
   * Normalise priority value to valid enum.
   */
  private normalisePriority(value: any): 'high' | 'medium' | 'low' {
    const s = String(value).toLowerCase();
    if (s === 'high') return 'high';
    if (s === 'low') return 'low';
    return 'medium';
  }

  /**
   * Normalise trend value to valid enum or undefined.
   */
  private normaliseTrend(value: any): 'up' | 'down' | 'flat' | undefined {
    if (value == null) return undefined;
    const s = String(value).toLowerCase();
    if (s === 'up') return 'up';
    if (s === 'down') return 'down';
    if (s === 'flat') return 'flat';
    return undefined;
  }

  /**
   * Create a fallback briefing when generation fails.
   * Returns a minimal briefing with an informational message.
   */
  private createFallbackBriefing(userId: string, role: BriefingRole): DailyBriefing {
    return {
      generatedAt: new Date().toISOString(),
      userId,
      role,
      greeting: 'Hello.',
      summary: 'Your daily briefing could not be generated at this time. Please try again later or use the traditional dashboard.',
      items: [
        {
          id: randomUUID(),
          title: 'Briefing Unavailable',
          description: 'The AI briefing service is temporarily unavailable. You can access all features through the standard navigation.',
          category: 'system',
          priority: 'low',
          actions: [
            {
              label: 'Go to Dashboard',
              actionType: 'navigate',
              route: '/',
            },
          ],
        },
      ],
    };
  }
}
