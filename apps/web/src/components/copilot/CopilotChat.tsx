import { useEffect, useRef } from 'react';
import {
  Bot,
  ExternalLink,
  FileText,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from '@tanstack/react-router';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import {
  useCopilotStore,
  type ChatMessage,
  type ChatMessageAction,
  type ChatRecordLink,
  type ActionProposal,
} from '@/stores/copilot-store';

import { useI18n } from '@nexa/i18n';

import { DataCard } from './DataCard';

// ── Entity route map ─────────────────────────────────────────────────────────

const ENTITY_ROUTE_MAP: Record<string, string> = {
  customerInvoice: '/ar/invoices',
  salesOrder: '/sales/orders',
  purchaseOrder: '/purchasing/orders',
  quote: '/sales/quotes',
  creditNote: '/ar/credit-notes',
  journalEntry: '/finance/journal-entries',
  debitNote: '/ap/debit-notes',
  goodsReceipt: '/purchasing/goods-receipts',
  workOrder: '/manufacturing/work-orders',
  customer: '/ar/customers',
  supplier: '/ap/suppliers',
};

function buildEntityPath(entityType: string, entityId: string): string {
  const basePath = ENTITY_ROUTE_MAP[entityType] ?? `/${entityType}`;
  return `${basePath}/${encodeURIComponent(entityId)}`;
}

// ── Streaming dots indicator ─────────────────────────────────────────────────

function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="size-1.5 animate-pulse rounded-full bg-current" />
      <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
      <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
    </span>
  );
}

// ── Record link chip ─────────────────────────────────────────────────────────

function RecordLinkChip({ link }: { link: ChatRecordLink }) {
  const href = buildEntityPath(link.entityType, link.entityId);
  return (
    <Link
      to={href}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold',
        'cursor-pointer hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
      )}
    >
      <FileText className="size-3" />
      {link.displayRef}
      <ExternalLink className="size-2.5 text-muted-foreground" />
    </Link>
  );
}

// ── Inline action button ─────────────────────────────────────────────────────

function ActionButton({
  action,
  onClick,
}: {
  action: ChatMessageAction;
  onClick: (action: ChatMessageAction) => void;
}) {
  const { t } = useI18n();
  const variant =
    action.type === 'navigate'
      ? 'link'
      : action.type === 'execute'
        ? 'default'
        : 'outline';

  return (
    <Button
      variant={variant}
      size="xs"
      onClick={() => onClick(action)}
    >
      {action.labelKey ? t(action.labelKey) : action.label}
    </Button>
  );
}

// ── Action proposal card (BR-COM-013) ────────────────────────────────────────

function ActionProposalCard({
  proposal,
}: {
  proposal: ActionProposal;
}) {
  const { t } = useI18n();

  const handleApprove = () => {
    toast.info(t('copilot.actionProposal.notConnected'));
  };

  const handleReject = () => {
    toast.info(t('copilot.actionProposal.notConnected'));
  };

  return (
    <Card className="mt-2 gap-0 py-0 shadow-none">
      <CardHeader className="gap-1 px-3 py-2">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold">
          <Bot className="size-3.5 text-primary" />
          {t('copilot.actionProposal.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-3 pb-2">
        <p className="text-xs">{proposal.description}</p>
        <p className="text-xs text-muted-foreground">
          {t('copilot.actionProposal.confidence', {
            score: Math.round(proposal.confidence * 100),
          })}
        </p>
        {Object.keys(proposal.previewData).length > 0 && (
          <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            {Object.entries(proposal.previewData)
              .slice(0, 3)
              .map(([key, value]) => (
                <div key={key}>
                  <span className="font-medium">{key}:</span>{' '}
                  {String(value)}
                </div>
              ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2 border-t px-3 py-2">
        <Button variant="ghost" size="xs" onClick={handleReject}>
          {t('copilot.actionProposal.reject')}
        </Button>
        <Button variant="default" size="xs" onClick={handleApprove}>
          {t('copilot.actionProposal.approve')}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ── Single message bubble ────────────────────────────────────────────────────

function MessageBubble({
  message,
  userInitials,
  onActionClick,
}: {
  message: ChatMessage;
  userInitials: string;
  onActionClick: (action: ChatMessageAction) => void;
}) {
  const { t } = useI18n();
  const isUser = message.role === 'user';

  const timestamp = new Date(message.timestamp);
  const timeString = timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={cn(
        'flex gap-2',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {/* Avatar */}
      <Avatar size="sm" className="mt-0.5 shrink-0">
        <AvatarFallback
          className={cn(
            'text-[10px]',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {isUser ? userInitials : <Sparkles className="size-3" />}
        </AvatarFallback>
      </Avatar>

      {/* Message content */}
      <div
        className={cn(
          'flex max-w-[85%] flex-col gap-1',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-3 py-2 text-sm',
            isUser
              ? 'rounded-br-md bg-primary text-primary-foreground'
              : 'rounded-bl-md bg-muted',
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          {message.isStreaming && (
            <span className="ml-1">
              <span className="sr-only">{t('copilot.streaming')}</span>
              <StreamingDots />
            </span>
          )}
        </div>

        {/* Record links */}
        {message.recordLinks && message.recordLinks.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.recordLinks.map((link) => (
              <RecordLinkChip
                key={`${link.entityType}-${link.entityId}`}
                link={link}
              />
            ))}
          </div>
        )}

        {/* Inline action buttons */}
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.actions.map((action) => (
              <ActionButton
                key={action.id}
                action={action}
                onClick={onActionClick}
              />
            ))}
          </div>
        )}

        {/* Action proposal (BR-COM-013) */}
        {message.actionProposal && (
          <ActionProposalCard proposal={message.actionProposal} />
        )}

        {/* Data cards (Task 6.5) */}
        {message.dataCards && message.dataCards.length > 0 && (
          <div className="flex flex-col gap-1">
            {message.dataCards.map((card) => (
              <DataCard key={card.id} card={card} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground">{timeString}</span>
      </div>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  const { t } = useI18n();

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="size-5 text-primary" />
        </div>
        <p className="max-w-[250px] text-sm text-muted-foreground">
          {t('copilot.emptyState')}
        </p>
      </div>
    </div>
  );
}

// ── Main CopilotChat component ───────────────────────────────────────────────

/**
 * CopilotChat — scrollable conversation thread for the Co-Pilot drawer.
 *
 * Renders user and AI message bubbles with support for streaming indicators,
 * inline action buttons, record link chips, data cards, and action proposal
 * cards (BR-COM-013). Auto-scrolls to the latest message.
 */
export function CopilotChat() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const messages = useCopilotStore((s) => s.messages);
  const user = useAuthStore((s) => s.user);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Derive user initials from auth store
  const userInitials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : '?';

  // Auto-scroll to bottom when messages change.
  // Uses 'auto' (instant) during streaming to avoid queuing dozens of
  // smooth-scroll animations per second as chunks arrive. Falls back
  // to 'smooth' for regular message additions.
  const isStreaming = useCopilotStore((s) => s.isStreaming);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);

    // Debounce during streaming (60ms) to batch rapid chunk updates
    const delay = isStreaming ? 60 : 0;
    scrollTimerRef.current = setTimeout(() => {
      bottomRef.current?.scrollIntoView({
        behavior: isStreaming ? 'auto' : 'smooth',
      });
    }, delay);

    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, [messages, isStreaming]);

  // Handler for inline action buttons
  const handleActionClick = (action: ChatMessageAction) => {
    if (action.type === 'navigate' && action.id) {
      navigate({ to: action.id });
    } else {
      // Execute and confirm actions are not wired in this story
      toast.info(t('copilot.actionProposal.notConnected'));
    }
  };

  if (messages.length === 0) {
    return (
      <ScrollArea className="flex-1">
        <EmptyState />
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div
        className="flex min-h-[200px] flex-col gap-4 p-4"
        aria-live="polite"
        aria-label={t('copilot.drawerLabel')}
      >
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            userInitials={userInitials}
            onActionClick={handleActionClick}
          />
        ))}
        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </ScrollArea>
  );
}
