import { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

import { EntityAutocompleteDropdown } from './entity-autocomplete-dropdown';
import { EntityChip } from './entity-chip';
import type { EntityMention, EntitySearchResult } from './types';
import { useEntitySearch } from './use-entity-search';
import { useEntityTriggers } from './use-entity-triggers';
import { useMentionDetection } from './use-mention-detection';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EntityMentionInputProps {
  onSend: (text: string, mentions: EntityMention[]) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Accessible label for the textarea */
  inputAriaLabel?: string;
  /** Accessible label for the send button */
  sendAriaLabel?: string;
}

// ---------------------------------------------------------------------------
// EntityMentionInput
// ---------------------------------------------------------------------------

export function EntityMentionInput({
  onSend,
  disabled = false,
  placeholder,
  inputAriaLabel,
  sendAriaLabel = 'Send message',
}: EntityMentionInputProps) {
  // -- State --
  const [inputText, setInputText] = useState('');
  const [mentions, setMentions] = useState<EntityMention[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Dismissed tracks whether the user explicitly closed the autocomplete (Escape).
  // Resets whenever the detected trigger/query changes.
  const [dismissed, setDismissed] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  // -- Hooks --
  const { triggerMap } = useEntityTriggers();
  const { detected } = useMentionDetection(triggerMap, inputText);

  // Derive scope from existing mentions (subtask 8.3)
  const scopeBy = detected?.trigger.scopeBy ?? undefined;
  const scopeEntity = scopeBy
    ? mentions.find((m) => {
        // Map scopeBy field (e.g. "customerId") to entity type (e.g. "Customer")
        const expectedType = scopeBy.replace(/Id$/, '');
        return m.type.toLowerCase() === expectedType.toLowerCase();
      })
    : undefined;

  const { results, isLoading } = useEntitySearch({
    type: detected?.trigger.entityType ?? null,
    q: detected?.searchQuery ?? '',
    scopeBy: scopeEntity ? scopeBy : undefined,
    scopeValue: scopeEntity?.id,
  });

  // Reset dismissed flag when detection changes (new trigger or query)
  const detectedKey = detected ? `${detected.trigger.triggerWord}:${detected.searchQuery}` : null;
  useEffect(() => {
    setDismissed(false);
    setSelectedIndex(0);
  }, [detectedKey]);

  // Autocomplete is visible when there is detection AND user hasn't dismissed
  const showAutocomplete = detected !== null && !dismissed;

  // -- Handlers --

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputText(value);

    // Auto-resize textarea
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 96).toString()}px`;
  }, []);

  const handleSelectEntity = useCallback(
    (result: EntitySearchResult) => {
      // Add to mentions (subtask 8.4)
      const mention: EntityMention = {
        id: result.id,
        type: result.entityType,
        name: result.displayName,
        subtitle: result.subtitle ?? undefined,
      };
      setMentions((prev) => (prev.some((m) => m.id === mention.id) ? prev : [...prev, mention]));

      // Replace trigger word + search text with {id : displayName} so the AI model sees the reference inline
      if (detected) {
        const before = inputText.slice(0, detected.triggerStartIndex).trimEnd();
        const replacement = `{${result.id} : ${result.displayName}}`;
        setInputText(before ? `${before} ${replacement} ` : `${replacement} `);
      }

      setDismissed(true);
      setSelectedIndex(0);
      inputRef.current?.focus();
    },
    [detected, inputText],
  );

  const handleRemoveEntity = useCallback((id: string) => {
    setMentions((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text && mentions.length === 0) return;

    // subtask 8.8 — pass mentions alongside text
    onSend(text, mentions);
    setInputText('');
    setMentions([]);
    setDismissed(false);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [inputText, mentions, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Keyboard navigation when autocomplete is visible (subtask 8.6)
      if (showAutocomplete) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
          return;
        }
        if (e.key === 'Enter' && results.length > 0) {
          e.preventDefault();
          const selected = results[selectedIndex];
          if (selected) handleSelectEntity(selected);
          return;
        }
        if (e.key === 'Tab' && results.length > 0) {
          e.preventDefault();
          const first = results[0];
          if (first) handleSelectEntity(first);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setDismissed(true);
          return;
        }
      }

      // Backspace removes last entity chip if input is empty (subtask 8.5)
      if (e.key === 'Backspace' && inputText === '' && mentions.length > 0) {
        e.preventDefault();
        setMentions((prev) => prev.slice(0, -1));
        return;
      }

      // Send message on Enter (no Shift, no autocomplete)
      if (e.key === 'Enter' && !e.shiftKey && !showAutocomplete) {
        e.preventDefault();
        handleSend();
      }
    },
    [
      showAutocomplete,
      results,
      selectedIndex,
      inputText,
      mentions.length,
      handleSelectEntity,
      handleSend,
    ],
  );

  const contextScopeLabel = scopeEntity?.name;
  const isEmpty = !inputText.trim() && mentions.length === 0;

  // -- Render (subtask 8.7) --
  return (
    <div className="relative">
      {/* Autocomplete dropdown */}
      {showAutocomplete && detected && (
        <EntityAutocompleteDropdown
          results={results}
          loading={isLoading}
          selectedIndex={selectedIndex}
          entityType={detected.trigger.entityType}
          contextScope={contextScopeLabel}
          onSelect={handleSelectEntity}
          onClose={() => setDismissed(true)}
          isMobile={isMobile}
        />
      )}

      {/* Entity chips + text input */}
      <div
        className={cn(
          'flex flex-wrap items-end gap-1.5 rounded-xl border border-border bg-background px-3 py-2 transition-shadow',
          'focus-within:ring-2 focus-within:ring-[#7c3aed]/30 focus-within:border-[#7c3aed]',
          disabled && 'opacity-50 pointer-events-none',
        )}
      >
        {mentions.map((entity) => (
          <EntityChip
            key={entity.id}
            entity={entity}
            onRemove={() => handleRemoveEntity(entity.id)}
          />
        ))}
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            placeholder ??
            (mentions.length > 0
              ? 'Continue typing...'
              : "Ask anything... (type 'invoice', 'contact' to mention)")
          }
          aria-label={inputAriaLabel}
          rows={1}
          className="min-h-[24px] max-h-[96px] flex-1 resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground outline-none"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isEmpty || disabled}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#7c3aed] text-white transition-colors hover:bg-[#6d28d9] disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={sendAriaLabel}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
