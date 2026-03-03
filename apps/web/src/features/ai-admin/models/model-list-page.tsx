/* eslint-disable i18next/no-literal-string */
/**
 * Model Registry List Page — T1 EntityListPage for AI models.
 *
 * AC-2: Shows all AI models with columns for name, provider, model ID,
 * max tokens, costs, routing tags, active status, and default flag.
 * Supports search, column sorting, and cursor-based pagination.
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

import type { AiModelListItem } from '../api/types';
import { useAiModels, useUpdateAiModel, useDeleteAiModel } from '../api/use-ai-models';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a number with locale-aware thousand separators (e.g. 200,000) */
function formatTokenCount(value: number): string {
  return value.toLocaleString('en-GB');
}

/** Format a decimal cost string as currency (e.g. "$15.00") */
function formatCost(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return `$${num.toFixed(2)}`;
}

/** Capitalise the first letter of a string */
function capitalise(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ModelListPage() {
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
    useAiModels(queryParams);
  const models = data?.data ?? [];

  // --- Mutations ---
  const updateModel = useUpdateAiModel();
  const deleteModel = useDeleteAiModel();

  // --- Delete confirmation state ---
  const [deleteTarget, setDeleteTarget] = useState<AiModelListItem | null>(null);

  const handleToggleActive = useCallback(
    (model: AiModelListItem) => {
      updateModel.mutate(
        { id: model.id, data: { isActive: !model.isActive } },
        {
          onError: (error: Error) => {
            toast.error(error.message || 'Failed to update model status');
          },
        },
      );
    },
    [updateModel],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteModel.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
      },
      onError: (error: Error) => {
        toast.error(error.message || 'Failed to delete model');
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, deleteModel]);

  // --- Column definitions (subtask 8.2) ---
  const columns = useMemo<ColumnDef<AiModelListItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="font-mono text-sm font-semibold">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'provider',
        header: 'Provider',
        enableSorting: true,
        cell: ({ getValue }) => (
          <Badge variant="outline" className="text-xs">
            {capitalise(getValue<string>())}
          </Badge>
        ),
      },
      {
        accessorKey: 'modelId',
        header: 'Model ID',
        cell: ({ getValue }) => {
          const value = getValue<string>();
          return (
            <span className="inline-block max-w-[180px] truncate font-mono text-sm" title={value}>
              {value}
            </span>
          );
        },
      },
      {
        accessorKey: 'maxInputTokens',
        header: 'Max Tokens',
        meta: { align: 'right' },
        cell: ({ getValue }) => (
          <span className="font-mono text-sm tabular-nums">
            {formatTokenCount(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: 'costPerMInput',
        header: 'Cost/M In',
        meta: { align: 'right' },
        cell: ({ getValue }) => (
          <span className="font-mono text-sm tabular-nums">{formatCost(getValue<string>())}</span>
        ),
      },
      {
        accessorKey: 'costPerMOutput',
        header: 'Cost/M Out',
        meta: { align: 'right' },
        cell: ({ getValue }) => (
          <span className="font-mono text-sm tabular-nums">{formatCost(getValue<string>())}</span>
        ),
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
      {
        accessorKey: 'isDefault',
        header: 'Default',
        cell: ({ getValue }) => {
          const isDefault = getValue<boolean>();
          if (!isDefault) return null;
          return (
            <Badge className="bg-[#7c3aed] text-white hover:bg-[#5b21b6] text-xs">Default</Badge>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const model = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative size-11 text-muted-foreground hover:bg-[#f5f3ff]"
                  aria-label={`Actions for ${model.name}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={() => void navigate({ to: `/ai/admin/models/${model.id}` as string })}
                >
                  <Pencil className="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleToggleActive(model)}>
                  <Power className="mr-2 size-4" />
                  {model.isActive ? 'Deactivate' : 'Activate'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[#dc2626] focus:text-[#dc2626]"
                  onClick={() => setDeleteTarget(model)}
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
    () => [{ label: 'AI Administration', path: '/ai/admin' }, { label: 'Model Registry' }],
    [],
  );

  return (
    <>
      <EntityListPage<AiModelListItem>
        title="Model Registry"
        breadcrumbs={breadcrumbs}
        entityType="ai-model"
        columns={columns}
        data={models}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, provider, or model ID..."
        canCreate
        onCreateNew={() => void navigate({ to: '/ai/admin/models/new' as string })}
        onRowClick={(row) => void navigate({ to: `/ai/admin/models/${row.id}` as string })}
        hasMore={hasNextPage}
        onLoadMore={() => void fetchNextPage()}
        isLoadingMore={isFetchingNextPage}
        getRowId={(row) => row.id}
        batchActions={[]}
      />

      {/* Delete confirmation dialog (subtask 8.3) */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="animate-step-in sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Delete Model</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this model? This action cannot be undone.
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
