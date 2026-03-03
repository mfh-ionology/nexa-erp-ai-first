/* eslint-disable i18next/no-literal-string */
/**
 * Prompt Template Editor Page — T4-style editor for AI prompt templates.
 *
 * AC-5: Prompt template editor with syntax-highlighted system prompt and user template,
 *       variable autocomplete on `{{`, parameters JSON editor, version history sidebar.
 * AC-6: Versioning on save — changeReason modal on edit.
 * AC-7: Version restore from sidebar.
 *
 * Two-column layout: editor (left ~70%) + version sidebar (right ~30%) on desktop.
 * Single column stacked on mobile.
 *
 * Used for both `/ai/admin/prompts/new` (create) and `/ai/admin/prompts/:id` (edit).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { FlaskConical, Loader2, Save, Trash2 } from 'lucide-react';
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
import { useWatch, type Control } from 'react-hook-form';
import { PageHeader } from '@/components/templates/page-header';

import type { AiPromptDetail, PromptCategory } from '../api/types';
import {
  useAiPrompt,
  useCreateAiPrompt,
  useUpdateAiPrompt,
  useDeleteAiPrompt,
} from '../api/use-ai-prompts';
import { PromptVersionSidebar } from './prompt-version-sidebar';
import { PromptTestPanel } from './prompt-test-panel';
import {
  VariableAutocomplete,
  VARIABLE_LISTBOX_ID,
  type VariableAutocompleteHandle,
} from './variable-autocomplete';

// ─── Constants ───────────────────────────────────────────────────────────────

const PROMPT_CATEGORIES: { value: PromptCategory; label: string }[] = [
  { value: 'record-creation', label: 'Record Creation' },
  { value: 'query', label: 'Query' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'briefing', label: 'Briefing' },
  { value: 'skill', label: 'Skill' },
  { value: 'chat', label: 'Chat' },
  { value: 'automation', label: 'Automation' },
];

// ─── Form schema ─────────────────────────────────────────────────────────────

const promptFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or fewer')
    .regex(/^[a-z][a-z0-9_-]*$/, 'Must start with lowercase letter, use only a-z, 0-9, -, _'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  isActive: z.boolean(),
  systemPrompt: z.string().min(1, 'System prompt is required'),
  userTemplate: z.string().min(1, 'User template is required'),
  parameters: z.string(), // JSON string, validated on submit
});

type PromptFormValues = z.infer<typeof promptFormSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tryParseJson(value: string): unknown | null {
  if (!value.trim()) return [];
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function promptToFormValues(prompt: AiPromptDetail): PromptFormValues {
  return {
    name: prompt.name,
    description: prompt.description ?? '',
    category: prompt.category,
    isActive: prompt.isActive,
    systemPrompt: prompt.systemPrompt,
    userTemplate: prompt.userTemplate,
    parameters: prompt.parameters ? JSON.stringify(prompt.parameters, null, 2) : '[]',
  };
}

const DEFAULT_FORM_VALUES: PromptFormValues = {
  name: '',
  description: '',
  category: '',
  isActive: true,
  systemPrompt: '',
  userTemplate: '',
  parameters: '[]',
};

// ─── Prompt Textarea with variable autocomplete ──────────────────────────────

interface PromptTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minHeight?: string;
  /** Accessible label for screen readers (WCAG 2.1 AA 4.1.2) */
  'aria-label'?: string;
}

function PromptTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
  minHeight = '200px',
  'aria-label': ariaLabel,
}: PromptTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autocompleteRef = useRef<VariableAutocompleteHandle>(null);
  const [autocompleteFilter, setAutocompleteFilter] = useState('');
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const filterStartPos = useRef<number | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, parseInt(minHeight))}px`;
  }, [value, minHeight]);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart;
      onChange(newValue);

      // Check for {{ trigger
      if (cursorPos >= 2) {
        const lastTwo = newValue.slice(cursorPos - 2, cursorPos);
        if (lastTwo === '{{' && !autocompleteRef.current?.isOpen) {
          filterStartPos.current = cursorPos;
          setAutocompleteFilter('');
          // Get cursor position for popover placement
          const rect = getCaretRect(e.target);
          if (rect) {
            autocompleteRef.current?.open(rect);
          }
          return;
        }
      }

      // Update filter if autocomplete is open
      if (autocompleteRef.current?.isOpen && filterStartPos.current !== null) {
        const filterText = newValue.slice(filterStartPos.current, cursorPos);
        if (filterText.includes('}}') || filterText.includes('\n')) {
          autocompleteRef.current.close();
          filterStartPos.current = null;
        } else {
          setAutocompleteFilter(filterText);
        }
      }
    },
    [onChange],
  );

  const handleSelectVariable = useCallback(
    (variableName: string) => {
      const el = textareaRef.current;
      if (!el || filterStartPos.current === null) return;

      const before = value.slice(0, filterStartPos.current);
      const after = value.slice(el.selectionStart);
      const newValue = `${before}${variableName}}}${after}`;
      onChange(newValue);

      // Set cursor after the inserted variable
      const newCursorPos = filterStartPos.current + variableName.length + 2;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(newCursorPos, newCursorPos);
      });

      filterStartPos.current = null;
    },
    [value, onChange],
  );

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onBlur={onBlur}
        onKeyDown={(e) => autocompleteRef.current?.handleKeyDown(e)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-controls={isAutocompleteOpen ? VARIABLE_LISTBOX_ID : undefined}
        aria-expanded={isAutocompleteOpen}
        aria-activedescendant={
          isAutocompleteOpen ? autocompleteRef.current?.activeDescendantId : undefined
        }
        aria-autocomplete={isAutocompleteOpen ? 'list' : undefined}
        className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ minHeight }}
      />
      <VariableAutocomplete
        ref={autocompleteRef}
        onSelect={handleSelectVariable}
        filter={autocompleteFilter}
        onOpenChange={setIsAutocompleteOpen}
      />
    </div>
  );
}

/** Get approximate caret rectangle for positioning the autocomplete popover */
function getCaretRect(textarea: HTMLTextAreaElement): DOMRect | null {
  const { selectionStart } = textarea;
  const textBefore = textarea.value.substring(0, selectionStart);
  const lines = textBefore.split('\n');
  const lineIndex = lines.length - 1;

  const style = window.getComputedStyle(textarea);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
  const paddingTop = parseFloat(style.paddingTop);
  const paddingLeft = parseFloat(style.paddingLeft);

  const rect = textarea.getBoundingClientRect();
  const top = rect.top + paddingTop + lineIndex * lineHeight - textarea.scrollTop;
  const left = rect.left + paddingLeft;

  return new DOMRect(left, top, 0, lineHeight);
}

// ─── Connected Version Sidebar (isolates form.watch re-renders) ──────────────

function ConnectedVersionSidebar({
  promptId,
  activeVersion,
  control,
}: {
  promptId: string;
  activeVersion: number;
  control: Control<PromptFormValues>;
}) {
  const systemPrompt = useWatch({ control, name: 'systemPrompt' });
  const userTemplate = useWatch({ control, name: 'userTemplate' });

  return (
    <PromptVersionSidebar
      promptId={promptId}
      activeVersion={activeVersion}
      currentSystemPrompt={systemPrompt}
      currentUserTemplate={userTemplate}
    />
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface PromptEditorPageProps {
  id?: string;
}

export function PromptEditorPage({ id }: PromptEditorPageProps) {
  const navigate = useNavigate();
  const isEditMode = !!id;

  // --- Data fetching ---
  const { data: prompt, isLoading, isError } = useAiPrompt(id);

  // --- Mutations ---
  const createMutation = useCreateAiPrompt();
  const updateMutation = useUpdateAiPrompt();
  const deleteMutation = useDeleteAiPrompt();

  // --- Dialog states ---
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showChangeReasonDialog, setShowChangeReasonDialog] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [showTestPanel, setShowTestPanel] = useState(false);

  // Ref to hold pending form values while waiting for changeReason
  const pendingValues = useRef<PromptFormValues | null>(null);

  // --- Form setup ---
  const form = useZodForm<PromptFormValues>({
    schema: promptFormSchema,
    defaultValues: DEFAULT_FORM_VALUES,
    values: prompt ? promptToFormValues(prompt) : undefined,
  });

  const isDirty = form.formState.isDirty;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [
      { label: 'AI Administration', path: '/ai/admin' },
      { label: 'Prompt Templates', path: '/ai/admin/prompts' },
      { label: isEditMode ? (prompt?.name ?? 'Edit Prompt') : 'New Prompt Template' },
    ],
    [isEditMode, prompt?.name],
  );

  // --- Submit handler ---
  const doSubmit = useCallback(
    async (values: PromptFormValues, reason?: string) => {
      // Validate JSON
      const parameters = tryParseJson(values.parameters);
      if (parameters === null) {
        form.setError('parameters', { message: 'Invalid JSON syntax' });
        return;
      }

      try {
        if (isEditMode && id) {
          // Guard: changeReason is mandatory in edit mode
          if (!reason?.trim()) {
            toast.error('A change reason is required when updating a prompt');
            return;
          }
          await updateMutation.mutateAsync({
            id,
            data: {
              name: values.name,
              description: values.description || undefined,
              category: values.category as PromptCategory,
              isActive: values.isActive,
              systemPrompt: values.systemPrompt,
              userTemplate: values.userTemplate,
              parameters,
              changeReason: reason.trim(),
            },
          });
        } else {
          const created = await createMutation.mutateAsync({
            name: values.name,
            description: values.description || undefined,
            category: values.category as PromptCategory,
            isActive: values.isActive,
            systemPrompt: values.systemPrompt,
            userTemplate: values.userTemplate,
            parameters,
          });
          toast.success('Prompt template created');
          void navigate({ to: `/ai/admin/prompts/${created.id}` as string });
        }
      } catch (error: unknown) {
        const err = error as { message?: string; statusCode?: number };
        toast.error(err.message ?? 'An unexpected error occurred');
      }
    },
    [isEditMode, id, form, createMutation, updateMutation, navigate],
  );

  const handleSaveClick = useCallback(
    (values: PromptFormValues) => {
      if (isEditMode) {
        // Show changeReason dialog
        pendingValues.current = values;
        setChangeReason('');
        setShowChangeReasonDialog(true);
      } else {
        void doSubmit(values);
      }
    },
    [isEditMode, doSubmit],
  );

  const handleChangeReasonConfirm = useCallback(() => {
    if (!changeReason.trim()) return;
    const values = pendingValues.current;
    if (!values) return;
    setShowChangeReasonDialog(false);
    void doSubmit(values, changeReason.trim());
    pendingValues.current = null;
  }, [changeReason, doSubmit]);

  // --- Delete handler ---
  const handleDelete = useCallback(async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      setShowDeleteDialog(false);
      void navigate({ to: '/ai/admin/prompts' as string });
    } catch (error: unknown) {
      const err = error as { message?: string; statusCode?: number };
      toast.error(err.message ?? 'Failed to delete prompt');
      setShowDeleteDialog(false);
    }
  }, [id, deleteMutation, navigate]);

  // Reset changeReason dialog on close
  useEffect(() => {
    if (!showChangeReasonDialog) {
      setChangeReason('');
    }
  }, [showChangeReasonDialog]);

  // --- Loading state ---
  if (isEditMode && isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Prompt" breadcrumbs={breadcrumbs} isLoading />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <Card className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <CardContent className="space-y-4 pt-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
          <div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (isEditMode && (isError || !prompt)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Prompt" breadcrumbs={breadcrumbs} />
        <Card className="mx-auto max-w-4xl rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load prompt template. It may have been deleted.
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
        onClick={() => void navigate({ to: '/ai/admin/prompts' as string })}
      >
        Cancel
      </Button>

      {isEditMode && (
        <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
          <Trash2 className="size-4" />
          Delete
        </Button>
      )}

      {isEditMode && id && (
        <Button variant="outline" size="sm" onClick={() => setShowTestPanel(true)}>
          <FlaskConical className="size-4" />
          Test Prompt
        </Button>
      )}

      <Button
        onClick={form.handleSubmit(handleSaveClick)}
        disabled={!isDirty || isSubmitting}
        size="sm"
      >
        {isSubmitting ? <Loader2 className="animate-spin" /> : <Save className="size-4" />}
        Save
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditMode ? (prompt?.name ?? 'Edit Prompt') : 'New Prompt Template'}
        breadcrumbs={breadcrumbs}
        statusBadge={
          isEditMode && prompt ? (
            <div className="flex items-center gap-2">
              {prompt.isActive ? (
                <Badge className="bg-[#10b981] text-white hover:bg-[#059669]">Active</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Inactive
                </Badge>
              )}
              <Badge variant="secondary" className="bg-muted font-mono text-xs">
                v{prompt.activeVersion}
              </Badge>
            </div>
          ) : undefined
        }
        actionBarSlot={actionBarSlot}
      />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* ─── Main Editor Column ──────────────────────────────────── */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSaveClick)} noValidate>
            <div className="space-y-6">
              {/* Metadata Section (11.2) */}
              <Card className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="record-creation-invoice"
                              className="font-mono"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>Lowercase identifier (a-z, 0-9, -, _)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PROMPT_CATEGORIES.map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>
                                  {cat.label}
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
                      name="description"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Brief description of what this prompt does..."
                              rows={2}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4 sm:col-span-2">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Active</FormLabel>
                            <FormDescription>
                              Enable this prompt template for use in AI operations
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* System Prompt Editor (11.3) */}
              <Card className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]">
                <CardContent className="pt-6 space-y-2">
                  <h3 className="font-serif text-sm font-semibold">System Prompt</h3>
                  <p className="text-xs text-muted-foreground">
                    Type{' '}
                    <code className="rounded bg-primary/10 px-1 py-0.5 font-mono text-primary">
                      {'{{'}
                      {'}'}
                    </code>{' '}
                    to insert variables
                  </p>
                  <FormField
                    control={form.control}
                    name="systemPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <PromptTextarea
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="You are an AI assistant for the Nexa ERP system..."
                            minHeight="200px"
                            aria-label="System prompt editor"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* User Template Editor (11.4) */}
              <Card className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]">
                <CardContent className="pt-6 space-y-2">
                  <h3 className="font-serif text-sm font-semibold">User Template</h3>
                  <p className="text-xs text-muted-foreground">
                    Type{' '}
                    <code className="rounded bg-primary/10 px-1 py-0.5 font-mono text-primary">
                      {'{{'}
                      {'}'}
                    </code>{' '}
                    to insert variables
                  </p>
                  <FormField
                    control={form.control}
                    name="userTemplate"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <PromptTextarea
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="Please help me with the following task..."
                            minHeight="150px"
                            aria-label="User template editor"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Parameters JSON Editor (11.5) */}
              <Card className="rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]">
                <CardContent className="pt-6 space-y-2">
                  <h3 className="font-serif text-sm font-semibold">Parameters Schema</h3>
                  <FormField
                    control={form.control}
                    name="parameters"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder='[{"name": "entityType", "source": "context", "required": true}]'
                            className="min-h-[120px] font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Define parameter sources as a JSON array of PromptParameter objects
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Screen reader error announcements */}
            <div aria-live="polite" aria-atomic="true" className="sr-only">
              {Object.values(form.formState.errors)
                .map((e) => e?.message)
                .filter(Boolean)
                .join('. ')}
            </div>
          </form>
        </Form>

        {/* ─── Version Sidebar Column (11.6) ───────────────────────── */}
        {isEditMode && id && (
          <div className="lg:sticky lg:top-6 lg:self-start">
            <ConnectedVersionSidebar
              promptId={id}
              activeVersion={prompt?.activeVersion ?? 1}
              control={form.control}
            />
          </div>
        )}
      </div>

      {/* ─── Change Reason Dialog (11.7) ────────────────────────────── */}
      <Dialog open={showChangeReasonDialog} onOpenChange={setShowChangeReasonDialog}>
        <DialogContent className="animate-step-in sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Save Prompt Changes</DialogTitle>
            <DialogDescription>Describe what changed in this version</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="e.g., Updated system prompt to include inventory context"
              rows={3}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && changeReason.trim()) {
                  e.preventDefault();
                  handleChangeReasonConfirm();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowChangeReasonDialog(false)}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangeReasonConfirm}
              disabled={!changeReason.trim() || isSubmitting}
              className="rounded-lg"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Save className="size-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─────────────────────────────── */}
      {isEditMode && (
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="animate-step-in sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-serif">Delete Prompt Template</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this prompt template? This action cannot be undone.
                All versions will also be deleted.
              </DialogDescription>
              {prompt && (
                <p className="mt-2 rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
                  {prompt.name}
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

      {/* ─── Test Prompt Panel (11.8) ───────────────────────────────── */}
      {isEditMode && id && (
        <PromptTestPanel
          open={showTestPanel}
          onOpenChange={setShowTestPanel}
          promptId={id}
          variables={prompt?.variables ?? []}
        />
      )}
    </div>
  );
}
