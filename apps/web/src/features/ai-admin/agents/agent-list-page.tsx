/* eslint-disable i18next/no-literal-string */
/**
 * Agent Configuration List Page — T1 EntityListPage for AI agents.
 *
 * AC-1: Shows all AI agents with columns for name, display name, model,
 * prompt, tool count, routing tags, max turns, and active status.
 * Supports search, overflow actions, and cursor-based pagination.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';
import { MoreHorizontal, Pencil, Power, Trash2 } from 'lucide-react';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EntityListPage } from '@/components/templates/entity-list-page';
import { cn } from '@/lib/utils';

import type { AiAgentListItem } from '../api/types';
import { useAiAgents, useUpdateAiAgent, useDeleteAiAgent } from '../api/use-ai-agents';

// ─── Component ───────────────────────────────────────────────────────────────

export function AgentListPage() {
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
    useAiAgents(queryParams);
  const agents = data?.data ?? [];

  // --- Mutations ---
  const updateAgent = useUpdateAiAgent();
  const deleteAgent = useDeleteAiAgent();

  // --- Delete confirmation state ---
  const [deleteTarget, setDeleteTarget] = useState<AiAgentListItem | null>(null);

  const handleToggleActive = useCallback(
    (agent: AiAgentListItem) => {
      updateAgent.mutate(
        { id: agent.id, data: { isActive: !agent.isActive } },
        {
          onSuccess: () => {
            toast.success(
              `Agent ${agent.displayName} ${agent.isActive ? 'deactivated' : 'activated'}`,
            );
          },
          onError: (error: Error) => {
            toast.error(error.message || 'Failed to update agent status');
          },
        },
      );
    },
    [updateAgent],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteAgent.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
      },
      onError: (error: Error) => {
        toast.error(error.message || 'Failed to delete agent');
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, deleteAgent]);

  // --- Column definitions (subtask 7.2) ---
  const columns = useMemo<ColumnDef<AiAgentListItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="font-mono text-sm font-bold">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'displayName',
        header: 'Display Name',
        enableSorting: true,
        cell: ({ getValue }) => <span className="text-sm">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'modelDisplayName',
        header: 'Model',
        cell: ({ row }) => {
          const modelId = row.original.modelId;
          const modelDisplayName = row.original.modelDisplayName;
          if (!modelId) {
            return <span className="text-sm italic text-muted-foreground">Auto-routed</span>;
          }
          return <span className="text-sm">{modelDisplayName}</span>;
        },
      },
      {
        accessorKey: 'promptName',
        header: 'Prompt',
        cell: ({ getValue }) => <span className="font-mono text-sm">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'toolCount',
        header: 'Tools',
        cell: ({ getValue }) => {
          const count = getValue<number>();
          return (
            <span className="font-mono text-sm">
              {count} {count === 1 ? 'tool' : 'tools'}
            </span>
          );
        },
      },
      {
        accessorKey: 'routingTags',
        header: 'Routing Tags',
        cell: ({ getValue }) => {
          const tags = getValue<string[]>();
          if (!tags || tags.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="bg-[#f5f3ff] text-[#7c3aed] border border-[#7c3aed]/20 text-xs"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        accessorKey: 'maxTurns',
        header: 'Max Turns',
        cell: ({ getValue }) => <span className="font-mono text-sm">{getValue<number>()}</span>,
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ getValue }) => {
          const isActive = getValue<boolean>();
          return (
            <div className="flex items-center gap-2">
              <span
                className={cn('size-2 rounded-full', isActive ? 'bg-[#10b981]' : 'bg-[#d1d5db]')}
                aria-hidden="true"
              />
              <span
                className={cn('text-sm', isActive ? 'text-foreground' : 'text-muted-foreground')}
              >
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          );
        },
      },
      // --- Overflow actions column (subtask 7.3) ---
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const agent = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative size-11 text-muted-foreground hover:bg-[#f5f3ff]"
                  aria-label={`Actions for ${agent.name}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={() => void navigate({ to: `/ai/admin/agents/${agent.id}` as string })}
                >
                  <Pencil className="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleToggleActive(agent)}>
                  <Power className="mr-2 size-4" />
                  {agent.isActive ? 'Deactivate' : 'Activate'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[#dc2626] focus:text-[#dc2626]"
                  onClick={() => setDeleteTarget(agent)}
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
    () => [{ label: 'AI Administration', path: '/ai/admin' }, { label: 'Agent Configuration' }],
    [],
  );

  return (
    <>
      <EntityListPage<AiAgentListItem>
        title="Agent Configuration"
        breadcrumbs={breadcrumbs}
        entityType="ai-agent"
        columns={columns}
        data={agents}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, display name, or description..."
        canCreate
        onCreateNew={() => void navigate({ to: '/ai/admin/agents/new' as string })}
        onRowClick={(row) => void navigate({ to: `/ai/admin/agents/${row.id}` as string })}
        hasMore={hasNextPage}
        onLoadMore={() => void fetchNextPage()}
        isLoadingMore={isFetchingNextPage}
        getRowId={(row) => row.id}
        batchActions={[]}
      />

      {/* Delete confirmation dialog (subtask 7.3) */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="animate-step-in sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this agent? This action cannot be undone. If this
              agent is referenced by automation steps, deletion will be blocked.
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
    </>
  );
}
