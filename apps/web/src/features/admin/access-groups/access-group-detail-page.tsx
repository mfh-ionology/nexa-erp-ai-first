/**
 * Access Group Detail Page.
 *
 * T7 Settings-style page for viewing and editing an access group:
 *  - Read-only Code field (immutable after creation)
 *  - Editable Name and Description with dirty tracking
 *  - System group info banner (code cannot change, cannot deactivate)
 *  - Tabbed layout: Permissions (default) and Field Overrides
 *  - Overflow menu with Deactivate action + confirmation dialog
 */

import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { Info, Loader2, MoreHorizontal, Save, Trash2 } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

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
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/lib/form-utils';
import { useZodForm } from '@/lib/form-utils';
import { PageHeader } from '@/components/templates/page-header';

import { useAccessGroup } from './api/use-access-groups';
import {
  useUpdateAccessGroup,
  useDeactivateAccessGroup,
} from './api/use-access-group-mutations';
import { PermissionMatrix } from './components/permission-matrix';
import { FieldOverridePanel } from './components/field-override-panel';

// --- Validation schema for metadata editing ---

const metadataSchema = z.object({
  name: z
    .string()
    .min(1, 'accessGroups.validation.nameRequired')
    .max(255, 'accessGroups.validation.nameMaxLength'),
  description: z.string().max(1000).optional(),
});

type MetadataFormValues = z.infer<typeof metadataSchema>;

// --- Component ---

export interface AccessGroupDetailPageProps {
  id: string;
}

export function AccessGroupDetailPage({ id }: AccessGroupDetailPageProps) {
  const { t } = useI18n();
  const navigate = useNavigate();

  // --- Data fetching ---
  const {
    data: group,
    isLoading,
    isError,
  } = useAccessGroup(id);

  // --- Mutations ---
  const updateMutation = useUpdateAccessGroup(id);
  const deactivateMutation = useDeactivateAccessGroup();

  // --- Deactivation dialog state ---
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  // --- Form setup (populated once data loads) ---
  const form = useZodForm<MetadataFormValues>({
    schema: metadataSchema,
    defaultValues: {
      name: '',
      description: '',
    },
    values: group
      ? {
          name: group.name,
          description: group.description ?? '',
        }
      : undefined,
  });

  const isDirty = form.formState.isDirty;

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [
      { label: t('navigation:system'), path: '/system' },
      { label: t('accessGroups.title'), path: '/system/access-groups' },
      { label: group?.name ?? t('accessGroups.detail.title') },
    ],
    [t, group?.name],
  );

  // --- Save metadata handler ---
  const onSubmit = useCallback(
    async (values: MetadataFormValues) => {
      const payload: Record<string, string | null> = {};
      if (values.name !== group?.name) {
        payload.name = values.name;
      }
      if ((values.description ?? '') !== (group?.description ?? '')) {
        payload.description = values.description || null;
      }
      // Only send changed fields
      if (Object.keys(payload).length === 0) return;
      await updateMutation.mutateAsync(payload);
    },
    [group?.name, group?.description, updateMutation],
  );

  // --- Deactivate handler ---
  const handleDeactivate = useCallback(async () => {
    try {
      await deactivateMutation.mutateAsync(id);
      setShowDeactivateDialog(false);
      void navigate({ to: '/system/access-groups' as string });
    } catch {
      // Dialog stays open — error toast is shown by the mutation's onError callback
    }
  }, [deactivateMutation, id, navigate]);

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('accessGroups.detail.title')}
          breadcrumbs={breadcrumbs}
          isLoading
        />
        <Card className="max-w-3xl">
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Error state ---
  if (isError || !group) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('accessGroups.detail.title')}
          breadcrumbs={breadcrumbs}
        />
        <Card className="max-w-3xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('accessGroups.error.loadFailed')}
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Action bar slot ---
  const actionBarSlot = (
    <div className="flex items-center gap-2">
      {/* Save button */}
      <Button
        onClick={form.handleSubmit(onSubmit)}
        disabled={!isDirty || updateMutation.isPending}
        size="sm"
      >
        {updateMutation.isPending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Save className="size-4" />
        )}
        {t('common:save')}
      </Button>

      {/* Overflow menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('actionBar.moreActions')}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            disabled={group.isSystem}
            onSelect={() => setShowDeactivateDialog(true)}
          >
            <Trash2 className="size-4" />
            {t('accessGroups.deactivate.confirm')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page header with breadcrumbs, title, and action bar */}
      <PageHeader
        title={group.name}
        breadcrumbs={breadcrumbs}
        statusBadge={
          group.isSystem ? (
            <Badge variant="secondary">{t('accessGroups.systemBadge')}</Badge>
          ) : undefined
        }
        actionBarSlot={actionBarSlot}
      />

      {/* System group info banner */}
      {group.isSystem && (
        <div
          className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200"
          role="alert"
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{t('accessGroups.systemBanner')}</p>
        </div>
      )}

      {/* Metadata form */}
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              noValidate
              className="space-y-4"
            >
              {/* Code field — always read-only */}
              <FormItem>
                <FormLabel>{t('accessGroups.field.code')}</FormLabel>
                <FormControl>
                  <Input
                    value={group.code}
                    readOnly
                    disabled
                    className="font-mono"
                    aria-label={t('accessGroups.field.code')}
                  />
                </FormControl>
              </FormItem>

              {/* Name field */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('accessGroups.field.name')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('accessGroups.field.namePlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description field */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('accessGroups.field.description')}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          'accessGroups.field.descriptionPlaceholder',
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Screen reader error announcements */}
              <div aria-live="polite" aria-atomic="true" className="sr-only">
                {form.formState.errors.name?.message}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Tabbed layout: Permissions & Field Overrides */}
      <Tabs defaultValue="permissions" className="max-w-5xl">
        <TabsList>
          <TabsTrigger value="permissions">
            {t('accessGroups.tab.permissions')}
          </TabsTrigger>
          <TabsTrigger value="fieldOverrides">
            {t('accessGroups.tab.fieldOverrides')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="permissions" forceMount className="mt-4 data-[state=inactive]:hidden">
          <PermissionMatrix
            accessGroupId={id}
            permissions={group.permissions}
            readOnly={group.isSystem}
          />
        </TabsContent>

        <TabsContent value="fieldOverrides" forceMount className="mt-4 data-[state=inactive]:hidden">
          <FieldOverridePanel
            accessGroupId={id}
            fieldOverrides={group.fieldOverrides}
            readOnly={group.isSystem}
          />
        </TabsContent>
      </Tabs>

      {/* Deactivation confirmation dialog */}
      <Dialog
        open={showDeactivateDialog}
        onOpenChange={setShowDeactivateDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('accessGroups.deactivate.title')}</DialogTitle>
            <DialogDescription>
              {t('accessGroups.deactivate.body', { name: group.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowDeactivateDialog(false)}
            >
              {t('common:cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending && (
                <Loader2 className="animate-spin" />
              )}
              {t('accessGroups.deactivate.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
