import { useCallback, useEffect, useRef } from 'react';
import { Sparkles, X, Minimize2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useBreakpoint, usePrefersReducedMotion } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';
import { useCopilotStore } from '@/stores/copilot-store';

import { useI18n } from '@nexa/i18n';

import { useAiChat } from '@/hooks/use-ai-chat';

import { ChatHistory } from './ChatHistory';
import { CopilotChat } from './CopilotChat';
import { CopilotInput } from './CopilotInput';
import { QuickPrompts } from './QuickPrompts';

/**
 * Co-Pilot Drawer — main container for AI conversations.
 *
 * Desktop/Tablet (>=768px): Inline 380px panel on the right side of the
 * content area. Slides in/out with translate-x animation.
 *
 * Phone (<768px): Full-screen custom overlay with semi-transparent backdrop
 * and a Minimise option that collapses to a floating pill (CopilotMinimisedPill).
 *
 * NOTE: Does NOT use shadcn Sheet per spec Dev Note #3.
 *
 * Sections (top → bottom):
 *   1. Header (title + close/minimise buttons)
 *   2. ChatHistory selector
 *   3. CopilotChat conversation area
 *   4. QuickPrompts chips
 *   5. CopilotInput text area
 */
export function CopilotDrawer() {
  const { t } = useI18n();
  const breakpoint = useBreakpoint();
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobile = breakpoint === 'phone';

  const isDrawerOpen = useCopilotStore((s) => s.isDrawerOpen);
  const closeDrawer = useCopilotStore((s) => s.closeDrawer);
  const setMinimised = useCopilotStore((s) => s.setMinimised);

  // Single shared useAiChat instance — passed to children to avoid multiple socket connections
  const { sendMessage, confirmAction, rejectAction, isConnected } = useAiChat();

  const drawerRef = useRef<HTMLDivElement>(null);

  // Close drawer on Escape key — but only if no other overlay (popover,
  // dropdown, command palette) already handled the event. Radix UI
  // components call stopPropagation or set defaultPrevented on Escape,
  // so we check both to avoid closing the drawer as a side effect.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen && !e.defaultPrevented) {
        // Also skip if focus is inside a Radix popover / command palette
        const active = document.activeElement;
        if (active?.closest('[data-radix-popper-content-wrapper]')) return;

        closeDrawer();
      }
    },
    [isDrawerOpen, closeDrawer],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Focus the drawer when it opens
  useEffect(() => {
    if (isDrawerOpen && drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [isDrawerOpen]);

  // Focus trap for mobile full-screen overlay (WCAG 2.1 AA)
  useEffect(() => {
    if (!isMobile || !isDrawerOpen || !drawerRef.current) return;

    const container = drawerRef.current;

    function handleTabTrap(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;

      const focusable = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleTabTrap);
    return () => document.removeEventListener('keydown', handleTabTrap);
  }, [isMobile, isDrawerOpen]);

  // Shared drawer content sections — all children share the single useAiChat instance
  const drawerContent = (
    <>
      {/* Chat History */}
      <ChatHistory />

      {/* Conversation area */}
      <CopilotChat confirmAction={confirmAction} rejectAction={rejectAction} />

      {/* Quick Prompts */}
      <QuickPrompts />

      {/* Input */}
      <CopilotInput sendMessage={sendMessage} isConnected={isConnected} />
    </>
  );

  // ── Phone: Custom full-screen overlay ─────────────────────────────────
  if (isMobile) {
    if (!isDrawerOpen) return null;

    return (
      <>
        {/* Semi-transparent backdrop (spec Task 3.5: bg-black/50) */}
        <div className="fixed inset-0 z-40 bg-black/50" onClick={closeDrawer} aria-hidden="true" />

        {/* Full-screen drawer panel */}
        <div
          ref={drawerRef}
          role="complementary"
          aria-label={t('copilot.drawerLabel')}
          tabIndex={-1}
          className={cn(
            'fixed inset-0 z-50 flex flex-col bg-surface outline-none',
            !prefersReducedMotion && 'animate-in slide-in-from-right duration-200',
          )}
        >
          {/* Header */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="text-sm font-semibold">{t('copilot.title')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setMinimised(true);
                  closeDrawer();
                }}
                aria-label={t('copilot.minimise')}
              >
                <Minimize2 className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={closeDrawer}
                aria-label={t('copilot.close')}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          {drawerContent}
        </div>
      </>
    );
  }

  // ── Desktop / Tablet: Inline panel ───────────────────────────────────
  const animationClasses = prefersReducedMotion
    ? ''
    : 'transition-[width,opacity] duration-200 ease-out';

  return (
    <div
      ref={drawerRef}
      role="complementary"
      aria-label={t('copilot.drawerLabel')}
      tabIndex={-1}
      className={cn(
        'flex h-full shrink-0 flex-col overflow-hidden border-l border-border bg-surface outline-none',
        animationClasses,
        isDrawerOpen
          ? cn('w-[380px] xl:w-[420px]', !prefersReducedMotion && 'animate-pulse-border')
          : 'w-0 border-l-0',
      )}
    >
      {isDrawerOpen && (
        <>
          {/* Header */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="text-sm font-semibold">{t('copilot.title')}</span>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={closeDrawer}
              aria-label={t('copilot.close')}
            >
              <X className="size-3.5" />
            </Button>
          </div>

          {drawerContent}
        </>
      )}
    </div>
  );
}
