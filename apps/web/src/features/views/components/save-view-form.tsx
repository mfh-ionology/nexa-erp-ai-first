import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/lib/form-utils';
import { useZodForm } from '@/lib/form-utils';
import { useAuthStore } from '@/stores/auth-store';
import { ApiError } from '@nexa/api-client';

import type { ViewScope, CreateSavedViewRequest, CreateSavedViewConditionInput } from '../types';
import type { useViewMutations } from '../hooks/use-view-mutations';
import type { ViewState } from '../hooks/use-view-state';

const saveViewSchema = z.object({
  name: z.string().min(1).max(100),
  groupName: z.string().min(1).max(100),
  scope: z.enum(['PERSONAL', 'ROLE', 'GLOBAL']),
  roleId: z.string().optional(),
  isFavourite: z.boolean().default(false),
});

type SaveViewFormValues = z.infer<typeof saveViewSchema>;

interface SaveViewFormProps {
  viewKey: string;
  viewState: ViewState;
  mutations: ReturnType<typeof useViewMutations>;
  onSuccess: () => void;
  onCancel: () => void;
}

export function SaveViewForm({
  viewKey,
  viewState,
  mutations,
  onSuccess,
  onCancel,
}: SaveViewFormProps) {
  const { t } = useI18n();
  const permissions = useAuthStore((s) => s.permissions);
  const isAdmin = permissions?.isSuperAdmin ?? false;
  const accessGroups = permissions?.accessGroups ?? [];

  const form = useZodForm({
    schema: saveViewSchema,
    defaultValues: {
      name: '',
      groupName: '',
      scope: 'PERSONAL' as ViewScope,
      roleId: undefined,
      isFavourite: false,
    },
  });

  const selectedScope = form.watch('scope');

  async function onSubmit(values: SaveViewFormValues) {
    // Serialize active filter conditions for the saved view
    const conditions: CreateSavedViewConditionInput[] = viewState.activeFilters.map((c, idx) => ({
      dataViewFieldId: c.dataViewFieldId,
      operator: c.operator,
      value: c.value ?? undefined,
      valueList: c.valueList ?? undefined,
      datePresetId: c.datePresetId ?? undefined,
      groupId: c.groupId,
      groupLogic: c.groupLogic,
      outerLogic: c.outerLogic,
      conditionOrder: idx,
    }));

    const request: CreateSavedViewRequest = {
      viewKey,
      name: values.name.trim(),
      groupName: values.groupName.trim(),
      scope: values.scope,
      isFavourite: values.isFavourite,
      ...(values.scope === 'ROLE' && values.roleId ? { roleId: values.roleId } : {}),
      filterLogic: viewState.filterLogic,
      sortConfig: viewState.activeSortRules.map((r) => ({
        field: r.field,
        direction: r.direction,
        priority: r.priority,
      })),
      columnConfig: viewState.columnState.map((col) => ({
        fieldId: col.fieldId,
        visible: col.visible,
        order: col.order,
        width: col.width,
        pinned: col.pinned,
      })),
      conditions,
    };

    try {
      await mutations.createView.mutateAsync(request);
      onSuccess();
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 409) {
        form.setError('name', {
          message: t('views.error.duplicateName'),
        });
      }
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          void form.handleSubmit(onSubmit)(e);
        }}
        className="space-y-3 pt-2"
        noValidate
      >
        {/* Name field */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('views.form.name')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t('views.form.namePlaceholder')}
                  maxLength={100}
                  /* eslint-disable-next-line jsx-a11y/no-autofocus */
                  autoFocus
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Group name field */}
        <FormField
          control={form.control}
          name="groupName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('views.form.groupName')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t('views.form.groupNamePlaceholder')}
                  maxLength={100}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Add to favourites checkbox */}
        <FormField
          control={form.control}
          name="isFavourite"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="is-favourite"
                />
              </FormControl>
              <FormLabel htmlFor="is-favourite" className="text-sm font-normal cursor-pointer">
                {t('views.form.addToFavourites')}
              </FormLabel>
            </FormItem>
          )}
        />

        {/* Scope radio group */}
        <FormField
          control={form.control}
          name="scope"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('views.form.scope')}</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-1.5">
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <RadioGroupItem value="PERSONAL" id="scope-personal" />
                    <label htmlFor="scope-personal" className="text-sm cursor-pointer">
                      {t('views.scope.personal')}
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <RadioGroupItem value="ROLE" id="scope-role" />
                    <label htmlFor="scope-role" className="text-sm cursor-pointer">
                      {t('views.scope.role')}
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem
                      // eslint-disable-next-line i18next/no-literal-string
                      value="GLOBAL"
                      id="scope-global"
                      disabled={!isAdmin}
                    />
                    <label
                      htmlFor="scope-global"
                      className={`text-sm cursor-pointer ${!isAdmin ? 'text-muted-foreground' : ''}`}
                    >
                      {t('views.scope.global')}
                    </label>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Role selector — only when scope is ROLE */}
        {selectedScope === 'ROLE' && (
          <FormField
            control={form.control}
            name="roleId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('views.form.role')}</FormLabel>
                {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('views.form.rolePlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {accessGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={mutations.createView.isPending}>
            {mutations.createView.isPending && <Loader2 className="size-3.5 animate-spin" />}
            {t('views.actions.saveNew')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
