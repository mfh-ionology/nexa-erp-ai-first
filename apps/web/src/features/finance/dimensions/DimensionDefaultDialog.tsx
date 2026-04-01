/* eslint-disable i18next/no-literal-string */
/**
 * DimensionDefaultDialog — Create dimension default dialog.
 *
 * Defaults cannot be edited, only created and deleted.
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

import { useDimensionTypes, useDimensionValues, useCreateDimensionDefault } from './api';
import type { DimensionDefaultEntityType } from './api';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const defaultSchema = z.object({
  dimensionTypeId: z.string().min(1, 'Dimension type is required'),
  dimensionValueId: z.string().min(1, 'Dimension value is required'),
  entityType: z.enum(['ACCOUNT', 'CUSTOMER', 'SUPPLIER', 'ITEM', 'COMPANY']),
  entityId: z.string().optional(),
});

type DefaultFormValues = z.infer<typeof defaultSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DimensionDefaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DimensionDefaultDialog({ open, onOpenChange }: DimensionDefaultDialogProps) {
  const { t } = useI18n('finance');

  const { data: dimensionTypes } = useDimensionTypes({ isActive: true });
  const createMutation = useCreateDimensionDefault();

  const form = useZodForm<DefaultFormValues>({
    schema: defaultSchema,
    defaultValues: {
      dimensionTypeId: '',
      dimensionValueId: '',
      entityType: 'COMPANY' as DimensionDefaultEntityType,
      entityId: '',
    },
  });

  const selectedTypeId = form.watch('dimensionTypeId');
  const selectedEntityType = form.watch('entityType');

  // Fetch values for the selected dimension type
  const { data: dimensionValues } = useDimensionValues(selectedTypeId || undefined);

  // Reset value when type changes
  useEffect(() => {
    form.setValue('dimensionValueId', '');
  }, [selectedTypeId, form]);

  // Reset form on open
  useEffect(() => {
    if (open) {
      form.reset({
        dimensionTypeId: '',
        dimensionValueId: '',
        entityType: 'COMPANY',
        entityId: '',
      });
    }
  }, [open, form]);

  const showEntityId = selectedEntityType !== 'COMPANY';

  const onSubmit = useCallback(
    async (values: DefaultFormValues) => {
      try {
        await createMutation.mutateAsync({
          dimensionTypeId: values.dimensionTypeId,
          dimensionValueId: values.dimensionValueId,
          entityType: values.entityType,
          entityId: showEntityId ? values.entityId || undefined : undefined,
        });
        onOpenChange(false);
      } catch {
        // Error toast handled by mutation
      }
    },
    [createMutation, onOpenChange, showEntityId],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dimensions.defaults.dialog.create.title')}</DialogTitle>
          <DialogDescription>
            {t('dimensions.defaults.dialog.create.description')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="dimensionTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('dimensions.defaults.field.dimensionType')}</FormLabel>
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

            <FormField
              control={form.control}
              name="dimensionValueId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('dimensions.defaults.field.dimensionValue')}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!selectedTypeId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select dimension value" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(dimensionValues ?? [])
                        .filter((v) => v.isActive)
                        .map((v) => (
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

            <FormField
              control={form.control}
              name="entityType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('dimensions.defaults.field.entityType')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="COMPANY">Company (company-wide)</SelectItem>
                      <SelectItem value="ACCOUNT">Account</SelectItem>
                      <SelectItem value="CUSTOMER">Customer</SelectItem>
                      <SelectItem value="SUPPLIER">Supplier</SelectItem>
                      <SelectItem value="ITEM">Item</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showEntityId && (
              <FormField
                control={form.control}
                name="entityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('dimensions.defaults.field.entityId')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={`Enter ${selectedEntityType.toLowerCase()} ID or code`}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={createMutation.isPending}
              >
                {t('common:cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {t('common:create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
