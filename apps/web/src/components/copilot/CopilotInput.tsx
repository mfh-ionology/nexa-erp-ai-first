import { useCallback, useRef, useState } from 'react';
import { SendHorizontal, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useCopilotStore } from '@/stores/copilot-store';

import { useI18n } from '@nexa/i18n';

// ── Component ────────────────────────────────────────────────────────────────

/**
 * CopilotInput — multi-line text input with send button and file drop zone.
 *
 * - Enter submits the message; Shift+Enter inserts a new line
 * - Auto-resizes from 1 row to max 4 rows
 * - File drag-and-drop shows a visual overlay (stub for MVP)
 * - Submit is disabled while streaming or when input is empty
 */
export function CopilotInput() {
  const { t } = useI18n();
  const pendingInput = useCopilotStore((s) => s.pendingInput);
  const setPendingInput = useCopilotStore((s) => s.setPendingInput);
  const submitUserMessage = useCopilotStore((s) => s.submitUserMessage);
  const isStreaming = useCopilotStore((s) => s.isStreaming);

  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSubmit = pendingInput.trim().length > 0 && !isStreaming;

  const handleSubmit = useCallback(() => {
    const text = pendingInput.trim();
    if (!text || isStreaming) return;

    // Submit message (adds user msg, opens drawer, queues placeholder response)
    submitUserMessage(text);

    // Clear input
    setPendingInput('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [pendingInput, isStreaming, submitUserMessage, setPendingInput]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPendingInput(e.target.value);

    // Auto-resize: reset height then set to scrollHeight (capped at 4 rows ≈ 96px)
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
  };

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

      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={pendingInput}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t('copilot.inputPlaceholder')}
          aria-label={t('copilot.inputAriaLabel')}
          disabled={isStreaming}
          rows={1}
          className={cn(
            'min-h-[36px] max-h-[96px] resize-none border-0 bg-muted/50 px-3 py-2 text-sm shadow-none',
            'focus-visible:ring-1 focus-visible:ring-ring',
          )}
        />
        <Button
          variant="default"
          size="icon-sm"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-label={t('copilot.send')}
          className="shrink-0"
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
    </div>
  );
}
