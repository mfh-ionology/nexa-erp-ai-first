import { useCallback, useRef, useState } from 'react';
import { GripVertical, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';

import { useI18n } from '@nexa/i18n';

import { PageHeader } from './page-header';
import type { BoardPageProps, BoardColumn, DefaultBoardCardData } from './types';

/**
 * T5: Board Page template (Kanban-style).
 *
 * Provides a horizontal scrollable column layout where cards
 * can be dragged between columns. Used for CRM Pipeline,
 * Production Schedule, and similar board views.
 *
 * Uses native HTML5 drag-and-drop for MVP simplicity.
 */
export function BoardPage<TCard extends { id: string }>({
  // BaseTemplateProps
  title,
  subtitle,
  breadcrumbs,
  isLoading = false,
  children,
  // BoardPage-specific props
  columns,
  onCardMove,
  onCardClick,
  canCreate = false,
  onCreateNew,
  actionBarSlot,
  renderCard,
}: BoardPageProps<TCard>) {
  const { t } = useI18n();
  const breakpoint = useBreakpoint();

  // Drag state (shared between HTML5 drag-and-drop and touch polyfill)
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragSourceColumn, setDragSourceColumn] = useState<string | null>(null);
  const [dropTargetColumn, setDropTargetColumn] = useState<string | null>(null);

  // For mobile: track which column is currently visible via scroll snap
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Live region ref for announcing card moves to screen readers
  const liveRegionRef = useRef<HTMLDivElement>(null);

  // --- Shared move logic ---
  const moveCard = useCallback(
    (cardId: string, fromColumn: string, toColumn: string) => {
      if (fromColumn !== toColumn) {
        onCardMove?.(cardId, fromColumn, toColumn);
        // Announce move to screen readers using the translated column label
        if (liveRegionRef.current) {
          const targetCol = columns.find((c) => c.key === toColumn);
          const columnLabel = targetCol ? t(targetCol.labelKey) : toColumn;
          liveRegionRef.current.textContent = t('board.cardMoved', { column: columnLabel });
        }
      }
    },
    [onCardMove, t, columns],
  );

  const resetDragState = useCallback(() => {
    setDraggedCardId(null);
    setDragSourceColumn(null);
    setDropTargetColumn(null);
  }, []);

  // --- HTML5 Drag handlers (desktop/tablet) ---
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, cardId: string, columnKey: string) => {
      e.dataTransfer.setData('text/plain', cardId);
      e.dataTransfer.effectAllowed = 'move';
      setDraggedCardId(cardId);
      setDragSourceColumn(columnKey);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, columnKey: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropTargetColumn(columnKey);
    },
    [],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
        setDropTargetColumn(null);
      }
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, toColumn: string) => {
      e.preventDefault();
      const cardId = e.dataTransfer.getData('text/plain');
      if (cardId && dragSourceColumn) {
        moveCard(cardId, dragSourceColumn, toColumn);
      }
      resetDragState();
    },
    [dragSourceColumn, moveCard, resetDragState],
  );

  // --- Touch handlers (mobile polyfill for HTML5 DnD) ---
  const touchStartRef = useRef<{ cardId: string; columnKey: string; startY: number } | null>(null);

  const handleTouchStart = useCallback(
    (cardId: string, columnKey: string, startY: number) => {
      touchStartRef.current = { cardId, columnKey, startY };
      setDraggedCardId(cardId);
      setDragSourceColumn(columnKey);
    },
    [],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      if (!touch) { resetDragState(); return; }

      // Find the column element under the touch point
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const columnEl = target?.closest('[data-board-column]');
      const toColumn = columnEl?.getAttribute('data-board-column');

      if (toColumn && touchStartRef.current.columnKey) {
        moveCard(touchStartRef.current.cardId, touchStartRef.current.columnKey, toColumn);
      }
      touchStartRef.current = null;
      resetDragState();
    },
    [moveCard, resetDragState],
  );

  // --- Header actions ---
  const headerActions = actionBarSlot ?? (
    <div className="flex items-center gap-2">
      {canCreate && (
        <Button onClick={onCreateNew} size="sm">
          <Plus className="size-4" />
          {t('board.newCard')}
        </Button>
      )}
    </div>
  );

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <main className="flex flex-col gap-4" aria-label={title} aria-busy="true">
        <PageHeader
          title={title}
          breadcrumbs={breadcrumbs}
          isLoading
        />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex w-72 shrink-0 flex-col gap-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4" aria-label={title}>
      {/* Page header */}
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        actionBarSlot={headerActions}
      />

      {/* Board area */}
      {breakpoint === 'phone' ? (
        /* Phone: single column visible, horizontal scroll snap */
        <div
          ref={scrollContainerRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 -mx-4 px-4"
          role="region"
          aria-label={title}
        >
          {columns.map((column) => (
            <BoardColumnComponent
              key={column.key}
              column={column}
              className="w-[85vw] shrink-0 snap-center"
              draggedCardId={draggedCardId}
              isDropTarget={dropTargetColumn === column.key}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={resetDragState}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onCardClick={onCardClick}
              renderCard={renderCard}
            />
          ))}
        </div>
      ) : (
        /* Tablet/Desktop: horizontal scroll with all/some columns visible */
        <ScrollArea className="w-full">
          <div
            className={cn(
              'flex gap-4 pb-4',
              'min-w-max',
            )}
            role="region"
            aria-label={title}
          >
            {columns.map((column) => (
              <BoardColumnComponent
                key={column.key}
                column={column}
                className={cn(
                  'shrink-0',
                  breakpoint === 'tablet' ? 'w-64' : 'w-72',
                )}
                draggedCardId={draggedCardId}
                isDropTarget={dropTargetColumn === column.key}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnd={resetDragState}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onCardClick={onCardClick}
                renderCard={renderCard}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      {/* Screen reader live region for drag announcements */}
      <div
        ref={liveRegionRef}
        className="sr-only"
        aria-live="assertive"
        aria-atomic="true"
        role="status"
      />

      {/* Children slot */}
      {children}
    </main>
  );
}

// --- Internal: Board Column ---

interface BoardColumnComponentProps<TCard extends { id: string }> {
  column: BoardColumn<TCard>;
  className?: string;
  draggedCardId: string | null;
  isDropTarget: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, cardId: string, columnKey: string) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, columnKey: string) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, columnKey: string) => void;
  onDragEnd: () => void;
  onTouchStart?: (cardId: string, columnKey: string, startY: number) => void;
  onTouchEnd?: (e: React.TouchEvent<HTMLDivElement>) => void;
  onCardClick?: (card: TCard) => void;
  renderCard?: (card: TCard) => React.ReactNode;
}

function BoardColumnComponent<TCard extends { id: string }>({
  column,
  className,
  draggedCardId,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onTouchStart,
  onTouchEnd,
  onCardClick,
  renderCard,
}: BoardColumnComponentProps<TCard>) {
  const { t } = useI18n();

  return (
    <div
      data-board-column={column.key}
      className={cn(
        'flex flex-col rounded-lg bg-muted/50 transition-colors motion-reduce:transition-none',
        isDropTarget && 'bg-primary/5 ring-2 ring-primary/20',
        className,
      )}
      onDragOver={(e) => onDragOver(e, column.key)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, column.key)}
      role="group"
      aria-label={t('board.columnAriaLabel', {
        label: t(column.labelKey),
        count: column.cards.length,
      })}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          {column.color && (
            <div
              className="size-2.5 rounded-full shrink-0"
              style={{ backgroundColor: column.color }}
              aria-hidden="true"
            />
          )}
          <h3 className="text-sm font-semibold text-foreground truncate">
            {t(column.labelKey)}
          </h3>
        </div>
        <Badge variant="secondary" className="text-xs tabular-nums">
          {column.cards.length}
        </Badge>
      </div>

      {/* Cards list */}
      <div className="flex flex-col gap-2 px-2 pb-2 min-h-[120px]">
        {column.cards.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            {t('board.emptyColumn')}
          </div>
        ) : (
          column.cards.map((card) =>
            renderCard ? (
              <BoardCardWrapper
                key={card.id}
                cardId={card.id}
                columnKey={column.key}
                isDragging={draggedCardId === card.id}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                onClick={onCardClick ? () => onCardClick(card) : undefined}
              >
                {renderCard(card)}
              </BoardCardWrapper>
            ) : (
              <BoardCard
                key={card.id}
                card={card as unknown as DefaultBoardCardData}
                columnKey={column.key}
                isDragging={draggedCardId === card.id}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                onClick={onCardClick ? () => onCardClick(card) : undefined}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}

// --- Internal: Board Card Wrapper (for custom renderCard) ---

interface BoardCardWrapperProps {
  cardId: string;
  columnKey: string;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, cardId: string, columnKey: string) => void;
  onDragEnd: () => void;
  onTouchStart?: (cardId: string, columnKey: string, startY: number) => void;
  onTouchEnd?: (e: React.TouchEvent<HTMLDivElement>) => void;
  onClick?: () => void;
  children: React.ReactNode;
}

function BoardCardWrapper({
  cardId,
  columnKey,
  isDragging,
  onDragStart,
  onDragEnd,
  onTouchStart,
  onTouchEnd,
  onClick,
  children,
}: BoardCardWrapperProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, cardId, columnKey)}
      onDragEnd={onDragEnd}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        if (touch) onTouchStart?.(cardId, columnKey, touch.clientY);
      }}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      tabIndex={0}
      role="article"
      aria-roledescription="draggable"
      data-dragging={isDragging || undefined}
      className={cn(
        'cursor-grab active:cursor-grabbing',
        'transition-all motion-reduce:transition-none',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary',
        onClick && 'cursor-pointer',
      )}
    >
      {children}
    </div>
  );
}

// --- Internal: Default Board Card (for DefaultBoardCardData shape) ---

interface BoardCardProps {
  card: DefaultBoardCardData;
  columnKey: string;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, cardId: string, columnKey: string) => void;
  onDragEnd: () => void;
  onTouchStart?: (cardId: string, columnKey: string, startY: number) => void;
  onTouchEnd?: (e: React.TouchEvent<HTMLDivElement>) => void;
  onClick?: () => void;
}

function BoardCard({
  card,
  columnKey,
  isDragging,
  onDragStart,
  onDragEnd,
  onTouchStart,
  onTouchEnd,
  onClick,
}: BoardCardProps) {
  const { t } = useI18n();

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, card.id, columnKey)}
      onDragEnd={onDragEnd}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        if (touch) onTouchStart?.(card.id, columnKey, touch.clientY);
      }}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      tabIndex={0}
      role="article"
      aria-label={card.title}
      aria-roledescription="draggable"
      data-dragging={isDragging || undefined}
      className={cn(
        'cursor-grab hover:shadow-md active:cursor-grabbing',
        'transition-all motion-reduce:transition-none',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary',
        onClick && 'cursor-pointer',
      )}
    >
      <CardHeader className="p-3 pb-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm leading-snug line-clamp-2">
            {card.title}
          </CardTitle>
          <GripVertical
            className="size-4 shrink-0 text-muted-foreground"
            aria-label={t('board.dragCard')}
          />
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {card.subtitle && (
          <p className="text-xs text-muted-foreground truncate">
            {card.subtitle}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          {card.status && (
            <Badge variant="secondary" className="text-xs">
              {card.status}
            </Badge>
          )}
          {card.assignee && (
            <div
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary"
              aria-label={card.assignee}
              title={card.assignee}
            >
              {card.assignee.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
