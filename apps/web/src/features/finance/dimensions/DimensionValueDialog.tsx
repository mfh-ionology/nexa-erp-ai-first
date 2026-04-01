/* eslint-disable i18next/no-literal-string */
/**
 * DimensionValueDialog — Create/Edit dimension value dialog.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/lib/form-utils';
import { useZodForm } from '@/lib/form-utils';

import { useCreateDimensionValue, useUpdateDimensionValue } from './api';
import type { DimensionValue } from './api';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const dimensionValueSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .max(50, 'Max 50 characters')
    .regex(/^[A-Z0-9_-]+$/, 'Uppercase letters, numbers, hyphens, underscores only'),
  name: z.string().min(1, 'Name is required').max(200, 'Max 200 characters'),
  parentId: z.string().optional(),
});

type DimensionValueFormValues = z.infer<typeof dimensionValueSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DimensionValueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  typeId: string;
  existingValues: DimensionValue[];
  dimensionValue?: DimensionValue | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DimensionValueDialog({
  open,
  onOpenChange,
  typeId,
  existingValues,
  dimensionValue,
}: DimensionValueDialogProps) {
  const { t } = useI18n('finance');
  const isEdit = !!dimensionValue;

  const createMutation = useCreateDimensionValue(typeId);
  const updateMutation = useUpdateDimensionValue(typeId);

  const form = useZodForm<DimensionValueFormValues>({
    schema: dimensionValueSchema,
    defaultValues: {
      code: '',
      name: '',
      parentId: undefined,
    },
  });

  // Sync form on open/edit
  useEffect(() => {
    if (open && dimensionValue) {
      form.reset({
        code: dimensionValue.code,
        name: dimensionValue.name,
        parentId: dimensionValue.parentId ?? undefined,
      });
    } else if (open && !dimensionValue) {
      form.reset({
        code: '',
        name: '',
        parentId: undefined,
      });
    }
  }, [open, dimensionValue, form]);

  // Filter out the current value and its descendants from parent options
  const parentOptions = existingValues.filter((v) => {
    if (!dimensionValue) return v.isActive;
    return v.id !== dimensionValue.id && v.isActive;
  });

  const onSubmit = useCallback(
    async (values: DimensionValueFormValues) => {
      try {
        if (isEdit && dimensionValue) {
          await updateMutation.mutateAsync({
            id: dimensionValue.id,
            data: {
              name: values.name,
              parentId: values.parentId || null,
            },
          });
        } else {
          await createMutation.mutateAsync({
            code: values.code,
            name: values.name,
            parentId: values.parentId || undefined,
          });
        }
        onOpenChange(false);
      } catch {
        // Error toast handled by mutation
      }
    },
    [isEdit, dimensionValue, createMutation, updateMutation, onOpenChange],
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('dimensions.dialog.editValue.title')
              : t('dimensions.dialog.createValue.title')}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t('dimensions.dialog.editValue.description')
              : t('dimensions.dialog.createValue.description')}
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
                      placeholder="e.g. SALES"
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
                    <Input placeholder="e.g. Sales Department" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('dimensions.field.parent')}</FormLabel>
                  <Select
                    value={field.value ?? '_none_'}
                    onValueChange={(val) => field.onChange(val === '_none_' ? undefined : val)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('dimensions.field.parentPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none_">{t('dimensions.field.noParent')}</SelectItem>
                      {parentOptions.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          <span className="font-mono text-xs">{v.code}</span>
                          <span className="ml-2">{v.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
