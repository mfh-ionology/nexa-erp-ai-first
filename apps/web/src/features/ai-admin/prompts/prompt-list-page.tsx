/* eslint-disable i18next/no-literal-string */
/**
 * Prompt Templates List Page — T1 EntityListPage for AI prompts.
 *
 * AC-4: Shows all prompt templates with columns for name, category,
 * active version, variable count, active status, and last updated.
 * Supports category filtering, search, and cursor-based pagination.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EntityListPage } from '@/components/templates/entity-list-page';
import { cn } from '@/lib/utils';

import type { AiPromptListItem, PromptCategory } from '../api/types';
import { useAiPrompts, useUpdateAiPrompt, useDeleteAiPrompt } from '../api/use-ai-prompts';

// ─── Category badge colours ──────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'record-creation': {
    bg: 'bg-[#f5f3ff]',
    text: 'text-[#7c3aed]',
    border: 'border-[#7c3aed]/20',
  },
  query: {
    bg: 'bg-[#eff6ff]',
    text: 'text-[#2563eb]',
    border: 'border-[#2563eb]/20',
  },
  analysis: {
    bg: 'bg-[#fffbeb]',
    text: 'text-[#d97706]',
    border: 'border-[#d97706]/20',
  },
  briefing: {
    bg: 'bg-[#ecfdf5]',
    text: 'text-[#059669]',
    border: 'border-[#059669]/20',
  },
  skill: {
    bg: 'bg-[#eef2ff]',
    text: 'text-[#4f46e5]',
    border: 'border-[#4f46e5]/20',
  },
  chat: {
    bg: 'bg-[#f0fdfa]',
    text: 'text-[#0d9488]',
    border: 'border-[#0d9488]/20',
  },
  automation: {
    bg: 'bg-[#fff7ed]',
    text: 'text-[#ea580c]',
    border: 'border-[#ea580c]/20',
  },
};

const CATEGORY_OPTIONS: Array<{ value: PromptCategory; label: string }> = [
  { value: 'record-creation', label: 'Record Creation' },
  { value: 'query', label: 'Query' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'briefing', label: 'Briefing' },
  { value: 'skill', label: 'Skill' },
  { value: 'chat', label: 'Chat' },
  { value: 'automation', label: 'Automation' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function PromptListPage() {
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

  // --- Category filter state ---
  const [categoryFilter, setCategoryFilter] = useState<PromptCategory | 'all'>('all');

  // --- Query params ---
  const queryParams = useMemo(() => {
    const params: Record<string, string | boolean> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (categoryFilter !== 'all') params.category = categoryFilter;
    return params;
  }, [debouncedSearch, categoryFilter]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useAiPrompts(queryParams);
  const prompts = data?.data ?? [];

  // --- Mutations ---
  const updatePrompt = useUpdateAiPrompt();
  const deletePrompt = useDeleteAiPrompt();

  // --- Delete confirmation state ---
  const [deleteTarget, setDeleteTarget] = useState<AiPromptListItem | null>(null);

  const handleToggleActive = useCallback(
    (prompt: AiPromptListItem) => {
      updatePrompt.mutate(
        {
          id: prompt.id,
          data: {
            isActive: !prompt.isActive,
            changeReason: `${prompt.isActive ? 'Deactivated' : 'Activated'} via admin UI`,
          },
        },
        {
          onError: (error: Error) => {
            toast.error(error.message || 'Failed to update prompt status');
          },
        },
      );
    },
    [updatePrompt],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deletePrompt.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
      },
      onError: (error: Error) => {
        toast.error(error.message || 'Failed to delete prompt');
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, deletePrompt]);

  // --- Column definitions (subtask 10.2) ---
  const columns = useMemo<ColumnDef<AiPromptListItem>[]>(
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
        accessorKey: 'category',
        header: 'Category',
        enableSorting: true,
        cell: ({ getValue }) => {
          const category = getValue<string>();
          const style = CATEGORY_STYLES[category] ?? {
            bg: 'bg-muted',
            text: 'text-muted-foreground',
            border: 'border-border',
          };
          return (
            <Badge
              variant="outline"
              className={cn('border text-xs', style.bg, style.text, style.border)}
            >
              {category}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'activeVersion',
        header: 'Version',
        cell: ({ getValue }) => <span className="font-mono text-sm">v{getValue<number>()}</span>,
      },
      {
        accessorKey: 'variableCount',
        header: 'Variables',
        cell: ({ getValue }) => {
          const count = getValue<number>();
          return (
            <span
              className="text-sm text-muted-foreground"
              title={`${count} bound variable${count !== 1 ? 's' : ''}`}
            >
              {count}
            </span>
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
        accessorKey: 'updatedAt',
        header: 'Last Updated',
        enableSorting: true,
        cell: ({ getValue }) => {
          const dateStr = getValue<string>();
          if (!dateStr) return null;
          return (
            <span
              className="text-sm text-muted-foreground"
              title={new Date(dateStr).toLocaleString()}
            >
              {formatDistanceToNow(new Date(dateStr), { addSuffix: true })}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const prompt = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative size-11 text-muted-foreground hover:bg-[#f5f3ff]"
                  aria-label={`Actions for ${prompt.name}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={() => void navigate({ to: `/ai/admin/prompts/${prompt.id}` as string })}
                >
                  <Pencil className="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleToggleActive(prompt)}>
                  <Power className="mr-2 size-4" />
                  {prompt.isActive ? 'Deactivate' : 'Activate'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[#dc2626] focus:text-[#dc2626]"
                  onClick={() => setDeleteTarget(prompt)}
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
    () => [{ label: 'AI Administration', path: '/ai/admin' }, { label: 'Prompt Templates' }],
    [],
  );

  // --- Category filter slot (subtask 10.3) ---
  const categoryFilterSlot = (
    <Select
      value={categoryFilter}
      onValueChange={(value) => setCategoryFilter(value as PromptCategory | 'all')}
    >
      <SelectTrigger
        className="w-[180px] rounded-lg border-border bg-card shadow-sm"
        aria-label="Filter by category"
      >
        <SelectValue placeholder="All Categories" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Categories</SelectItem>
        {CATEGORY_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <>
      <EntityListPage<AiPromptListItem>
        title="Prompt Templates"
        breadcrumbs={breadcrumbs}
        entityType="ai-prompt"
        columns={columns}
        data={prompts}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or description..."
        filterSlot={categoryFilterSlot}
        canCreate
        onCreateNew={() => void navigate({ to: '/ai/admin/prompts/new' as string })}
        onRowClick={(row) => void navigate({ to: `/ai/admin/prompts/${row.id}` as string })}
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
            <AlertDialogTitle className="font-serif">Delete Prompt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this prompt template? This will also delete all
              versions and variable bindings. This action cannot be undone.
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
