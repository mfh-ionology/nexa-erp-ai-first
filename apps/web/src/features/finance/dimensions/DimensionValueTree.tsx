/* eslint-disable i18next/no-literal-string */
/**
 * DimensionValueTree — Tree/flat view for dimension values of a given type.
 *
 * Features:
 * - Toggle between tree view and flat list
 * - Hierarchical indentation with expand/collapse
 * - Search filter
 * - Create/edit value dialogs
 */

import { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Search } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/templates/page-header';

import { useDimensionType, useDimensionValues, useUpdateDimensionValue } from './api';
import type { DimensionValue } from './api';
import { DimensionValueDialog } from './DimensionValueDialog';

// ---------------------------------------------------------------------------
// Tree building
// ---------------------------------------------------------------------------

interface TreeNode {
  value: DimensionValue;
  children: TreeNode[];
  depth: number;
}

function buildTree(values: DimensionValue[]): TreeNode[] {
  const map = new Map<string | null, DimensionValue[]>();
  for (const v of values) {
    const pid = v.parentId ?? null;
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push(v);
  }

  function build(parentId: string | null, depth: number): TreeNode[] {
    return (map.get(parentId) ?? []).map((v) => ({
      value: v,
      children: build(v.id, depth + 1),
      depth,
    }));
  }

  return build(null, 0);
}

function flattenTree(nodes: TreeNode[], expanded: Set<string>): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (expanded.has(node.value.id) && node.children.length > 0) {
      result.push(...flattenTree(node.children, expanded));
    }
  }
  return result;
}

function hasChildren(node: TreeNode): boolean {
  return node.children.length > 0;
}

// Collect all node IDs up to depth 2
function collectExpandedIds(nodes: TreeNode[], maxDepth: number): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.depth < maxDepth && node.children.length > 0) {
      ids.push(node.value.id);
      ids.push(...collectExpandedIds(node.children, maxDepth));
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DimensionValueTreeProps {
  typeId: string;
}

export function DimensionValueTree({ typeId }: DimensionValueTreeProps) {
  const { t } = useI18n('finance');

  const { data: dimensionType, isLoading: typeLoading } = useDimensionType(typeId);
  const { data: values, isLoading: valuesLoading } = useDimensionValues(typeId);
  const updateMutation = useUpdateDimensionValue(typeId);

  const [isTreeView, setIsTreeView] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<DimensionValue | null>(null);

  const isLoading = typeLoading || valuesLoading;
  const allValues = values ?? [];

  // Build tree structure
  const tree = useMemo(() => buildTree(allValues), [allValues]);

  // Auto-expand first 2 levels on initial load
  useMemo(() => {
    if (allValues.length > 0 && expanded.size === 0) {
      const ids = collectExpandedIds(tree, 2);
      if (ids.length > 0) {
        setExpanded(new Set(ids));
      }
    }
  }, [allValues.length, tree, expanded.size]);

  // Flatten tree for rendering
  const flatNodes = useMemo(() => flattenTree(tree, expanded), [tree, expanded]);

  // Filter by search
  const filteredValues = useMemo(() => {
    if (!search) return isTreeView ? flatNodes : allValues;
    const q = search.toLowerCase();
    const filtered = allValues.filter(
      (v) => v.code.toLowerCase().includes(q) || v.name.toLowerCase().includes(q),
    );
    if (isTreeView) {
      // In tree view with search, show flat results
      return filtered.map((v) => ({
        value: v,
        children: [],
        depth: 0,
      }));
    }
    return filtered;
  }, [search, isTreeView, flatNodes, allValues]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleActive = useCallback(
    (value: DimensionValue) => {
      updateMutation.mutate({
        id: value.id,
        data: { isActive: !value.isActive },
      });
    },
    [updateMutation],
  );

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [
      { label: t('navigation:finance'), path: '/finance' },
      { label: t('dimensions.title'), path: '/finance/dimensions' },
      { label: dimensionType?.name ?? t('dimensions.values.title') },
    ],
    [t, dimensionType?.name],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('dimensions.values.title')} breadcrumbs={breadcrumbs} isLoading />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const actionBar = (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="tree-toggle" className="text-sm text-muted-foreground">
          {t('dimensions.values.flatList')}
        </Label>
        <Switch id="tree-toggle" checked={isTreeView} onCheckedChange={setIsTreeView} />
        <Label htmlFor="tree-toggle" className="text-sm text-muted-foreground">
          {t('dimensions.values.treeView')}
        </Label>
      </div>
      <Button
        size="sm"
        onClick={() => {
          setEditingValue(null);
          setDialogOpen(true);
        }}
      >
        <Plus className="size-4" />
        {t('dimensions.action.createValue')}
      </Button>
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={dimensionType?.name ?? t('dimensions.values.title')}
          subtitle={dimensionType ? `Code: ${dimensionType.code}` : undefined}
          breadcrumbs={breadcrumbs}
          actionBarSlot={actionBar}
        />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                {t('dimensions.values.title')}
                {allValues.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({allValues.length})
                  </span>
                )}
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('dimensions.values.searchPlaceholder')}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredValues.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                {search
                  ? t('dimensions.values.noSearchResults')
                  : t('dimensions.emptyState.values')}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b bg-[rgba(107,114,128,0.04)] hover:bg-[rgba(107,114,128,0.04)]">
                      <TableHead className="h-10 w-48 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('dimensions.column.code')}
                      </TableHead>
                      <TableHead className="h-10 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('dimensions.column.name')}
                      </TableHead>
                      <TableHead className="h-10 w-32 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('dimensions.column.parent')}
                      </TableHead>
                      <TableHead className="h-10 w-24 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('dimensions.column.active')}
                      </TableHead>
                      <TableHead className="h-10 w-24 px-3" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(isTreeView && !search
                      ? (filteredValues as TreeNode[])
                      : isTreeView
                        ? (filteredValues as TreeNode[])
                        : allValues
                            .filter((v) => {
                              if (!search) return true;
                              const q = search.toLowerCase();
                              return (
                                v.code.toLowerCase().includes(q) || v.name.toLowerCase().includes(q)
                              );
                            })
                            .map((v) => ({ value: v, children: [], depth: 0 }))
                    ).map((item) => {
                      const node = item as TreeNode;
                      const val = node.value;
                      const parentName = val.parentId
                        ? (allValues.find((v) => v.id === val.parentId)?.name ?? '')
                        : '';

                      return (
                        <TableRow
                          key={val.id}
                          className="border-b border-border/60 transition-colors hover:bg-[#f5f3ff]/30 cursor-pointer"
                          onClick={() => {
                            setEditingValue(val);
                            setDialogOpen(true);
                          }}
                        >
                          <TableCell className="px-3 py-2">
                            <div
                              className="flex items-center gap-1"
                              style={{
                                paddingLeft: isTreeView && !search ? `${node.depth * 20}px` : '0',
                              }}
                            >
                              {isTreeView && !search && hasChildren(node) ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpand(val.id);
                                  }}
                                  className="shrink-0 rounded p-0.5 hover:bg-accent"
                                  aria-label={expanded.has(val.id) ? 'Collapse' : 'Expand'}
                                >
                                  {expanded.has(val.id) ? (
                                    <ChevronDown className="size-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="size-4 text-muted-foreground" />
                                  )}
                                </button>
                              ) : isTreeView && !search ? (
                                <span className="shrink-0 w-5" />
                              ) : null}
                              <span className="font-mono text-sm font-semibold text-[#7c3aed]">
                                {val.code}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-sm">{val.name}</TableCell>
                          <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                            {parentName || '\u2014'}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className={
                                val.isActive
                                  ? 'border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/50 dark:text-green-300'
                                  : 'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
                              }
                            >
                              {val.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleActive(val);
                              }}
                              className="text-xs text-muted-foreground"
                            >
                              {val.isActive
                                ? t('dimensions.action.deactivate')
                                : t('dimensions.action.activate')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DimensionValueDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        typeId={typeId}
        existingValues={allValues}
        dimensionValue={editingValue}
      />
    </>
  );
}
