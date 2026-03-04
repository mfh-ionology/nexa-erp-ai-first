/* eslint-disable i18next/no-literal-string, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-misused-promises */
/**
 * Email Template Editor Page — T7 Settings (Split-Pane variant).
 *
 * Create or edit an email template with:
 * - Left pane: form fields with React Hook Form + Zod
 * - Right pane: live preview + variable reference panel
 * - Responsive: stacked on tablet, form-only on mobile with preview dialog
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBlocker, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { Loader2, MoreHorizontal, Power, Save, Trash2, Eye, ArrowLeft } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/lib/form-utils';
import { useZodForm } from '@/lib/form-utils';
import { PageHeader } from '@/components/templates/page-header';
import { useBreakpoint } from '@/hooks/use-breakpoint';

import { DOCUMENT_TYPES } from './api/types';
import type { DocumentType } from './api/types';
import {
  useEmailTemplate,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
} from './api/use-email-templates';
import { EmailTemplatePreviewPane } from './components/email-template-preview-pane';
import {
  DOCUMENT_TYPE_VARIABLES,
  VariableReferencePanel,
} from './components/variable-reference-panel';

// --- Zod validation schema ---

const emailTemplateFormSchema = z.object({
  code: z
    .string()
    .min(1, 'emailTemplates.field.codeHelp')
    .max(100)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'emailTemplates.field.codeHelp'),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(''),
  documentType: z.enum(DOCUMENT_TYPES as unknown as [string, ...string[]]),
  subjectTemplate: z.string().min(1).max(500),
  bodyHtmlTemplate: z.string().min(1),
  bodyTextTemplate: z.string().optional().default(''),
  languageCode: z.string().min(1).max(5).default('en'),
  attachPdf: z.boolean().default(true),
  autoSend: z.boolean().default(false),
});

type EmailTemplateFormValues = z.infer<typeof emailTemplateFormSchema>;

// --- Component ---

export interface EmailTemplateEditorPageProps {
  id?: string;
}

export function EmailTemplateEditorPage({ id }: EmailTemplateEditorPageProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const breakpoint = useBreakpoint();
  const isCreateMode = !id;

  // --- Data fetching (edit mode) ---
  const { data: template, isLoading, isError } = useEmailTemplate(id);

  // --- Mutations ---
  const createMutation = useCreateEmailTemplate();
  const updateMutation = useUpdateEmailTemplate(id ?? '');
  const deleteMutation = useDeleteEmailTemplate();

  // --- Delete dialog state ---
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // --- Mobile preview dialog state ---
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  // --- Form setup ---
  const form = useZodForm<EmailTemplateFormValues>({
    schema: emailTemplateFormSchema,
    defaultValues: {
      code: '',
      name: '',
      description: '',
      documentType: '' as DocumentType,
      subjectTemplate: '',
      bodyHtmlTemplate: '',
      bodyTextTemplate: '',
      languageCode: 'en',
      attachPdf: true,
      autoSend: false,
    },
    values: template
      ? {
          code: template.code,
          name: template.name,
          description: template.description ?? '',
          documentType: template.documentType as DocumentType,
          subjectTemplate: template.subjectTemplate,
          bodyHtmlTemplate: template.bodyHtmlTemplate,
          bodyTextTemplate: template.bodyTextTemplate ?? '',
          languageCode: template.languageCode,
          attachPdf: template.attachPdf,
          autoSend: template.autoSend,
        }
      : undefined,
  });

  const isDirty = form.formState.isDirty;
  const watchedDocumentType = form.watch('documentType') as DocumentType;
  const watchedSubject = form.watch('subjectTemplate');
  const watchedBodyHtml = form.watch('bodyHtmlTemplate');

  // --- Unsaved changes: block in-app navigation ---
  const blocker = useBlocker({
    shouldBlockFn: () => isDirty,
    withResolver: true,
  });

  // --- Unsaved changes: browser beforeunload ---
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // --- Client-side preview with sample data substitution ---
  // Renders a live preview of the template being edited (both new and existing),
  // replacing {{variable}} placeholders with sample data for the selected document type.
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const previewError: string | null = null;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!watchedSubject && !watchedBodyHtml) {
        setPreviewHtml(null);
        setPreviewSubject(null);
        return;
      }

      // Build sample data map for the selected document type
      const variables = watchedDocumentType
        ? (DOCUMENT_TYPE_VARIABLES[watchedDocumentType] ?? [])
        : [];
      const sampleData: Record<string, string> = {};
      for (const v of variables) {
        sampleData[v] = `[${v}]`;
      }

      // Simple Handlebars-like substitution: replace {{varName}} with sample value
      const substitute = (tpl: string) =>
        tpl.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => sampleData[key] ?? `{{${key}}}`);

      setPreviewSubject(watchedSubject ? substitute(watchedSubject) : null);
      setPreviewHtml(watchedBodyHtml ? substitute(watchedBodyHtml) : null);
    }, 500);

    return () => clearTimeout(timer);
  }, [watchedSubject, watchedBodyHtml, watchedDocumentType]);

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [
      { label: t('navigation:system'), path: '/system' },
      { label: t('emailTemplates.title'), path: '/system/email-templates' },
      { label: isCreateMode ? t('create') : (template?.name ?? t('loading')) },
    ],
    [t, isCreateMode, template?.name],
  );

  // --- Submit handler ---
  const onSubmit = useCallback(
    async (values: EmailTemplateFormValues) => {
      if (isCreateMode) {
        const result = await createMutation.mutateAsync({
          code: values.code,
          name: values.name,
          description: values.description || undefined,
          documentType: values.documentType as DocumentType,
          subjectTemplate: values.subjectTemplate,
          bodyHtmlTemplate: values.bodyHtmlTemplate,
          bodyTextTemplate: values.bodyTextTemplate || undefined,
          languageCode: values.languageCode,
          attachPdf: values.attachPdf,
          autoSend: values.autoSend,
        });
        void navigate({
          to: '/system/email-templates/$id' as string,
          params: { id: result.id },
        });
      } else {
        await updateMutation.mutateAsync({
          name: values.name,
          description: values.description || undefined,
          documentType: values.documentType as DocumentType,
          subjectTemplate: values.subjectTemplate,
          bodyHtmlTemplate: values.bodyHtmlTemplate,
          bodyTextTemplate: values.bodyTextTemplate || undefined,
          languageCode: values.languageCode,
          attachPdf: values.attachPdf,
          autoSend: values.autoSend,
        });
      }
    },
    [isCreateMode, createMutation, updateMutation, navigate],
  );

  // --- Delete handler ---
  const handleDelete = useCallback(async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      setShowDeleteDialog(false);
      void navigate({ to: '/system/email-templates' as string });
    } catch {
      // Error toast shown by mutation's onError
    }
  }, [deleteMutation, id, navigate]);

  // --- Activate/Deactivate handler ---
  const handleToggleActive = useCallback(async () => {
    if (!id || !template) return;
    await updateMutation.mutateAsync({ isActive: !template.isActive });
  }, [id, template, updateMutation]);

  // --- Variable insert handler ---
  const handleVariableInsert = useCallback(
    (variable: string) => {
      const currentBody = form.getValues('bodyHtmlTemplate');
      form.setValue('bodyHtmlTemplate', `${currentBody}{{${variable}}}`, {
        shouldDirty: true,
      });
    },
    [form],
  );

  // --- Loading state ---
  if (!isCreateMode && isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('emailTemplates.title')} breadcrumbs={breadcrumbs} isLoading />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Error state ---
  if (!isCreateMode && (isError || (!isLoading && !template))) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('emailTemplates.title')} breadcrumbs={breadcrumbs} />
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('emailTemplates.error.loadFailed')}
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // --- Action bar ---
  const actionBarSlot = (
    <div className="flex items-center gap-2">
      {/* Back button (mobile) */}
      {breakpoint === 'phone' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void navigate({ to: '/system/email-templates' as string })}
          aria-label={t('back')}
        >
          <ArrowLeft className="size-4" />
        </Button>
      )}

      {/* Mobile preview button */}
      {breakpoint === 'phone' && !isCreateMode && (
        <Button variant="outline" size="sm" onClick={() => setShowMobilePreview(true)}>
          <Eye className="size-4" />
          {t('emailTemplates.preview.title')}
        </Button>
      )}

      {/* Save button */}
      <Button onClick={form.handleSubmit(onSubmit)} disabled={!isDirty || isSaving} size="sm">
        {isSaving ? <Loader2 className="animate-spin" /> : <Save className="size-4" />}
        {t('save')}
      </Button>

      {/* Overflow menu */}
      {!isCreateMode && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('actions')}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={handleToggleActive}>
              <Power className="size-4" />
              {template?.isActive ? t('emailTemplates.deactivate') : t('emailTemplates.activate')}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setShowDeleteDialog(true)}>
              <Trash2 className="size-4" />
              {t('emailTemplates.delete.confirm')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  // --- Form content (left pane) ---
  const formContent = (
    <Card className="h-fit">
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
            {/* Code */}
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('emailTemplates.field.code')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('emailTemplates.field.codePlaceholder')}
                      className="font-mono uppercase"
                      readOnly={!isCreateMode}
                      disabled={!isCreateMode}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('emailTemplates.field.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('emailTemplates.field.namePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('emailTemplates.field.description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('emailTemplates.field.descriptionPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Document Type */}
            <FormField
              control={form.control}
              name="documentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('emailTemplates.field.documentType')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t('emailTemplates.field.documentTypePlaceholder')}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`emailTemplates.documentType.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Language Code */}
            <FormField
              control={form.control}
              name="languageCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('emailTemplates.field.languageCode')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Subject Template */}
            <FormField
              control={form.control}
              name="subjectTemplate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('emailTemplates.field.subjectTemplate')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('emailTemplates.field.subjectTemplatePlaceholder')}
                      className="font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Body HTML Template */}
            <FormField
              control={form.control}
              name="bodyHtmlTemplate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('emailTemplates.field.bodyHtmlTemplate')}</FormLabel>
                  <FormControl>
                    <Textarea className="min-h-[200px] font-mono text-sm" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Body Text Template */}
            <FormField
              control={form.control}
              name="bodyTextTemplate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('emailTemplates.field.bodyTextTemplate')}</FormLabel>
                  <FormControl>
                    <Textarea className="min-h-[100px] font-mono text-sm" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Toggle switches */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="attachPdf"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        {t('emailTemplates.field.attachPdf')}
                      </FormLabel>
                      <FormDescription>
                        {t('emailTemplates.field.attachPdfDescription')}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="autoSend"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        {t('emailTemplates.field.autoSend')}
                      </FormLabel>
                      <FormDescription>
                        {t('emailTemplates.field.autoSendDescription')}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  // --- Preview content (right pane) ---
  const previewContent = (
    <div className="space-y-4">
      <EmailTemplatePreviewPane
        subject={previewSubject}
        bodyHtml={previewHtml}
        error={previewError}
        isLoading={false}
      />
      <VariableReferencePanel documentType={watchedDocumentType} onInsert={handleVariableInsert} />
    </div>
  );

  const isDesktop = breakpoint === 'desktop';
  const isTablet = breakpoint === 'tablet';
  const isMobile = breakpoint === 'phone';

  return (
    <div className="space-y-6">
      <PageHeader
        title={isCreateMode ? t('create') : (template?.name ?? '')}
        breadcrumbs={breadcrumbs}
        statusBadge={
          !isCreateMode && template ? (
            <Badge variant={template.isActive ? 'default' : 'secondary'}>
              {template.isActive
                ? t('emailTemplates.status.active')
                : t('emailTemplates.status.inactive')}
            </Badge>
          ) : undefined
        }
        actionBarSlot={actionBarSlot}
      />

      {/* Desktop: side-by-side split pane */}
      {isDesktop && (
        <div className="grid grid-cols-[3fr_2fr] gap-6 animate-fade-in-up delay-3">
          {formContent}
          <div className="sticky top-6">{previewContent}</div>
        </div>
      )}

      {/* Tablet: stacked layout */}
      {isTablet && (
        <div className="space-y-6 animate-fade-in-up delay-3">
          {formContent}
          {previewContent}
        </div>
      )}

      {/* Mobile: form only with preview dialog */}
      {isMobile && <div className="space-y-6 animate-fade-in-up delay-3">{formContent}</div>}

      {/* Mobile preview dialog */}
      <Dialog open={showMobilePreview} onOpenChange={setShowMobilePreview}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('emailTemplates.preview.title')}</DialogTitle>
          </DialogHeader>
          <EmailTemplatePreviewPane
            subject={previewSubject}
            bodyHtml={previewHtml}
            error={previewError}
            isLoading={false}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('emailTemplates.delete.title')}</DialogTitle>
            <DialogDescription>
              {t('emailTemplates.delete.message', { name: template?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="animate-spin" />}
              {t('emailTemplates.delete.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsaved changes navigation blocker dialog */}
      {blocker.status === 'blocked' && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) blocker.reset();
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('emailTemplates.unsavedChanges.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('emailTemplates.unsavedChanges.message')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => blocker.reset()}>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => blocker.proceed()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('emailTemplates.unsavedChanges.discard')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
