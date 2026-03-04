/* eslint-disable i18next/no-literal-string */
/**
 * Email Template List Page — T1 Entity List.
 *
 * Displays all email templates from GET /email/templates
 * with text search, cursor-based pagination, document type filter,
 * and row click → detail.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EntityListPage } from '@/components/templates/entity-list-page';
import { cn } from '@/lib/utils';

import { useI18n, useFormatDate } from '@nexa/i18n';

import type { EmailTemplateListItem } from './api/types';
import { DOCUMENT_TYPES } from './api/types';
import { useEmailTemplates } from './api/use-email-templates';

// --- Document type badge styles ---

/* eslint-disable @typescript-eslint/naming-convention -- keys match backend enum values */
const DOC_TYPE_STYLES: Record<string, string> = {
  CustomerInvoice: 'border-blue-200 bg-blue-50 text-blue-700',
  CustomerStatement: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  SalesQuote: 'border-amber-200 bg-amber-50 text-amber-700',
  SalesOrder: 'border-green-200 bg-green-50 text-green-700',
  PurchaseOrder: 'border-orange-200 bg-orange-50 text-orange-700',
  CreditNote: 'border-red-200 bg-red-50 text-red-700',
  Payslip: 'border-purple-200 bg-purple-50 text-purple-700',
};
/* eslint-enable @typescript-eslint/naming-convention */

// --- Component ---

export function EmailTemplateListPage() {
  const { t } = useI18n();
  const formatDate = useFormatDate();
  const navigate = useNavigate();

  // --- Search state with 300ms debounce ---
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // --- Filter state ---
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  // --- Data fetching ---
  const queryParams = useMemo(() => {
    const params: Record<string, string | boolean> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (documentTypeFilter) params.documentType = documentTypeFilter;
    if (activeFilter === 'active') params.isActive = true;
    if (activeFilter === 'inactive') params.isActive = false;
    return params;
  }, [debouncedSearch, documentTypeFilter, activeFilter]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useEmailTemplates(queryParams);

  const templates = data?.data ?? [];

  // --- Column definitions ---
  const columns = useMemo<ColumnDef<EmailTemplateListItem>[]>(
    () => [
      {
        accessorKey: 'code',
        header: t('emailTemplates.column.code'),
        cell: ({ getValue }) => <span className="font-mono text-sm">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'name',
        header: t('emailTemplates.column.name'),
        cell: ({ getValue }) => (
          <span className="font-medium text-foreground">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'documentType',
        header: t('emailTemplates.column.documentType'),
        cell: ({ getValue }) => {
          const type = getValue<string>();
          return (
            <Badge variant="outline" className={cn('text-xs', DOC_TYPE_STYLES[type] ?? '')}>
              {t(`emailTemplates.documentType.${type}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'languageCode',
        header: t('emailTemplates.column.language'),
        cell: ({ getValue }) => (
          <span className="text-sm text-foreground uppercase">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'isActive',
        header: t('emailTemplates.column.status'),
        cell: ({ getValue }) => {
          const isActive = getValue<boolean>();
          return (
            <div className="flex items-center gap-2">
              <span
                className={cn('size-2 rounded-full', isActive ? 'bg-[#10b981]' : 'bg-[#d1d5db]')}
              />
              <span
                className={cn('text-sm', isActive ? 'text-foreground' : 'text-muted-foreground')}
              >
                {isActive ? t('emailTemplates.status.active') : t('emailTemplates.status.inactive')}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'updatedAt',
        header: t('emailTemplates.column.updatedAt'),
        cell: ({ getValue }) => {
          const value = getValue<string>();
          return <span className="text-sm text-foreground">{formatDate(value)}</span>;
        },
      },
    ],
    [t, formatDate],
  );

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [
      { label: t('navigation:system'), path: '/system' },
      { label: t('emailTemplates.title') },
    ],
    [t],
  );

  // --- Create handler ---
  const handleCreate = useCallback(() => {
    void navigate({ to: '/system/email-templates/new' as string });
  }, [navigate]);

  // --- Filter slot ---
  const filterSlot = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <Select
          value={documentTypeFilter}
          onValueChange={(v) => setDocumentTypeFilter(v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('emailTemplates.filter.documentType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('emailTemplates.filter.allTypes')}</SelectItem>
            {DOCUMENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`emailTemplates.documentType.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={activeFilter}
          onValueChange={(v) => setActiveFilter(v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('emailTemplates.filter.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('emailTemplates.filter.allStatuses')}</SelectItem>
            <SelectItem value="active">{t('emailTemplates.status.active')}</SelectItem>
            <SelectItem value="inactive">{t('emailTemplates.status.inactive')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    ),
    [documentTypeFilter, activeFilter, t],
  );

  return (
    <EntityListPage<EmailTemplateListItem>
      title={t('emailTemplates.title')}
      breadcrumbs={breadcrumbs}
      entityType="emailTemplate"
      columns={columns}
      data={templates}
      isLoading={isLoading}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={t('emailTemplates.searchPlaceholder')}
      filterSlot={filterSlot}
      canCreate
      onCreateNew={handleCreate}
      onRowClick={(row) =>
        void navigate({
          to: '/system/email-templates/$id' as string,
          params: { id: row.id },
        })
      }
      hasMore={hasNextPage}
      onLoadMore={() => void fetchNextPage()}
      isLoadingMore={isFetchingNextPage}
      getRowId={(row) => row.id}
      batchActions={[]}
    />
  );
}
