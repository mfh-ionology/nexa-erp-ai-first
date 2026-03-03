// ---------------------------------------------------------------------------
// Shared text utilities for AI memory services
// Extracted to eliminate divergent copies across SemanticDedupService,
// MemoryInjectionService, and any future consumers.
// E5b-4 Code Review Fix #7
// ---------------------------------------------------------------------------

/** Stop words excluded from keyword extraction */
export const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'shall',
  'can',
  'need',
  'must',
  'ought',
  'to',
  'of',
  'in',
  'for',
  'on',
  'with',
  'at',
  'by',
  'from',
  'as',
  'into',
  'about',
  'like',
  'through',
  'after',
  'over',
  'between',
  'out',
  'against',
  'during',
  'without',
  'before',
  'under',
  'around',
  'among',
  'and',
  'but',
  'or',
  'nor',
  'not',
  'so',
  'yet',
  'both',
  'either',
  'neither',
  'each',
  'every',
  'all',
  'any',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'only',
  'own',
  'same',
  'than',
  'too',
  'very',
  'just',
  'because',
  'that',
  'this',
  'these',
  'those',
  'what',
  'which',
  'who',
  'whom',
  'how',
  'when',
  'where',
  'why',
  'user',
  'prefers',
  'prefer',
  'uses',
  'use',
  'always',
  'never',
  'typically',
  'usually',
  'often',
  'frequently',
  'i',
  'me',
  'my',
]);

/**
 * Extract significant keywords from text for similarity comparison.
 * Lowercases, removes punctuation, filters stop words, requires min length 3.
 */
export function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w)),
  );
}

/**
 * Calculate Jaccard similarity between two keyword sets.
 * Jaccard index = |intersection| / |union|
 * Returns a value between 0 and 1.
 */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Calculate days since a given date.
 * Returns 0 for future dates.
 */
export function daysSince(date: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
}
