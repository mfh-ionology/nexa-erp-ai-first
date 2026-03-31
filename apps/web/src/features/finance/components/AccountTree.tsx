/* eslint-disable i18next/no-literal-string */
/**
 * AccountTree — recursive tree view for Chart of Accounts.
 *
 * Renders accounts hierarchically with expand/collapse, color-coded type badges,
 * and balance display aligned to the account's normal balance direction.
 */

import { useCallback, useState } from 'react';
import { ChevronRight, Folder, FolderOpen, FileText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { AccountTreeNode, AccountType } from '../types';

// ---------------------------------------------------------------------------
// Account type badge colors (per requirement)
// ---------------------------------------------------------------------------

const ACCOUNT_TYPE_STYLES: Record<AccountType, string> = {
  ASSET: 'bg-blue-100 text-blue-700 border-blue-200',
  LIABILITY: 'bg-red-100 text-red-700 border-red-200',
  EQUITY: 'bg-green-100 text-green-700 border-green-200',
  REVENUE: 'bg-purple-100 text-purple-700 border-purple-200',
  EXPENSE: 'bg-orange-100 text-orange-700 border-orange-200',
};

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expense',
};

// ---------------------------------------------------------------------------
// Format currency balance
// ---------------------------------------------------------------------------

function formatBalance(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(Math.abs(amount));
}

// ---------------------------------------------------------------------------
// AccountTreeNode component (recursive)
// ---------------------------------------------------------------------------

interface AccountTreeNodeProps {
  node: AccountTreeNode;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: AccountTreeNode) => void;
}

function AccountTreeNodeRow({
  node,
  depth,
  expandedIds,
  onToggle,
  onSelect,
}: AccountTreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle(node.id);
    },
    [node.id, onToggle],
  );

  const handleSelect = useCallback(() => {
    onSelect(node);
  }, [node, onSelect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(node);
      }
      if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
        e.preventDefault();
        onToggle(node.id);
      }
      if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
        e.preventDefault();
        onToggle(node.id);
      }
    },
    [node, hasChildren, isExpanded, onSelect, onToggle],
  );

  return (
    <>
      <div
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-level={depth + 1}
        tabIndex={0}
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors',
          'hover:bg-[#f5f3ff] hover:shadow-[0_2px_8px_rgba(124,58,237,0.08)]',
          !node.isActive && 'opacity-50',
        )}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
      >
        {/* Expand/collapse toggle */}
        <button
          type="button"
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded transition-transform',
            hasChildren ? 'hover:bg-[#ede9fe]' : 'invisible',
          )}
          onClick={handleToggle}
          tabIndex={-1}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
              isExpanded && 'rotate-90',
            )}
          />
        </button>

        {/* Folder/file icon */}
        {hasChildren ? (
          isExpanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-[#7c3aed]" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-[#7c3aed]/70" />
          )
        ) : (
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}

        {/* Account code */}
        <span className="shrink-0 font-mono text-xs font-semibold text-muted-foreground tabular-nums">
          {node.code}
        </span>

        {/* Account name */}
        <span
          className={cn(
            'flex-1 truncate text-sm font-medium',
            node.isActive ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {node.name}
        </span>

        {/* Account type badge */}
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 text-[10px] font-semibold uppercase tracking-wider',
            ACCOUNT_TYPE_STYLES[node.accountType],
          )}
        >
          {ACCOUNT_TYPE_LABELS[node.accountType]}
        </Badge>

        {/* Postable indicator */}
        {!node.isPostable && (
          <span className="shrink-0 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            Header
          </span>
        )}

        {/* Balance */}
        <span
          className={cn(
            'shrink-0 w-28 text-right font-mono text-sm tabular-nums',
            node.currentBalance < 0 ? 'text-red-600' : 'text-foreground',
          )}
        >
          {node.isPostable ? formatBalance(node.currentBalance) : ''}
        </span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div role="group">
          {node.children.map((child) => (
            <AccountTreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// AccountTree (public component)
// ---------------------------------------------------------------------------

export interface AccountTreeProps {
  tree: AccountTreeNode[];
  onSelect: (node: AccountTreeNode) => void;
  isLoading?: boolean;
  /** Start with all nodes expanded (default: expand first level) */
  defaultExpandAll?: boolean;
}

export function AccountTree({
  tree,
  onSelect,
  isLoading = false,
  defaultExpandAll = false,
}: AccountTreeProps) {
  // Build the initial expanded set: either all IDs or just root-level
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (defaultExpandAll) {
      const ids = new Set<string>();
      const collectIds = (nodes: AccountTreeNode[]) => {
        for (const node of nodes) {
          if (node.children.length > 0) {
            ids.add(node.id);
            collectIds(node.children);
          }
        }
      };
      collectIds(tree);
      return ids;
    }
    // Default: expand root level
    return new Set(tree.filter((n) => n.children.length > 0).map((n) => n.id));
  });

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const ids = new Set<string>();
    const collectIds = (nodes: AccountTreeNode[]) => {
      for (const node of nodes) {
        if (node.children.length > 0) {
          ids.add(node.id);
          collectIds(node.children);
        }
      }
    };
    collectIds(tree);
    setExpandedIds(ids);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5"
            style={{ paddingLeft: `${(i % 3) * 24 + 12}px` }}
          >
            <div className="h-4 w-4 rounded bg-muted animate-pulse" />
            <div className="h-3.5 w-12 rounded bg-muted animate-pulse" />
            <div className="h-3.5 flex-1 rounded bg-muted animate-pulse" />
            <div className="h-5 w-16 rounded-md bg-muted animate-pulse" />
            <div className="h-3.5 w-20 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Folder className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">No accounts found</p>
        <p className="text-xs mt-1">Create your first account to get started</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Expand/collapse controls */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <button
          type="button"
          onClick={expandAll}
          className="text-xs font-medium text-[#7c3aed] hover:text-[#5b21b6] transition-colors"
        >
          Expand all
        </button>
        <span className="text-muted-foreground/40">|</span>
        <button
          type="button"
          onClick={collapseAll}
          className="text-xs font-medium text-[#7c3aed] hover:text-[#5b21b6] transition-colors"
        >
          Collapse all
        </button>
      </div>

      {/* Tree */}
      <div role="tree" aria-label="Chart of Accounts">
        {tree.map((node) => (
          <AccountTreeNodeRow
            key={node.id}
            node={node}
            depth={0}
            expandedIds={expandedIds}
            onToggle={handleToggle}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
