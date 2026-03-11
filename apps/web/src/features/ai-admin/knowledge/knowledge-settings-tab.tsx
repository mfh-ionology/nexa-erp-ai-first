/* eslint-disable i18next/no-literal-string */
/**
 * Knowledge Settings Tab — T7 Settings layout for AI Knowledge configuration.
 *
 * AC-8: Settings form with Enable Knowledge, Share Patterns, Categories,
 * Retention, RAG Budget. T7 responsive layout (two-column desktop,
 * single-column stacked on tablet/mobile). Dirty state detection with
 * navigation prompt. localStorage interim until backend settings endpoint.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBlocker } from '@tanstack/react-router';
import { z } from 'zod';
import { Loader2, Save } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
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
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'nexa:knowledge-settings';

const CATEGORY_OPTIONS = [
  { value: 'BUSINESS_PROCESS', label: 'Business Processes' },
  { value: 'TERMINOLOGY', label: 'Terminology' },
  { value: 'INDUSTRY_RULES', label: 'Industry Rules' },
  { value: 'CUSTOM_FIELDS', label: 'Custom Fields' },
  { value: 'HISTORICAL_PATTERN', label: 'Historical Patterns' },
] as const;

type CategoryValue = (typeof CATEGORY_OPTIONS)[number]['value'];

// ─── Schema ─────────────────────────────────────────────────────────────────

const settingsSchema = z.object({
  enableKnowledgeBase: z.boolean(),
  shareAnonymisedPatterns: z.boolean(),
  categories: z
    .array(
      z.enum([
        'BUSINESS_PROCESS',
        'TERMINOLOGY',
        'INDUSTRY_RULES',
        'CUSTOM_FIELDS',
        'HISTORICAL_PATTERN',
      ]),
    )
    .min(1, 'Select at least one category'),
  retentionDays: z.coerce.number().int().min(30, 'Minimum 30 days').max(365, 'Maximum 365 days'),
  ragTokenBudget: z.coerce
    .number()
    .int()
    .min(500, 'Minimum 500 tokens')
    .max(2000, 'Maximum 2000 tokens'),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const DEFAULT_SETTINGS: SettingsFormValues = {
  enableKnowledgeBase: true,
  shareAnonymisedPatterns: false,
  categories: [
    'BUSINESS_PROCESS',
    'TERMINOLOGY',
    'INDUSTRY_RULES',
    'CUSTOM_FIELDS',
    'HISTORICAL_PATTERN',
  ],
  retentionDays: 90,
  ragTokenBudget: 1000,
};

// ─── Persistence (localStorage interim — TODO: replace with backend settings endpoint) ──

function getStorageKey(companyId: string | null): string {
  return companyId ? `${STORAGE_KEY_PREFIX}:${companyId}` : STORAGE_KEY_PREFIX;
}

function loadSettings(companyId: string | null): SettingsFormValues {
  try {
    const raw = localStorage.getItem(getStorageKey(companyId));
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const result = settingsSchema.safeParse(parsed);
    return result.success ? result.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(companyId: string | null, values: SettingsFormValues): void {
  localStorage.setItem(getStorageKey(companyId), JSON.stringify(values));
}

// ─── Setting Row Layout ─────────────────────────────────────────────────────

interface SettingRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
  isDesktop: boolean;
}

function SettingRow({ label, description, children, isDesktop }: SettingRowProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card p-5',
        'shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
        'hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]',
        'transition-shadow duration-200',
        isDesktop ? 'flex items-start gap-8' : 'space-y-3',
      )}
    >
      <div className={cn(isDesktop && 'w-72 shrink-0')}>
        <p className="text-sm font-medium font-serif text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className={cn(isDesktop && 'flex-1')}>{children}</div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

interface KnowledgeSettingsTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function KnowledgeSettingsTab({ onDirtyChange }: KnowledgeSettingsTabProps) {
  const breakpoint = useBreakpoint();
  const isDesktop = breakpoint === 'desktop';
  const [isSaving, setIsSaving] = useState(false);
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);

  const savedSettings = useMemo(() => loadSettings(activeCompanyId), [activeCompanyId]);

  const form = useZodForm<SettingsFormValues>({
    schema: settingsSchema,
    defaultValues: savedSettings,
  });

  const isDirty = form.formState.isDirty;

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Browser beforeunload warning when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Block in-app navigation when dirty — show confirmation dialog
  const blocker = useBlocker({
    shouldBlockFn: () => isDirty,
    withResolver: true,
  });

  const handleSave = useCallback(
    async (values: SettingsFormValues) => {
      setIsSaving(true);
      try {
        // TODO: Replace with API call when backend settings endpoint is available
        saveSettings(activeCompanyId, values);
        // Simulate a brief save delay for UX feedback
        await new Promise((resolve) => setTimeout(resolve, 300));
        form.reset(values);
        toast.success('Knowledge settings saved');
      } catch {
        toast.error('Failed to save settings');
      } finally {
        setIsSaving(false);
      }
    },
    [form, activeCompanyId],
  );

  const handleReset = useCallback(() => {
    form.reset(DEFAULT_SETTINGS);
  }, [form]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-xs text-amber-600" role="status" aria-live="polite">
              You have unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={isSaving}>
            Reset to Defaults
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 bg-[#7c3aed] hover:bg-[#5b21b6]"
            onClick={form.handleSubmit(handleSave)}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="size-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Settings form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
          {/* Enable AI Knowledge Base */}
          <SettingRow
            label="Enable AI Knowledge Base"
            description="When enabled, the AI uses your company's knowledge articles to provide more accurate answers."
            isDesktop={isDesktop}
          >
            <FormField
              control={form.control}
              name="enableKnowledgeBase"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSaving}
                      aria-label="Enable AI Knowledge Base"
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-normal">
                    {field.value ? 'Enabled' : 'Disabled'}
                  </FormLabel>
                </FormItem>
              )}
            />
          </SettingRow>

          {/* Share Anonymised Patterns */}
          <SettingRow
            label="Share Anonymised Patterns"
            description="Allows anonymised usage patterns to be shared with the vendor to improve AI for all tenants. No actual data leaves your system — only statistical counts and categories."
            isDesktop={isDesktop}
          >
            <FormField
              control={form.control}
              name="shareAnonymisedPatterns"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSaving}
                      aria-label="Share Anonymised Patterns"
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-normal">
                    {field.value ? 'Sharing enabled' : 'Not sharing'}
                  </FormLabel>
                </FormItem>
              )}
            />
          </SettingRow>

          {/* Knowledge Categories */}
          <SettingRow
            label="Knowledge Categories"
            description="Which categories are included in RAG retrieval. At least one category must be selected."
            isDesktop={isDesktop}
          >
            <FormField
              control={form.control}
              name="categories"
              render={({ field }) => (
                <FormItem>
                  <div className="space-y-2">
                    {CATEGORY_OPTIONS.map((option) => {
                      const isChecked = field.value.includes(option.value);
                      return (
                        <label
                          key={option.value}
                          className="flex items-center gap-2.5 cursor-pointer"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const next = checked
                                ? [...field.value, option.value]
                                : field.value.filter((v: CategoryValue) => v !== option.value);
                              field.onChange(next);
                            }}
                            disabled={isSaving}
                            aria-label={option.label}
                          />
                          <span className="text-sm">{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingRow>

          {/* Auto-generated Article Retention */}
          <SettingRow
            label="Auto-generated Article Retention"
            description="How long unconfirmed AI-generated articles are kept before automatic cleanup."
            isDesktop={isDesktop}
          >
            <FormField
              control={form.control}
              name="retentionDays"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || '')}
                        min={30}
                        max={365}
                        step={1}
                        className="w-24 font-mono"
                        disabled={isSaving}
                        aria-label="Retention days"
                      />
                    </FormControl>
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                  <FormDescription className="text-xs">Range: 30–365 days</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingRow>

          {/* RAG Token Budget */}
          <SettingRow
            label="RAG Token Budget"
            description="Maximum tokens allocated for knowledge context in AI responses. Higher values provide more context but may slow responses."
            isDesktop={isDesktop}
          >
            <FormField
              control={form.control}
              name="ragTokenBudget"
              render={({ field }) => (
                <FormItem>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <FormControl>
                        <Slider
                          value={[field.value]}
                          onValueChange={([val]) => field.onChange(val)}
                          min={500}
                          max={2000}
                          step={100}
                          disabled={isSaving}
                          className="flex-1"
                          aria-label="RAG Token Budget"
                        />
                      </FormControl>
                      <span className="w-16 text-right font-mono text-sm tabular-nums">
                        {field.value}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>500</span>
                      <span>1000</span>
                      <span>1500</span>
                      <span>2000</span>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingRow>
        </form>
      </Form>

      {/* Navigation blocker confirmation dialog */}
      {blocker.status === 'blocked' && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) blocker.reset();
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-serif">Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved settings changes. Are you sure you want to leave?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => blocker.reset()}>Stay</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => blocker.proceed()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Discard & Leave
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
