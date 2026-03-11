/* eslint-disable i18next/no-literal-string */
/**
 * Template List — grouped by document type with collapsible accordion sections.
 *
 * AC6: Template Management UI — Template List
 * - Grouped list by document type (collapsible sections)
 * - Each template: name, status badge (active/inactive), default badge, version count
 * - Overflow menu: Edit, Preview, Clone, Set as Default, Deactivate
 * - Document type filter dropdown, search input, "Add Template" button
 * - Empty state message
 * - Concept D: 12px radius, purple-tinted shadows, Plus Jakarta Sans, #f4f2ff
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Copy,
  Edit,
  Eye,
  FileText,
  MoreHorizontal,
  Plus,
  Power,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { DocumentTemplateListItem, DocumentType } from './api';
import {
  DOCUMENT_TYPES,
  useDocumentTemplates,
  useUpdateDocumentTemplate,
  useDeleteDocumentTemplate,
} from './api';
import { DOCUMENT_TYPE_LABELS } from './constants';

// ─── Types ─────────────────────────────────────────────────────────────────

interface TemplateGroup {
  documentType: DocumentType;
  label: string;
  templates: DocumentTemplateListItem[];
}

export interface TemplateListProps {
  onAddTemplate: () => void;
  onEditTemplate: (template: DocumentTemplateListItem) => void;
  onPreviewTemplate: (template: DocumentTemplateListItem) => void;
  onCloneTemplate: (template: DocumentTemplateListItem) => void;
  onViewDetail: (template: DocumentTemplateListItem) => void;
}

// ─── Filter Bar ────────────────────────────────────────────────────────────

function TemplateFilterBar({
  documentTypeFilter,
  onDocumentTypeChange,
  search,
  onSearchChange,
  showInactive,
  onShowInactiveChange,
  onClear,
  hasActiveFilters,
}: {
  documentTypeFilter: DocumentType | 'ALL';
  onDocumentTypeChange: (value: DocumentType | 'ALL') => void;
  search: string;
  onSearchChange: (value: string) => void;
  showInactive: boolean;
  onShowInactiveChange: (value: boolean) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Document type filter */}
      <Select
        value={documentTypeFilter}
        onValueChange={(v) => {
          onDocumentTypeChange(v as DocumentType | 'ALL');
        }}
      >
        <SelectTrigger
          className={cn(
            'h-8 w-48 text-xs',
            documentTypeFilter !== 'ALL' && 'border-[#7c3aed]/40 bg-[#f5f3ff]',
          )}
        >
          <SelectValue placeholder="All Document Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Document Types</SelectItem>
          {DOCUMENT_TYPES.map((dt) => (
            <SelectItem key={dt} value={dt}>
              {DOCUMENT_TYPE_LABELS[dt]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => {
            onSearchChange(e.target.value);
          }}
          className="h-8 w-48 pl-8 text-xs"
          aria-label="Search templates by name"
        />
      </div>

      {/* Show inactive toggle */}
      <Button
        variant={showInactive ? 'default' : 'outline'}
        size="sm"
        onClick={() => {
          onShowInactiveChange(!showInactive);
        }}
        className={cn('h-8 text-xs', showInactive && 'bg-[#7c3aed] hover:bg-[#5b21b6]')}
      >
        {showInactive ? 'Showing Inactive' : 'Show Inactive'}
      </Button>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-8 gap-1 text-xs text-muted-foreground"
        >
          <X className="size-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}

// ─── Template Card ─────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onEdit,
  onPreview,
  onClone,
  onSetDefault,
  onDeactivate,
  onViewDetail,
  animationIndex,
}: {
  template: DocumentTemplateListItem;
  onEdit: () => void;
  onPreview: () => void;
  onClone: () => void;
  onSetDefault: () => void;
  onDeactivate: () => void;
  onViewDetail: () => void;
  animationIndex: number;
}) {
  const delay = String(animationIndex * 50);

  return (
    <Card
      className="cursor-pointer rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)] animate-fade-in-up"
      style={animationIndex <= 6 ? { animationDelay: `${delay}ms` } : undefined}
      onClick={onViewDetail}
    >
      <CardContent className="space-y-3 p-4">
        {/* Row 1: Name + overflow menu */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{template.name}</h3>
          <div className="flex shrink-0 items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 hover:bg-[#f5f3ff]"
                  aria-label="Template actions"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onPreview}>
                  <Eye className="mr-2 size-4" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onClone}>
                  <Copy className="mr-2 size-4" />
                  Clone
                </DropdownMenuItem>
                {!template.isDefault && (
                  <DropdownMenuItem onClick={onSetDefault}>
                    <Star className="mr-2 size-4" />
                    Set as Default
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className={
                    template.isActive
                      ? 'text-[#dc2626] focus:text-[#dc2626]'
                      : 'text-green-700 focus:text-green-700'
                  }
                  onClick={onDeactivate}
                >
                  {template.isActive ? (
                    <Trash2 className="mr-2 size-4" />
                  ) : (
                    <Power className="mr-2 size-4" />
                  )}
                  {template.isActive ? 'Deactivate' : 'Activate'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Row 2: Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Status badge */}
          <Badge
            variant="secondary"
            className={cn(
              'border-0 text-xs',
              template.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500',
            )}
          >
            {template.isActive ? 'Active' : 'Inactive'}
          </Badge>

          {/* Default badge */}
          {template.isDefault && (
            <Badge variant="secondary" className="border-0 bg-[#7c3aed]/10 text-xs text-[#7c3aed]">
              Default
            </Badge>
          )}
        </div>

        {/* Row 3: Metadata */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {template.pageSize} / {template.orientation}
          </span>
          <span className="font-mono">
            {template.versionCount} {template.versionCount === 1 ? 'version' : 'versions'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Grouped Accordion View ────────────────────────────────────────────────

function GroupedTemplateView({
  groups,
  isLoading,
  onEdit,
  onPreview,
  onClone,
  onSetDefault,
  onDeactivate,
  onViewDetail,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: {
  groups: TemplateGroup[];
  isLoading: boolean;
  onEdit: (t: DocumentTemplateListItem) => void;
  onPreview: (t: DocumentTemplateListItem) => void;
  onClone: (t: DocumentTemplateListItem) => void;
  onSetDefault: (t: DocumentTemplateListItem) => void;
  onDeactivate: (t: DocumentTemplateListItem) => void;
  onViewDetail: (t: DocumentTemplateListItem) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-40 rounded-lg" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 2 }).map((_unused, j) => (
                <Skeleton key={j} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
        <FileText className="mb-3 size-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No document templates found. Click &apos;Add Template&apos; to create your first template.
        </p>
      </div>
    );
  }

  const defaultExpanded = groups.slice(0, 5).map((g) => g.documentType);

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={defaultExpanded}>
        {groups.map((group) => (
          <AccordionItem key={group.documentType} value={group.documentType}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="border border-[#6d28d9]/20 bg-[#ede9fe] text-xs text-[#6d28d9]"
                >
                  {group.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  ({group.templates.length}{' '}
                  {group.templates.length === 1 ? 'template' : 'templates'})
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.templates.map((template, idx) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onEdit={() => {
                      onEdit(template);
                    }}
                    onPreview={() => {
                      onPreview(template);
                    }}
                    onClone={() => {
                      onClone(template);
                    }}
                    onSetDefault={() => {
                      onSetDefault(template);
                    }}
                    onDeactivate={() => {
                      onDeactivate(template);
                    }}
                    onViewDetail={() => {
                      onViewDetail(template);
                    }}
                    animationIndex={idx + 1}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="gap-1.5"
          >
            <ChevronDown className="size-4" />
            {isLoadingMore ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export function TemplateList({
  onAddTemplate,
  onEditTemplate,
  onPreviewTemplate,
  onCloneTemplate,
  onViewDetail,
}: TemplateListProps) {
  // ── Filters ──
  const [documentTypeFilter, setDocumentTypeFilter] = useState<DocumentType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  const hasActiveFilters = documentTypeFilter !== 'ALL' || search !== '' || showInactive;

  const handleClearFilters = useCallback(() => {
    setDocumentTypeFilter('ALL');
    setSearch('');
    setShowInactive(false);
  }, []);

  // ── Query params ──
  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = {};
    if (documentTypeFilter !== 'ALL') params.documentType = documentTypeFilter;
    if (debouncedSearch) params.search = debouncedSearch;
    if (showInactive) params.isActive = false;
    return params;
  }, [documentTypeFilter, debouncedSearch, showInactive]);

  // ── Data query ──
  const {
    data: templatesData,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useDocumentTemplates(queryParams);

  // ── Group by document type ──
  const templateGroups = useMemo<TemplateGroup[]>(() => {
    const allTemplates = templatesData?.data ?? [];
    const map = new Map<DocumentType, DocumentTemplateListItem[]>();

    for (const template of allTemplates) {
      const existing = map.get(template.documentType) ?? [];
      existing.push(template);
      map.set(template.documentType, existing);
    }

    return DOCUMENT_TYPES.filter((dt) => map.has(dt)).map((dt) => ({
      documentType: dt,
      label: DOCUMENT_TYPE_LABELS[dt],
      templates: map.get(dt) ?? [],
    }));
  }, [templatesData]);

  // ── Set as default mutation ──
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const handleSetDefault = useCallback((template: DocumentTemplateListItem) => {
    setSettingDefaultId(template.id);
  }, []);

  // ── Deactivate / Activate ──
  const deleteTemplate = useDeleteDocumentTemplate();
  const [deactivatingTemplate, setDeactivatingTemplate] = useState<DocumentTemplateListItem | null>(
    null,
  );
  const [activatingTemplateId, setActivatingTemplateId] = useState<string | null>(null);

  const handleDeactivateConfirm = useCallback(() => {
    if (!deactivatingTemplate) return;
    if (deactivatingTemplate.isActive) {
      // Deactivate: soft-delete via DELETE endpoint
      deleteTemplate.mutate(deactivatingTemplate.id, {
        onSettled: () => {
          setDeactivatingTemplate(null);
        },
      });
    } else {
      // Activate: PATCH with isActive: true
      setActivatingTemplateId(deactivatingTemplate.id);
      setDeactivatingTemplate(null);
    }
  }, [deactivatingTemplate, deleteTemplate]);

  const deactivatingName = deactivatingTemplate?.name ?? '';

  return (
    <div className="space-y-4">
      {/* Action bar + Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TemplateFilterBar
          documentTypeFilter={documentTypeFilter}
          onDocumentTypeChange={setDocumentTypeFilter}
          search={search}
          onSearchChange={setSearch}
          showInactive={showInactive}
          onShowInactiveChange={setShowInactive}
          onClear={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5 bg-[#7c3aed] hover:bg-[#5b21b6]"
            onClick={onAddTemplate}
          >
            <Plus className="size-4" />
            Add Template
          </Button>
        </div>
      </div>

      {/* Grouped template list */}
      <GroupedTemplateView
        groups={templateGroups}
        isLoading={isLoading}
        onEdit={onEditTemplate}
        onPreview={onPreviewTemplate}
        onClone={onCloneTemplate}
        onSetDefault={handleSetDefault}
        onDeactivate={setDeactivatingTemplate}
        onViewDetail={onViewDetail}
        hasMore={hasNextPage}
        onLoadMore={() => {
          void fetchNextPage();
        }}
        isLoadingMore={isFetchingNextPage}
      />

      {/* Set as Default confirm — uses SetDefaultHandler */}
      {settingDefaultId && (
        <SetDefaultHandler
          templateId={settingDefaultId}
          onDone={() => {
            setSettingDefaultId(null);
          }}
        />
      )}

      {/* Activate handler — uses ActivateHandler */}
      {activatingTemplateId && (
        <ActivateHandler
          templateId={activatingTemplateId}
          onDone={() => {
            setActivatingTemplateId(null);
          }}
        />
      )}

      {/* Deactivate confirm dialog */}
      <AlertDialog
        open={!!deactivatingTemplate}
        onOpenChange={(open) => {
          if (!open) setDeactivatingTemplate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deactivatingTemplate?.isActive ? 'Deactivate Template' : 'Activate Template'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deactivatingTemplate?.isActive
                ? `Are you sure you want to deactivate "${deactivatingName}"? Deactivated templates cannot be used for document generation.`
                : `Are you sure you want to activate "${deactivatingName}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivateConfirm}
              className={
                deactivatingTemplate?.isActive
                  ? 'bg-[#dc2626] hover:bg-[#b91c1c]'
                  : 'bg-[#7c3aed] hover:bg-[#5b21b6]'
              }
            >
              {deactivatingTemplate?.isActive ? 'Deactivate' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Set Default Handler (needs useUpdateDocumentTemplate with ID) ─────────

function SetDefaultHandler({ templateId, onDone }: { templateId: string; onDone: () => void }) {
  const updateTemplate = useUpdateDocumentTemplate(templateId);
  const hasRun = useRef(false);

  useEffect(() => {
    // Guard against React 18 strict mode double-firing
    if (hasRun.current) return;
    hasRun.current = true;
    updateTemplate.mutate({ isDefault: true }, { onSettled: onDone });
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ─── Activate Handler (PATCH with isActive: true) ─────────────────────────

function ActivateHandler({ templateId, onDone }: { templateId: string; onDone: () => void }) {
  const updateTemplate = useUpdateDocumentTemplate(templateId);
  const hasRun = useRef(false);

  useEffect(() => {
    // Guard against React 18 strict mode double-firing
    if (hasRun.current) return;
    hasRun.current = true;
    updateTemplate.mutate({ isActive: true }, { onSettled: onDone });
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
