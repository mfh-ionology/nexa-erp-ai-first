/* eslint-disable i18next/no-literal-string */
/**
 * Automation Runs List Page — T1 EntityListPage for automation run history.
 *
 * AC-1: Shows all runs with columns for automation name, trigger type badge,
 * triggered by, started at, duration, status, total tokens, total cost.
 * Supports column sorting and cursor-based pagination.
 *
 * AC-2: Filter bar with status multi-select, date range, and optional
 * automation name filter (visible in "all runs" mode).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import { MoreHorizontal, RotateCcw, Eye } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EntityListPage } from '@/components/templates/entity-list-page';
import type { BreadcrumbSegment } from '@/components/templates/types';
import { cn } from '@/lib/utils';

import type {
  AiAutomationRunListItem,
  AutomationRunStatus,
  AutomationTriggerType,
} from '../api/types';
import {
  useAllAutomationRuns,
  useAutomationRuns,
  useRetryAutomationRun,
} from '../api/use-ai-automation-runs';
import {
  RUN_STATUS_CONFIG,
  TRIGGER_BADGE_CONFIG,
  formatDuration,
  formatTriggeredBy,
} from '../shared/automation-constants';
import { AutomationRunFilterBar } from './automation-run-filter-bar';

// ─── Filter state type ───────────────────────────────────────────────────────

export interface RunFilters {
  statuses: AutomationRunStatus[];
  dateFrom: string;
  dateTo: string;
  automationId: string;
}

const INITIAL_FILTERS: RunFilters = {
  statuses: [],
  dateFrom: '',
  dateTo: '',
  automationId: '',
};

// ─── Component ───────────────────────────────────────────────────────────────

interface AutomationRunListPageProps {
  /** When provided, scopes runs to a specific automation */
  automationId?: string;
  /** Automation name for breadcrumb (when scoped) */
  automationName?: string;
}

export function AutomationRunListPage({
  automationId,
  automationName,
}: AutomationRunListPageProps) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<RunFilters>(INITIAL_FILTERS);
  const [retryTarget, setRetryTarget] = useState<AiAutomationRunListItem | null>(null);

  // Build query params from filter state
  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = {};
    if (filters.statuses.length === 1) params.status = filters.statuses[0];
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (filters.automationId) params.automationId = filters.automationId;
    return params;
  }, [filters]);

  // Use the appropriate hook based on whether we're scoped to an automation
  const allRunsQuery = useAllAutomationRuns(automationId ? undefined : queryParams);
  const scopedRunsQuery = useAutomationRuns(automationId, automationId ? queryParams : undefined);

  const activeQuery = automationId ? scopedRunsQuery : allRunsQuery;
  const runs = activeQuery.data?.data ?? [];

  // Client-side multi-status filtering (API only supports single status).
  // When multi-status is active, server returns unfiltered results; we filter client-side.
  const isMultiStatusFilter = filters.statuses.length > 1;
  const filteredRuns = useMemo(() => {
    if (!isMultiStatusFilter) return runs;
    return runs.filter((run) => filters.statuses.includes(run.status));
  }, [runs, filters.statuses, isMultiStatusFilter]);

  // Auto-load more pages when multi-status filter yields few visible results.
  // Cap at 5 extra page fetches (250 total records at 50/page) to avoid unbounded fetching.
  const totalPagesFetched = activeQuery.data?.pages?.length ?? 0;
  const MAX_AUTO_FETCH_PAGES = 5;
  useEffect(() => {
    if (
      isMultiStatusFilter &&
      filteredRuns.length < 20 &&
      activeQuery.hasNextPage &&
      !activeQuery.isFetchingNextPage &&
      totalPagesFetched < MAX_AUTO_FETCH_PAGES
    ) {
      void activeQuery.fetchNextPage();
    }
  }, [
    isMultiStatusFilter,
    filteredRuns.length,
    activeQuery.hasNextPage,
    activeQuery.isFetchingNextPage,
    activeQuery.fetchNextPage,
    totalPagesFetched,
  ]);

  // Retry mutation
  const retryMutation = useRetryAutomationRun();

  const handleRetryConfirm = useCallback(() => {
    if (!retryTarget) return;
    retryMutation.mutate(retryTarget.id, {
      onSuccess: () => {
        setRetryTarget(null);
      },
      onError: (error: Error) => {
        toast.error(error.message || 'Failed to retry automation run');
        setRetryTarget(null);
      },
    });
  }, [retryTarget, retryMutation]);

  const handleClearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  // Column definitions
  const columns = useMemo<ColumnDef<AiAutomationRunListItem>[]>(
    () => [
      {
        accessorKey: 'automationName',
        header: 'Automation',
        enableSorting: true,
        cell: ({ row }) => (
          <button
            type="button"
            className="text-left text-sm font-semibold text-foreground hover:text-[#7c3aed] hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              void navigate({ to: `/ai/admin/automations/${row.original.automationId}` as string });
            }}
          >
            {row.original.automationName}
          </button>
        ),
      },
      {
        accessorKey: 'triggerType',
        header: 'Trigger',
        cell: ({ getValue }) => {
          const type = getValue<AutomationTriggerType | undefined>();
          if (!type) return <span className="text-sm text-muted-foreground">&mdash;</span>;
          const config = TRIGGER_BADGE_CONFIG[type];
          return (
            <Badge variant="secondary" className={cn('text-xs', config.className)}>
              {config.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'triggeredBy',
        header: 'Triggered By',
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">
            {formatTriggeredBy(getValue<string>())}
          </span>
        ),
      },
      {
        accessorKey: 'startedAt',
        header: 'Started At',
        enableSorting: true,
        cell: ({ getValue }) => {
          const v = getValue<string | null>();
          if (!v) return <span className="text-sm text-muted-foreground">&mdash;</span>;
          return (
            <span className="text-sm text-muted-foreground">
              {format(new Date(v), 'dd MMM yyyy HH:mm:ss')}
            </span>
          );
        },
      },
      {
        id: 'duration',
        header: 'Duration',
        enableSorting: true,
        accessorFn: (row) => {
          if (!row.startedAt) return -1;
          if (!row.completedAt) return Infinity;
          return new Date(row.completedAt).getTime() - new Date(row.startedAt).getTime();
        },
        cell: ({ row }) => (
          <span className="text-sm font-mono text-muted-foreground">
            {formatDuration(row.original.startedAt, row.original.completedAt, row.original.status)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableSorting: true,
        cell: ({ getValue }) => {
          const status = getValue<AutomationRunStatus>();
          const config = RUN_STATUS_CONFIG[status];
          return (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'size-2 rounded-full',
                  config.dotColor,
                  status === 'RUNNING' && 'animate-pulse',
                )}
                aria-hidden="true"
              />
              <span className="text-sm">{config.label}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'totalTokens',
        header: 'Tokens',
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="font-mono text-sm text-muted-foreground">
            {getValue<number>().toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: 'totalCost',
        header: 'Cost',
        cell: ({ getValue }) => {
          const cost = getValue<string>();
          const num = parseFloat(cost);
          return (
            <span className="font-mono text-sm text-muted-foreground">
              {isNaN(num) ? '\u2014' : `\u00A3${num.toFixed(4)}`}
            </span>
          );
        },
      },
      // Step count — not available on list endpoint; show "—" per AC-1
      {
        id: 'stepCount',
        header: 'Steps',
        cell: () => <span className="font-mono text-sm text-muted-foreground">&mdash;</span>,
      },
      // Actions column
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const run = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative size-11 text-muted-foreground hover:bg-[#f5f3ff]"
                  aria-label={`Actions for run ${run.id.slice(0, 8)}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={() =>
                    void navigate({ to: `/ai/admin/automations/runs/${run.id}` as string })
                  }
                >
                  <Eye className="mr-2 size-4" />
                  View Details
                </DropdownMenuItem>
                {run.status === 'FAILED' && (
                  <DropdownMenuItem onClick={() => setRetryTarget(run)}>
                    <RotateCcw className="mr-2 size-4" />
                    Retry
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [navigate],
  );

  // Breadcrumbs
  const breadcrumbs = useMemo<BreadcrumbSegment[]>(() => {
    const crumbs: BreadcrumbSegment[] = [
      { label: 'AI Administration', path: '/ai/admin' },
      { label: 'Automations', path: '/ai/admin/automations' },
    ];
    if (automationId && automationName) {
      crumbs.push({ label: automationName, path: `/ai/admin/automations/${automationId}` });
    }
    crumbs.push({ label: 'Runs' });
    return crumbs;
  }, [automationId, automationName]);

  // Determine if any filters are active
  const hasActiveFilters =
    filters.statuses.length > 0 ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '' ||
    filters.automationId !== '';

  return (
    <>
      <EntityListPage<AiAutomationRunListItem>
        title="Automation Runs"
        breadcrumbs={breadcrumbs}
        entityType="ai-automation-run"
        columns={columns}
        data={filteredRuns}
        isLoading={activeQuery.isLoading}
        onRowClick={(row) =>
          void navigate({ to: `/ai/admin/automations/runs/${row.id}` as string })
        }
        hasMore={activeQuery.hasNextPage}
        onLoadMore={() => void activeQuery.fetchNextPage()}
        isLoadingMore={activeQuery.isFetchingNextPage}
        getRowId={(row) => row.id}
        batchActions={[]}
        filterSlot={
          <AutomationRunFilterBar
            filters={filters}
            onChange={setFilters}
            onClear={handleClearFilters}
            hasActiveFilters={hasActiveFilters}
            showAutomationFilter={!automationId}
          />
        }
      />

      {/* Retry confirmation dialog */}
      <AlertDialog
        open={!!retryTarget}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRetryTarget(null);
        }}
      >
        <AlertDialogContent className="animate-step-in sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Retry Automation Run</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new run starting from the failed step. Previous step outputs will
              be preserved.
            </AlertDialogDescription>
            {retryTarget && (
              <p className="mt-2 rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
                {retryTarget.automationName} &mdash; {retryTarget.id.slice(0, 8)}
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRetryConfirm}
              className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
            >
              Retry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
