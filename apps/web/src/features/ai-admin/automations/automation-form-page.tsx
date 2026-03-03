/* eslint-disable i18next/no-literal-string */
/**
 * Automation Form/Builder Page — T2-style detail form for AI automations.
 *
 * AC-2: Create and edit automations with trigger config, step builder,
 * chain config, notifications, and budget settings.
 * AC-3/4: Step builder with dnd-kit drag-reorder and agent selection.
 * AC-5: Step input/output JSON configuration panels.
 * AC-7: Chain configuration with cycle detection (backend 422).
 * AC-8: Notification configuration.
 * AC-9: "Run Now" from the builder page.
 *
 * Used for both `/ai/admin/automations/new` (create) and
 * `/ai/admin/automations/:id` (edit).
 */

import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Loader2,
  Play,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
import { PageHeader } from '@/components/templates/page-header';

import type {
  AiAutomationDetail,
  AutomationTriggerType,
  CreateAutomationRequest,
  UpdateAutomationRequest,
} from '../api/types';
import {
  useAiAutomation,
  useAiAutomations,
  useCreateAiAutomation,
  useUpdateAiAutomation,
  useDeleteAiAutomation,
  useRunAutomation,
} from '../api/use-ai-automations';
import { useAiAgents } from '../api/use-ai-agents';
import { CronBuilder } from './components/cron-builder';
import { VariableAutocompleteTextarea } from './components/variable-autocomplete-textarea';

// ─── Constants ───────────────────────────────────────────────────────────────

const TRIGGER_TYPE_OPTIONS: { value: AutomationTriggerType; label: string; description: string }[] =
  [
    { value: 'SCHEDULED', label: 'Scheduled', description: 'Run on a cron schedule' },
    { value: 'EVENT', label: 'Event', description: 'Triggered by a system event' },
    { value: 'MANUAL', label: 'Manual', description: 'Triggered manually via Run Now' },
  ];

const KNOWN_EVENT_TYPES = [
  'invoice.overdue',
  'stock.reorder.triggered',
  'payment.posted',
  'order.confirmed',
  'customer.created',
  'payment.overdue',
  'inventory.low',
  'purchase.approved',
];

const INPUT_SOURCE_TYPES =
  'Sources: DB_FIELD, DB_QUERY, SYSTEM, PREVIOUS_STEP, CONSTANT, EXPRESSION';

// ─── Form Schema ─────────────────────────────────────────────────────────────

const stepSchema = z.object({
  agentId: z.string(),
  goal: z.string(),
  inputConfig: z.string(),
  outputConfig: z.string(),
  maxTurns: z.coerce.number().int().min(1).max(50),
});

const automationFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or fewer'),
  description: z.string().max(2000).optional(),
  triggerType: z.enum(['SCHEDULED', 'EVENT', 'CHAIN', 'MANUAL']),
  // Schedule fields (SCHEDULED trigger)
  cronExpression: z.string(),
  timezone: z.string(),
  schedulePaused: z.boolean(),
  // Event field (EVENT trigger)
  eventType: z.string(),
  // Steps
  steps: z.array(stepSchema),
  // Chain
  chainEnabled: z.boolean(),
  chainNextId: z.string(),
  // Notification
  notifyEnabled: z.boolean(),
  notifyRecipients: z.string(),
  notifyInApp: z.boolean(),
  notifyEmail: z.boolean(),
  notifyOnSuccess: z.boolean(),
  notifyOnFailure: z.boolean(),
  // Budget
  maxTokenBudget: z.coerce.number().int().min(0),
  maxDurationSeconds: z.coerce.number().int().min(0),
  // Active
  isActive: z.boolean(),
});

type AutomationFormValues = z.infer<typeof automationFormSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface NotificationConfig {
  enabled?: boolean;
  recipients?: string[];
  channels?: string[];
  onSuccess?: boolean;
  onFailure?: boolean;
}

function tryParseJson(value: string, emptyDefault: unknown = {}): unknown | null {
  if (!value.trim()) return emptyDefault;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function detailToFormValues(automation: AiAutomationDetail): AutomationFormValues {
  const notif = automation.notificationConfig as NotificationConfig | null;
  return {
    name: automation.name,
    description: automation.description ?? '',
    triggerType: automation.triggerType,
    cronExpression: automation.schedule?.cronExpression ?? '',
    timezone: automation.schedule?.timezone ?? 'Europe/London',
    schedulePaused: automation.schedule?.isPaused ?? false,
    eventType: automation.eventType ?? '',
    steps: (automation.steps ?? [])
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map((step) => ({
        agentId: step.agentId,
        goal: step.goal,
        inputConfig: step.inputConfig ? JSON.stringify(step.inputConfig, null, 2) : '{}',
        outputConfig: step.outputConfig ? JSON.stringify(step.outputConfig, null, 2) : '{}',
        maxTurns: step.maxTurns,
      })),
    chainEnabled: !!automation.chainNextId,
    chainNextId: automation.chainNextId ?? '',
    notifyEnabled: !!notif?.enabled,
    notifyRecipients: notif?.recipients?.join(', ') ?? '',
    notifyInApp: notif?.channels?.includes('in-app') ?? true,
    notifyEmail: notif?.channels?.includes('email') ?? false,
    notifyOnSuccess: notif?.onSuccess ?? true,
    notifyOnFailure: notif?.onFailure ?? true,
    maxTokenBudget: automation.maxTokenBudget,
    maxDurationSeconds: Math.round(automation.maxDurationMs / 1000),
    isActive: automation.isActive,
  };
}

const DEFAULT_FORM_VALUES: AutomationFormValues = {
  name: '',
  description: '',
  triggerType: 'MANUAL',
  cronExpression: '',
  timezone: 'Europe/London',
  schedulePaused: false,
  eventType: '',
  steps: [{ agentId: '', goal: '', inputConfig: '{}', outputConfig: '{}', maxTurns: 10 }],
  chainEnabled: false,
  chainNextId: '',
  notifyEnabled: false,
  notifyRecipients: '',
  notifyInApp: true,
  notifyEmail: false,
  notifyOnSuccess: true,
  notifyOnFailure: true,
  maxTokenBudget: 50000,
  maxDurationSeconds: 300,
  isActive: true,
};

const NEW_STEP = { agentId: '', goal: '', inputConfig: '{}', outputConfig: '{}', maxTurns: 10 };

// ─── SortableStepCard ────────────────────────────────────────────────────────

interface SortableStepCardProps {
  sortableId: string;
  index: number;
  stepCount: number;
  form: UseFormReturn<AutomationFormValues>;
  agents: { id: string; name: string; displayName: string }[];
  onRemove: () => void;
}

function SortableStepCard({
  sortableId,
  index,
  stepCount,
  form,
  agents,
  onRemove,
}: SortableStepCardProps) {
  const [inputOpen, setInputOpen] = useState(false);
  const [outputOpen, setOutputOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const goalValue = form.watch(`steps.${index}.goal`);

  const handleRemove = useCallback(() => {
    if (goalValue?.trim()) {
      setShowDeleteConfirm(true);
    } else {
      onRemove();
    }
  }, [goalValue, onRemove]);

  const handleUsePreviousStepOutput = useCallback(() => {
    const prevStepBinding = JSON.stringify(
      { sources: [{ type: 'PREVIOUS_STEP', stepOrder: index, field: '*' }] },
      null,
      2,
    );
    form.setValue(`steps.${index}.inputConfig`, prevStepBinding, { shouldDirty: true });
  }, [form, index]);

  return (
    <>
      <div ref={setNodeRef} style={style} className="relative">
        {/* Vertical connector line */}
        {index < stepCount - 1 && (
          <div className="absolute left-6 top-full z-0 h-4 w-0.5 bg-[#7c3aed]/20" />
        )}

        <div
          className={cn(
            'relative rounded-xl border bg-card shadow-sm transition-shadow',
            'hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]',
            isDragging && 'z-50 shadow-lg opacity-90',
          )}
        >
          <div className="flex items-start gap-3 p-4">
            {/* Drag handle */}
            <button
              type="button"
              className="mt-1.5 cursor-grab touch-none text-muted-foreground hover:text-foreground"
              aria-label="Drag to reorder step"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" />
            </button>

            {/* Step number badge */}
            <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#7c3aed] text-xs font-semibold text-white">
              {index + 1}
            </div>

            {/* Step content */}
            <div className="min-w-0 flex-1 space-y-4">
              {/* Row 1: Agent + Max Turns */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
                <FormField
                  control={form.control}
                  name={`steps.${index}.agentId`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Agent</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select agent" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {agents.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              <span className="font-medium">{a.displayName}</span>
                              <span className="ml-2 font-mono text-xs text-muted-foreground">
                                {a.name}
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
                  name={`steps.${index}.maxTurns`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Max Turns</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          className="font-mono"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 10)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Goal textarea with variable autocomplete — AC-6 */}
              <FormField
                control={form.control}
                name={`steps.${index}.goal`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Goal</FormLabel>
                    <FormControl>
                      <VariableAutocompleteTextarea
                        placeholder="Describe what this step should accomplish. Use {{variable}} for dynamic values."
                        className="min-h-[80px] text-sm"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        stepIndex={index}
                        stepCount={stepCount}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Input config (collapsible) — AC-5 */}
              <div className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => setInputOpen(!inputOpen)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {inputOpen ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                  Input Configuration
                </button>
                {inputOpen && (
                  <div className="space-y-2 border-t px-3 pb-3 pt-2">
                    <FormField
                      control={form.control}
                      name={`steps.${index}.inputConfig`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              className="min-h-[100px] font-mono text-xs"
                              placeholder="{}"
                              {...field}
                              onBlur={(e) => {
                                field.onBlur();
                                const parsed = tryParseJson(e.target.value);
                                if (parsed === null && e.target.value.trim()) {
                                  form.setError(`steps.${index}.inputConfig`, {
                                    message: 'Invalid JSON syntax',
                                  });
                                } else {
                                  form.clearErrors(`steps.${index}.inputConfig`);
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription className="text-[11px]">
                            {INPUT_SOURCE_TYPES}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleUsePreviousStepOutput}
                      >
                        Use Previous Step Output
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Output config (collapsible) — AC-5 */}
              <div className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => setOutputOpen(!outputOpen)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {outputOpen ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                  Output Configuration
                </button>
                {outputOpen && (
                  <div className="space-y-2 border-t px-3 pb-3 pt-2">
                    <FormField
                      control={form.control}
                      name={`steps.${index}.outputConfig`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              className="min-h-[100px] font-mono text-xs"
                              placeholder="{}"
                              {...field}
                              onBlur={(e) => {
                                field.onBlur();
                                const parsed = tryParseJson(e.target.value);
                                if (parsed === null && e.target.value.trim()) {
                                  form.setError(`steps.${index}.outputConfig`, {
                                    message: 'Invalid JSON syntax',
                                  });
                                } else {
                                  form.clearErrors(`steps.${index}.outputConfig`);
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription className="text-[11px]">
                            Define what to capture from the agent&apos;s response
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Delete button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleRemove}
              disabled={stepCount <= 1}
              aria-label="Remove step"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Step delete confirmation dialog (AC-4) */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="animate-step-in sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Remove Step {index + 1}?</AlertDialogTitle>
            <AlertDialogDescription>
              This step has content that will be lost. Are you sure you want to remove it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDeleteConfirm(false);
                onRemove();
              }}
              className="rounded-lg bg-[#dc2626] text-white hover:bg-[#b91c1c]"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export interface AutomationFormPageProps {
  id?: string;
}

export function AutomationFormPage({ id }: AutomationFormPageProps) {
  const navigate = useNavigate();
  const isEditMode = !!id;

  // --- Data fetching ---
  const { data: automation, isLoading, isError } = useAiAutomation(id);

  // Fetch active agents for step dropdown
  const { data: agentsData } = useAiAgents({ isActive: true });
  const availableAgents = useMemo(
    () =>
      (agentsData?.data ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        displayName: a.displayName,
      })),
    [agentsData?.data],
  );

  // Fetch automations for chain dropdown (exclude current)
  const { data: automationsData } = useAiAutomations();
  const chainableAutomations = useMemo(
    () => (automationsData?.data ?? []).filter((a) => a.id !== id),
    [automationsData?.data, id],
  );

  // --- Mutations ---
  const createMutation = useCreateAiAutomation();
  const updateMutation = useUpdateAiAutomation();
  const deleteMutation = useDeleteAiAutomation();
  const runMutation = useRunAutomation();

  // --- Dialogs ---
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRunDialog, setShowRunDialog] = useState(false);

  // --- Form setup ---
  const form = useZodForm<AutomationFormValues>({
    schema: automationFormSchema,
    defaultValues: DEFAULT_FORM_VALUES,
    values: automation ? detailToFormValues(automation) : undefined,
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'steps',
  });

  const isDirty = form.formState.isDirty;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // --- Watched fields for conditional rendering ---
  const triggerType = form.watch('triggerType');
  const chainEnabled = form.watch('chainEnabled');
  const notifyEnabled = form.watch('notifyEnabled');

  // When switching to SCHEDULED, ensure cronExpression has a default so
  // the CronBuilder display and the form value stay in sync.
  const cronExpression = form.watch('cronExpression');
  if (triggerType === 'SCHEDULED' && !cronExpression) {
    form.setValue('cronExpression', '0 9 * * 1-5', { shouldDirty: true });
  }

  // --- DnD sensors ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortableIds = useMemo(() => fields.map((f) => f.id), [fields]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const fromIndex = fields.findIndex((f) => f.id === active.id);
      const toIndex = fields.findIndex((f) => f.id === over.id);
      if (fromIndex === -1 || toIndex === -1) return;

      move(fromIndex, toIndex);
    },
    [fields, move],
  );

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [
      { label: 'AI Administration', path: '/ai/admin' },
      { label: 'Automations', path: '/ai/admin/automations' },
      { label: isEditMode ? (automation?.name ?? 'Edit Automation') : 'New Automation' },
    ],
    [isEditMode, automation?.name],
  );

  // --- Form submission ---
  const onSubmit = useCallback(
    async (values: AutomationFormValues) => {
      // Validate at least one step
      if (values.steps.length === 0) {
        toast.error('At least one step is required');
        return;
      }

      // Validate step agent selections
      for (let i = 0; i < values.steps.length; i++) {
        if (!values.steps[i]!.agentId) {
          form.setError(`steps.${i}.agentId`, { message: 'Agent is required' });
          return;
        }
      }

      // Validate cron for scheduled type
      if (values.triggerType === 'SCHEDULED' && !values.cronExpression.trim()) {
        form.setError('cronExpression', {
          message: 'Cron expression is required for scheduled triggers',
        });
        return;
      }

      // Parse and validate step JSON configs
      const parsedSteps = [];
      for (let i = 0; i < values.steps.length; i++) {
        const step = values.steps[i]!;
        const inputConfig = tryParseJson(step.inputConfig);
        if (inputConfig === null) {
          form.setError(`steps.${i}.inputConfig`, { message: 'Invalid JSON syntax' });
          return;
        }
        const outputConfig = tryParseJson(step.outputConfig);
        if (outputConfig === null) {
          form.setError(`steps.${i}.outputConfig`, { message: 'Invalid JSON syntax' });
          return;
        }
        parsedSteps.push({
          agentId: step.agentId,
          goal: step.goal,
          inputConfig: inputConfig as Record<string, unknown>,
          outputConfig: outputConfig as Record<string, unknown>,
          maxTurns: step.maxTurns,
        });
      }

      // Build schedule
      const schedule =
        values.triggerType === 'SCHEDULED' && values.cronExpression.trim()
          ? {
              cronExpression: values.cronExpression.trim(),
              timezone: values.timezone,
              isPaused: values.schedulePaused,
            }
          : undefined;

      // Build notification config
      const notificationConfig = values.notifyEnabled
        ? {
            enabled: true,
            recipients: values.notifyRecipients
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            channels: [
              ...(values.notifyInApp ? ['in-app'] : []),
              ...(values.notifyEmail ? ['email'] : []),
            ],
            onSuccess: values.notifyOnSuccess,
            onFailure: values.notifyOnFailure,
          }
        : undefined;

      const basePayload = {
        name: values.name,
        description: values.description || undefined,
        triggerType: values.triggerType as AutomationTriggerType,
        eventType: values.triggerType === 'EVENT' ? values.eventType || undefined : undefined,
        steps: parsedSteps,
        schedule,
        chainNextId: values.chainEnabled && values.chainNextId ? values.chainNextId : undefined,
        notificationConfig: notificationConfig as Record<string, unknown> | undefined,
        maxTokenBudget: values.maxTokenBudget,
        maxDurationMs: values.maxDurationSeconds * 1000,
      };

      try {
        if (isEditMode && id) {
          const updatePayload: UpdateAutomationRequest = {
            ...basePayload,
            isActive: values.isActive,
            schedule: schedule ?? null,
            chainNextId: values.chainEnabled && values.chainNextId ? values.chainNextId : null,
            notificationConfig: (notificationConfig as Record<string, unknown>) ?? null,
          };
          await updateMutation.mutateAsync({ id, data: updatePayload });
        } else {
          const createPayload: CreateAutomationRequest = basePayload;
          const created = await createMutation.mutateAsync(createPayload);
          void navigate({ to: `/ai/admin/automations/${created.id}` as string });
        }
      } catch (error: unknown) {
        const err = error as {
          message?: string;
          statusCode?: number;
          fieldErrors?: Record<string, string>;
        };
        if (err.fieldErrors) {
          for (const [field, message] of Object.entries(err.fieldErrors)) {
            form.setError(field as keyof AutomationFormValues, { message });
          }
        } else if (err.statusCode === 409) {
          form.setError('name', {
            message: err.message ?? 'An automation with this name already exists',
          });
        } else if (err.statusCode === 422) {
          // Chain cycle detection or validation error — show inline on chainNextId if chain-related
          const msg = err.message ?? 'Validation error — check your form fields';
          if (msg.toLowerCase().includes('chain') || msg.toLowerCase().includes('circular')) {
            form.setError('chainNextId', { message: msg });
          } else {
            toast.error(msg);
          }
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
      void navigate({ to: '/ai/admin/automations' as string });
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message ?? 'Failed to delete automation');
      setShowDeleteDialog(false);
    }
  }, [id, deleteMutation, navigate]);

  // --- Run Now handler ---
  const handleRunNow = useCallback(async () => {
    if (!id) return;
    try {
      await runMutation.mutateAsync({ id });
      setShowRunDialog(false);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message ?? 'Failed to start automation');
      setShowRunDialog(false);
    }
  }, [id, runMutation]);

  // --- Loading state ---
  if (isEditMode && isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Automation" breadcrumbs={breadcrumbs} isLoading />
        <Card className="mx-auto max-w-4xl rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-10 w-1/2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Error state ---
  if (isEditMode && (isError || !automation)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Automation" breadcrumbs={breadcrumbs} />
        <Card className="mx-auto max-w-4xl rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load automation. It may have been deleted.
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
        onClick={() => void navigate({ to: '/ai/admin/automations' as string })}
      >
        Cancel
      </Button>

      {isEditMode && (
        <>
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="size-4" />
            Delete
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRunDialog(true)}
            disabled={runMutation.isPending}
          >
            {runMutation.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Run Now
          </Button>
        </>
      )}

      <Button onClick={form.handleSubmit(onSubmit)} disabled={!isDirty || isSubmitting} size="sm">
        {isSubmitting ? <Loader2 className="animate-spin" /> : <Save className="size-4" />}
        Save
      </Button>
    </div>
  );

  return (
    <div className="animate-fade-in-up space-y-6">
      <PageHeader
        title={isEditMode ? (automation?.name ?? 'Edit Automation') : 'New Automation'}
        breadcrumbs={breadcrumbs}
        statusBadge={
          isEditMode && automation ? (
            <div className="flex items-center gap-2">
              {automation.isActive ? (
                <Badge className="bg-[#10b981] text-white hover:bg-[#059669]">Active</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Inactive
                </Badge>
              )}
            </div>
          ) : undefined
        }
        actionBarSlot={actionBarSlot}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="mx-auto max-w-4xl space-y-6">
            {/* ─── Basic Config (4.1) ─────────────────────────────── */}
            <Card className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]">
              <CardContent className="space-y-4 pt-6">
                <h3 className="font-serif text-sm font-semibold text-foreground">
                  Basic Configuration
                </h3>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Daily AR Analysis" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what this automation does..."
                          className="min-h-[60px]"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isEditMode && (
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active</FormLabel>
                          <FormDescription>Enable this automation</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* ─── Trigger Config (4.2) ───────────────────────────── */}
            <Card className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]">
              <CardContent className="space-y-4 pt-6">
                <h3 className="font-serif text-sm font-semibold text-foreground">
                  Trigger Configuration
                </h3>

                {/* Read-only indicator for CHAIN trigger type (set by backend) */}
                {triggerType === 'CHAIN' && (
                  <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <Badge className="bg-[#fffbeb] text-[#d97706] border border-[#d97706]/20">
                      Chain
                    </Badge>
                    <div>
                      <div className="text-sm font-medium">Chain Trigger</div>
                      <div className="text-xs text-muted-foreground">
                        This automation is triggered by another automation in a chain. The trigger
                        type cannot be changed.
                      </div>
                    </div>
                  </div>
                )}

                {triggerType !== 'CHAIN' && (
                  <FormField
                    control={form.control}
                    name="triggerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trigger Type</FormLabel>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                          >
                            {TRIGGER_TYPE_OPTIONS.map((opt) => (
                              <label
                                key={opt.value}
                                className={cn(
                                  'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                                  field.value === opt.value
                                    ? 'border-[#7c3aed] bg-[#f5f3ff]'
                                    : 'hover:bg-accent/50',
                                )}
                              >
                                <RadioGroupItem value={opt.value} />
                                <div>
                                  <div className="text-sm font-medium">{opt.label}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {opt.description}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Scheduled trigger config — CronBuilder + isPaused */}
                {triggerType === 'SCHEDULED' && (
                  <div className="space-y-4 rounded-lg border border-dashed border-[#7c3aed]/30 bg-[#f5f3ff]/50 p-4">
                    <CronBuilder
                      value={form.watch('cronExpression')}
                      onChange={(cron) =>
                        form.setValue('cronExpression', cron, { shouldDirty: true })
                      }
                      timezone={form.watch('timezone') || 'Europe/London'}
                      onTimezoneChange={(tz) =>
                        form.setValue('timezone', tz, { shouldDirty: true })
                      }
                    />

                    <FormField
                      control={form.control}
                      name="schedulePaused"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border bg-card p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Paused</FormLabel>
                            <FormDescription>Temporarily pause the schedule</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Event trigger config */}
                {triggerType === 'EVENT' && (
                  <div className="space-y-3 rounded-lg border border-dashed border-blue-300/50 bg-blue-50/30 p-4">
                    <FormField
                      control={form.control}
                      name="eventType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Type</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. invoice.overdue" {...field} />
                          </FormControl>
                          <FormDescription>
                            Known events: {KNOWN_EVENT_TYPES.join(', ')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Manual trigger info */}
                {triggerType === 'MANUAL' && (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    This automation can only be triggered manually via the Run Now button.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ─── Step Builder (4.3, 4.4) ────────────────────────── */}
            <Card className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]">
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-sm font-semibold text-foreground">Steps</h3>
                  <Badge variant="secondary" className="bg-[#f5f3ff] text-[#7c3aed] text-xs">
                    {fields.length} step{fields.length !== 1 ? 's' : ''}
                  </Badge>
                </div>

                {fields.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    No steps configured. Add at least one step to save the automation.
                  </p>
                )}

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {fields.map((field, index) => (
                        <SortableStepCard
                          key={field.id}
                          sortableId={field.id}
                          index={index}
                          stepCount={fields.length}
                          form={form}
                          agents={availableAgents}
                          onRemove={() => remove(index)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {/* Add Step button */}
                <button
                  type="button"
                  onClick={() => append(NEW_STEP)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 py-4 text-sm text-muted-foreground transition-colors hover:border-[#7c3aed]/40 hover:bg-[#f5f3ff] hover:text-[#7c3aed]"
                >
                  <Plus className="size-4" />
                  Add Step
                </button>
              </CardContent>
            </Card>

            {/* ─── Chain Config (4.5) ─────────────────────────────── */}
            <Card className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]">
              <CardContent className="space-y-4 pt-6">
                <h3 className="font-serif text-sm font-semibold text-foreground">
                  Chain Configuration
                </h3>

                <FormField
                  control={form.control}
                  name="chainEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Chain to next automation</FormLabel>
                        <FormDescription>
                          Trigger another automation when this one completes
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {chainEnabled && (
                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name="chainNextId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Next Automation</FormLabel>
                          <Select value={field.value || ''} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select automation to chain to" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {chainableAutomations.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  <span className="font-medium">{a.name}</span>
                                  <Badge
                                    variant="secondary"
                                    className={cn(
                                      'ml-2 text-[10px]',
                                      a.triggerType === 'SCHEDULED' &&
                                        'bg-purple-100 text-purple-700',
                                      a.triggerType === 'EVENT' && 'bg-blue-100 text-blue-700',
                                      a.triggerType === 'CHAIN' && 'bg-amber-100 text-amber-700',
                                      a.triggerType === 'MANUAL' && 'bg-gray-100 text-gray-700',
                                    )}
                                  >
                                    {a.triggerType}
                                  </Badge>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            The final step&apos;s output is automatically passed as input. Circular
                            chains are rejected (max depth 10).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Chain path display */}
                    {isEditMode && automation?.chainFromId && (
                      <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                        <span className="font-medium">Chain path:</span>
                        <span>Triggered by another automation</span>
                        <span className="text-amber-500">&rarr;</span>
                        <span className="font-semibold">{automation.name}</span>
                        {automation.chainNextId && (
                          <>
                            <span className="text-amber-500">&rarr;</span>
                            <span>
                              {chainableAutomations.find((a) => a.id === automation.chainNextId)
                                ?.name ?? 'Next automation'}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ─── Notification Config (4.6) ──────────────────────── */}
            <Card className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]">
              <CardContent className="space-y-4 pt-6">
                <h3 className="font-serif text-sm font-semibold text-foreground">Notifications</h3>

                <FormField
                  control={form.control}
                  name="notifyEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Notify on completion</FormLabel>
                        <FormDescription>
                          Send notifications when this automation finishes
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {notifyEnabled && (
                  <div className="space-y-4 rounded-lg border border-dashed p-4">
                    <FormField
                      control={form.control}
                      name="notifyRecipients"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recipients</FormLabel>
                          <FormControl>
                            <Input placeholder="User IDs, comma-separated" {...field} />
                          </FormControl>
                          <FormDescription>
                            Comma-separated list of user IDs to notify
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Channels */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Channels</Label>
                      <div className="flex items-center gap-6">
                        <FormField
                          control={form.control}
                          name="notifyInApp"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2 space-y-0">
                              <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">In-App</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="notifyEmail"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2 space-y-0">
                              <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">Email</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Success / Failure toggles */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="notifyOnSuccess"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border bg-card p-3">
                            <FormLabel className="text-sm">Notify on success</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="notifyOnFailure"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border bg-card p-3">
                            <FormLabel className="text-sm">Notify on failure</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ─── Budget Config (4.7) ────────────────────────────── */}
            <Card className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]">
              <CardContent className="space-y-4 pt-6">
                <h3 className="font-serif text-sm font-semibold text-foreground">
                  Budget &amp; Limits
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="maxTokenBudget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Token Budget</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            className="font-mono"
                            {...field}
                            onChange={(e) => field.onChange(e.target.valueAsNumber || 50000)}
                          />
                        </FormControl>
                        <FormDescription>Maximum tokens per run</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxDurationSeconds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Duration (seconds)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            className="font-mono"
                            {...field}
                            onChange={(e) => field.onChange(e.target.valueAsNumber || 300)}
                          />
                        </FormControl>
                        <FormDescription>Maximum execution time in seconds</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Screen reader error announcements */}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {Object.values(form.formState.errors)
              .map((e) => {
                if (typeof e === 'object' && e !== null && 'message' in e) {
                  return (e as { message?: string }).message;
                }
                return undefined;
              })
              .filter(Boolean)
              .join('. ')}
          </div>
        </form>
      </Form>

      {/* Delete confirmation dialog */}
      {isEditMode && (
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="animate-step-in sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-serif">Delete Automation</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this automation? This action cannot be undone.
              </DialogDescription>
              {automation && (
                <p className="mt-2 rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
                  {automation.name}
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

      {/* Run Now confirmation dialog */}
      {isEditMode && (
        <AlertDialog open={showRunDialog} onOpenChange={setShowRunDialog}>
          <AlertDialogContent className="animate-step-in">
            <AlertDialogHeader>
              <AlertDialogTitle>Run Automation Now?</AlertDialogTitle>
              <AlertDialogDescription>
                This will immediately trigger &ldquo;{automation?.name}&rdquo;. The automation will
                execute all {fields.length} step{fields.length !== 1 ? 's' : ''} using the current
                configuration.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRunNow}
                disabled={runMutation.isPending}
                className="bg-[#7c3aed] hover:bg-[#5b21b6]"
              >
                {runMutation.isPending && <Loader2 className="mr-2 animate-spin" />}
                Run Now
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
