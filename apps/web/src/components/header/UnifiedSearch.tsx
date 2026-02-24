/**
 * Unified Search / Command Palette component.
 *
 * Cmd+K (Mac) / Ctrl+K (Windows) opens a combined search + AI command palette
 * in the header bar. Results are grouped into three sections:
 *   1. Entities — matching records (placeholder for MVP, real API in E7)
 *   2. Pages — fuzzy-matched against sidebar navigation items
 *   3. Ask AI — natural language prompts sent to the Co-Pilot drawer
 *
 * Self-contained: reads route + auth context from stores.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { FileText, Layout, Search, Sparkles } from 'lucide-react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';
import type { SearchResultItem } from '@/components/copilot/types';
import { useCopilotStore } from '@/stores/copilot-store';

import { useI18n } from '@nexa/i18n';

import { useSearchInputType } from './use-search-input-type';
import {
  getAiSuggestions,
  getEntityResultPlaceholders,
  getPageResults,
} from './search-results';

// ── Rotating placeholder hints ────────────────────────────────────────────────

const ROTATING_HINT_KEYS = [
  'search.rotatingHint1',
  'search.rotatingHint2',
  'search.rotatingHint3',
] as const;

const HINT_INTERVAL_MS = 4_000;

function useRotatingHint(t: (key: string) => string, isActive: boolean) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % ROTATING_HINT_KEYS.length);
    }, HINT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isActive]);

  return t(ROTATING_HINT_KEYS[index] ?? ROTATING_HINT_KEYS[0]);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UnifiedSearch() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const submitUserMessage = useCopilotStore((s) => s.submitUserMessage);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { type: inputType } = useSearchInputType(query);
  const isFocusedEmpty = isOpen && !query.trim();
  const rotatingHint = useRotatingHint(t, isFocusedEmpty);

  // ── Keyboard shortcut: Cmd+K / Ctrl+K ────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        // Focus the input after the popover opens
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Compute results (pass t for i18n) ──────────────────────────────────────
  const entityResults =
    inputType === 'entity' ? getEntityResultPlaceholders(query, t) : [];
  const pageResults =
    inputType === 'page' || inputType === 'entity'
      ? getPageResults(query)
      : inputType === 'empty'
        ? []
        : getPageResults(query);
  const aiSuggestions =
    inputType === 'ai' ? getAiSuggestions(query, t) : [];

  const hasResults =
    entityResults.length > 0 ||
    pageResults.length > 0 ||
    aiSuggestions.length > 0;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  const handlePageSelect = useCallback(
    (item: SearchResultItem) => {
      if (item.href) {
        void navigate({ to: item.href });
      }
      handleClose();
    },
    [navigate, handleClose],
  );

  const handleAiSelect = useCallback(
    (prompt: string) => {
      handleClose();
      submitUserMessage(prompt);
    },
    [handleClose, submitUserMessage],
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverAnchor asChild>
        <div
          className="relative w-full max-w-md cursor-pointer"
          onClick={() => {
            setIsOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="unified-search-results"
          aria-label={t('search.ariaLabel')}
          aria-haspopup="listbox"
        >
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <div
            className="flex h-9 w-full items-center rounded-md border border-input bg-transparent pl-9 pr-3 text-sm text-muted-foreground"
          >
            {t('search.placeholder')}
            <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
              <span className="text-xs">&#8984;</span>K
            </kbd>
          </div>
        </div>
      </PopoverAnchor>

      <PopoverContent
        id="unified-search-results"
        className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={handleClose}
      >
        <Command shouldFilter={false}>
          <CommandInput
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            placeholder={isFocusedEmpty ? rotatingHint : t('search.placeholder')}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                handleClose();
              }
            }}
          />

          <CommandList>
            {!hasResults && query.trim() && (
              <CommandEmpty>{t('search.noResults')}</CommandEmpty>
            )}

            {/* ── Entity results ─────────────────────────────────── */}
            {entityResults.length > 0 && (
              <CommandGroup heading={t('search.entities')}>
                {entityResults.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => handlePageSelect(item)}
                    disabled
                    className="opacity-60"
                  >
                    <FileText className="size-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{item.label}</span>
                      {item.description && (
                        <span className="text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {t('search.entitySearchComingSoon')}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {entityResults.length > 0 && pageResults.length > 0 && (
              <CommandSeparator />
            )}

            {/* ── Page results ───────────────────────────────────── */}
            {pageResults.length > 0 && (
              <CommandGroup heading={t('search.pages')}>
                {pageResults.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => handlePageSelect(item)}
                  >
                    {item.icon ? (
                      <item.icon className="size-4 text-muted-foreground" />
                    ) : (
                      <Layout className="size-4 text-muted-foreground" />
                    )}
                    <span>{item.labelKey ? t(item.labelKey) : item.label}</span>
                    {item.href && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {item.href}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {(entityResults.length > 0 || pageResults.length > 0) &&
              aiSuggestions.length > 0 && <CommandSeparator />}

            {/* ── AI suggestions ─────────────────────────────────── */}
            {aiSuggestions.length > 0 && (
              <CommandGroup heading={t('search.askAi')}>
                {aiSuggestions.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() =>
                      handleAiSelect(item.aiPrompt ?? item.label)
                    }
                  >
                    <Sparkles className="size-4 text-primary" />
                    <span>&ldquo;{item.label}&rdquo;</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* ── Send as AI command (fallback for non-empty input) ─ */}
            {query.trim() && inputType !== 'entity' && (
              <>
                {hasResults && <CommandSeparator />}
                <CommandGroup>
                  <CommandItem
                    value="send-ai-query"
                    onSelect={() => handleAiSelect(query.trim())}
                  >
                    <Sparkles className="size-4 text-primary" />
                    <span>
                      {t('search.askAi')}: &ldquo;{query.trim()}&rdquo;
                    </span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
