/* eslint-disable i18next/no-literal-string */
/**
 * Training Example Form Dialog — reusable Create / Edit dialog.
 *
 * AC-5: Fields: inputText, outputText, skillKey (optional), category.
 * Create and Edit modes. Source shown read-only in edit mode.
 * React Hook Form + Zod validation.
 * Concept D: animate-step-in, 12px radius.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { z } from 'zod';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
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

import type { KnowledgeCategory, TrainingExample } from '../../api/types';
import {
  useCreateTrainingExample,
  useUpdateTrainingExample,
} from '../../api/use-training-examples';

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: KnowledgeCategory; label: string }[] = [
  { value: 'BUSINESS_PROCESS', label: 'Business Processes' },
  { value: 'TERMINOLOGY', label: 'Terminology' },
  { value: 'INDUSTRY_RULES', label: 'Industry Rules' },
  { value: 'CUSTOM_FIELDS', label: 'Custom Fields' },
  { value: 'HISTORICAL_PATTERN', label: 'Historical Patterns' },
];

const SOURCE_LABELS: Record<TrainingExample['source'], { label: string; className: string }> = {
  ADMIN_CURATED: { label: 'Admin Curated', className: 'bg-[#7c3aed]/10 text-[#7c3aed]' },
  CORRECTION_DERIVED: { label: 'From Corrections', className: 'bg-amber-50 text-amber-700' },
};

// ─── Schema ─────────────────────────────────────────────────────────────────

const trainingExampleSchema = z.object({
  inputText: z
    .string()
    .min(1, 'Input text is required')
    .max(10_000, 'Input text must be 10,000 characters or fewer'),
  outputText: z
    .string()
    .min(1, 'Output text is required')
    .max(10_000, 'Output text must be 10,000 characters or fewer'),
  skillKey: z.string().max(200, 'Skill key must be 200 characters or fewer').optional(),
  category: z.enum(
    ['BUSINESS_PROCESS', 'TERMINOLOGY', 'INDUSTRY_RULES', 'CUSTOM_FIELDS', 'HISTORICAL_PATTERN'],
    { message: 'Category is required' },
  ),
});

type TrainingExampleFormValues = z.infer<typeof trainingExampleSchema>;

// ─── Component ──────────────────────────────────────────────────────────────

interface TrainingExampleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  /** The example to edit; required when mode === 'edit'. */
  example?: TrainingExample | null;
}

export function TrainingExampleFormDialog({
  open,
  onOpenChange,
  mode,
  example,
}: TrainingExampleFormDialogProps) {
  const createExample = useCreateTrainingExample();
  const updateExample = useUpdateTrainingExample();
  const isPending = createExample.isPending || updateExample.isPending;

  const isEdit = mode === 'edit' && !!example;

  const defaultValues = useMemo<TrainingExampleFormValues>(() => {
    if (isEdit) {
      return {
        inputText: example.inputText,
        outputText: example.outputText,
        skillKey: example.skillKey ?? '',
        category: example.category,
      };
    }
    return {
      inputText: '',
      outputText: '',
      skillKey: '',
      category: undefined as unknown as KnowledgeCategory,
    };
  }, [isEdit, example]);

  const form = useZodForm<TrainingExampleFormValues>({
    schema: trainingExampleSchema,
    defaultValues,
  });

  // Reset form when dialog opens or example changes
  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [open, defaultValues, form]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) form.reset();
      onOpenChange(nextOpen);
    },
    [onOpenChange, form],
  );

  const onSubmit = useCallback(
    async (values: TrainingExampleFormValues) => {
      try {
        if (isEdit) {
          const data: Record<string, unknown> = {};
          if (values.inputText !== example.inputText) data.inputText = values.inputText;
          if (values.outputText !== example.outputText) data.outputText = values.outputText;
          if (values.category !== example.category) data.category = values.category;
          // Handle skillKey: send null to clear, new value to update
          const newSkillKey = values.skillKey || null;
          if (newSkillKey !== (example.skillKey ?? null)) data.skillKey = newSkillKey;

          if (Object.keys(data).length > 0) {
            await updateExample.mutateAsync({ id: example.id, data });
          }
        } else {
          await createExample.mutateAsync({
            inputText: values.inputText,
            outputText: values.outputText,
            category: values.category,
            ...(values.skillKey ? { skillKey: values.skillKey } : {}),
          });
        }
        handleOpenChange(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save training example');
      }
    },
    [isEdit, example, createExample, updateExample, handleOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="animate-step-in rounded-xl sm:max-w-lg max-md:top-0 max-md:left-0 max-md:translate-x-0 max-md:translate-y-0 max-md:max-w-full max-md:h-[100dvh] max-md:rounded-none max-md:overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {isEdit ? 'Edit Training Example' : 'Add Training Example'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the training example. Changes will affect how the AI responds to similar questions.'
              : 'Teach the AI how to respond to specific questions about your business.'}
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
                  className={cn('border-0 text-xs', SOURCE_LABELS[example.source].className)}
                >
                  {SOURCE_LABELS[example.source].label}
                </Badge>
              </div>
            )}

            {/* Input text */}
            <FormField
              control={form.control}
              name="inputText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>When user asks...</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="e.g. What are our payment terms for new customers?"
                      className="min-h-[100px] resize-y"
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Output text */}
            <FormField
              control={form.control}
              name="outputText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AI should respond...</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="e.g. Our standard payment terms for new customers are Net 30 days..."
                      className="min-h-[100px] resize-y"
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Skill key */}
            <FormField
              control={form.control}
              name="skillKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Skill Key</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g. finance.invoicing"
                      className="font-mono"
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>Optionally scope to a specific skill</FormDescription>
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
                    {isEdit ? 'Saving...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    {isEdit ? 'Save Changes' : 'Add Example'}
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
