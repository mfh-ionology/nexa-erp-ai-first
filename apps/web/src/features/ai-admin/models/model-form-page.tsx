/* eslint-disable i18next/no-literal-string */
/**
 * Model Add/Edit Form Page — T3-style detail form for AI models.
 *
 * AC-3: Create and edit AI models with full validation. Business rules:
 *  - Setting isDefault=true automatically unsets the previous default
 *  - Cannot deactivate a model that isDefault=true
 *  - Cannot delete a model referenced by any AiAgent
 *  - Fallback model dropdown must not allow circular chains
 *
 * Used for both `/ai/admin/models/new` (create) and `/ai/admin/models/:id` (edit).
 */

import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { Loader2, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

import type { AiModelDetail } from '../api/types';
import {
  useAiModel,
  useAiModels,
  useCreateAiModel,
  useUpdateAiModel,
  useDeleteAiModel,
} from '../api/use-ai-models';

// ─── Constants ───────────────────────────────────────────────────────────────

const PROVIDERS = ['anthropic', 'openai', 'deepseek', 'google'] as const;

const ROUTING_TAG_OPTIONS = [
  'reasoning',
  'standard',
  'cheap',
  'fast',
  'vision',
  'structured_output',
  'briefing',
] as const;

// ─── Client-side validation schema ───────────────────────────────────────────

const modelFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  displayName: z.string().min(1, 'Display name is required').max(255),
  provider: z.string().min(1, 'Provider is required').max(100),
  modelId: z.string().min(1, 'Model ID is required').max(255),
  maxInputTokens: z.coerce.number().int().positive('Must be a positive integer'),
  maxOutputTokens: z.coerce.number().int().positive('Must be a positive integer'),
  costPerMInput: z
    .string()
    .min(1, 'Cost is required')
    .regex(/^\d+(\.\d{1,4})?$/, 'Must be a decimal with up to 4 decimal places'),
  costPerMOutput: z
    .string()
    .min(1, 'Cost is required')
    .regex(/^\d+(\.\d{1,4})?$/, 'Must be a decimal with up to 4 decimal places'),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  routingTags: z.array(z.string()),
  capabilities: z.string(), // JSON string, validated on submit
  fallbackModelId: z.string().optional(),
  config: z.string(), // JSON string, validated on submit
});

type ModelFormValues = z.infer<typeof modelFormSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse a JSON string, returning null if invalid */
function tryParseJson(value: string): unknown | null {
  if (!value.trim()) return {};
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Convert model detail to form values */
function modelToFormValues(model: AiModelDetail): ModelFormValues {
  return {
    name: model.name,
    displayName: model.displayName,
    provider: model.provider,
    modelId: model.modelId,
    maxInputTokens: model.maxInputTokens,
    maxOutputTokens: model.maxOutputTokens,
    costPerMInput: model.costPerMInput,
    costPerMOutput: model.costPerMOutput,
    isActive: model.isActive,
    isDefault: model.isDefault,
    routingTags: model.routingTags,
    capabilities: model.capabilities ? JSON.stringify(model.capabilities, null, 2) : '{}',
    fallbackModelId: model.fallbackModelId ?? '',
    config: model.config ? JSON.stringify(model.config, null, 2) : '',
  };
}

const DEFAULT_FORM_VALUES: ModelFormValues = {
  name: '',
  displayName: '',
  provider: '',
  modelId: '',
  maxInputTokens: 0,
  maxOutputTokens: 0,
  costPerMInput: '',
  costPerMOutput: '',
  isActive: true,
  isDefault: false,
  routingTags: [],
  capabilities: '{}',
  fallbackModelId: '',
  config: '',
};

// ─── Component ───────────────────────────────────────────────────────────────

export interface ModelFormPageProps {
  id?: string;
}

export function ModelFormPage({ id }: ModelFormPageProps) {
  const navigate = useNavigate();
  const isEditMode = !!id;

  // --- Data fetching ---
  const { data: model, isLoading, isError } = useAiModel(id);

  // Fetch active models for fallback dropdown (exclude current model)
  const { data: modelsData } = useAiModels({ isActive: true });
  const availableModels = useMemo(
    () => (modelsData?.data ?? []).filter((m) => m.id !== id),
    [modelsData?.data, id],
  );

  // --- Mutations ---
  const createMutation = useCreateAiModel();
  const updateMutation = useUpdateAiModel();
  const deleteMutation = useDeleteAiModel();

  // --- Delete confirmation ---
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // --- Custom provider input ---
  const [useCustomProvider, setUseCustomProvider] = useState(false);

  // --- Form setup ---
  const form = useZodForm<ModelFormValues>({
    schema: modelFormSchema,
    defaultValues: DEFAULT_FORM_VALUES,
    values: model ? modelToFormValues(model) : undefined,
  });

  const isDirty = form.formState.isDirty;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Detect if current provider is custom (not in predefined list)
  const currentProvider = form.watch('provider');
  const isCustomProvider =
    useCustomProvider ||
    (!!currentProvider && !PROVIDERS.includes(currentProvider as (typeof PROVIDERS)[number]));

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [
      { label: 'AI Administration', path: '/ai/admin' },
      { label: 'Model Registry', path: '/ai/admin/models' },
      { label: isEditMode ? (model?.displayName ?? 'Edit Model') : 'New Model' },
    ],
    [isEditMode, model?.displayName],
  );

  // --- Form submission (subtask 9.3) ---
  const onSubmit = useCallback(
    async (values: ModelFormValues) => {
      // Validate JSON fields
      const capabilities = tryParseJson(values.capabilities);
      if (capabilities === null) {
        form.setError('capabilities', { message: 'Invalid JSON syntax' });
        return;
      }

      const config = values.config.trim() ? tryParseJson(values.config) : undefined;
      if (values.config.trim() && config === null) {
        form.setError('config', { message: 'Invalid JSON syntax' });
        return;
      }

      const payload = {
        name: values.name,
        provider: values.provider,
        modelId: values.modelId,
        displayName: values.displayName,
        maxInputTokens: values.maxInputTokens,
        maxOutputTokens: values.maxOutputTokens,
        costPerMInput: values.costPerMInput,
        costPerMOutput: values.costPerMOutput,
        capabilities: capabilities as Record<string, unknown>,
        isActive: values.isActive,
        isDefault: values.isDefault,
        routingTags: values.routingTags,
        fallbackModelId: values.fallbackModelId || undefined,
        config: config as Record<string, unknown> | undefined,
      };

      try {
        if (isEditMode && id) {
          await updateMutation.mutateAsync({ id, data: payload });
        } else {
          const created = await createMutation.mutateAsync(payload);
          toast.success('Model created successfully');
          void navigate({ to: `/ai/admin/models/${created.id}` as string });
        }
      } catch (error: unknown) {
        const err = error as { message?: string; statusCode?: number };
        if (err.statusCode === 422) {
          toast.error(err.message ?? 'Validation error');
        } else {
          toast.error(err.message ?? 'An unexpected error occurred');
        }
      }
    },
    [isEditMode, id, form, createMutation, updateMutation, navigate],
  );

  // --- Delete handler ---
  const handleDelete = useCallback(async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      setShowDeleteDialog(false);
      void navigate({ to: '/ai/admin/models' as string });
    } catch (error: unknown) {
      const err = error as { message?: string; statusCode?: number };
      if (err.statusCode === 422) {
        toast.error(err.message ?? 'Cannot delete this model');
      } else {
        toast.error(err.message ?? 'Failed to delete model');
      }
      setShowDeleteDialog(false);
    }
  }, [id, deleteMutation, navigate]);

  // --- Tag management ---
  const currentTags = form.watch('routingTags');

  const addTag = useCallback(
    (tag: string) => {
      const tags = form.getValues('routingTags');
      if (!tags.includes(tag)) {
        form.setValue('routingTags', [...tags, tag], { shouldDirty: true });
      }
    },
    [form],
  );

  const removeTag = useCallback(
    (tag: string) => {
      const tags = form.getValues('routingTags');
      form.setValue(
        'routingTags',
        tags.filter((t) => t !== tag),
        { shouldDirty: true },
      );
    },
    [form],
  );

  // --- Loading state ---
  if (isEditMode && isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Model" breadcrumbs={breadcrumbs} isLoading />
        <Card className="mx-auto max-w-4xl rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-1/2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Error state ---
  if (isEditMode && (isError || !model)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Model" breadcrumbs={breadcrumbs} />
        <Card className="mx-auto max-w-4xl rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load model. It may have been deleted.
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Action bar ---
  const actionBarSlot = (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void navigate({ to: '/ai/admin/models' as string })}
      >
        Cancel
      </Button>

      {isEditMode && (
        <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
          <Trash2 className="size-4" />
          Delete
        </Button>
      )}

      <Button onClick={form.handleSubmit(onSubmit)} disabled={!isDirty || isSubmitting} size="sm">
        {isSubmitting ? <Loader2 className="animate-spin" /> : <Save className="size-4" />}
        Save
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditMode ? (model?.displayName ?? 'Edit Model') : 'New Model'}
        breadcrumbs={breadcrumbs}
        statusBadge={
          isEditMode && model ? (
            <div className="flex items-center gap-2">
              {model.isActive ? (
                <Badge className="bg-[#10b981] text-white hover:bg-[#059669]">Active</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Inactive
                </Badge>
              )}
              {model.isDefault && (
                <Badge className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">Default</Badge>
              )}
            </div>
          ) : undefined
        }
        actionBarSlot={actionBarSlot}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <Card className="mx-auto max-w-4xl rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]">
            <CardContent className="pt-6">
              <Tabs defaultValue="primary">
                <TabsList>
                  <TabsTrigger value="primary">Primary</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>

                {/* ─── Primary Tab (subtask 9.2) ──────────────────── */}
                <TabsContent value="primary" className="mt-6 space-y-6">
                  {/* Row 1: Name + Display Name */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="claude-opus-4-6" className="font-mono" {...field} />
                          </FormControl>
                          <FormDescription>Unique identifier, e.g. claude-opus-4-6</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Claude Opus 4.6" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Row 2: Provider + Model ID */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="provider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Provider</FormLabel>
                          {isCustomProvider ? (
                            <div className="flex gap-2">
                              <FormControl>
                                <Input placeholder="Custom provider name" {...field} />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setUseCustomProvider(false);
                                  field.onChange('');
                                }}
                                aria-label="Switch to preset providers"
                              >
                                <X className="size-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select provider" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {PROVIDERS.map((p) => (
                                    <SelectItem key={p} value={p}>
                                      {p.charAt(0).toUpperCase() + p.slice(1)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setUseCustomProvider(true)}
                                className="shrink-0 text-xs"
                              >
                                Custom
                              </Button>
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="modelId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model ID</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="claude-opus-4-6-20250514"
                              className="font-mono"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>API model identifier</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Row 3: Max Tokens */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="maxInputTokens"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Input Tokens</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="200000"
                              className="font-mono"
                              {...field}
                              onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="maxOutputTokens"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Output Tokens</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="32000"
                              className="font-mono"
                              {...field}
                              onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Row 4: Costs */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="costPerMInput"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost per Million Input Tokens ($)</FormLabel>
                          <FormControl>
                            <Input placeholder="15.00" className="font-mono" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="costPerMOutput"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost per Million Output Tokens ($)</FormLabel>
                          <FormControl>
                            <Input placeholder="75.00" className="font-mono" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Row 5: Toggles */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Active</FormLabel>
                            <FormDescription>Enable this model for AI operations</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isDefault"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Default Model</FormLabel>
                            <FormDescription>
                              Setting as default will unset the current default model
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                {/* ─── Advanced Tab (subtask 9.2) ─────────────────── */}
                <TabsContent value="advanced" className="mt-6 space-y-6">
                  {/* Routing Tags */}
                  <div className="space-y-3">
                    <FormLabel>Routing Tags</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {currentTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="bg-[#f5f3ff] text-[#7c3aed] border border-[#7c3aed]/20 gap-1 pr-1"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="relative ml-1 inline-flex size-5 items-center justify-center rounded-full hover:bg-[#7c3aed]/10 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] after:absolute after:-inset-2 after:content-['']"
                            aria-label={`Remove tag ${tag}`}
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ROUTING_TAG_OPTIONS.filter((t) => !currentTags.includes(t)).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => addTag(tag)}
                          className="rounded-lg border border-dashed border-muted-foreground/30 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-[#7c3aed]/40 hover:bg-[#f5f3ff] hover:text-[#7c3aed] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                    <FormDescription>
                      Tags used for intent-based model routing (e.g. reasoning, fast, vision)
                    </FormDescription>
                  </div>

                  {/* Capabilities JSON */}
                  <FormField
                    control={form.control}
                    name="capabilities"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capabilities</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='{"vision": true, "function_calling": true}'
                            className="min-h-[120px] font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Model capabilities as a JSON object</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Fallback Model */}
                  <FormField
                    control={form.control}
                    name="fallbackModelId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fallback Model</FormLabel>
                        <Select
                          value={field.value || ''}
                          onValueChange={(val) => field.onChange(val === '__none__' ? '' : val)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="No fallback model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">No fallback model</SelectItem>
                            {availableModels.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                <span className="font-medium">{m.displayName}</span>
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({m.provider})
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Model to fall back to if this model is unavailable
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Config JSON */}
                  <FormField
                    control={form.control}
                    name="config"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Config</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='{"temperature": 0.7, "topP": 0.95}'
                            className="min-h-[120px] font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Provider-specific configuration (temperature, topP, maxRetries, timeout)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Screen reader error announcements */}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {Object.values(form.formState.errors)
              .map((e) => e?.message)
              .filter(Boolean)
              .join('. ')}
          </div>
        </form>
      </Form>

      {/* Delete confirmation dialog (subtask 9.1) */}
      {isEditMode && (
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="animate-step-in sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-serif">Delete Model</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this model? This action cannot be undone.
              </DialogDescription>
              {model && (
                <p className="mt-2 rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
                  {model.name}
                </p>
              )}
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setShowDeleteDialog(false)}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="rounded-lg"
              >
                {deleteMutation.isPending && <Loader2 className="animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
