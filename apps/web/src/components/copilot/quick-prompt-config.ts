import type { QuickPromptConfig } from './types';

/**
 * Preset quick-prompt configurations for the Co-Pilot dock.
 *
 * Each entry specifies:
 *  - `labelKey`      — i18n key rendered on the chip
 *  - `promptKey`     — i18n key for the prompt text sent to the AI
 *  - `prompt`        — fallback English prompt text
 *  - `pagePatterns`  — glob-style route patterns where the prompt is relevant
 *  - `roles`         — roles that see this prompt (empty = all)
 *  - `timeRelevance` — time-of-day filter
 */
export const QUICK_PROMPTS: QuickPromptConfig[] = [
  // ── Global prompts (all roles, all pages) ───────────────────────────────
  {
    labelKey: 'copilot.prompt.dailyBriefing',
    promptKey: 'copilot.promptText.dailyBriefing',
    prompt: 'Give me my daily briefing',
    timeRelevance: 'any',
  },
  {
    labelKey: 'copilot.prompt.needsAttention',
    promptKey: 'copilot.promptText.needsAttention',
    prompt: "What needs my attention today?",
    timeRelevance: 'any',
  },

  // ── Owner / Manager prompts ─────────────────────────────────────────────
  {
    labelKey: 'copilot.prompt.revenueSummary',
    promptKey: 'copilot.promptText.revenueSummary',
    prompt: 'Show me a revenue summary',
    roles: ['OWNER', 'ADMIN', 'MANAGER'],
    timeRelevance: 'any',
  },
  {
    labelKey: 'copilot.prompt.cashFlowForecast',
    promptKey: 'copilot.promptText.cashFlowForecast',
    prompt: 'Show me the cash flow forecast',
    roles: ['OWNER', 'ADMIN', 'MANAGER'],
    timeRelevance: 'any',
  },

  // ── Finance / AR prompts ────────────────────────────────────────────────
  {
    labelKey: 'copilot.prompt.createInvoice',
    promptKey: 'copilot.promptText.createInvoice',
    prompt: 'Create a new invoice',
    pagePatterns: ['/ar/*', '/finance/*'],
    timeRelevance: 'any',
  },
  {
    labelKey: 'copilot.prompt.showOverdue',
    promptKey: 'copilot.promptText.showOverdue',
    prompt: 'Show overdue invoices',
    pagePatterns: ['/ar/*', '/finance/*'],
    timeRelevance: 'any',
  },
  {
    labelKey: 'copilot.prompt.bankRecStatus',
    promptKey: 'copilot.promptText.bankRecStatus',
    prompt: 'Show bank reconciliation status',
    pagePatterns: ['/finance/*'],
    timeRelevance: 'any',
  },

  // ── Sales prompts ──────────────────────────────────────────────────────
  {
    labelKey: 'copilot.prompt.createQuote',
    promptKey: 'copilot.promptText.createQuote',
    prompt: 'Create a new quote',
    pagePatterns: ['/sales/*'],
    timeRelevance: 'any',
  },
  {
    labelKey: 'copilot.prompt.pipelineSummary',
    promptKey: 'copilot.promptText.pipelineSummary',
    prompt: 'Show me the sales pipeline summary',
    pagePatterns: ['/sales/*', '/crm/*'],
    timeRelevance: 'any',
  },

  // ── Inventory prompts ──────────────────────────────────────────────────
  {
    labelKey: 'copilot.prompt.lowStock',
    promptKey: 'copilot.promptText.lowStock',
    prompt: 'Show low stock items',
    pagePatterns: ['/inventory/*'],
    timeRelevance: 'any',
  },
  {
    labelKey: 'copilot.prompt.stockValuation',
    promptKey: 'copilot.promptText.stockValuation',
    prompt: 'Show stock valuation',
    pagePatterns: ['/inventory/*'],
    timeRelevance: 'any',
  },

  // ── Morning prompts ────────────────────────────────────────────────────
  {
    labelKey: 'copilot.prompt.morningBriefing',
    promptKey: 'copilot.promptText.morningBriefing',
    prompt: 'Give me my morning briefing',
    timeRelevance: 'morning',
  },
];
