import type { PlatformInsight } from '@/types/intelligence';

/**
 * Extract a module name from insight evidence or title (best-effort).
 *
 * Tries evidence.module first, then falls back to parsing the title
 * for patterns like "[Finance] ..." or "AR: ...".
 */
export function extractModule(insight: PlatformInsight): string {
  const evidence = insight.evidence as Record<string, unknown> | null;
  if (evidence && typeof evidence.module === 'string') return evidence.module;

  const bracketMatch = insight.title.match(/^\[([A-Za-z]+)\]/);
  if (bracketMatch?.[1]) return bracketMatch[1];

  const colonMatch = insight.title.match(/^([A-Z]{2,})\s*:/);
  if (colonMatch?.[1]) return colonMatch[1];

  return 'Other';
}

/** Extract tenant count from insight evidence */
export function extractTenantCount(insight: PlatformInsight): number {
  const evidence = insight.evidence as Record<string, unknown> | null;
  if (evidence && typeof evidence.tenantCount === 'number') return evidence.tenantCount;
  return 0;
}

/** Extract frequency from insight evidence */
export function extractFrequency(insight: PlatformInsight): number {
  const evidence = insight.evidence as Record<string, unknown> | null;
  if (evidence && typeof evidence.frequency === 'number') return evidence.frequency;
  if (evidence && typeof evidence.occurrenceCount === 'number') return evidence.occurrenceCount;
  return 0;
}
