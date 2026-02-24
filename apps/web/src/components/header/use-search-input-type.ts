import { useMemo } from 'react';

import {
  NAVIGATION_MODULES,
  type NavigationItem,
} from '@/lib/navigation-config';

export type SearchInputType = 'entity' | 'page' | 'ai' | 'empty';

export interface SearchInputClassification {
  type: SearchInputType;
  entityPrefix?: string;
}

/** Entity prefix pattern: 2-3 uppercase letters followed by a dash */
const ENTITY_PREFIX_RE = /^[A-Z]{2,3}-/i;

/** Known entity prefixes for the ERP system (spec Task 2.3) */
const KNOWN_ENTITY_PREFIXES = [
  'INV',
  'PO',
  'SO',
  'CUS',
  'SUP',
  'QUO',
  'QU',
  'DN',
  'GR',
  'WO',
  'CN',
];

/** AI-indicating keywords: command verbs and question words */
const AI_KEYWORDS_RE =
  /\b(create|show|list|what|how|why|who|when|find|get|make|generate|summarise|summarize|explain|help|forecast|analyse|analyze)\b/i;

/**
 * Flatten all navigation items from the module config into a searchable list.
 * Cached at module level since the config is static.
 */
const ALL_NAV_ITEMS: NavigationItem[] = NAVIGATION_MODULES.flatMap(
  (mod) => mod.items,
);

/**
 * Simple fuzzy match: checks whether every word in the query appears
 * somewhere in the target string (case-insensitive).
 */
function fuzzyMatch(query: string, target: string): boolean {
  const lowerTarget = target.toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((w) => lowerTarget.includes(w));
}

/**
 * Check if the query matches any navigation page name.
 * Uses the navigation key as a fallback label (e.g. "ar.invoices" → "invoices").
 */
function matchesPageName(query: string): boolean {
  if (query.length < 2) return false;

  return ALL_NAV_ITEMS.some((item) => {
    // Match against the item key's last segment (e.g. "invoices" from "ar.invoices")
    const keyLabel = item.key.split('.').pop() ?? '';
    return fuzzyMatch(query, keyLabel) || fuzzyMatch(query, item.path);
  });
}

/**
 * Hook that classifies the search input type based on its content.
 *
 * - **entity**: Input starts with a known entity prefix pattern (INV-, PO-, etc.)
 * - **page**: Input matches a module/page name from the navigation config
 * - **ai**: Natural language — longer text, question marks, or command verbs
 * - **empty**: Input is blank
 */
export function useSearchInputType(query: string): SearchInputClassification {
  return useMemo(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      return { type: 'empty' as const };
    }

    // Check for entity prefix pattern
    const prefixMatch = trimmed.match(ENTITY_PREFIX_RE);
    if (prefixMatch) {
      const prefix = prefixMatch[0].replace('-', '').toUpperCase();
      if (KNOWN_ENTITY_PREFIXES.includes(prefix)) {
        return { type: 'entity' as const, entityPrefix: prefix };
      }
    }

    // Check for page name match (short queries that match navigation items)
    if (trimmed.length <= 30 && matchesPageName(trimmed)) {
      return { type: 'page' as const };
    }

    // Check for AI keywords or question marks
    if (AI_KEYWORDS_RE.test(trimmed) || trimmed.includes('?')) {
      return { type: 'ai' as const };
    }

    // Longer inputs default to AI
    if (trimmed.length > 15) {
      return { type: 'ai' as const };
    }

    // Short non-matching input — could be partial page search
    if (matchesPageName(trimmed)) {
      return { type: 'page' as const };
    }

    // Default fallback: treat as AI query
    return { type: 'ai' as const };
  }, [query]);
}
