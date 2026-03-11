/* eslint-disable i18next/no-literal-string */
/**
 * Version Management — list, create, edit, clone, delete versions for a document template.
 *
 * AC8: Template Management UI — Version Management
 * - Displays list of versions with priority, selection criteria summary, status badge, created date
 * - Actions per version: Edit, Clone, Activate/Deactivate toggle, Delete (with confirm dialog)
 * - "Create Version" button opens version editor dialog
 * - Version editor form: selection criteria, override editors (collapsible), email settings, priority, isActive
 * - Concept D visual fidelity throughout
 */

import { useCallback, useMemo, useState } from 'react';
import { ChevronDown, Copy, Edit, Eye, Loader2, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { z } from 'zod';
import type { Control, SubmitHandler } from 'react-hook-form';

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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  useZodForm,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/lib/form-utils';

import type { DocumentTemplateVersion, CreateTemplateVersionRequest } from './api';
import {
  useCreateTemplateVersion,
  useUpdateTemplateVersion,
  useDeleteTemplateVersion,
} from './api';

// ─── Schema ────────────────────────────────────────────────────────────────

const versionFormSchema = z.object({
  languageCode: z.string().max(10).optional().or(z.literal('')),
  branchCode: z.string().max(50).optional().or(z.literal('')),
  numberSeriesId: z.string().optional().or(z.literal('')),
  accessGroup: z.string().max(50).optional().or(z.literal('')),
  customerGroupId: z.string().optional().or(z.literal('')),
  htmlOverride: z.string().optional().or(z.literal('')),
  cssOverride: z.string().optional().or(z.literal('')),
  headerOverride: z.string().optional().or(z.literal('')),
  footerOverride: z.string().optional().or(z.literal('')),
  emailSubject: z.string().max(500).optional().or(z.literal('')),
  emailBody: z.string().optional().or(z.literal('')),
  replyToEmail: z.string().email('Invalid email address').max(255).optional().or(z.literal('')),
  ccEmails: z
    .string()
    .max(500)
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => {
        if (!val) return true;
        return val.split(',').every((email) => {
          const trimmed = email.trim();
          return trimmed === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
        });
      },
      { message: 'Each CC email must be a valid email address' },
    ),
  priority: z.coerce.number().int().min(-100).max(1000).default(0),
  isActive: z.boolean().default(true),
});

type VersionFormValues = z.infer<typeof versionFormSchema>;

// ─── Types ──────────────────────────────────────────────────────────────────

type EditorMode =
  | { type: 'closed' }
  | { type: 'create' }
  | { type: 'edit'; version: DocumentTemplateVersion }
  | { type: 'clone'; version: DocumentTemplateVersion };

export interface VersionManagementProps {
  templateId: string;
  versions: DocumentTemplateVersion[];
  onPreviewVersion?: (versionId: string) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildCriteriaSummary(version: DocumentTemplateVersion): string {
  const parts: string[] = [];
  if (version.languageCode) parts.push(`Lang: ${version.languageCode}`);
  if (version.branchCode) parts.push(`Branch: ${version.branchCode}`);
  if (version.accessGroup) parts.push(`Group: ${version.accessGroup}`);
  if (version.numberSeriesId) parts.push('Number Series');
  if (version.customerGroupId) parts.push('Customer Group');
  return parts.length > 0 ? parts.join(', ') : 'No selection criteria';
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '\u2014';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '\u2014';
  }
}

// ─── Version Row ────────────────────────────────────────────────────────────

function VersionRow({
  version,
  onEdit,
  onClone,
  onPreview,
  onToggleActive,
  onDelete,
  animationIndex,
}: {
  version: DocumentTemplateVersion;
  onEdit: () => void;
  onClone: () => void;
  onPreview: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  animationIndex: number;
}) {
  const criteriaSummary = useMemo(() => buildCriteriaSummary(version), [version]);
  const delay = String(animationIndex * 40);

  return (
    <Card
      className="rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)] animate-fade-in-up"
      style={animationIndex <= 8 ? { animationDelay: `${delay}ms` } : undefined}
    >
      <CardContent className="flex items-center justify-between gap-3 p-3 sm:p-4">
        {/* Left: Info */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-xs font-semibold tabular-nums"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Priority: {version.priority}
            </span>
            <Badge
              variant="secondary"
              className={
                version.isActive
                  ? 'border-0 bg-green-50 text-xs text-green-700'
                  : 'border-0 bg-gray-100 text-xs text-gray-500'
              }
            >
              {version.isActive ? 'Active' : 'Draft'}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">{criteriaSummary}</p>
          <p className="text-xs text-muted-foreground">{formatDate(version.createdAt)}</p>
        </div>

        {/* Right: Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 shrink-0 p-0 hover:bg-[#f5f3ff]"
              aria-label="Version actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
            <DropdownMenuItem onClick={onToggleActive}>
              <Badge
                variant="secondary"
                className={
                  version.isActive
                    ? 'mr-2 border-0 bg-gray-100 text-xs text-gray-500'
                    : 'mr-2 border-0 bg-green-50 text-xs text-green-700'
                }
              >
                {version.isActive ? 'Deactivate' : 'Activate'}
              </Badge>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[#dc2626] focus:text-[#dc2626]" onClick={onDelete}>
              <Trash2 className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

// ─── Version Editor Dialog ──────────────────────────────────────────────────

function VersionEditorDialog({
  templateId,
  mode,
  onClose,
}: {
  templateId: string;
  mode: Exclude<EditorMode, { type: 'closed' }>;
  onClose: () => void;
}) {
  const isEdit = mode.type === 'edit';
  const sourceVersion = mode.type !== 'create' ? mode.version : null;

  const defaultValues = useMemo<VersionFormValues>(() => {
    if (!sourceVersion) {
      return {
        languageCode: '',
        branchCode: '',
        numberSeriesId: '',
        accessGroup: '',
        customerGroupId: '',
        htmlOverride: '',
        cssOverride: '',
        headerOverride: '',
        footerOverride: '',
        emailSubject: '',
        emailBody: '',
        replyToEmail: '',
        ccEmails: '',
        priority: 0,
        isActive: true,
      };
    }
    return {
      languageCode: sourceVersion.languageCode ?? '',
      branchCode: sourceVersion.branchCode ?? '',
      numberSeriesId: sourceVersion.numberSeriesId ?? '',
      accessGroup: sourceVersion.accessGroup ?? '',
      customerGroupId: sourceVersion.customerGroupId ?? '',
      htmlOverride: sourceVersion.htmlOverride ?? '',
      cssOverride: sourceVersion.cssOverride ?? '',
      headerOverride: sourceVersion.headerOverride ?? '',
      footerOverride: sourceVersion.footerOverride ?? '',
      emailSubject: sourceVersion.emailSubject ?? '',
      emailBody: sourceVersion.emailBody ?? '',
      replyToEmail: sourceVersion.replyToEmail ?? '',
      ccEmails: sourceVersion.ccEmails ?? '',
      priority: sourceVersion.priority,
      isActive: mode.type === 'clone' ? true : sourceVersion.isActive,
    };
  }, [sourceVersion, mode.type]);

  const form = useZodForm({ schema: versionFormSchema, defaultValues });

  const createVersion = useCreateTemplateVersion(templateId);
  const updateVersion = useUpdateTemplateVersion(templateId);
  const isPending = createVersion.isPending || updateVersion.isPending;

  const toPayload = useCallback(
    (values: VersionFormValues): CreateTemplateVersionRequest => ({
      languageCode: values.languageCode || null,
      branchCode: values.branchCode || null,
      numberSeriesId: values.numberSeriesId || null,
      accessGroup: values.accessGroup || null,
      customerGroupId: values.customerGroupId || null,
      htmlOverride: values.htmlOverride || null,
      cssOverride: values.cssOverride || null,
      headerOverride: values.headerOverride || null,
      footerOverride: values.footerOverride || null,
      emailSubject: values.emailSubject || null,
      emailBody: values.emailBody || null,
      replyToEmail: values.replyToEmail || null,
      ccEmails: values.ccEmails || null,
      priority: values.priority,
      isActive: values.isActive,
    }),
    [],
  );

  const onSubmit: SubmitHandler<VersionFormValues> = useCallback(
    (values) => {
      const payload = toPayload(values);
      if (isEdit && sourceVersion) {
        updateVersion.mutate(
          { versionId: sourceVersion.id, data: payload },
          { onSuccess: onClose },
        );
      } else {
        createVersion.mutate(payload, { onSuccess: onClose });
      }
    },
    [isEdit, sourceVersion, createVersion, updateVersion, toPayload, onClose],
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Version' : mode.type === 'clone' ? 'Clone Version' : 'Create Version'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-5">
            {/* ── Selection Criteria ── */}
            <div>
              <h4 className="mb-3 text-sm font-medium">Selection Criteria</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="languageCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language Code</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. fr, de, es" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="branchCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch Code</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. MAIN, LONDON" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="numberSeriesId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number Series ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Number series reference" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accessGroup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Access Group</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. SALES, PURCHASING" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerGroupId"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Customer Group ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Customer group reference" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* ── Override Editors (Collapsible) ── */}
            <CollapsibleOverride
              label="HTML Override"
              name="htmlOverride"
              control={form.control}
              placeholder="<!-- Override base HTML template -->"
            />
            <CollapsibleOverride
              label="CSS Override"
              name="cssOverride"
              control={form.control}
              placeholder="/* Override base CSS styles */"
            />
            <CollapsibleOverride
              label="Header Override"
              name="headerOverride"
              control={form.control}
              placeholder="<!-- Override header HTML -->"
            />
            <CollapsibleOverride
              label="Footer Override"
              name="footerOverride"
              control={form.control}
              placeholder="<!-- Override footer HTML -->"
            />

            {/* ── Email Settings ── */}
            <div>
              <h4 className="mb-3 text-sm font-medium">Email Settings</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="emailSubject"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Email Subject</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Invoice {{document.number}} from {{company.name}}"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emailBody"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Email Body</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Email body text or HTML..."
                          className="min-h-[100px] resize-y text-sm"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="replyToEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reply-To Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="reply@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ccEmails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CC Emails</FormLabel>
                      <FormControl>
                        <Input placeholder="comma-separated emails" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* ── Priority & Active ── */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <FormControl>
                      <Input type="number" min={-100} max={1000} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel className="cursor-pointer">Active</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* ── Actions ── */}
            <div className="flex items-center justify-end gap-3 border-t pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="gap-1.5 bg-[#7c3aed] hover:bg-[#5b21b6]"
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {isPending ? 'Saving...' : isEdit ? 'Update Version' : 'Create Version'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Collapsible Override Editor ────────────────────────────────────────────

function CollapsibleOverride({
  label,
  name,
  control,
  placeholder,
}: {
  label: string;
  name: 'htmlOverride' | 'cssOverride' | 'headerOverride' | 'footerOverride';
  control: Control<VersionFormValues>;
  placeholder: string;
}) {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-between px-0 hover:bg-transparent"
        >
          <Label className="cursor-pointer text-sm font-medium">{label}</Label>
          <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <FormField
          control={control}
          name={name}
          render={({ field }) => (
            <FormItem className="mt-2">
              <FormControl>
                <Textarea
                  placeholder={placeholder}
                  className="min-h-[120px] resize-y font-mono text-sm leading-relaxed"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function VersionManagement({
  templateId,
  versions,
  onPreviewVersion,
}: VersionManagementProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>({ type: 'closed' });
  const [deletingVersion, setDeletingVersion] = useState<DocumentTemplateVersion | null>(null);

  const deleteVersion = useDeleteTemplateVersion(templateId);
  const updateVersion = useUpdateTemplateVersion(templateId);

  const handleDeleteConfirm = useCallback(() => {
    if (!deletingVersion) return;
    deleteVersion.mutate(deletingVersion.id, {
      onSettled: () => {
        setDeletingVersion(null);
      },
    });
  }, [deletingVersion, deleteVersion]);

  const handleToggleActive = useCallback(
    (version: DocumentTemplateVersion) => {
      updateVersion.mutate({
        versionId: version.id,
        data: { isActive: !version.isActive },
      });
    },
    [updateVersion],
  );

  // Sort versions by priority descending
  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => b.priority - a.priority),
    [versions],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Versions
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({versions.length})
          </span>
        </h3>
        <Button
          size="sm"
          className="gap-1.5 bg-[#7c3aed] hover:bg-[#5b21b6]"
          onClick={() => {
            setEditorMode({ type: 'create' });
          }}
        >
          <Plus className="size-3.5" />
          Create Version
        </Button>
      </div>

      {/* Version List */}
      {sortedVersions.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No versions yet. Create a version to add selection criteria and overrides.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {sortedVersions.map((version, idx) => (
            <VersionRow
              key={version.id}
              version={version}
              onEdit={() => {
                setEditorMode({ type: 'edit', version });
              }}
              onClone={() => {
                setEditorMode({ type: 'clone', version });
              }}
              onPreview={() => {
                onPreviewVersion?.(version.id);
              }}
              onToggleActive={() => {
                handleToggleActive(version);
              }}
              onDelete={() => {
                setDeletingVersion(version);
              }}
              animationIndex={idx}
            />
          ))}
        </div>
      )}

      {/* Version Editor Dialog */}
      {editorMode.type !== 'closed' && (
        <VersionEditorDialog
          templateId={templateId}
          mode={editorMode}
          onClose={() => {
            setEditorMode({ type: 'closed' });
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingVersion}
        onOpenChange={(open) => {
          if (!open) setDeletingVersion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Version</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this version (priority{' '}
              {deletingVersion?.priority ?? 0})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-[#dc2626] hover:bg-[#b91c1c]"
            >
              {deleteVersion.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
