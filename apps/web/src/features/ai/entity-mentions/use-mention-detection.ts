import { useMemo } from 'react';

import type { EntityTrigger } from './types';

export interface MentionDetectionResult {
  trigger: EntityTrigger;
  searchQuery: string;
  triggerStartIndex: number;
}

/**
 * Detects entity trigger words in the input text and extracts the search query.
 *
 * Algorithm:
 *   1. Scan backwards from the end of the input to find the last trigger word
 *   2. At each position, try 2-word combos first (e.g. "saved view"), then single
 *      words — the first match found scanning backwards wins (most recent trigger)
 *   3. Trigger words must appear at word boundaries (e.g. "invoices" does NOT match "invoice")
 *   4. Only activate when the text after the trigger word has >= 2 characters
 *      (this naturally prevents matches at the end of the text with no search query)
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
 * Pure function that performs trigger detection.
 * Exported separately for direct unit testing without React hooks.
 */
export function detectMention(
  triggerMap: Map<string, EntityTrigger>,
  inputText: string,
): MentionDetectionResult | null {
  if (!inputText || triggerMap.size === 0) {
    return null;
  }

  const text = inputText;

  // Find word boundaries — positions where words start.
  // We scan backwards to find the LAST (most recent) trigger.
  const wordStarts = getWordStartPositions(text);

  // Check from the end of the text backwards for trigger words.
  // At each word boundary, try 2-word match first (longer wins), then 1-word.
  for (let i = wordStarts.length - 1; i >= 0; i--) {
    // Try 2-word trigger first (e.g. "saved view")
    if (i > 0) {
      const twoWordStart = wordStarts[i - 1]!;
      const match = tryMatchTrigger(triggerMap, text, twoWordStart, wordStarts[i]!);
      if (match) return match;
    }

    // Try 1-word trigger
    const oneWordStart = wordStarts[i]!;
    const match = tryMatchTrigger(triggerMap, text, oneWordStart, null);
    if (match) return match;
  }

  return null;
}

/**
 * Returns the start index of each word in the text.
 */
function getWordStartPositions(text: string): number[] {
  const positions: number[] = [];
  let inWord = false;
  for (let i = 0; i < text.length; i++) {
    const isSpace = text[i] === ' ' || text[i] === '\t' || text[i] === '\n';
    if (!isSpace && !inWord) {
      positions.push(i);
      inWord = true;
    } else if (isSpace) {
      inWord = false;
    }
  }
  return positions;
}

/**
 * Tries to match a trigger starting at `triggerStart`.
 * If `secondWordStart` is provided, tries a 2-word trigger.
 * Otherwise tries a 1-word trigger.
 *
 * Returns a detection result if:
 *   - The candidate text matches a trigger word in the map (case-insensitive)
 *   - The trigger word is at a word boundary (followed by a space or end of string)
 *   - There is a search query of >= 2 characters after the trigger
 */
function tryMatchTrigger(
  triggerMap: Map<string, EntityTrigger>,
  text: string,
  triggerStart: number,
  secondWordStart: number | null,
): MentionDetectionResult | null {
  // Determine where the trigger word(s) end by finding the next space
  // after the last word of the trigger.
  let candidateEnd: number;

  if (secondWordStart !== null) {
    // 2-word trigger: find the end of the second word
    candidateEnd = findWordEnd(text, secondWordStart);
  } else {
    // 1-word trigger: find the end of this word
    candidateEnd = findWordEnd(text, triggerStart);
  }

  const candidateWord = text.substring(triggerStart, candidateEnd).toLowerCase();

  // Check word boundary after the trigger word:
  // Must be followed by a space (or nothing if at end — but then there's no query).
  // If there's more text immediately after (no space), it's not a word boundary
  // e.g. "invoices" should NOT match "invoice"
  if (candidateEnd < text.length && text[candidateEnd] !== ' ') {
    return null;
  }

  const trigger = triggerMap.get(candidateWord);
  if (!trigger) {
    return null;
  }

  // Extract the search query — everything after the trigger word + space
  const queryStart = candidateEnd + 1; // +1 for the space after trigger
  if (queryStart >= text.length) {
    // Trigger word found but no search query text yet
    return null;
  }

  const searchQuery = text.substring(queryStart).trimEnd();

  // Only activate if the search query has >= 2 characters
  if (searchQuery.length < 2) {
    return null;
  }

  return {
    trigger,
    searchQuery,
    triggerStartIndex: triggerStart,
  };
}

/**
 * Finds the end index (exclusive) of the word starting at `start`.
 */
function findWordEnd(text: string, start: number): number {
  let i = start;
  while (i < text.length && text[i] !== ' ' && text[i] !== '\t' && text[i] !== '\n') {
    i++;
  }
  return i;
}
