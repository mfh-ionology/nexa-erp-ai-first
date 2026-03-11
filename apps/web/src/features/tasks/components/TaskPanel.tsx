/**
 * TaskPanel — embedded task card for record detail pages (T2/T3).
 *
 * Replicated from v0 reference `TaskPanel` in `task-panel.tsx` with adaptations:
 *   - useEntityTasks hook wired to real API
 *   - CreateTaskDialog with entityType/entityId pre-filled
 *   - PanelDetailSheet for task detail view
 *   - i18n for all labels
 *   - Concept D card styling (12px radius, purple hover shadow)
 *   - Collapsible completed/cancelled section
 *   - Empty state with CTA
 *   - Loading skeleton
 */

import { useEffect, useRef, useState } from 'react';
import { CheckSquare, ChevronDown, ChevronUp, Plus } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import type { Task } from '../types';
import { useEntityTasks } from '../hooks/use-tasks';
import { CreateTaskDialog } from './CreateTaskDialog';
import { PanelDetailSheet } from './PanelDetailSheet';
import { TaskPanelItem } from './TaskPanelItem';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TaskPanelProps {
  entityType: string;
  entityId: string;
  entityLabel?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskPanel({ entityType, entityId, entityLabel }: TaskPanelProps) {
  const { t } = useI18n();
  const { tasks, isLoading } = useEntityTasks(entityType, entityId);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  // Sync detailTask with fresh query data after mutations
  const detailTaskIdRef = useRef<string | null>(null);
  detailTaskIdRef.current = detailTask?.id ?? null;
  useEffect(() => {
    if (detailTaskIdRef.current) {
      const fresh = tasks.find((t) => t.id === detailTaskIdRef.current);
      if (fresh) setDetailTask(fresh);
    }
  }, [tasks]);

  const activeTasks = tasks.filter(
    (task) => task.status === 'OPEN' || task.status === 'IN_PROGRESS',
  );
  const completedTasks = tasks.filter(
    (task) => task.status === 'COMPLETED' || task.status === 'CANCELLED',
  );

  return (
    <div className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-[#7c3aed]" />
          <h3 className="font-serif text-sm font-semibold text-foreground">
            {t('tasks.panel.title')} ({activeTasks.length})
          </h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setCreateOpen(true)}
          className="h-7 gap-1 text-xs border-border text-foreground hover:bg-[#f5f3ff]"
        >
          <Plus className="h-3 w-3" /> {t('tasks.panel.addTask')}
        </Button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-12 rounded-full" />
              </div>
              <div className="mt-2 pl-6">
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <>
          {/* Empty state */}
          {activeTasks.length === 0 && completedTasks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckSquare className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t('tasks.empty.noEntityTasks')}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCreateOpen(true)}
                className="h-7 gap-1 text-xs border-border text-[#7c3aed] hover:bg-[#f5f3ff]"
              >
                <Plus className="h-3 w-3" /> {t('tasks.panel.addTask')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {activeTasks.map((task) => (
                <TaskPanelItem key={task.id} task={task} onClick={() => setDetailTask(task)} />
              ))}
            </div>
          )}

          {/* Completed/Cancelled tasks — collapsible */}
          {completedTasks.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent"
              >
                <span>
                  {t('tasks.panel.completed')} ({completedTasks.length})
                </span>
                {showCompleted ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              {showCompleted && (
                <div className="mt-2 flex flex-col gap-2">
                  {completedTasks.map((task) => (
                    <TaskPanelItem key={task.id} task={task} onClick={() => setDetailTask(task)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Create Dialog */}
      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        entityType={entityType}
        entityId={entityId}
        entityLabel={entityLabel ?? `${entityType} ${entityId}`}
      />

      {/* Detail Sheet */}
      <PanelDetailSheet
        task={detailTask}
        open={!!detailTask}
        onOpenChange={(open) => {
          if (!open) setDetailTask(null);
        }}
      />
    </div>
  );
}
