/* eslint-disable i18next/no-literal-string */
/**
 * Article Form Dialog — reusable Create / Edit dialog for knowledge articles.
 *
 * AC-3: Create article dialog with title, content (markdown textarea), category.
 * AC-4: Edit dialog pre-filled, source read-only, content-change warning,
 *        isConfirmed checkbox for unconfirmed articles.
 * Concept D: animate-step-in, 12px radius.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { z } from 'zod';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';

import type { KnowledgeArticle, KnowledgeCategory, KnowledgeSource } from '../../api/types';
import {
  useCreateKnowledgeArticle,
  useUpdateKnowledgeArticle,
} from '../../api/use-knowledge-articles';

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: KnowledgeCategory; label: string }[] = [
  { value: 'BUSINESS_PROCESS', label: 'Business Processes' },
  { value: 'TERMINOLOGY', label: 'Terminology' },
  { value: 'INDUSTRY_RULES', label: 'Industry Rules' },
  { value: 'CUSTOM_FIELDS', label: 'Custom Fields' },
  { value: 'HISTORICAL_PATTERN', label: 'Historical Patterns' },
];

const SOURCE_LABELS: Record<KnowledgeSource, { label: string; className: string }> = {
  ADMIN_UPLOADED: { label: 'Admin', className: 'bg-[#7c3aed]/10 text-[#7c3aed]' },
  AI_GENERATED: { label: 'AI Generated', className: 'bg-blue-50 text-blue-700' },
  PLATFORM_SUGGESTED: { label: 'Platform', className: 'bg-green-50 text-green-700' },
  CORRECTION_DERIVED: { label: 'From Corrections', className: 'bg-amber-50 text-amber-700' },
};

// ─── Schema ─────────────────────────────────────────────────────────────────

const articleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must be 500 characters or fewer'),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(100_000, 'Content must be 100,000 characters or fewer'),
  category: z.enum(
    ['BUSINESS_PROCESS', 'TERMINOLOGY', 'INDUSTRY_RULES', 'CUSTOM_FIELDS', 'HISTORICAL_PATTERN'],
    { message: 'Category is required' },
  ),
  isConfirmed: z.boolean().optional(),
});

type ArticleFormValues = z.infer<typeof articleSchema>;

// ─── Component ──────────────────────────────────────────────────────────────

interface ArticleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  /** The article to edit; required when mode === 'edit'. */
  article?: KnowledgeArticle | null;
  /** Optional pre-fill values for create mode (e.g. from correction). */
  prefill?: {
    title?: string;
    content?: string;
    category?: KnowledgeCategory;
  };
}

export function ArticleFormDialog({
  open,
  onOpenChange,
  mode,
  article,
  prefill,
}: ArticleFormDialogProps) {
  const createArticle = useCreateKnowledgeArticle();
  const updateArticle = useUpdateKnowledgeArticle();
  const isPending = createArticle.isPending || updateArticle.isPending;

  const isEdit = mode === 'edit' && !!article;

  const defaultValues = useMemo<ArticleFormValues>(() => {
    if (isEdit) {
      return {
        title: article.title,
        content: article.content,
        category: article.category,
        isConfirmed: article.isConfirmed,
      };
    }
    return {
      title: prefill?.title ?? '',
      content: prefill?.content ?? '',
      category: prefill?.category ?? (undefined as unknown as KnowledgeCategory),
      isConfirmed: undefined,
    };
  }, [isEdit, article, prefill]);

  const form = useZodForm<ArticleFormValues>({
    schema: articleSchema,
    defaultValues,
  });

  // Reset form when dialog opens or article changes
  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [open, defaultValues, form]);

  // Track whether content was changed in edit mode (for re-chunk warning)
  const currentContent = form.watch('content');
  const contentChanged = isEdit && currentContent !== article.content;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) form.reset();
      onOpenChange(nextOpen);
    },
    [onOpenChange, form],
  );

  const onSubmit = useCallback(
    async (values: ArticleFormValues) => {
      try {
        if (isEdit) {
          const data: Record<string, unknown> = {};
          if (values.title !== article.title) data.title = values.title;
          if (values.content !== article.content) data.content = values.content;
          if (values.category !== article.category) data.category = values.category;
          if (values.isConfirmed && !article.isConfirmed) data.isConfirmed = true;

          if (Object.keys(data).length > 0) {
            await updateArticle.mutateAsync({ id: article.id, data });
          }
        } else {
          await createArticle.mutateAsync({
            title: values.title,
            content: values.content,
            category: values.category,
          });
        }
        handleOpenChange(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save article');
      }
    },
    [isEdit, article, createArticle, updateArticle, handleOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="animate-step-in rounded-xl sm:max-w-lg max-md:top-0 max-md:left-0 max-md:translate-x-0 max-md:translate-y-0 max-md:max-w-full max-md:h-[100dvh] max-md:rounded-none max-md:overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {isEdit ? 'Edit Knowledge Article' : 'Create Knowledge Article'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the article details. Content changes will re-chunk and re-embed.'
              : 'Create a new knowledge article to help the AI understand your business.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Source badge (read-only in edit mode) */}
            {isEdit && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Source:</span>
                <Badge
                  variant="secondary"
                  className={cn('border-0 text-xs', SOURCE_LABELS[article.source].className)}
                >
                  {SOURCE_LABELS[article.source].label}
                </Badge>
              </div>
            )}

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Article title" disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Content */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Write your article content here. Markdown is supported."
                      className="min-h-[160px] resize-y"
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>Supports markdown formatting</FormDescription>
                  {contentChanged && (
                    <p className="text-xs text-amber-600">
                      Content changes will re-chunk and re-embed this article.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Confirm checkbox (edit mode, unconfirmed articles only) */}
            {isEdit && !article.isConfirmed && (
              <FormField
                control={form.control}
                name="isConfirmed"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 space-y-0 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                        disabled={isPending}
                      />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">Confirm this article</FormLabel>
                      <FormDescription className="text-xs text-amber-700">
                        Confirming will upgrade the confidence score to 0.8
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="gap-1.5 bg-[#7c3aed] hover:bg-[#5b21b6]"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {isEdit ? 'Saving…' : 'Creating…'}
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    {isEdit ? 'Save Changes' : 'Create Article'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
