/* eslint-disable i18next/no-literal-string */
/**
 * ChartOfAccountsPage — T1 Entity List Page for Chart of Accounts.
 *
 * Displays accounts in a hierarchical tree view with:
 * - Search/filter toolbar (by account type, active status)
 * - Tree view with expand/collapse, color-coded type badges
 * - Balance display with normal balance direction
 * - Navigation to account detail page
 * - Create new account button
 */

import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Filter, Landmark, MoreHorizontal, Plus, Search, Sparkles } from 'lucide-react';

import { ExportButtons } from '../components/ExportButtons';

import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/templates/page-header';
import { usePermission } from '@/hooks/use-permissions';

import { AccountTree } from '../components/AccountTree';
import { useAccountsTree } from '../hooks/use-accounts';
import type { AccountTreeNode, AccountType } from '../types';
import { ACCOUNT_TYPES } from '../types';

// ---------------------------------------------------------------------------
// Summary card — shows count by account type
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<AccountType, string> = {
  ASSET: '#3b82f6',
  LIABILITY: '#ef4444',
  EQUITY: '#10b981',
  REVENUE: '#7c3aed',
  EXPENSE: '#f97316',
};

interface SummaryCardProps {
  label: string;
  count: number;
  color: string;
}

function SummaryCard({ label, count, color }: SummaryCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}15` }}
      >
        <Landmark className="h-4 w-4" style={{ color }} />
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground tabular-nums">{count}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countNodes(nodes: AccountTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    count += countNodes(node.children);
  }
  return count;
}

function countByType(nodes: AccountTreeNode[], type: AccountType): number {
  let count = 0;
  for (const node of nodes) {
    if (node.accountType === type) count += 1;
    count += countByType(node.children, type);
  }
  return count;
}

function filterTree(
  nodes: AccountTreeNode[],
  search: string,
  typeFilter: string,
): AccountTreeNode[] {
  const lowerSearch = search.toLowerCase();
  return nodes.reduce<AccountTreeNode[]>((acc, node) => {
    const matchesSearch =
      !search ||
      node.code.toLowerCase().includes(lowerSearch) ||
      node.name.toLowerCase().includes(lowerSearch);
    const matchesType = typeFilter === 'all' || node.accountType === typeFilter;

    // Filter children recursively
    const filteredChildren = filterTree(node.children, search, typeFilter);

    // Include node if it matches directly or has matching children
    if ((matchesSearch && matchesType) || filteredChildren.length > 0) {
      acc.push({
        ...node,
        children: filteredChildren,
      });
    }
    return acc;
  }, []);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChartOfAccountsPage() {
  const { t } = useI18n('finance');
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('active');

  // Permissions
  const perms = usePermission('finance.accounts');

  // Fetch tree data
  const { tree, isLoading } = useAccountsTree({
    isActive: activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : undefined,
  });

  // Filter tree client-side for search + type (server already handles isActive)
  const filteredTree = useMemo(
    () => filterTree(tree, search, typeFilter),
    [tree, search, typeFilter],
  );

  // Summary counts from unfiltered tree
  const totalCount = useMemo(() => countNodes(tree), [tree]);
  const typeCounts = useMemo(
    () =>
      ACCOUNT_TYPES.map((type) => ({
        type,
        count: countByType(tree, type),
      })),
    [tree],
  );

  // Navigation
  const handleSelect = useCallback(
    (node: AccountTreeNode) => {
      void navigate({ to: '/finance/chart-of-accounts/$id', params: { id: node.id } });
    },
    [navigate],
  );

  const handleCreateNew = useCallback(() => {
    void navigate({ to: '/finance/chart-of-accounts/$id', params: { id: 'new' } });
  }, [navigate]);

  // Header actions
  const headerActions = (
    <div className="flex items-center gap-2">
      {perms.canNew && (
        <Button onClick={handleCreateNew} size="sm" className="bg-[#7c3aed] hover:bg-[#5b21b6]">
          <Plus className="size-4" />
          {t('new', 'New')}
        </Button>
      )}
      <ExportButtons
        exportPath="/finance/accounts/export"
        params={{
          ...(typeFilter !== 'all' ? { accountType: typeFilter } : {}),
          ...(activeFilter === 'active'
            ? { isActive: true }
            : activeFilter === 'inactive'
              ? { isActive: false }
              : {}),
        }}
        variant="icon"
        label="Export accounts"
      />
      <Button variant="ghost" size="icon-sm" aria-label="AI">
        <Sparkles className="size-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t('actions', 'Actions')}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Import Accounts</DropdownMenuItem>
          <DropdownMenuItem>Print</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <main className="flex flex-col gap-6" aria-label="Chart of Accounts">
      {/* Page header */}
      <PageHeader
        title={t('accounts.title', 'Chart of Accounts')}
        subtitle={t('accounts.subtitle', 'Manage your general ledger account structure')}
        breadcrumbs={[
          { label: t('title', 'Finance'), path: '/finance' },
          { label: t('accounts.title', 'Chart of Accounts') },
        ]}
        actionBarSlot={headerActions}
        isLoading={isLoading}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 animate-fade-in-up delay-1">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7c3aed]/10">
            <Landmark className="h-4 w-4 text-[#7c3aed]" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground tabular-nums">{totalCount}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
        {typeCounts.map(({ type, count }) => (
          <SummaryCard
            key={type}
            label={type.charAt(0) + type.slice(1).toLowerCase()}
            count={count}
            color={TYPE_COLORS[type]}
          />
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center animate-fade-in-up delay-2">
        {/* Search */}
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('accounts.searchPlaceholder', 'Search by code or name...')}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            aria-label={t('search', 'Search')}
          />
        </div>

        {/* Account type filter */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px] shrink-0">
            <Filter className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Account Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {ACCOUNT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Active filter */}
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-[130px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="inactive">Inactive Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active filter tags */}
      {(search || typeFilter !== 'all' || activeFilter !== 'active') && (
        <div className="flex items-center gap-2 animate-fade-in-up">
          <span className="text-xs text-muted-foreground">Filters:</span>
          {search && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs cursor-pointer hover:bg-destructive/10"
              onClick={() => setSearch('')}
            >
              Search: {search}
              <span className="text-muted-foreground/60">&times;</span>
            </Badge>
          )}
          {typeFilter !== 'all' && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs cursor-pointer hover:bg-destructive/10"
              onClick={() => setTypeFilter('all')}
            >
              Type: {typeFilter.charAt(0) + typeFilter.slice(1).toLowerCase()}
              <span className="text-muted-foreground/60">&times;</span>
            </Badge>
          )}
          {activeFilter !== 'active' && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs cursor-pointer hover:bg-destructive/10"
              onClick={() => setActiveFilter('active')}
            >
              Status: {activeFilter === 'all' ? 'All' : 'Inactive'}
              <span className="text-muted-foreground/60">&times;</span>
            </Badge>
          )}
        </div>
      )}

      {/* Tree view */}
      <Card className="rounded-xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)] animate-fade-in-up delay-3">
        <CardContent className="p-0">
          <AccountTree tree={filteredTree} onSelect={handleSelect} isLoading={isLoading} />
        </CardContent>
      </Card>

      {/* Record count */}
      {!isLoading && (
        <p className="px-1 text-xs text-muted-foreground animate-fade-in-up">
          {countNodes(filteredTree)} account{countNodes(filteredTree) !== 1 ? 's' : ''} shown
          {filteredTree.length !== tree.length && ` (${totalCount} total)`}
        </p>
      )}
    </main>
  );
}
