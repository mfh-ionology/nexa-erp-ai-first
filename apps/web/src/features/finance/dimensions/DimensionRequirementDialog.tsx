/* eslint-disable i18next/no-literal-string */
/**
 * DimensionRequirementDialog — Create/Edit dimension requirement dialog.
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
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/lib/form-utils';
import { useZodForm } from '@/lib/form-utils';

import {
  useDimensionTypes,
  useCreateDimensionRequirement,
  useUpdateDimensionRequirement,
} from './api';
import type { DimensionRequirement } from './api';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const requirementSchema = z
  .object({
    dimensionTypeId: z.string().min(1, 'Dimension type is required'),
    accountCodeFrom: z.string().min(1, 'Account code from is required'),
    accountCodeTo: z.string().min(1, 'Account code to is required'),
    isRequired: z.boolean(),
  })
  .refine((data) => data.accountCodeFrom <= data.accountCodeTo, {
    message: 'Account code "from" must be less than or equal to "to"',
    path: ['accountCodeTo'],
  });

type RequirementFormValues = z.infer<typeof requirementSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DimensionRequirementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirement?: DimensionRequirement | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DimensionRequirementDialog({
  open,
  onOpenChange,
  requirement,
}: DimensionRequirementDialogProps) {
  const { t } = useI18n('finance');
  const isEdit = !!requirement;

  const { data: dimensionTypes } = useDimensionTypes({ isActive: true });
  const createMutation = useCreateDimensionRequirement();
  const updateMutation = useUpdateDimensionRequirement();

  const form = useZodForm<RequirementFormValues>({
    schema: requirementSchema,
    defaultValues: {
      dimensionTypeId: '',
      accountCodeFrom: '',
      accountCodeTo: '',
      isRequired: true,
    },
  });

  // Sync form on open/edit
  useEffect(() => {
    if (open && requirement) {
      form.reset({
        dimensionTypeId: requirement.dimensionTypeId,
        accountCodeFrom: requirement.accountCodeFrom,
        accountCodeTo: requirement.accountCodeTo,
        isRequired: requirement.isRequired,
      });
    } else if (open && !requirement) {
      form.reset({
        dimensionTypeId: '',
        accountCodeFrom: '',
        accountCodeTo: '',
        isRequired: true,
      });
    }
  }, [open, requirement, form]);

  const onSubmit = useCallback(
    async (values: RequirementFormValues) => {
      try {
        if (isEdit && requirement) {
          await updateMutation.mutateAsync({
            id: requirement.id,
            data: {
              dimensionTypeId: values.dimensionTypeId,
              accountCodeFrom: values.accountCodeFrom,
              accountCodeTo: values.accountCodeTo,
              isRequired: values.isRequired,
            },
          });
        } else {
          await createMutation.mutateAsync({
            dimensionTypeId: values.dimensionTypeId,
            accountCodeFrom: values.accountCodeFrom,
            accountCodeTo: values.accountCodeTo,
            isRequired: values.isRequired,
          });
        }
        onOpenChange(false);
      } catch {
        // Error toast handled by mutation
      }
    },
    [isEdit, requirement, createMutation, updateMutation, onOpenChange],
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('dimensions.requirements.dialog.edit.title')
              : t('dimensions.requirements.dialog.create.title')}
          </DialogTitle>
          <DialogDescription>{t('dimensions.requirements.dialog.description')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="dimensionTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('dimensions.requirements.field.dimensionType')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select dimension type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(dimensionTypes ?? []).map((dt) => (
                        <SelectItem key={dt.id} value={dt.id}>
                          <span className="font-mono text-xs">{dt.code}</span>
                          <span className="ml-2">{dt.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="accountCodeFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('dimensions.requirements.field.accountCodeFrom')}</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 1000" className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accountCodeTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('dimensions.requirements.field.accountCodeTo')}</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 9999" className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isRequired"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <FormLabel className="text-sm">
                    {t('dimensions.requirements.field.isRequired')}
                  </FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
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
