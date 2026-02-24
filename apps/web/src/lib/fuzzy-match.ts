/**
 * Simple fuzzy match: checks whether every word in the query appears
 * somewhere in the target string (case-insensitive).
 */
export function fuzzyMatch(query: string, target: string): boolean {
  const lowerTarget = target.toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((w) => lowerTarget.includes(w));
}
