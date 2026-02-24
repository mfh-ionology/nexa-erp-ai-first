import { useCallback, useMemo } from 'react';
import { ChevronDown, MessageSquare, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCopilotStore } from '@/stores/copilot-store';

import { useI18n } from '@nexa/i18n';

// ── Relative time formatting (i18n) ────────────────────────────────────────

function getRelativeTime(
  isoString: string,
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return t('copilot.time.justNow');
  if (diffMins < 60) return t('copilot.time.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('copilot.time.hoursAgo', { count: diffHours });
  if (diffDays === 1) return t('copilot.time.yesterday');
  if (diffDays < 7) return t('copilot.time.daysAgo', { count: diffDays });
  return new Date(isoString).toLocaleDateString();
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * ChatHistory — Session selector dropdown + New Chat button.
 *
 * Displays a dropdown of previous chat sessions sorted by most recent,
 * and a button to start a new conversation. For MVP, sessions are stored
 * locally in Zustand (future: server-side via GET /ai/chat/history).
 */
export function ChatHistory() {
  const { t } = useI18n();

  const sessions = useCopilotStore((s) => s.sessions);
  const activeConversationId = useCopilotStore((s) => s.activeConversationId);
  const switchToSession = useCopilotStore((s) => s.switchToSession);
  const createSession = useCopilotStore((s) => s.createSession);

  // Sort sessions by lastMessageAt descending
  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime(),
      ),
    [sessions],
  );

  // Find the currently active session title for the trigger label
  const activeSessionTitle = useMemo(() => {
    if (!activeConversationId) return null;
    const session = sessions.find((s) => s.id === activeConversationId);
    return session?.title ?? null;
  }, [sessions, activeConversationId]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      switchToSession(sessionId);
    },
    [switchToSession],
  );

  const handleNewChat = useCallback(() => {
    const newSession = {
      id: crypto.randomUUID(),
      title: t('copilot.newChat'),
      lastMessageAt: new Date().toISOString(),
      messageCount: 0,
    };
    createSession(newSession);
    // switchToSession saves current messages to sessionMessages cache
    // before loading the (empty) new session — preventing data loss.
    switchToSession(newSession.id);
  }, [createSession, switchToSession, t]);

  // Truncate title to 30 characters
  const truncateTitle = (title: string, maxLen = 30): string =>
    title.length > maxLen ? `${title.slice(0, maxLen)}...` : title;

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
      {/* Session selector dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex min-w-0 flex-1 items-center justify-between gap-1 text-xs"
            aria-label={t('copilot.recentChats')}
          >
            <span className="truncate">
              {activeSessionTitle
                ? truncateTitle(activeSessionTitle)
                : t('copilot.recentChats')}
            </span>
            <ChevronDown className="size-3 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs">
            {t('copilot.recentChats')}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {sortedSessions.length === 0 ? (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              {t('copilot.noChats')}
            </div>
          ) : (
            sortedSessions.map((session) => (
              <DropdownMenuItem
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                className="flex items-center gap-2"
              >
                <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-xs font-medium">
                    {truncateTitle(session.title)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {getRelativeTime(session.lastMessageAt, t)}
                  </span>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* New Chat button */}
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={handleNewChat}
        aria-label={t('copilot.newChat')}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}
