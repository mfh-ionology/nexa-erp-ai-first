/**
 * Hook encapsulating cross-cutting panel state for ActionBar integration.
 *
 * Manages open/close state for AttachmentPanel and LinksPanel, and
 * exposes attachment/link counts so ActionBar badges render immediately.
 *
 * Uses lightweight count-only queries (limit=0) to avoid fetching full
 * lists just for badge numbers. The full list is fetched lazily when the
 * panel is opened.
 */

import { useCallback, useState } from 'react';

import { useAttachmentCount } from './use-attachments';
import { useRecordLinkCount } from './use-record-links';

export function useCrossCuttingPanels(entityType: string, entityId: string) {
  const [isAttachmentPanelOpen, setAttachmentPanelOpen] = useState(false);
  const [isLinksPanelOpen, setLinksPanelOpen] = useState(false);

  // Lightweight count-only queries (limit=0) — only fetch total, not items.
  const attachmentCount = useAttachmentCount(entityType, entityId);
  const linkCount = useRecordLinkCount(entityType, entityId);

  const onAttachmentsClick = useCallback(() => {
    setAttachmentPanelOpen(true);
  }, []);

  const onLinksClick = useCallback(() => {
    setLinksPanelOpen(true);
  }, []);

  return {
    attachmentCount,
    linkCount,
    isAttachmentPanelOpen,
    setAttachmentPanelOpen,
    isLinksPanelOpen,
    setLinksPanelOpen,
    onAttachmentsClick,
    onLinksClick,
  };
}
