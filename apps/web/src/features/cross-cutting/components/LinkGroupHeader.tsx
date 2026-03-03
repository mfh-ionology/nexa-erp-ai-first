/**
 * Section header for a link type group within the LinksPanel.
 *
 * - Displays link type label, count, and expand/collapse toggle
 * - Uses Shadcn Collapsible for accessible expand/collapse
 * - Link type labels mapped from enum to user-friendly i18n keys
 */

import { ChevronDown, ChevronRight } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { CollapsibleTrigger } from '@/components/ui/collapsible';

import type { RecordLinkType } from '../types';

// ---------------------------------------------------------------------------
// Link type → i18n key mapping
// ---------------------------------------------------------------------------

const LINK_TYPE_LABEL_KEYS: Record<RecordLinkType, string> = {
  CREATED_FROM: 'crossCutting.recordLinks.typeCreatedFrom',
  FULFILLS: 'crossCutting.recordLinks.typeFulfils',
  PAYMENT_FOR: 'crossCutting.recordLinks.typePaymentFor',
  CREDIT_FOR: 'crossCutting.recordLinks.typeCreditFor',
  RELATES_TO: 'crossCutting.recordLinks.typeRelatesTo',
  PARENT_CHILD: 'crossCutting.recordLinks.typeParentChild',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LinkGroupHeaderProps {
  linkType: RecordLinkType;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LinkGroupHeader({ linkType, count, isOpen, onToggle }: LinkGroupHeaderProps) {
  const { t } = useI18n();

  return (
    <CollapsibleTrigger
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm font-medium hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        {isOpen ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
        <span>{t(LINK_TYPE_LABEL_KEYS[linkType])}</span>
      </div>
      <Badge variant="secondary" className="text-xs">
        {count}
      </Badge>
    </CollapsibleTrigger>
  );
}
