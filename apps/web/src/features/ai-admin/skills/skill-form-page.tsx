/* eslint-disable i18next/no-literal-string */
/**
 * Skill Add/Edit Form Page — T2-style detail form for AI skills.
 *
 * AC-4: Create and edit AI skills with tabs for Main, Triggers, Content, Schema.
 * Business rules:
 *  - name must be unique, kebab-case
 *  - at least 1 trigger phrase required
 *  - priority 1-1000 (default 100)
 *  - orchestrationPattern can be null
 *  - version is read-only
 *
 * Used for both `/ai/admin/skills/new` (create) and `/ai/admin/skills/:id` (edit).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { Loader2, Save, ShieldOff } from 'lucide-react';
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
import type {
  AiSkillDetail,
  SkillCategory,
  SkillOutputType,
  OrchestrationPattern,
} from '../api/types';
import { useAiSkill, useCreateAiSkill, useUpdateAiSkill } from '../api/use-ai-skills';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: SkillCategory; label: string }[] = [
  { value: 'document', label: 'Document' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'communication', label: 'Communication' },
  { value: 'financial', label: 'Financial' },
];

const OUTPUT_TYPE_OPTIONS: { value: SkillOutputType; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'email', label: 'Email' },
];

const ORCHESTRATION_PATTERN_OPTIONS: { value: OrchestrationPattern | '__none__'; label: string }[] =
  [
    { value: '__none__', label: 'None' },
    { value: 'SEQUENTIAL', label: 'Sequential' },
    { value: 'PARALLEL', label: 'Parallel' },
    { value: 'ITERATIVE', label: 'Iterative' },
    { value: 'CONTEXT_AWARE', label: 'Context Aware' },
    { value: 'DOMAIN_INTELLIGENCE', label: 'Domain Intelligence' },
  ];

const MODULE_KEY_OPTIONS = [
  'ar',
  'ap',
  'finance',
  'sales',
  'purchasing',
  'inventory',
  'crm',
  'hr',
  'manufacturing',
  'reporting',
  'views',
  'system',
] as const;

// ─── Client-side validation schema ───────────────────────────────────────────

const skillFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  displayName: z.string().min(1, 'Display name is required').max(255),
  description: z.string().max(2000).optional(),
  category: z.enum(['document', 'analysis', 'communication', 'financial'], {
    message: 'Category is required',
  }),
  moduleKey: z.string().max(100).optional(),
  packKey: z.string().max(100).optional(),
  outputType: z.enum(['pdf', 'json', 'markdown', 'email'], {
    message: 'Output type is required',
  }),
  orchestrationPattern: z.string().optional(), // '__none__' or pattern value
  priority: z.coerce.number().int().min(1, 'Min 1').max(1000, 'Max 1000'),
  isActive: z.boolean(),
  // Triggers tab
  triggerPhrases: z.array(z.string()).min(1, 'At least one trigger phrase is required'),
  negativeTriggers: z.array(z.string()),
  contextRequired: z.array(z.string()),
  // Content tab
  skillContent: z.string().min(1, 'Skill content is required'),
  // Schema tab — JSON string fields validated on submit
  inputSchema: z.string(),
  parameters: z.string(),
  requiredTools: z.array(z.string()),
  examples: z.string(),
});

type SkillFormValues = z.infer<typeof skillFormSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse a JSON string, returning null if invalid. Returns `emptyDefault` for empty/whitespace input. */
function tryParseJson(value: string, emptyDefault: unknown = {}): unknown | null {
  if (!value.trim()) return emptyDefault;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Convert skill detail to form values */
function skillToFormValues(skill: AiSkillDetail): SkillFormValues {
  return {
    name: skill.name,
    displayName: skill.displayName,
    description: skill.description ?? '',
    category: (skill.category as SkillCategory) || 'document',
    moduleKey: skill.moduleKey ?? '',
    packKey: skill.packKey ?? '',
    outputType: (skill.outputType as SkillOutputType) || 'json',
    orchestrationPattern: skill.orchestrationPattern ?? '__none__',
    priority: skill.priority,
    isActive: skill.isActive,
    triggerPhrases: skill.triggerPhrases,
    negativeTriggers: skill.negativeTriggers,
    contextRequired: skill.contextRequired,
    skillContent: skill.skillContent ?? '',
    inputSchema: skill.inputSchema ? JSON.stringify(skill.inputSchema, null, 2) : '{}',
    parameters: skill.parameters ? JSON.stringify(skill.parameters, null, 2) : '{}',
    requiredTools: skill.requiredTools ?? [],
    examples: skill.examples ? JSON.stringify(skill.examples, null, 2) : '[]',
  };
}

const DEFAULT_FORM_VALUES: SkillFormValues = {
  name: '',
  displayName: '',
  description: '',
  category: 'document',
  moduleKey: '',
  packKey: '',
  outputType: 'json',
  orchestrationPattern: '__none__',
  priority: 100,
  isActive: true,
  triggerPhrases: [],
  negativeTriggers: [],
  contextRequired: [],
  skillContent: '',
  inputSchema: '{}',
  parameters: '{}',
  requiredTools: [],
  examples: '[]',
};

// ─── Module Key Combobox ─────────────────────────────────────────────────────

function ModuleKeyCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [input, setInput] = useState(value);
  const [isOpen, setIsOpen] = useState(false);

  // Sync internal state when external value changes (e.g. form reset, edit mode load)
  useEffect(() => {
    setInput(value);
  }, [value]);

  const filteredOptions = MODULE_KEY_OPTIONS.filter((opt) =>
    opt.toLowerCase().includes(input.toLowerCase()),
  );

  return (
    <div className="relative">
      <Input
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          // Delay to allow click on dropdown
          setTimeout(() => setIsOpen(false), 200);
        }}
        placeholder="Select or type a module key"
        className="text-sm"
      />
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-lg border bg-popover p-1 shadow-md">
          {filteredOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              className="w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-[#f5f3ff] hover:text-[#7c3aed] focus:outline-none"
              onMouseDown={(e) => {
                e.preventDefault();
                setInput(opt);
                onChange(opt);
                setIsOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface SkillFormPageProps {
  id?: string;
}

export function SkillFormPage({ id }: SkillFormPageProps) {
  const navigate = useNavigate();
  const isEditMode = !!id;

  // --- Data fetching ---
  const { data: skill, isLoading, isError } = useAiSkill(id);

  // --- Mutations ---
  const createMutation = useCreateAiSkill();
  const updateMutation = useUpdateAiSkill();

  // --- Deactivate confirmation ---
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  // --- Form setup ---
  const form = useZodForm<SkillFormValues>({
    schema: skillFormSchema,
    defaultValues: DEFAULT_FORM_VALUES,
    values: skill ? skillToFormValues(skill) : undefined,
  });

  const isDirty = form.formState.isDirty;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [
      { label: 'AI Administration', path: '/ai/admin' },
      { label: 'Skill Packs', path: '/ai/admin/skills' },
      { label: isEditMode ? (skill?.displayName ?? 'Edit Skill') : 'New Skill' },
    ],
    [isEditMode, skill?.displayName],
  );

  // --- Skill content character count ---
  const skillContent = form.watch('skillContent');
  const charCount = skillContent?.length ?? 0;

  // --- Form submission (subtask 10.3) ---
  const onSubmit = useCallback(
    async (values: SkillFormValues) => {
      // Validate JSON fields
      const inputSchema = tryParseJson(values.inputSchema);
      if (inputSchema === null) {
        form.setError('inputSchema', { message: 'Invalid JSON syntax' });
        return;
      }

      const parameters = tryParseJson(values.parameters);
      if (parameters === null) {
        form.setError('parameters', { message: 'Invalid JSON syntax' });
        return;
      }

      const examples = tryParseJson(values.examples, []);
      if (examples === null) {
        form.setError('examples', { message: 'Invalid JSON syntax' });
        return;
      }

      const payload = {
        name: values.name,
        displayName: values.displayName,
        description: values.description || undefined,
        category: values.category,
        moduleKey: values.moduleKey || undefined,
        packKey: values.packKey || undefined,
        outputType: values.outputType,
        orchestrationPattern:
          values.orchestrationPattern === '__none__'
            ? null
            : (values.orchestrationPattern as OrchestrationPattern),
        priority: values.priority,
        isActive: values.isActive,
        triggerPhrases: values.triggerPhrases,
        negativeTriggers: values.negativeTriggers,
        contextRequired: values.contextRequired,
        skillContent: values.skillContent,
        inputSchema,
        parameters,
        examples,
        requiredTools: values.requiredTools,
      };

      try {
        if (isEditMode && id) {
          await updateMutation.mutateAsync({ id, data: payload });
          toast.success('Skill updated successfully');
        } else {
          const created = await createMutation.mutateAsync(payload);
          void navigate({ to: `/ai/admin/skills/${created.id}` as string });
        }
      } catch (error: unknown) {
        const err = error as {
          message?: string;
          statusCode?: number;
          fieldErrors?: Record<string, string>;
        };
        if (err.fieldErrors) {
          for (const [field, message] of Object.entries(err.fieldErrors)) {
            form.setError(field as keyof SkillFormValues, { message });
          }
        } else if (err.statusCode === 409) {
          form.setError('name', {
            message: err.message ?? 'A skill with this name already exists',
          });
        } else if (err.statusCode === 422) {
          toast.error(err.message ?? 'Validation error — check your form fields');
        } else {
          toast.error(err.message ?? 'An unexpected error occurred');
        }
      }
    },
    [isEditMode, id, form, createMutation, updateMutation, navigate],
  );

  // --- Deactivate handler ---
  const handleDeactivate = useCallback(async () => {
    if (!id) return;
    try {
      await updateMutation.mutateAsync({ id, data: { isActive: false } });
      toast.success(`Skill ${skill?.displayName ?? ''} deactivated`);
      setShowDeactivateDialog(false);
      void navigate({ to: '/ai/admin/skills' as string });
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message ?? 'Failed to deactivate skill');
      setShowDeactivateDialog(false);
    }
  }, [id, skill?.displayName, updateMutation, navigate]);

  // --- Loading state ---
  if (isEditMode && isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Skill" breadcrumbs={breadcrumbs} isLoading />
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
  if (isEditMode && (isError || !skill)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Skill" breadcrumbs={breadcrumbs} />
        <Card className="mx-auto max-w-4xl rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load skill. It may have been deleted.
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
        onClick={() => void navigate({ to: '/ai/admin/skills' as string })}
      >
        Cancel
      </Button>

      {isEditMode && (
        <Button variant="destructive" size="sm" onClick={() => setShowDeactivateDialog(true)}>
          <ShieldOff className="size-4" />
          Deactivate
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
        title={isEditMode ? (skill?.displayName ?? 'Edit Skill') : 'New Skill'}
        breadcrumbs={breadcrumbs}
        statusBadge={
          isEditMode && skill ? (
            <div className="flex items-center gap-2">
              {skill.isActive ? (
                <Badge className="bg-[#10b981] text-white hover:bg-[#059669]">Active</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Inactive
                </Badge>
              )}
              <Badge variant="outline" className="font-mono text-muted-foreground">
                v{skill.version}
              </Badge>
              {skill.contextCount > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  {skill.contextCount} context{skill.contextCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {skill.overrideCount > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  {skill.overrideCount} override{skill.overrideCount !== 1 ? 's' : ''}
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
                  <TabsTrigger value="triggers">Triggers</TabsTrigger>
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="schema">Schema</TabsTrigger>
                </TabsList>

                {/* ─── Main Tab ──────────────────────────────────── */}
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
                            <Input
                              placeholder="generate-invoice-pdf"
                              className="font-mono"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Unique identifier (kebab-case), e.g. generate-invoice-pdf
                          </FormDescription>
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
                            <Input placeholder="Generate Invoice PDF" {...field} />
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
                            placeholder="Describe what this skill does..."
                            className="min-h-[80px]"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Row 2: Category + Module Key */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
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

                    <FormField
                      control={form.control}
                      name="moduleKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Module Key</FormLabel>
                          <FormControl>
                            <ModuleKeyCombobox
                              value={field.value ?? ''}
                              onChange={(val) =>
                                form.setValue('moduleKey', val, { shouldDirty: true })
                              }
                            />
                          </FormControl>
                          <FormDescription>
                            Module this skill belongs to, or type a custom key
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Row 3: Pack Key + Output Type */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="packKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pack Key</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. finance-basics" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="outputType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Output Type</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select output type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {OUTPUT_TYPE_OPTIONS.map((opt) => (
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
                  </div>

                  {/* Row 4: Orchestration Pattern + Priority */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="orchestrationPattern"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Orchestration Pattern</FormLabel>
                          <Select value={field.value || '__none__'} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="None" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ORCHESTRATION_PATTERN_OPTIONS.map((opt) => (
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

                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={1000}
                              placeholder="100"
                              className="font-mono"
                              {...field}
                              onChange={(e) => field.onChange(e.target.valueAsNumber || 100)}
                            />
                          </FormControl>
                          <FormDescription>1-1000 (higher = more important)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Row 5: Version (read-only) + Active */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {isEditMode && skill && (
                      <div className="space-y-2">
                        <FormLabel>Version</FormLabel>
                        <div className="flex h-10 items-center rounded-md border bg-muted/50 px-3 font-mono text-sm text-muted-foreground">
                          v{skill.version}
                        </div>
                        <p className="text-[0.8rem] text-muted-foreground">
                          Auto-incremented on each update
                        </p>
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Active</FormLabel>
                            <FormDescription>Enable this skill for AI operations</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                {/* ─── Triggers Tab ──────────────────────────────── */}
                <TabsContent value="triggers" className="mt-6 space-y-6">
                  {/* Trigger Phrases — blue pills */}
                  <FormField
                    control={form.control}
                    name="triggerPhrases"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trigger Phrases</FormLabel>
                        <FormControl>
                          <TagInput
                            value={field.value}
                            onChange={(tags) =>
                              form.setValue('triggerPhrases', tags, { shouldDirty: true })
                            }
                            placeholder="Type a phrase and press Enter"
                            pillClassName="bg-blue-50 text-blue-700 border border-blue-200"
                            tagType="trigger phrase"
                            preserveCase
                          />
                        </FormControl>
                        <FormDescription>
                          At least 1 required. Phrases that trigger this skill
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Negative Triggers — red pills */}
                  <FormField
                    control={form.control}
                    name="negativeTriggers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Negative Triggers</FormLabel>
                        <FormControl>
                          <TagInput
                            value={field.value}
                            onChange={(tags) =>
                              form.setValue('negativeTriggers', tags, { shouldDirty: true })
                            }
                            placeholder="Type a phrase and press Enter"
                            pillClassName="bg-red-50 text-red-700 border border-red-200"
                            tagType="negative trigger"
                            preserveCase
                          />
                        </FormControl>
                        <FormDescription>
                          Phrases that should NOT trigger this skill
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Context Required — grey pills */}
                  <FormField
                    control={form.control}
                    name="contextRequired"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Context Required</FormLabel>
                        <FormControl>
                          <TagInput
                            value={field.value}
                            onChange={(tags) =>
                              form.setValue('contextRequired', tags, { shouldDirty: true })
                            }
                            placeholder="e.g., screen:entity-list, module:ar (press Enter)"
                            pillClassName="bg-muted text-muted-foreground border border-muted-foreground/20"
                            tagType="context"
                            preserveCase
                          />
                        </FormControl>
                        <FormDescription>
                          Context fields required for this skill to activate
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* ─── Content Tab ───────────────────────────────── */}
                <TabsContent value="content" className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Skill Instructions</h3>
                    <span className="text-xs text-muted-foreground">
                      {charCount.toLocaleString()} characters
                    </span>
                  </div>

                  <FormField
                    control={form.control}
                    name="skillContent"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Enter the full SKILL.md instruction content..."
                            className="min-h-[400px] resize-y font-mono text-sm leading-relaxed"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Full SKILL.md instruction content. Loaded at L2 routing level
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* ─── Schema Tab ────────────────────────────────── */}
                <TabsContent value="schema" className="mt-6 space-y-6">
                  {/* Input Schema */}
                  <FormField
                    control={form.control}
                    name="inputSchema"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Input Schema</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='{"type": "object", "properties": {}}'
                            className="min-h-[150px] font-mono text-sm"
                            {...field}
                            onBlur={(e) => {
                              field.onBlur();
                              const parsed = tryParseJson(e.target.value);
                              if (parsed === null && e.target.value.trim()) {
                                form.setError('inputSchema', {
                                  message: 'Invalid JSON syntax',
                                });
                              } else {
                                form.clearErrors('inputSchema');
                              }
                            }}
                          />
                        </FormControl>
                        <FormDescription>JSON schema defining expected inputs</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Parameters */}
                  <FormField
                    control={form.control}
                    name="parameters"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parameters</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='{"temperature": 0.7}'
                            className="min-h-[150px] font-mono text-sm"
                            {...field}
                            onBlur={(e) => {
                              field.onBlur();
                              const parsed = tryParseJson(e.target.value);
                              if (parsed === null && e.target.value.trim()) {
                                form.setError('parameters', {
                                  message: 'Invalid JSON syntax',
                                });
                              } else {
                                form.clearErrors('parameters');
                              }
                            }}
                          />
                        </FormControl>
                        <FormDescription>Additional parameters as JSON</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Required Tools — purple tag input */}
                  <FormField
                    control={form.control}
                    name="requiredTools"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Required Tools</FormLabel>
                        <FormControl>
                          <TagInput
                            value={field.value}
                            onChange={(tags) =>
                              form.setValue('requiredTools', tags, { shouldDirty: true })
                            }
                            placeholder="Tool name, e.g. query_entity (press Enter)"
                            pillClassName="bg-[#f5f3ff] text-[#7c3aed] border border-[#7c3aed]/20"
                            tagType="tool"
                          />
                        </FormControl>
                        <FormDescription>Tool names required to execute this skill</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Examples */}
                  <FormField
                    control={form.control}
                    name="examples"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Examples</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='[{"input": "...", "output": "..."}]'
                            className="min-h-[150px] font-mono text-sm"
                            {...field}
                            onBlur={(e) => {
                              field.onBlur();
                              const parsed = tryParseJson(e.target.value);
                              if (parsed === null && e.target.value.trim()) {
                                form.setError('examples', {
                                  message: 'Invalid JSON syntax',
                                });
                              } else {
                                form.clearErrors('examples');
                              }
                            }}
                          />
                        </FormControl>
                        <FormDescription>JSON array of usage examples</FormDescription>
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

      {/* Deactivate confirmation dialog */}
      {isEditMode && (
        <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
          <DialogContent className="animate-step-in sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-serif">Deactivate Skill</DialogTitle>
              <DialogDescription>
                Are you sure you want to deactivate this skill? It will no longer be available for
                AI operations.
              </DialogDescription>
              {skill && (
                <p className="mt-2 rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
                  {skill.name}
                </p>
              )}
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setShowDeactivateDialog(false)}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeactivate}
                disabled={updateMutation.isPending}
                className="rounded-lg"
              >
                {updateMutation.isPending && <Loader2 className="animate-spin" />}
                Deactivate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
