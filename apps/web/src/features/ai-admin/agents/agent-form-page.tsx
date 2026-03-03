/* eslint-disable i18next/no-literal-string */
/**
 * Agent Add/Edit Form Page — T3-style detail form for AI agents.
 *
 * AC-2: Create and edit AI agents with model, prompt, tools, guardrails,
 * and trigger configuration. Business rules:
 *  - modelId can be null (auto-route by tags)
 *  - promptId is required
 *  - Cannot delete an agent referenced by automation steps
 *
 * Used for both `/ai/admin/agents/new` (create) and `/ai/admin/agents/:id` (edit).
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

import { TagInput } from '../shared/tag-input';
import type { AiAgentDetail } from '../api/types';
import {
  useAiAgent,
  useCreateAiAgent,
  useUpdateAiAgent,
  useDeleteAiAgent,
} from '../api/use-ai-agents';
import { useAiModels } from '../api/use-ai-models';
import { useAiPrompts } from '../api/use-ai-prompts';

// ─── Constants ───────────────────────────────────────────────────────────────

const ROUTING_TAG_OPTIONS = [
  'reasoning',
  'standard',
  'cheap',
  'fast',
  'vision',
  'structured_output',
  'briefing',
] as const;

const DATA_SCOPE_OPTIONS = [
  { value: 'own', label: 'Own data only' },
  { value: 'module', label: 'Module data' },
  { value: 'all', label: 'All data' },
] as const;

// ─── Client-side validation schema ───────────────────────────────────────────

const agentFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  displayName: z.string().min(1, 'Display name is required').max(255),
  description: z.string().max(2000).optional(),
  modelId: z.string().optional(), // empty string or undefined → null (auto-route)
  promptId: z.string().min(1, 'Prompt is required'),
  routingTags: z.array(z.string()),
  maxTurns: z.coerce.number().int().min(1, 'Min 1').max(50, 'Max 50'),
  isActive: z.boolean(),
  // JSON string fields — validated on submit
  tools: z.string(),
  triggerConfig: z.string(),
  // Guardrails — structured fields
  canRead: z.array(z.string()),
  canWrite: z.array(z.string()),
  requiresApproval: z.boolean(),
  maxAmountWithoutApproval: z.string().optional(),
  blockedOperations: z.array(z.string()),
  dataScope: z.enum(['own', 'module', 'all']),
});

type AgentFormValues = z.infer<typeof agentFormSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse a JSON string, returning null if invalid. Returns `emptyDefault` for empty/whitespace input. */
function tryParseJson(value: string, emptyDefault: unknown = []): unknown | null {
  if (!value.trim()) return emptyDefault;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Convert agent detail to form values */
function agentToFormValues(agent: AiAgentDetail): AgentFormValues {
  const g = agent.guardrails ?? {};
  return {
    name: agent.name,
    displayName: agent.displayName,
    description: agent.description ?? '',
    modelId: agent.modelId ?? '',
    promptId: agent.promptId,
    routingTags: agent.routingTags,
    maxTurns: agent.maxTurns,
    isActive: agent.isActive,
    tools: agent.tools ? JSON.stringify(agent.tools, null, 2) : '[]',
    triggerConfig: agent.triggerConfig ? JSON.stringify(agent.triggerConfig, null, 2) : '[]',
    canRead: g.canRead ?? [],
    canWrite: g.canWrite ?? [],
    requiresApproval: g.requiresApproval ?? false,
    maxAmountWithoutApproval: g.maxAmountWithoutApproval ?? '',
    blockedOperations: g.blockedOperations ?? [],
    dataScope: g.dataScope ?? 'own',
  };
}

const DEFAULT_FORM_VALUES: AgentFormValues = {
  name: '',
  displayName: '',
  description: '',
  modelId: '',
  promptId: '',
  routingTags: [],
  maxTurns: 10,
  isActive: true,
  tools: '[]',
  triggerConfig: '[]',
  canRead: [],
  canWrite: [],
  requiresApproval: false,
  maxAmountWithoutApproval: '',
  blockedOperations: [],
  dataScope: 'own',
};

// ─── Component ───────────────────────────────────────────────────────────────

export interface AgentFormPageProps {
  id?: string;
}

export function AgentFormPage({ id }: AgentFormPageProps) {
  const navigate = useNavigate();
  const isEditMode = !!id;

  // --- Data fetching ---
  const { data: agent, isLoading, isError } = useAiAgent(id);

  // Fetch active models for dropdown
  const { data: modelsData } = useAiModels({ isActive: true });
  const availableModels = useMemo(() => modelsData?.data ?? [], [modelsData?.data]);

  // Fetch active prompts for dropdown
  const { data: promptsData } = useAiPrompts({ isActive: true });
  const availablePrompts = useMemo(() => promptsData?.data ?? [], [promptsData?.data]);

  // --- Mutations ---
  const createMutation = useCreateAiAgent();
  const updateMutation = useUpdateAiAgent();
  const deleteMutation = useDeleteAiAgent();

  // --- Delete confirmation ---
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // --- Form setup ---
  const form = useZodForm<AgentFormValues>({
    schema: agentFormSchema,
    defaultValues: DEFAULT_FORM_VALUES,
    values: agent ? agentToFormValues(agent) : undefined,
  });

  const isDirty = form.formState.isDirty;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [
      { label: 'AI Administration', path: '/ai/admin' },
      { label: 'Agent Registry', path: '/ai/admin/agents' },
      { label: isEditMode ? (agent?.displayName ?? 'Edit Agent') : 'New Agent' },
    ],
    [isEditMode, agent?.displayName],
  );

  // --- Form submission (subtask 8.3) ---
  const onSubmit = useCallback(
    async (values: AgentFormValues) => {
      // Validate JSON fields
      const tools = tryParseJson(values.tools);
      if (tools === null) {
        form.setError('tools', { message: 'Invalid JSON syntax' });
        return;
      }

      const triggerConfig = tryParseJson(values.triggerConfig);
      if (triggerConfig === null) {
        form.setError('triggerConfig', { message: 'Invalid JSON syntax' });
        return;
      }

      // Build guardrails object
      const guardrails = {
        canRead: values.canRead,
        canWrite: values.canWrite,
        requiresApproval: values.requiresApproval,
        ...(values.requiresApproval && values.maxAmountWithoutApproval
          ? { maxAmountWithoutApproval: values.maxAmountWithoutApproval }
          : {}),
        blockedOperations: values.blockedOperations,
        dataScope: values.dataScope,
      };

      const payload = {
        name: values.name,
        displayName: values.displayName,
        description: values.description || undefined,
        modelId: values.modelId || null,
        promptId: values.promptId,
        routingTags: values.routingTags,
        maxTurns: values.maxTurns,
        isActive: values.isActive,
        tools,
        guardrails,
        triggerConfig,
      };

      try {
        if (isEditMode && id) {
          await updateMutation.mutateAsync({ id, data: payload });
          toast.success('Agent updated successfully');
        } else {
          const created = await createMutation.mutateAsync(payload);
          void navigate({ to: `/ai/admin/agents/${created.id}` as string });
        }
      } catch (error: unknown) {
        const err = error as {
          message?: string;
          statusCode?: number;
          fieldErrors?: Record<string, string>;
        };
        if (err.fieldErrors) {
          for (const [field, message] of Object.entries(err.fieldErrors)) {
            form.setError(field as keyof AgentFormValues, { message });
          }
        } else if (err.statusCode === 409) {
          form.setError('name', {
            message: err.message ?? 'An agent with this name already exists',
          });
        } else if (err.statusCode === 422) {
          toast.error(err.message ?? 'Validation error — check your form fields');
        } else if (err.statusCode === 404) {
          toast.error(err.message ?? 'Referenced prompt not found');
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
      void navigate({ to: '/ai/admin/agents' as string });
    } catch (error: unknown) {
      const err = error as { message?: string; statusCode?: number };
      if (err.statusCode === 422) {
        toast.error(
          err.message ?? 'Cannot delete this agent — it is referenced by automation steps',
        );
      } else {
        toast.error(err.message ?? 'Failed to delete agent');
      }
      setShowDeleteDialog(false);
    }
  }, [id, deleteMutation, navigate]);

  // --- Routing tag management ---
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

  // --- Watch requiresApproval for conditional rendering ---
  const requiresApproval = form.watch('requiresApproval');

  // --- Loading state ---
  if (isEditMode && isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Agent" breadcrumbs={breadcrumbs} isLoading />
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
  if (isEditMode && (isError || !agent)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Agent" breadcrumbs={breadcrumbs} />
        <Card className="mx-auto max-w-4xl rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load agent. It may have been deleted.
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
        onClick={() => void navigate({ to: '/ai/admin/agents' as string })}
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
        title={isEditMode ? (agent?.displayName ?? 'Edit Agent') : 'New Agent'}
        breadcrumbs={breadcrumbs}
        statusBadge={
          isEditMode && agent ? (
            <div className="flex items-center gap-2">
              {agent.isActive ? (
                <Badge className="bg-[#10b981] text-white hover:bg-[#059669]">Active</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Inactive
                </Badge>
              )}
              {agent.automationStepCount > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  {agent.automationStepCount} automation step
                  {agent.automationStepCount !== 1 ? 's' : ''}
                </Badge>
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
              <Tabs defaultValue="main">
                <TabsList>
                  <TabsTrigger value="main">Main</TabsTrigger>
                  <TabsTrigger value="tools">Tools</TabsTrigger>
                  <TabsTrigger value="guardrails">Guardrails</TabsTrigger>
                  <TabsTrigger value="triggers">Triggers</TabsTrigger>
                </TabsList>

                {/* ─── Main Tab (subtask 8.2) ──────────────────────── */}
                <TabsContent value="main" className="mt-6 space-y-6">
                  {/* Row 1: Name + Display Name */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="invoice-creator" className="font-mono" {...field} />
                          </FormControl>
                          <FormDescription>Unique identifier, e.g. invoice-creator</FormDescription>
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
                            <Input placeholder="Invoice Creator Agent" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Description */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe what this agent does..."
                            className="min-h-[80px]"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Row 2: Model + Prompt */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="modelId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <Select
                            value={field.value || '__auto__'}
                            onValueChange={(val) => field.onChange(val === '__auto__' ? '' : val)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Auto-route by tags" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__auto__">
                                Auto-route by tags (no specific model)
                              </SelectItem>
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="promptId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prompt</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a prompt" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availablePrompts.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  <span className="font-mono text-sm">{p.name}</span>
                                  <Badge
                                    variant="secondary"
                                    className="ml-2 bg-[#f5f3ff] text-[#7c3aed] text-[10px]"
                                  >
                                    {p.category}
                                  </Badge>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
                            className="relative ml-1 inline-flex size-5 items-center justify-center rounded-full hover:bg-[#7c3aed]/10 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] after:absolute after:-inset-3 after:content-['']"
                            aria-label={`Remove routing tag ${tag}`}
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

                  {/* Row 3: Max Turns + Active */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="maxTurns"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Turns</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={50}
                              placeholder="10"
                              className="font-mono"
                              {...field}
                              onChange={(e) => field.onChange(e.target.valueAsNumber || 10)}
                            />
                          </FormControl>
                          <FormDescription>Maximum conversation turns (1-50)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Active</FormLabel>
                            <FormDescription>Enable this agent for AI operations</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                {/* ─── Tools Tab (subtask 8.2) ─────────────────────── */}
                <TabsContent value="tools" className="mt-6 space-y-6">
                  <FormField
                    control={form.control}
                    name="tools"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tool Configuration</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='["query_entity", "create_invoice"]'
                            className="min-h-[200px] font-mono text-sm"
                            {...field}
                            onBlur={(e) => {
                              field.onBlur();
                              const parsed = tryParseJson(e.target.value);
                              if (parsed === null && e.target.value.trim()) {
                                form.setError('tools', { message: 'Invalid JSON syntax' });
                              } else {
                                form.clearErrors('tools');
                              }
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          JSON array of tool name strings, e.g. [&quot;query_entity&quot;,
                          &quot;create_invoice&quot;]
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* ─── Guardrails Tab (subtask 8.2) ────────────────── */}
                <TabsContent value="guardrails" className="mt-6 space-y-6">
                  {/* Can Read — blue pills */}
                  <FormField
                    control={form.control}
                    name="canRead"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Can Read</FormLabel>
                        <FormControl>
                          <TagInput
                            value={field.value}
                            onChange={(tags) =>
                              form.setValue('canRead', tags, { shouldDirty: true })
                            }
                            placeholder="Entity name, e.g. customers (press Enter)"
                            pillClassName="bg-[#eff6ff] text-[#2563eb] border border-[#2563eb]/20"
                            tagType="readable entity"
                          />
                        </FormControl>
                        <FormDescription>Entity types the agent can read</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Can Write — green pills */}
                  <FormField
                    control={form.control}
                    name="canWrite"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Can Write</FormLabel>
                        <FormControl>
                          <TagInput
                            value={field.value}
                            onChange={(tags) =>
                              form.setValue('canWrite', tags, { shouldDirty: true })
                            }
                            placeholder="Entity name, e.g. invoices (press Enter)"
                            pillClassName="bg-[#f0fdf4] text-[#16a34a] border border-[#16a34a]/20"
                            tagType="writable entity"
                          />
                        </FormControl>
                        <FormDescription>
                          Entity types the agent can create or modify
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Requires Approval + Max Amount */}
                  <FormField
                    control={form.control}
                    name="requiresApproval"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Require Approval</FormLabel>
                          <FormDescription>
                            Require user approval for write operations
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {requiresApproval && (
                    <FormField
                      control={form.control}
                      name="maxAmountWithoutApproval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Amount Without Approval</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="1000.00"
                              className="font-mono"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum transaction amount the agent can execute without approval
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Blocked Operations — red pills */}
                  <FormField
                    control={form.control}
                    name="blockedOperations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Blocked Operations</FormLabel>
                        <FormControl>
                          <TagInput
                            value={field.value}
                            onChange={(tags) =>
                              form.setValue('blockedOperations', tags, { shouldDirty: true })
                            }
                            placeholder="Operation name, e.g. delete (press Enter)"
                            pillClassName="bg-[#fef2f2] text-[#dc2626] border border-[#dc2626]/20"
                            tagType="blocked operation"
                          />
                        </FormControl>
                        <FormDescription>
                          Operations the agent is not allowed to perform
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Data Scope */}
                  <FormField
                    control={form.control}
                    name="dataScope"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Scope</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DATA_SCOPE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>Scope of data the agent can access</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* ─── Triggers Tab (subtask 8.2) ──────────────────── */}
                <TabsContent value="triggers" className="mt-6 space-y-6">
                  <FormField
                    control={form.control}
                    name="triggerConfig"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trigger Configuration</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='[{"type": "chat_intent", "config": {}}]'
                            className="min-h-[200px] font-mono text-sm"
                            {...field}
                            onBlur={(e) => {
                              field.onBlur();
                              const parsed = tryParseJson(e.target.value);
                              if (parsed === null && e.target.value.trim()) {
                                form.setError('triggerConfig', { message: 'Invalid JSON syntax' });
                              } else {
                                form.clearErrors('triggerConfig');
                              }
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          JSON array of AgentTrigger objects. Types: chat_intent, ui_button,
                          schedule, event, api
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

      {/* Delete confirmation dialog (subtask 8.1) */}
      {isEditMode && (
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="animate-step-in sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-serif">Delete Agent</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this agent? This action cannot be undone.
              </DialogDescription>
              {agent && (
                <p className="mt-2 rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
                  {agent.name}
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
