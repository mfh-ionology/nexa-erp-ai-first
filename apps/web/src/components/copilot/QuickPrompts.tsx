import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';
import { useCopilotStore } from '@/stores/copilot-store';

import { useI18n } from '@nexa/i18n';

import { QUICK_PROMPTS } from './quick-prompt-config';

// ── Helpers ──────────────────────────────────────────────────────────────────

type TimeOfDay = 'morning' | 'afternoon' | 'evening';

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Simple glob-style matcher supporting trailing `*` wildcards.
 * e.g. `/ar/*` matches `/ar/invoices`, `/ar/invoices/123`, etc.
 */
function matchPattern(pattern: string, route: string): boolean {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1); // "/ar/"
    return route.startsWith(prefix) || route === pattern.slice(0, -2);
  }
  return route === pattern;
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * QuickPrompts — horizontal scrollable row of context-aware prompt chips.
 *
 * Chips are filtered by:
 *  - User role (from auth store)
 *  - Current page route (from copilot store context)
 *  - Time of day
 *
 * On click the prompt text is submitted as a user message and the Co-Pilot
 * drawer opens (if closed).
 */
export function QuickPrompts() {
  const { t } = useI18n();
  const role = useAuthStore((s) => s.permissions?.role ?? '');
  const pageRoute = useCopilotStore((s) => s.currentContext?.pageRoute ?? '');
  const submitUserMessage = useCopilotStore((s) => s.submitUserMessage);

  const timeOfDay = getTimeOfDay();

  const filteredPrompts = useMemo(() => {
    return QUICK_PROMPTS.filter((prompt) => {
      // Role filter: if roles specified, user must match one
      if (prompt.roles && prompt.roles.length > 0) {
        if (!prompt.roles.includes(role.toUpperCase())) {
          return false;
        }
      }

      // Page filter: if pagePatterns specified, current route must match one
      if (prompt.pagePatterns && prompt.pagePatterns.length > 0) {
        if (!pageRoute || !prompt.pagePatterns.some((p) => matchPattern(p, pageRoute))) {
          return false;
        }
      }

      // Time-of-day filter
      if (prompt.timeRelevance && prompt.timeRelevance !== 'any') {
        if (prompt.timeRelevance !== timeOfDay) {
          return false;
        }
      }

      return true;
    });
  }, [role, pageRoute, timeOfDay]);

  const handleChipClick = (cfg: (typeof filteredPrompts)[number]) => {
    // Resolve the i18n prompt text; fall back to the English prompt string
    const resolvedPrompt = cfg.promptKey ? t(cfg.promptKey) : cfg.prompt;
    submitUserMessage(resolvedPrompt);
  };

  if (filteredPrompts.length === 0) {
    return null;
  }

  return (
    <div
      className="shrink-0 border-t border-border px-4 py-2"
      aria-label={t('copilot.quickPrompts')}
    >
      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {t('copilot.quickPrompts')}
      </span>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {filteredPrompts.map((prompt) => (
          <Badge
            key={prompt.labelKey}
            variant="secondary"
            className="shrink-0 cursor-pointer select-none whitespace-nowrap bg-[#ede9fe] text-[#6d28d9] hover:bg-[#ddd6fe] rounded-full text-sm font-medium px-3 py-1"
            role="button"
            tabIndex={0}
            onClick={() => handleChipClick(prompt)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleChipClick(prompt);
              }
            }}
          >
            {t(prompt.labelKey)}
          </Badge>
        ))}
      </div>
    </div>
  );
}
