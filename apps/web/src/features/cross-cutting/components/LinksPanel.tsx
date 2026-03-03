/**
 * Linked Records side panel (Sheet) for viewing and managing record links.
 *
 * - Wraps Shadcn Sheet (right side, 400px desktop, full-screen phone)
 * - Links grouped by linkType using Collapsible sections
 * - "Add Link" button opens AddLinkForm dialog
 * - Permission-gated delete (manual → STAFF, system → MANAGER per AC #8)
 * - Keyboard: Escape closes panel, Tab navigates (Sheet built-in focus trap)
 */

import { useState, useCallback, useMemo } from 'react';
import { Plus, LinkIcon } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { usePrefersReducedMotion } from '@/hooks/use-breakpoint';
import { usePermission } from '@/hooks/use-permissions';

import { useRecordLinks, useDeleteRecordLink } from '../hooks/use-record-links';
import type { RecordLink, RecordLinkType } from '../types';

import { AddLinkForm } from './AddLinkForm';
import { LinkGroupHeader } from './LinkGroupHeader';
import { LinkItem } from './LinkItem';

// ---------------------------------------------------------------------------
// Link type ordering for display
// ---------------------------------------------------------------------------

const LINK_TYPE_ORDER: RecordLinkType[] = [
  'CREATED_FROM',
  'FULFILLS',
  'PAYMENT_FOR',
  'CREDIT_FOR',
  'RELATES_TO',
  'PARENT_CHILD',
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LinksPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  resourceCode: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LinksPanel({
  open,
  onOpenChange,
  entityType,
  entityId,
  resourceCode,
}: LinksPanelProps) {
  const { t } = useI18n();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { canDelete, canEdit } = usePermission(resourceCode);

  const { links, total, isLoading } = useRecordLinks(entityType, entityId);
  const deleteLinkMutation = useDeleteRecordLink(entityType, entityId);

  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<RecordLinkType>>(() => new Set(LINK_TYPE_ORDER));

  // Group links by type
  const groupedLinks = useMemo(() => {
    const groups = new Map<RecordLinkType, RecordLink[]>();
    for (const type of LINK_TYPE_ORDER) {
      groups.set(type, []);
    }
    for (const link of links) {
      const group = groups.get(link.linkType);
      if (group) {
        group.push(link);
      }
    }
    return groups;
  }, [links]);

  const handleToggleGroup = useCallback((type: RecordLinkType) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleDelete = useCallback(
    (linkId: string) => {
      deleteLinkMutation.mutate(linkId);
    },
    [deleteLinkMutation],
  );

  // Permission flags for delete
  // Manual links: STAFF (canEdit) is sufficient
  // System links: MANAGER (canDelete) required
  const canDeleteManual = canEdit || canDelete;
  const canDeleteSystem = canDelete;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full md:w-[400px] md:max-w-[400px] flex flex-col">
          <SheetHeader className="border-b border-primary/20 pb-3">
            <div className="flex items-center gap-2">
              <SheetTitle className="font-serif">{t('crossCutting.recordLinks.title')}</SheetTitle>
              {total > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {total}
                </Badge>
              )}
            </div>
            <SheetDescription className="sr-only">
              {t('crossCutting.recordLinks.panelDescription')}
            </SheetDescription>
          </SheetHeader>

          <div
            className={`flex-1 overflow-y-auto space-y-2 p-4 pt-3${prefersReducedMotion ? '' : ' animate-fade-in-up'}`}
          >
            {/* Add Link button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => setAddLinkOpen(true)}
            >
              <Plus className="size-4" />
              {t('crossCutting.recordLinks.addLink')}
            </Button>

            {/* Links content */}
            <div aria-live="polite" aria-relevant="additions removals">
              {isLoading ? (
                <div className="space-y-3 pt-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-8 w-1/2 rounded" />
                      <div className="flex items-center gap-3 p-2.5">
                        <Skeleton className="size-9 rounded-lg" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3.5 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : total === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <LinkIcon className="size-12 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('crossCutting.recordLinks.emptyState')}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2 text-primary"
                    onClick={() => setAddLinkOpen(true)}
                  >
                    {t('crossCutting.recordLinks.addLink')}
                  </Button>
                </div>
              ) : (
                /* Grouped links */
                <div className="space-y-1 pt-2">
                  {LINK_TYPE_ORDER.map((type) => {
                    const groupLinks = groupedLinks.get(type) ?? [];
                    if (groupLinks.length === 0) return null;

                    const isOpen = openGroups.has(type);

                    return (
                      <Collapsible
                        key={type}
                        open={isOpen}
                        onOpenChange={() => handleToggleGroup(type)}
                      >
                        <LinkGroupHeader
                          linkType={type}
                          count={groupLinks.length}
                          isOpen={isOpen}
                          onToggle={() => handleToggleGroup(type)}
                        />
                        <CollapsibleContent>
                          <div className="space-y-0.5 pl-2">
                            {groupLinks.map((link) => (
                              <LinkItem
                                key={link.id}
                                link={link}
                                currentEntityType={entityType}
                                currentEntityId={entityId}
                                canDeleteManual={canDeleteManual}
                                canDeleteSystem={canDeleteSystem}
                                onDelete={handleDelete}
                              />
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Link dialog */}
      <AddLinkForm
        sourceEntityType={entityType}
        sourceEntityId={entityId}
        open={addLinkOpen}
        onOpenChange={setAddLinkOpen}
      />
    </>
  );
}
