import type { LucideIcon } from 'lucide-react';

// Re-export chat types from copilot store
export type {
  ChatMessage,
  ChatMessageAction,
  ChatRecordLink,
  ActionProposal,
  ChatSession,
  CopilotPageContext,
} from '@/stores/copilot-store';

// ── Quick Prompt configuration ───────────────────────────────────────────────

export interface QuickPromptConfig {
  /** i18n key for the prompt label */
  labelKey: string;
  /** i18n key for the prompt text sent to the AI (resolves to localised text) */
  promptKey: string;
  /** Fallback English prompt text (used when i18n is unavailable) */
  prompt: string;
  /** Which page routes this prompt is relevant for (glob patterns) */
  pagePatterns?: string[];
  /** Which roles this prompt is visible for (empty = all roles) */
  roles?: string[];
  /** Time-of-day relevance: 'morning' | 'afternoon' | 'evening' | 'any' */
  timeRelevance?: 'morning' | 'afternoon' | 'evening' | 'any';
}

// ── Unified Search types ─────────────────────────────────────────────────────

export type SearchResultCategory = 'entity' | 'page' | 'ai';

export interface SearchResultItem {
  id: string;
  category: SearchResultCategory;
  label: string;
  /** i18n key for entity type or page name */
  labelKey?: string;
  description?: string;
  icon?: LucideIcon;
  /** Navigation URL for entity/page results */
  href?: string;
  /** AI prompt text for AI suggestion results */
  aiPrompt?: string;
}
