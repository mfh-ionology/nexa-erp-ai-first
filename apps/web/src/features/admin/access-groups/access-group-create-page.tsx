/**
 * Access Group Create Page.
 *
 * Simple form page for creating a new access group with
 * Code (UPPER_SNAKE_CASE), Name, and optional Description.
 */

import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { useI18n } from '@nexa/i18n';
import { ApiError } from '@nexa/api-client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

import { useCreateAccessGroup } from './api/use-access-group-mutations';

const createAccessGroupSchema = z.object({
  code: z
    .string()
    .min(1, 'accessGroups.validation.codeRequired')
    .max(50, 'accessGroups.validation.codeMaxLength')
    .regex(/^[A-Z][A-Z0-9_]*$/, 'accessGroups.validation.codeFormat'),
  name: z
    .string()
    .min(1, 'accessGroups.validation.nameRequired')
    .max(255, 'accessGroups.validation.nameMaxLength'),
  description: z.string().max(1000).optional(),
});

type CreateAccessGroupFormValues = z.infer<typeof createAccessGroupSchema>;

export function AccessGroupCreatePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const createMutation = useCreateAccessGroup();

  const form = useZodForm<CreateAccessGroupFormValues>({
    schema: createAccessGroupSchema,
    defaultValues: {
      code: '',
      name: '',
      description: '',
    },
  });

  const breadcrumbs = useMemo(
    () => [
      { label: t('navigation:system'), path: '/system' },
      { label: t('accessGroups.title'), path: '/system/access-groups' },
      { label: t('accessGroups.create.title') },
    ],
    [t],
  );

  async function onSubmit(values: CreateAccessGroupFormValues) {
    try {
      const created = await createMutation.mutateAsync({
        code: values.code,
        name: values.name,
        description: values.description || undefined,
      });
      toast.success(t('accessGroups.toast.created'));
      void navigate({
        to: `/system/access-groups/${created.id}` as string,
      });
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 409) {
        form.setError('code', {
          message: t('accessGroups.error.duplicateCode'),
        });
      } else if (error instanceof ApiError && error.statusCode === 400) {
        // Map server validation errors inline
        if ('details' in error) {
          const details = (error as ApiError & { details?: Record<string, string[]> }).details;
          if (details) {
            for (const [field, messages] of Object.entries(details)) {
              if (field === 'code' || field === 'name' || field === 'description') {
                form.setError(field, { message: messages[0] });
              }
            }
          }
        }
      } else {
        toast.error(t('errors:unexpected'));
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('accessGroups.create.title')}
        breadcrumbs={breadcrumbs}
      />

      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              noValidate
              className="space-y-4"
            >
              {/* Code field */}
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('accessGroups.field.code')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('accessGroups.field.codePlaceholder')}
                        autoFocus
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                    <FormLabel>{t('accessGroups.field.description')}</FormLabel>
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

              {/* Error announcements for screen readers */}
              <div aria-live="polite" aria-atomic="true" className="sr-only">
                {form.formState.errors.code?.message}
                {form.formState.errors.name?.message}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      {t('common:creating')}
                    </>
                  ) : (
                    t('common:create')
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    void navigate({
                      to: '/system/access-groups' as string,
                    })
                  }
                >
                  {t('common:cancel')}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
