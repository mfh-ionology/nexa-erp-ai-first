/* eslint-disable i18next/no-literal-string */
/**
 * DimensionTypeDialog — Create/Edit dimension type dialog.
 */

import { useCallback, useEffect } from 'react';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/lib/form-utils';
import { useZodForm } from '@/lib/form-utils';

import { useCreateDimensionType, useUpdateDimensionType } from './api';
import type { DimensionType } from './api';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const dimensionTypeSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .max(20, 'Max 20 characters')
    .regex(/^[A-Z0-9_-]+$/, 'Uppercase letters, numbers, hyphens, underscores only'),
  name: z.string().min(1, 'Name is required').max(100, 'Max 100 characters'),
  description: z.string().max(500, 'Max 500 characters').optional(),
  singleSelect: z.boolean(),
  allowManualEntry: z.boolean(),
  sortOrder: z.number().min(0).max(999),
});

type DimensionTypeFormValues = z.infer<typeof dimensionTypeSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DimensionTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dimensionType?: DimensionType | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DimensionTypeDialog({
  open,
  onOpenChange,
  dimensionType,
}: DimensionTypeDialogProps) {
  const { t } = useI18n('finance');
  const isEdit = !!dimensionType;

  const createMutation = useCreateDimensionType();
  const updateMutation = useUpdateDimensionType();

  const form = useZodForm<DimensionTypeFormValues>({
    schema: dimensionTypeSchema,
    defaultValues: {
      code: '',
      name: '',
      description: '',
      singleSelect: true,
      allowManualEntry: false,
      sortOrder: 0,
    },
  });

  // Sync form on open/edit
  useEffect(() => {
    if (open && dimensionType) {
      form.reset({
        code: dimensionType.code,
        name: dimensionType.name,
        description: dimensionType.description ?? '',
        singleSelect: dimensionType.singleSelect,
        allowManualEntry: dimensionType.allowManualEntry,
        sortOrder: dimensionType.sortOrder,
      });
    } else if (open && !dimensionType) {
      form.reset({
        code: '',
        name: '',
        description: '',
        singleSelect: true,
        allowManualEntry: false,
        sortOrder: 0,
      });
    }
  }, [open, dimensionType, form]);

  const onSubmit = useCallback(
    async (values: DimensionTypeFormValues) => {
      try {
        if (isEdit && dimensionType) {
          await updateMutation.mutateAsync({
            id: dimensionType.id,
            data: {
              name: values.name,
              description: values.description || null,
              singleSelect: values.singleSelect,
              allowManualEntry: values.allowManualEntry,
              sortOrder: values.sortOrder,
            },
          });
        } else {
          await createMutation.mutateAsync({
            code: values.code,
            name: values.name,
            description: values.description || undefined,
            singleSelect: values.singleSelect,
            allowManualEntry: values.allowManualEntry,
            sortOrder: values.sortOrder,
          });
        }
        onOpenChange(false);
      } catch {
        // Error toast handled by mutation
      }
    },
    [isEdit, dimensionType, createMutation, updateMutation, onOpenChange],
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('dimensions.dialog.editType.title')
              : t('dimensions.dialog.createType.title')}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t('dimensions.dialog.editType.description')
              : t('dimensions.dialog.createType.description')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('dimensions.field.code')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. DEPT"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      readOnly={isEdit}
                      disabled={isEdit}
                      className="font-mono"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('dimensions.field.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Department" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('dimensions.field.description')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Optional description" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="singleSelect"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-2 rounded-lg border p-3">
                    <FormLabel className="text-sm">{t('dimensions.field.singleSelect')}</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="allowManualEntry"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-2 rounded-lg border p-3">
                    <FormLabel className="text-sm">
                      {t('dimensions.field.allowManualEntry')}
                    </FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="sortOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('dimensions.field.sortOrder')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={999}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      className="w-24 font-mono"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                {t('common:cancel')}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {isEdit ? t('common:save') : t('common:create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
