/**
 * Single linked record row within the LinksPanel.
 *
 * - Entity type icon + display reference + direction arrow
 * - Navigation link to related record via React Router
 * - Delete button: manual links → STAFF, system links → MANAGER only
 * - Delete confirmation via AlertDialog
 */

import { useState, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, ArrowLeft, Trash2 } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import type { RecordLink } from '../types';
import {
  getEntityTypeIcon,
  getEntityTypeLabelKey,
  getEntityTypeRoute,
} from '../utils/entity-display';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LinkItemProps {
  link: RecordLink;
  currentEntityType: string;
  currentEntityId: string;
  canDeleteManual: boolean;
  canDeleteSystem: boolean;
  onDelete: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LinkItem({
  link,
  currentEntityType,
  currentEntityId,
  canDeleteManual,
  canDeleteSystem,
  onDelete,
}: LinkItemProps) {
  const { t } = useI18n();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Determine the "other" entity (the one we're linking TO from the current record)
  const isOutgoing =
    link.sourceEntityType === currentEntityType && link.sourceEntityId === currentEntityId;
  const linkedEntityType = isOutgoing ? link.targetEntityType : link.sourceEntityType;
  const linkedEntityId = isOutgoing ? link.targetEntityId : link.sourceEntityId;

  const Icon = getEntityTypeIcon(linkedEntityType);
  const entityLabelKey = getEntityTypeLabelKey(linkedEntityType);
  const displayRef = linkedEntityId.substring(0, 8);

  const canDelete = link.isSystemGenerated ? canDeleteSystem : canDeleteManual;

  const createdAt = formatDistanceToNow(new Date(link.createdAt), { addSuffix: true });

  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const recordLink = getEntityTypeRoute(linkedEntityType, linkedEntityId);

  return (
    <>
      <div className="group flex items-center gap-3 rounded-lg p-2.5 hover:bg-accent/50 transition-colors">
        {/* Entity type icon */}
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-primary">
          <Icon className="size-4" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {/* Direction indicator */}
            {isOutgoing ? (
              <ArrowRight
                className="size-3 shrink-0 text-muted-foreground"
                aria-label={t('crossCutting.recordLinks.directionOutgoing')}
              />
            ) : (
              <ArrowLeft
                className="size-3 shrink-0 text-muted-foreground"
                aria-label={t('crossCutting.recordLinks.directionIncoming')}
              />
            )}

            {/* Display reference (navigable link or plain text) */}
            {recordLink ? (
              <Link
                to={recordLink}
                className="truncate text-sm font-medium text-primary hover:underline"
              >
                <span className="font-mono">{displayRef}</span>
              </Link>
            ) : (
              <span className="truncate text-sm font-medium font-mono">{displayRef}</span>
            )}

            {link.isSystemGenerated && (
              <Badge
                variant="outline"
                className="border-0 bg-purple-100 text-purple-700 text-[10px] font-semibold uppercase tracking-wider shrink-0"
              >
                {t('crossCutting.recordLinks.system')}
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {t(entityLabelKey)}
            {' \u00B7 '}
            {createdAt}
          </p>
        </div>

        {/* Delete action */}
        {canDelete && (
          <div className="flex items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              onClick={handleDeleteClick}
              aria-label={t('crossCutting.recordLinks.deleteLink')}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('crossCutting.recordLinks.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('crossCutting.recordLinks.deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDelete(link.id);
                setShowDeleteConfirm(false);
              }}
            >
              {t('common:delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
