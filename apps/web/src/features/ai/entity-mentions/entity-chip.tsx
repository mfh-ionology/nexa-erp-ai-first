import type { LucideIcon } from 'lucide-react';
import {
  Bookmark,
  Building2,
  ClipboardList,
  FileText,
  LayoutList,
  Package,
  Tag,
  User,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';

import type { EntityMention } from './types';

// ---------------------------------------------------------------------------
// Default icon map — extensible via the `icon` field on entity triggers.
// Unknown entity types fall back to `Tag`.
// ---------------------------------------------------------------------------
const DEFAULT_ICON_MAP: Record<string, LucideIcon> = {
  Contact: User,
  Customer: Building2,
  Invoice: FileText,
  Product: Package,
  PurchaseOrder: ClipboardList,
  DataView: LayoutList,
  SavedView: Bookmark,
};

const FALLBACK_ICON: LucideIcon = Tag;

/**
 * Resolves a Lucide icon component for the given entity type string.
 * Checks the default map first; returns the fallback `Tag` icon for unknown types.
 */
export function getEntityIcon(entityType: string): LucideIcon {
  return DEFAULT_ICON_MAP[entityType] ?? FALLBACK_ICON;
}

// ---------------------------------------------------------------------------
// Variant styles
// ---------------------------------------------------------------------------
const VARIANT_STYLES = {
  input: 'bg-[#ede9fe] text-[#6d28d9]',
  'user-message': 'bg-white/20 text-white',
  'assistant-message': 'bg-[#ede9fe] text-[#6d28d9]',
} as const;

type ChipVariant = keyof typeof VARIANT_STYLES;

// ---------------------------------------------------------------------------
// EntityChip
// ---------------------------------------------------------------------------
export interface EntityChipProps {
  entity: EntityMention;
  onRemove?: () => void;
  variant?: ChipVariant;
  className?: string;
}

export function EntityChip({ entity, onRemove, variant = 'input', className }: EntityChipProps) {
  const Icon = getEntityIcon(entity.type);
  const showRemove = variant === 'input' && !!onRemove;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium align-middle',
        VARIANT_STYLES[variant],
        showRemove && 'pr-1',
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span>{entity.name}</span>
      {showRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors hover:bg-[#6d28d9]/20"
          aria-label={`Remove ${entity.name}`}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}
