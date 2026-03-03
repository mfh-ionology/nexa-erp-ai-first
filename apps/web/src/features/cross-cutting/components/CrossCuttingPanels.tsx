/**
 * Cross-cutting panels wrapper for record detail pages.
 *
 * Manages open/close state for AttachmentPanel and LinksPanel,
 * provides counts and click handlers for ActionBar integration,
 * and renders both panels as children.
 *
 * Usage:
 * ```tsx
 * const crossCutting = useCrossCuttingPanels(entityType, entityId);
 *
 * <ActionBar
 *   attachmentCount={crossCutting.attachmentCount}
 *   linkCount={crossCutting.linkCount}
 *   onAttachmentsClick={crossCutting.onAttachmentsClick}
 *   onLinksClick={crossCutting.onLinksClick}
 * />
 * <CrossCuttingPanels
 *   entityType={entityType}
 *   entityId={entityId}
 *   resourceCode={resourceCode}
 *   panels={crossCutting}
 * />
 * ```
 */

import { useCrossCuttingPanels } from '../hooks/use-cross-cutting-panels';
import { AttachmentPanel } from './AttachmentPanel';
import { LinksPanel } from './LinksPanel';

interface CrossCuttingPanelsProps {
  entityType: string;
  entityId: string;
  resourceCode: string;
  panels: ReturnType<typeof useCrossCuttingPanels>;
}

export function CrossCuttingPanels({
  entityType,
  entityId,
  resourceCode,
  panels,
}: CrossCuttingPanelsProps) {
  return (
    <>
      <AttachmentPanel
        open={panels.isAttachmentPanelOpen}
        onOpenChange={panels.setAttachmentPanelOpen}
        entityType={entityType}
        entityId={entityId}
        resourceCode={resourceCode}
      />
      <LinksPanel
        open={panels.isLinksPanelOpen}
        onOpenChange={panels.setLinksPanelOpen}
        entityType={entityType}
        entityId={entityId}
        resourceCode={resourceCode}
      />
    </>
  );
}
