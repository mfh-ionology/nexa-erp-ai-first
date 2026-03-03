import { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

import { useCopilotStore } from '@/stores/copilot-store';
import { useAiChat } from '@/hooks/use-ai-chat';
import { EntityMentionInput } from '@/features/ai/entity-mentions/entity-mention-input';
import type { EntityMention } from '@/features/ai/entity-mentions/types';

import { useI18n } from '@nexa/i18n';

// ── Component ────────────────────────────────────────────────────────────────

/**
 * CopilotInput — wraps EntityMentionInput with copilot store integration
 * and file drop zone.
 *
 * Replaces the plain textarea with entity-mention-aware input that supports
 * trigger word detection, autocomplete, and structured entity references.
 *
 * When the AI WebSocket is connected, messages (including entity mentions) are
 * sent over the wire via useAiChat.sendMessage. Otherwise falls back to the
 * store-level placeholder. (ISSUE #6 fix)
 */
export function CopilotInput() {
  const { t } = useI18n();
  const submitUserMessage = useCopilotStore((s) => s.submitUserMessage);
  const isStreaming = useCopilotStore((s) => s.isStreaming);
  const { sendMessage, isConnected } = useAiChat();

  const [isDragOver, setIsDragOver] = useState(false);

  const handleSend = useCallback(
    (text: string, mentions: EntityMention[]) => {
      if (isStreaming) return;
      const mentionsOrUndefined = mentions.length > 0 ? mentions : undefined;

      // Always update local store state (adds user message + opens drawer)
      submitUserMessage(text, mentionsOrUndefined);

      // When WebSocket is connected, also forward to the AI backend
      // with structured entity mentions. The store's placeholder response
      // will be superseded by the real streaming response from the server.
      if (isConnected) {
        sendMessage(text, mentionsOrUndefined);
      }
    },
    [isStreaming, submitUserMessage, sendMessage, isConnected],
  );

  // ── Drag & drop handlers (stub for MVP) ──────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    toast.info(t('copilot.fileDropNotReady'));
  };

  return (
    <div
      className="relative shrink-0 border-t border-border px-4 py-3"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* File drop zone overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary/5">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Upload className="size-4" />
            {t('copilot.fileDropZone')}
          </div>
        </div>
      )}

      <EntityMentionInput
        onSend={handleSend}
        disabled={isStreaming}
        placeholder={t('copilot.inputPlaceholder')}
      />
    </div>
  );
}
