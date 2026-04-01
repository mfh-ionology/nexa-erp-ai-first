import { useMemo } from 'react';

import type { EntityTrigger } from './types';

export interface MentionDetectionResult {
  trigger: EntityTrigger;
  searchQuery: string;
  triggerStartIndex: number;
}

/**
 * Detects entity mentions in the input text using the '//' trigger character.
 *
 * The word before '//' determines entity type (scoped search), or if no match
 * is found, a universal search is performed.
 *
 * Examples: "customer //POL" → Customer search, "find //POL" → universal search.
 *
 * This is a pure synchronous computation — no API calls, no debouncing.
 * Uses useMemo to avoid recomputation when inputs haven't changed.
 */
export function useMentionDetection(
  triggerMap: Map<string, EntityTrigger>,
  inputText: string,
): { detected: MentionDetectionResult | null } {
  const detected = useMemo(() => detectMention(triggerMap, inputText), [triggerMap, inputText]);

  return { detected };
}

/**
 * Pure function that performs trigger detection using the // trigger character.
 * Exported separately for direct unit testing without React hooks.
 *
 * Algorithm:
 *   1. Find the last occurrence of '//' in the input text
 *   2. Extract the search query after '//' (must be >= 2 characters)
 *   3. Look at the word immediately before '//' to determine entity type
 *   4. If the word matches a trigger in the map, use that trigger (scoped search)
 *   5. If no match, return a universal search trigger
 *
 * Examples:
 *   - "customer //POL"  → Customer entity search for "POL"
 *   - "account //100"   → ChartOfAccount entity search for "100"
 *   - "find //POL"      → Universal search for "POL"
 *   - "hello world"     → null (no // trigger)
 */
export function detectMention(
  triggerMap: Map<string, EntityTrigger>,
  inputText: string,
): MentionDetectionResult | null {
  if (!inputText || triggerMap.size === 0) {
    return null;
  }

  // Find last occurrence of '//'
  const triggerIndex = inputText.lastIndexOf('//');
  if (triggerIndex === -1) {
    return null;
  }

  // Extract search query after '//'
  const searchQuery = inputText.substring(triggerIndex + 2).trimEnd();
  if (searchQuery.length < 2) {
    return null;
  }

  // Look at the word immediately before '//'
  const beforeTrigger = inputText.substring(0, triggerIndex).trimEnd();
  const lastSpaceIndex = beforeTrigger.lastIndexOf(' ');
  const contextWord =
    lastSpaceIndex === -1
      ? beforeTrigger.toLowerCase()
      : beforeTrigger.substring(lastSpaceIndex + 1).toLowerCase();

  // Try to match context word against trigger map
  const trigger = contextWord ? triggerMap.get(contextWord) : undefined;

  if (trigger) {
    return {
      trigger,
      searchQuery,
      triggerStartIndex: lastSpaceIndex === -1 ? 0 : lastSpaceIndex + 1,
    };
  }

  // No matching context word — universal search
  const universalTrigger: EntityTrigger = {
    id: '_universal',
    moduleKey: '_all',
    triggerWord: '//',
    entityType: '_universal',
    searchEndpoint: '/ai/entity-search',
    displayField: 'name',
    subtitleField: null,
    scopeBy: null,
    icon: null,
    priority: 0,
  };

  return {
    trigger: universalTrigger,
    searchQuery,
    triggerStartIndex: triggerIndex,
  };
}
