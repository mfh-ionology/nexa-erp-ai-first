import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { ContextEngine } from './context-engine.js';
import { resolveRole as resolveRoleShared, type SuggestionChip, type SmartSuggestions, type BriefingRole } from './ai.types.js';
import type { EffectivePermissions } from '../core/rbac/permission.types.js';
import type { PermissionService } from '../core/rbac/permission.service.js';

// ─── Page Route → Suggestion Mapping ──────────────────────────────────────

/** Internal suggestion definition with optional module metadata for RBAC filtering */
type SuggestionDef = Omit<SuggestionChip, 'id'> & { requiredModule?: string };

interface PageSuggestionDef {
  pattern: RegExp;
  suggestions: SuggestionDef[];
}

const PAGE_SUGGESTIONS: PageSuggestionDef[] = [
  {
    pattern: /^\/ar\/customers\/[^/]+$/,
    suggestions: [
      { label: 'Invoice this customer', prompt: 'Create an invoice for this customer', category: 'action', icon: 'receipt', priority: 10, requiredModule: 'ar' },
      { label: 'Show payment history', prompt: 'Show payment history for this customer', category: 'query', icon: 'history', priority: 20, requiredModule: 'ar' },
      { label: 'Credit check', prompt: 'Run a credit check on this customer', category: 'query', icon: 'shield-check', priority: 30, requiredModule: 'ar' },
      { label: 'View outstanding', prompt: 'Show all outstanding invoices for this customer', category: 'query', icon: 'alert-circle', priority: 40, requiredModule: 'ar' },
    ],
  },
  {
    pattern: /^\/ar\/invoices\/?$/,
    suggestions: [
      { label: 'Show overdue', prompt: 'Show all overdue invoices', category: 'query', icon: 'clock', priority: 10, requiredModule: 'ar' },
      { label: 'Create invoice', prompt: 'Create a new invoice', category: 'action', icon: 'plus', priority: 20, requiredModule: 'ar' },
      { label: 'Export all', prompt: 'Export all invoices', category: 'action', icon: 'download', priority: 30, requiredModule: 'ar' },
      { label: 'Send statements', prompt: 'Send customer statements', category: 'action', icon: 'send', priority: 40, requiredModule: 'ar' },
    ],
  },
  {
    pattern: /^\/ap\/suppliers\/[^/]+$/,
    suggestions: [
      { label: 'Create PO', prompt: 'Create a purchase order for this supplier', category: 'action', icon: 'shopping-cart', priority: 10, requiredModule: 'ap' },
      { label: 'Show outstanding bills', prompt: 'Show all outstanding bills for this supplier', category: 'query', icon: 'file-text', priority: 20, requiredModule: 'ap' },
      { label: 'Payment history', prompt: 'Show payment history for this supplier', category: 'query', icon: 'history', priority: 30, requiredModule: 'ap' },
    ],
  },
  {
    pattern: /^\/$/,
    suggestions: [
      { label: 'Morning briefing', prompt: 'Show my daily briefing', category: 'query', icon: 'sun', priority: 10 },
      { label: 'What needs my attention?', prompt: 'What needs my attention today?', category: 'query', icon: 'bell', priority: 20 },
      { label: 'Revenue this month', prompt: 'Show revenue summary for this month', category: 'query', icon: 'trending-up', priority: 30, requiredModule: 'finance' },
    ],
  },
];

/** Fallback suggestions for unrecognised list pages */
const GENERIC_LIST_SUGGESTIONS: SuggestionDef[] = [
  { label: 'Create new', prompt: 'Create a new record', category: 'action', icon: 'plus', priority: 50 },
  { label: 'Export', prompt: 'Export this list', category: 'action', icon: 'download', priority: 60 },
  { label: 'Show summary', prompt: 'Show a summary of this data', category: 'query', icon: 'bar-chart', priority: 70 },
];

// ─── Role → Suggestion Mapping ────────────────────────────────────────────

const ROLE_SUGGESTIONS: Record<BriefingRole, SuggestionDef[]> = {
  FINANCE: [
    { label: 'Bank reconciliation', prompt: 'Show bank reconciliation status', category: 'query', icon: 'landmark', priority: 100, requiredModule: 'finance' },
    { label: 'Month-end status', prompt: 'Show month-end closing status', category: 'query', icon: 'calendar', priority: 110, requiredModule: 'finance' },
    { label: 'Cash flow forecast', prompt: 'Generate a cash flow forecast', category: 'query', icon: 'trending-up', priority: 120, requiredModule: 'finance' },
  ],
  SALES: [
    { label: 'Pipeline summary', prompt: 'Show sales pipeline summary', category: 'query', icon: 'funnel', priority: 100, requiredModule: 'sales' },
    { label: 'New leads', prompt: 'Show new leads this week', category: 'query', icon: 'users', priority: 110, requiredModule: 'crm' },
    { label: 'Revenue report', prompt: 'Generate revenue report', category: 'query', icon: 'bar-chart', priority: 120, requiredModule: 'finance' },
  ],
  OWNER: [
    { label: 'Business overview', prompt: 'Show business overview', category: 'query', icon: 'layout-dashboard', priority: 100 },
    { label: 'Anomaly check', prompt: 'Check for anomalies in recent transactions', category: 'query', icon: 'alert-triangle', priority: 110 },
    { label: 'Team activity', prompt: 'Show team activity summary', category: 'query', icon: 'users', priority: 120 },
  ],
  ADMIN: [
    { label: 'Business overview', prompt: 'Show business overview', category: 'query', icon: 'layout-dashboard', priority: 100 },
    { label: 'Anomaly check', prompt: 'Check for anomalies in recent transactions', category: 'query', icon: 'alert-triangle', priority: 110 },
    { label: 'Team activity', prompt: 'Show team activity summary', category: 'query', icon: 'users', priority: 120 },
  ],
  HR: [
    { label: 'Leave requests', prompt: 'Show pending leave requests', category: 'query', icon: 'calendar-off', priority: 100, requiredModule: 'hr' },
    { label: 'Headcount report', prompt: 'Show current headcount report', category: 'query', icon: 'users', priority: 110, requiredModule: 'hr' },
    { label: 'Payroll status', prompt: 'Show payroll status', category: 'query', icon: 'wallet', priority: 120, requiredModule: 'hr' },
  ],
  WAREHOUSE: [
    { label: 'Low stock alerts', prompt: 'Show items with low stock levels', category: 'query', icon: 'alert-triangle', priority: 100, requiredModule: 'inventory' },
    { label: 'Pending deliveries', prompt: 'Show pending deliveries', category: 'query', icon: 'truck', priority: 110, requiredModule: 'inventory' },
    { label: 'Picking queue', prompt: 'Show current picking queue', category: 'query', icon: 'list-checks', priority: 120, requiredModule: 'inventory' },
  ],
};

// ─── Time-of-Day → Suggestion Mapping ─────────────────────────────────────

interface TimeSuggestionDef {
  test: (hour: number) => boolean;
  suggestions: SuggestionDef[];
}

const TIME_SUGGESTIONS: TimeSuggestionDef[] = [
  {
    test: (h) => h < 12,
    suggestions: [
      { label: 'Daily briefing', prompt: 'Show my daily briefing', category: 'query', icon: 'sun', priority: 200 },
      { label: 'What happened overnight?', prompt: 'What happened overnight?', category: 'query', icon: 'moon', priority: 210 },
    ],
  },
  {
    test: (h) => h >= 12 && h < 17,
    suggestions: [
      { label: 'Summary so far today', prompt: 'Show a summary of today so far', category: 'query', icon: 'clock', priority: 200 },
      { label: 'Pending actions', prompt: 'What actions are pending?', category: 'query', icon: 'check-circle', priority: 210 },
    ],
  },
  {
    test: (h) => h >= 17,
    suggestions: [
      { label: 'Day summary', prompt: 'Show a summary of today', category: 'query', icon: 'sunset', priority: 200 },
      { label: "Tomorrow's schedule", prompt: "What's on the schedule for tomorrow?", category: 'query', icon: 'calendar', priority: 210 },
    ],
  },
];

// ─── SuggestionsService ───────────────────────────────────────────────────

export class SuggestionsService {
  constructor(
    private db: PrismaClient,
    private contextEngine: ContextEngine,
    private permissions: PermissionService,
    private logger: Logger,
  ) {}

  /**
   * Get contextual smart suggestions based on page route, role, and time of day.
   * Suggestions are deterministic (not AI-generated) for fast, predictable results.
   *
   * Never throws — returns empty suggestions on failure.
   */
  async getSuggestions(params: {
    userId: string;
    companyId: string;
    tenantId: string;
    entityType?: string;
    entityId?: string;
    pageRoute?: string;
  }): Promise<SmartSuggestions> {
    const { userId, companyId, tenantId, entityType, entityId, pageRoute } = params;

    try {
      // 1. Get user context for role resolution
      const userContext = await this.contextEngine.getUserContext(userId, companyId, tenantId);
      const briefingRole = this.resolveRole(userContext.user.role);

      // 2. Gather all suggestion sources
      const pageSuggestions = this.getPageSuggestions(pageRoute);
      const roleSuggestions = this.getRoleSuggestions(briefingRole);
      const timeSuggestions = this.getTimeSuggestions(new Date());

      // 3. Load agent preset prompts
      const agentPresets = await this.loadAgentPresetPrompts();

      // 4. Merge all suggestions
      let allSuggestions = [
        ...pageSuggestions,
        ...roleSuggestions,
        ...timeSuggestions,
        ...agentPresets,
      ];

      // 5. Deduplicate by prompt text
      allSuggestions = this.deduplicateByPrompt(allSuggestions);

      // 6. Apply RBAC filtering
      allSuggestions = await this.filterByPermissions(
        allSuggestions,
        userId,
        companyId,
        userContext.user.role,
      );

      // 7. Sort by priority (lower = higher priority)
      allSuggestions.sort((a, b) => a.priority - b.priority);

      return {
        entityType,
        entityId,
        pageRoute,
        suggestions: allSuggestions,
      };
    } catch (error) {
      this.logger.warn(
        { userId, companyId, error: (error as Error).message },
        'SuggestionsService: failed to generate suggestions — returning empty',
      );
      return {
        entityType,
        entityId,
        pageRoute,
        suggestions: [],
      };
    }
  }

  // ─── Page-Based Suggestions ───────────────────────────────────────────

  /**
   * Map the current page route to relevant suggestion chips.
   * Returns specific suggestions for known pages, generic suggestions for list pages.
   */
  getPageSuggestions(pageRoute?: string): SuggestionChip[] {
    if (!pageRoute) return [];

    // Check known page patterns
    for (const def of PAGE_SUGGESTIONS) {
      if (def.pattern.test(pageRoute)) {
        return def.suggestions.map((s) => ({ ...s, id: randomUUID() }));
      }
    }

    // Fallback: generic list page suggestions for any list-like route
    if (pageRoute.match(/^\/[a-z]+\/[a-z]+\/?$/)) {
      return GENERIC_LIST_SUGGESTIONS.map((s) => ({ ...s, id: randomUUID() }));
    }

    return [];
  }

  // ─── Role-Based Suggestions ───────────────────────────────────────────

  /**
   * Add role-specific suggestion chips based on the user's briefing role.
   */
  getRoleSuggestions(role: BriefingRole): SuggestionChip[] {
    const defs = ROLE_SUGGESTIONS[role] ?? [];
    return defs.map((s) => ({ ...s, id: randomUUID() }));
  }

  // ─── Time-Based Suggestions ───────────────────────────────────────────

  /**
   * Adjust suggestions by time of day.
   */
  getTimeSuggestions(now: Date): SuggestionChip[] {
    const hour = now.getHours();

    for (const def of TIME_SUGGESTIONS) {
      if (def.test(hour)) {
        return def.suggestions.map((s) => ({ ...s, id: randomUUID() }));
      }
    }

    return [];
  }

  // ─── Agent Preset Prompt Loading ──────────────────────────────────────

  /**
   * Load preset prompts from active AiAgent triggerConfig entries.
   * Agents with `triggerConfig.presetPrompts` contribute suggestion chips.
   * Gracefully returns empty if AiAgent model is unavailable.
   */
  async loadAgentPresetPrompts(): Promise<SuggestionChip[]> {
    try {
      const model = (this.db as any).aiAgent;
      if (!model || typeof model.findMany !== 'function') {
        this.logger.debug('SuggestionsService: AiAgent model not available — skipping preset prompts');
        return [];
      }

      const agents = await model.findMany({
        where: { isActive: true },
        select: {
          name: true,
          triggerConfig: true,
        },
      });

      const suggestions: SuggestionChip[] = [];

      for (const agent of agents) {
        const config = agent.triggerConfig as Record<string, unknown> | null;
        if (!config || typeof config !== 'object') continue;

        const presetPrompts = config.presetPrompts;
        if (!Array.isArray(presetPrompts)) continue;

        for (const preset of presetPrompts) {
          if (!preset || typeof preset !== 'object') continue;
          const p = preset as Record<string, unknown>;

          if (typeof p.label !== 'string' || typeof p.prompt !== 'string') continue;

          suggestions.push({
            id: randomUUID(),
            label: p.label,
            prompt: p.prompt,
            category: (p.category as SuggestionChip['category']) ?? 'action',
            icon: typeof p.icon === 'string' ? p.icon : undefined,
            priority: typeof p.priority === 'number' ? p.priority : 300,
          });
        }
      }

      return suggestions;
    } catch (error) {
      this.logger.warn(
        { error: (error as Error).message },
        'SuggestionsService: failed to load agent preset prompts — returning empty',
      );
      return [];
    }
  }

  // ─── RBAC Filtering ───────────────────────────────────────────────────

  /**
   * Filter suggestions by user permissions.
   * Removes suggestions that link to modules the user cannot access.
   * Uses in-memory permission check from PermissionService cache.
   */
  async filterByPermissions(
    suggestions: SuggestionChip[],
    userId: string,
    companyId: string,
    userRole: string,
  ): Promise<SuggestionChip[]> {
    let effective: EffectivePermissions;
    try {
      effective = await this.permissions.getEffectivePermissions(
        this.db,
        userId,
        companyId,
        userRole,
      );
    } catch (error) {
      this.logger.warn(
        { userId, companyId, error: (error as Error).message },
        'SuggestionsService: failed to load permissions — returning all suggestions unfiltered',
      );
      return suggestions;
    }

    // SUPER_ADMIN sees everything
    if (effective.isSuperAdmin) return suggestions;

    const enabledModules = new Set(effective.enabledModules);

    return suggestions.filter((s) => {
      const requiredModule = this.getRequiredModule(s);
      if (!requiredModule) return true; // No module requirement — always show
      return enabledModules.has(requiredModule);
    });
  }

  /**
   * Read the required module from suggestion metadata.
   * Metadata is carried through from SuggestionDef via object spread.
   */
  private getRequiredModule(suggestion: SuggestionChip): string | null {
    return (suggestion as SuggestionChip & { requiredModule?: string }).requiredModule ?? null;
  }

  // ─── Deduplication ────────────────────────────────────────────────────

  /**
   * Deduplicate suggestions by prompt text.
   * Keeps the first (highest priority) occurrence of each unique prompt.
   */
  private deduplicateByPrompt(suggestions: SuggestionChip[]): SuggestionChip[] {
    // Sort by priority first so we keep the highest-priority version
    const sorted = [...suggestions].sort((a, b) => a.priority - b.priority);
    const seen = new Set<string>();
    const result: SuggestionChip[] = [];

    for (const s of sorted) {
      const key = s.prompt.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(s);
      }
    }

    return result;
  }

  // ─── Role Resolution ──────────────────────────────────────────────────

  private resolveRole(userRole: string): BriefingRole {
    return resolveRoleShared(userRole);
  }
}
