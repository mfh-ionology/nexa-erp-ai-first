/* eslint-disable i18next/no-literal-string */
/**
 * Automation List Page — T1 EntityListPage for AI automations.
 *
 * AC-1: Shows all automations with columns for name, trigger type (badge),
 * schedule (human-readable cron), step count, last run status, last run time,
 * and active toggle. Supports search, overflow actions, cursor-based pagination.
 *
 * AC-9: "Run Now" action with confirmation dialog triggers POST /ai/automations/:id/run.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Pencil, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EntityListPage } from '@/components/templates/entity-list-page';
import { cn } from '@/lib/utils';

import type {
  AiAutomationListItem,
  AutomationRunStatus,
  AutomationTriggerType,
} from '../api/types';
import {
  useAiAutomations,
  useDeleteAiAutomation,
  useRunAutomation,
  useToggleAutomationActive,
} from '../api/use-ai-automations';
import { cronToHumanReadable } from './components/cron-builder';

// ─── Trigger type badge config ───────────────────────────────────────────────

const TRIGGER_BADGE_CONFIG: Record<AutomationTriggerType, { label: string; className: string }> = {
  SCHEDULED: {
    label: 'Scheduled',
    className: 'bg-[#f5f3ff] text-[#7c3aed] border border-[#7c3aed]/20',
  },
  EVENT: {
    label: 'Event',
    className: 'bg-[#eff6ff] text-[#2563eb] border border-[#2563eb]/20',
  },
  CHAIN: {
    label: 'Chain',
    className: 'bg-[#fffbeb] text-[#d97706] border border-[#d97706]/20',
  },
  MANUAL: {
    label: 'Manual',
    className: 'bg-[#f3f4f6] text-[#6b7280] border border-[#6b7280]/20',
  },
};

// ─── Run status config ───────────────────────────────────────────────────────

const RUN_STATUS_CONFIG: Record<AutomationRunStatus, { label: string; dotColor: string }> = {
  COMPLETED: { label: 'Completed', dotColor: 'bg-[#10b981]' },
  FAILED: { label: 'Failed', dotColor: 'bg-[#dc2626]' },
  RUNNING: { label: 'Running', dotColor: 'bg-[#f59e0b]' },
  PENDING: { label: 'Pending', dotColor: 'bg-[#d1d5db]' },
  CANCELLED: { label: 'Cancelled', dotColor: 'bg-[#9ca3af]' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function AutomationListPage() {
  const navigate = useNavigate();

  // --- Search state with 300ms debounce ---
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // --- Query params ---
  const queryParams = useMemo(() => {
    const params: Record<string, string | boolean> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [debouncedSearch]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useAiAutomations(queryParams);
  const automations = data?.data ?? [];

  // --- Mutations ---
  const toggleActive = useToggleAutomationActive();
  const deleteAutomation = useDeleteAiAutomation();
  const runAutomation = useRunAutomation();

  // --- Dialog state ---
  const [deleteTarget, setDeleteTarget] = useState<AiAutomationListItem | null>(null);
  const [runTarget, setRunTarget] = useState<AiAutomationListItem | null>(null);

  const handleToggleActive = useCallback(
    (automation: AiAutomationListItem, checked: boolean) => {
      toggleActive.mutate(
        { id: automation.id, isActive: checked },
        {
          onError: (error: Error) => {
            toast.error(error.message || 'Failed to update automation status');
          },
        },
      );
    },
    [toggleActive],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteAutomation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
      },
      onError: (error: Error) => {
        toast.error(error.message || 'Failed to delete automation');
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, deleteAutomation]);

  const handleRunConfirm = useCallback(() => {
    if (!runTarget) return;
    runAutomation.mutate(
      { id: runTarget.id },
      {
        onSuccess: () => {
          setRunTarget(null);
        },
        onError: (error: Error) => {
          toast.error(error.message || 'Failed to start automation');
          setRunTarget(null);
        },
      },
    );
  }, [runTarget, runAutomation]);

  // --- Column definitions ---
  const columns = useMemo<ColumnDef<AiAutomationListItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">{row.original.name}</span>
            {row.original.description && (
              <span className="text-xs text-muted-foreground line-clamp-1">
                {row.original.description}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'triggerType',
        header: 'Trigger',
        enableSorting: true,
        cell: ({ getValue }) => {
          const type = getValue<AutomationTriggerType>();
          const config = TRIGGER_BADGE_CONFIG[type];
          return (
            <Badge variant="secondary" className={cn('text-xs', config.className)}>
              {config.label}
            </Badge>
          );
        },
      },
      {
        id: 'schedule',
        header: 'Schedule',
        cell: ({ row }) => {
          const schedule = row.original.schedule;
          if (!schedule) {
            return <span className="text-sm text-muted-foreground">&mdash;</span>;
          }
          return (
            <span className="text-sm text-muted-foreground">
              {cronToHumanReadable(schedule.cronExpression)}
            </span>
          );
        },
      },
      {
        accessorKey: 'stepCount',
        header: 'Steps',
        cell: ({ getValue }) => (
          <span className="font-mono text-sm text-muted-foreground">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: 'lastRunStatus',
        header: 'Last Run',
        cell: ({ getValue }) => {
          const status = getValue<AutomationRunStatus | null>();
          if (!status) {
            return <span className="text-sm text-muted-foreground">Never run</span>;
          }
          const config = RUN_STATUS_CONFIG[status];
          return (
            <div className="flex items-center gap-2">
              <span className={cn('size-2 rounded-full', config.dotColor)} aria-hidden="true" />
              <span className="text-sm">{config.label}</span>
            </div>
          );
        },
      },
      {
        id: 'lastRunTime',
        header: 'Last Run Time',
        cell: ({ row }) => {
          const lastRunAt = row.original.lastRunAt;
          if (!lastRunAt) {
            return <span className="text-sm text-muted-foreground">&mdash;</span>;
          }
          return (
            <span className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(lastRunAt), { addSuffix: true })}
            </span>
          );
        },
      },
      {
        accessorKey: 'isActive',
        header: 'Active',
        cell: ({ row }) => {
          const automation = row.original;
          return (
            <Switch
              checked={automation.isActive}
              onCheckedChange={(checked) => handleToggleActive(automation, checked)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Toggle ${automation.name} active`}
            />
          );
        },
      },
      // --- Overflow actions column ---
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const automation = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative size-11 text-muted-foreground hover:bg-[#f5f3ff]"
                  aria-label={`Actions for ${automation.name}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={() =>
                    void navigate({ to: `/ai/admin/automations/${automation.id}` as string })
                  }
                >
                  <Pencil className="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRunTarget(automation)}>
                  <Play className="mr-2 size-4" />
                  Run Now
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[#dc2626] focus:text-[#dc2626]"
                  onClick={() => setDeleteTarget(automation)}
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [navigate, handleToggleActive],
  );

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [{ label: 'AI Administration', path: '/ai/admin' }, { label: 'Automations' }],
    [],
  );

  return (
    <>
      <EntityListPage<AiAutomationListItem>
        title="Automations"
        breadcrumbs={breadcrumbs}
        entityType="ai-automation"
        columns={columns}
        data={automations}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or description..."
        canCreate
        onCreateNew={() => void navigate({ to: '/ai/admin/automations/new' as string })}
        onRowClick={(row) => void navigate({ to: `/ai/admin/automations/${row.id}` as string })}
        hasMore={hasNextPage}
        onLoadMore={() => void fetchNextPage()}
        isLoadingMore={isFetchingNextPage}
        getRowId={(row) => row.id}
        batchActions={[]}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="animate-step-in sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Delete Automation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this automation? This action cannot be undone. Any
              scheduled runs will be cancelled.
            </AlertDialogDescription>
            {deleteTarget && (
              <p className="mt-2 rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
                {deleteTarget.name}
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="rounded-lg bg-[#dc2626] text-white hover:bg-[#b91c1c]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Run Now confirmation dialog (AC-9) */}
      <AlertDialog
        open={!!runTarget}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRunTarget(null);
        }}
      >
        <AlertDialogContent className="animate-step-in sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Run Automation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to run this automation now? It will execute immediately.
            </AlertDialogDescription>
            {runTarget && (
              <p className="mt-2 rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
                {runTarget.name}
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRunConfirm}
              className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
            >
              Run Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
