import { icons, type LucideIcon } from 'lucide-react';

/**
 * Resolves a Lucide icon name string to its component.
 * Returns undefined if the name doesn't match a known icon.
 */
export function resolveIcon(name: string): LucideIcon | undefined {
  return icons[name as keyof typeof icons];
}
