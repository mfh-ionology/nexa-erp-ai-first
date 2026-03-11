/* eslint-disable i18next/no-literal-string */
/**
 * Document Templates Management Page — T7 Settings layout shell.
 *
 * Manages page state: list view, editor view (create/edit/clone), and detail view.
 * Uses SettingsPage (T7) as the layout shell with custom content in children.
 *
 * - List view: shows TemplateList (grouped by document type, filters, overflow menus)
 * - Editor view: shows TemplateEditor (create / edit / clone)
 * - Detail view: shows template detail with VersionManagement + PreviewPanel (Task 11)
 */

import { useCallback, useMemo, useState } from 'react';

import { useI18n } from '@nexa/i18n';

import { SettingsPage } from '@/components/templates/settings-page';
import { Skeleton } from '@/components/ui/skeleton';

import type { DocumentTemplateDetail, DocumentTemplateListItem } from './api';
import { useDocumentTemplate } from './api';
import { PreviewPanel } from './preview-panel';
import { TemplateList } from './template-list';
import { TemplateEditor } from './template-editor';
import { VersionManagement } from './version-management';

// ─── View State ────────────────────────────────────────────────────────────

type PageView =
  | { mode: 'list' }
  | { mode: 'create' }
  | { mode: 'edit'; templateId: string }
  | { mode: 'clone'; cloneFromId: string }
  | { mode: 'detail'; templateId: string };

// ─── Component ─────────────────────────────────────────────────────────────

export function DocumentTemplatesPage() {
  const { t } = useI18n();
  const [view, setView] = useState<PageView>({ mode: 'list' });

  const breadcrumbs = useMemo(
    () => [
      { label: t('navigation:system'), path: '/system/settings' },
      { label: 'Document Templates' },
    ],
    [t],
  );

  // ── Navigation callbacks ──
  const goToList = useCallback(() => {
    setView({ mode: 'list' });
  }, []);
  const goToCreate = useCallback(() => {
    setView({ mode: 'create' });
  }, []);

  const goToEdit = useCallback((template: DocumentTemplateListItem) => {
    setView({ mode: 'edit', templateId: template.id });
  }, []);

  const goToClone = useCallback((template: DocumentTemplateListItem) => {
    setView({ mode: 'clone', cloneFromId: template.id });
  }, []);

  const goToDetail = useCallback((template: DocumentTemplateListItem) => {
    setView({ mode: 'detail', templateId: template.id });
  }, []);

  // Stub for preview — detail view handles preview via PreviewPanel (Task 11)
  const handlePreview = useCallback((template: DocumentTemplateListItem) => {
    setView({ mode: 'detail', templateId: template.id });
  }, []);

  // ── Render content based on view ──
  const content = (() => {
    switch (view.mode) {
      case 'list':
        return (
          <TemplateList
            onAddTemplate={goToCreate}
            onEditTemplate={goToEdit}
            onPreviewTemplate={handlePreview}
            onCloneTemplate={goToClone}
            onViewDetail={goToDetail}
          />
        );

      case 'create':
        return <TemplateEditor onSuccess={goToList} onCancel={goToList} />;

      case 'edit':
        return (
          <TemplateEditorWithData
            templateId={view.templateId}
            onSuccess={goToList}
            onCancel={goToList}
          />
        );

      case 'clone':
        return (
          <TemplateCloneWithData
            templateId={view.cloneFromId}
            onSuccess={goToList}
            onCancel={goToList}
          />
        );

      case 'detail':
        return (
          <TemplateDetailView
            templateId={view.templateId}
            onBack={goToList}
            onEdit={(template) => {
              setView({ mode: 'edit', templateId: template.id });
            }}
          />
        );

      default:
        return null;
    }
  })();

  return (
    <SettingsPage
      title="Document Templates"
      breadcrumbs={breadcrumbs}
      groups={[]}
      actionBarSlot={<div />}
    >
      {content}
    </SettingsPage>
  );
}

// ─── Edit wrapper — loads template detail then renders editor ──────────────

function TemplateEditorWithData({
  templateId,
  onSuccess,
  onCancel,
}: {
  templateId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { data: template, isLoading } = useDocumentTemplate(templateId);

  if (isLoading) {
    return (
      <div className="space-y-4 py-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Template not found.</div>
      </div>
    );
  }

  return <TemplateEditor template={template} onSuccess={onSuccess} onCancel={onCancel} />;
}

// ─── Clone wrapper — loads full template detail then renders editor in clone mode ──

function TemplateCloneWithData({
  templateId,
  onSuccess,
  onCancel,
}: {
  templateId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { data: template, isLoading } = useDocumentTemplate(templateId);

  if (isLoading) {
    return (
      <div className="space-y-4 py-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Template not found.</div>
      </div>
    );
  }

  return <TemplateEditor cloneFrom={template} onSuccess={onSuccess} onCancel={onCancel} />;
}

// ─── Detail view — VersionManagement + Preview ─────────────────────────────

function TemplateDetailView({
  templateId,
  onBack,
  onEdit,
}: {
  templateId: string;
  onBack: () => void;
  onEdit: (template: DocumentTemplateDetail) => void;
}) {
  const { data: template, isLoading } = useDocumentTemplate(templateId);
  const [previewVersionId, setPreviewVersionId] = useState<string | undefined>(undefined);

  if (isLoading) {
    return (
      <div className="space-y-4 py-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Template not found.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-2 text-sm text-[#7c3aed] hover:underline"
        >
          Back to list
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-1 text-xs text-muted-foreground hover:text-foreground"
          >
            &larr; Back to list
          </button>
          <h2 className="text-lg font-semibold">{template.name}</h2>
          {template.description && (
            <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onEdit(template);
          }}
          className="rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white hover:bg-[#5b21b6]"
        >
          Edit Template
        </button>
      </div>

      {/* Template info card */}
      <div className="rounded-xl border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-muted-foreground">Document Type</span>
            <p className="font-medium">{template.documentType.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Page Size</span>
            <p className="font-medium">
              {template.pageSize} / {template.orientation}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Status</span>
            <p className="font-medium">{template.isActive ? 'Active' : 'Inactive'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Versions</span>
            <p className="font-medium">{template.versions.length}</p>
          </div>
        </div>
      </div>

      {/* Two-column layout on desktop, stacked on mobile/tablet */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Version Management */}
        <div className="rounded-xl border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <VersionManagement
            templateId={template.id}
            versions={template.versions}
            onPreviewVersion={(versionId) => {
              setPreviewVersionId(versionId);
            }}
          />
        </div>

        {/* Right: Preview Panel */}
        <div className="rounded-xl border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <PreviewPanel
            templateId={template.id}
            versionId={previewVersionId}
            documentType={template.documentType}
          />
        </div>
      </div>
    </div>
  );
}
