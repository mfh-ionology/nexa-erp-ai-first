import { MessageSquare } from 'lucide-react';

import { useBreakpoint, usePrefersReducedMotion } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';
import { useCopilotStore } from '@/stores/copilot-store';

import { useI18n } from '@nexa/i18n';

/**
 * Floating pill shown on phone (<768px) when the Co-Pilot drawer is minimised.
 *
 * Displays a truncated preview (max 60 chars) of the last AI message.
 * Tapping the pill re-opens the drawer and clears the minimised state.
 *
 * Entrance animation: scale-in from 0.8 → 1.0 (respects prefers-reduced-motion).
 */
export function CopilotMinimisedPill() {
  const { t } = useI18n();
  const breakpoint = useBreakpoint();
  const prefersReducedMotion = usePrefersReducedMotion();

  const isMinimised = useCopilotStore((s) => s.isMinimised);
  const isDrawerOpen = useCopilotStore((s) => s.isDrawerOpen);
  const openDrawer = useCopilotStore((s) => s.openDrawer);
  const setMinimised = useCopilotStore((s) => s.setMinimised);
  const messages = useCopilotStore((s) => s.messages);

  const isMobile = breakpoint === 'phone';

  // Only render on phone when minimised and drawer is closed
  if (!isMobile || !isMinimised || isDrawerOpen) {
    return null;
  }

  // Get the last assistant message for preview
  const lastAiMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant');
  const previewText = lastAiMessage
    ? lastAiMessage.content.length > 60
      ? `${lastAiMessage.content.slice(0, 60)}…`
      : lastAiMessage.content
    : t('copilot.title');

  const handleClick = () => {
    openDrawer();
    setMinimised(false);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t('copilot.resumeConversation')}
      className={cn(
        'fixed bottom-4 right-4 z-50',
        'flex max-w-[280px] items-center gap-2 rounded-full',
        'bg-primary px-4 py-2.5 text-primary-foreground shadow-lg',
        'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        !prefersReducedMotion && 'animate-in zoom-in-80 duration-200',
      )}
    >
      <MessageSquare className="size-4 shrink-0" />
      <span className="truncate text-sm font-medium">{previewText}</span>
    </button>
  );
}
