/* eslint-disable i18next/no-literal-string */
/**
 * Suggested Knowledge Tab — platform-suggested articles with accept/reject/edit flows.
 *
 * AC-7: Platform-suggested articles displayed as cards with Accept, Reject,
 * and Edit & Accept actions. Cards transition out on accept/reject.
 * Graceful degradation when platform is not configured or list is empty.
 * Concept D: 12px radius, custom shadow, purple-tinted hover shadow.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { Check, ChevronDown, Edit, Info, Loader2, Save, Sparkles, X } from 'lucide-react';
import { format } from 'date-fns';

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
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/lib/form-utils';
import { useZodForm } from '@/lib/form-utils';
import { cn } from '@/lib/utils';

import type { KnowledgeCategory, SuggestedKnowledgeArticle } from '../api/types';
import {
  useSuggestedKnowledge,
  useAcceptSuggestion,
  useRejectSuggestion,
  useAcceptEditedSuggestion,
} from '../api/use-suggested-knowledge';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Platform taxonomy → badge styling. */
const PLATFORM_CATEGORY_CONFIG: Record<string, { label: string; className: string }> = {
  BEST_PRACTICE: { label: 'Best Practice', className: 'bg-blue-50 text-blue-700' },
  HELP: { label: 'Help', className: 'bg-teal-50 text-teal-700' },
  DEFAULT_CONFIG: { label: 'Default Config', className: 'bg-[#7c3aed]/10 text-[#7c3aed]' },
  SKILL_UPDATE: { label: 'Skill Update', className: 'bg-amber-50 text-amber-700' },
};

/** Fallback for unknown platform categories. */
function getPlatformCategoryConfig(category: string) {
  return (
    PLATFORM_CATEGORY_CONFIG[category] ?? {
      label: category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      className: 'bg-muted text-muted-foreground',
    }
  );
}

/** Tenant category options for Edit & Accept remapping. */
const TENANT_CATEGORY_OPTIONS: { value: KnowledgeCategory; label: string }[] = [
  { value: 'BUSINESS_PROCESS', label: 'Business Processes' },
  { value: 'TERMINOLOGY', label: 'Terminology' },
  { value: 'INDUSTRY_RULES', label: 'Industry Rules' },
  { value: 'CUSTOM_FIELDS', label: 'Custom Fields' },
  { value: 'HISTORICAL_PATTERN', label: 'Historical Patterns' },
];

/** Auto-map platform categories to the closest tenant category. */
const PLATFORM_TO_TENANT_CATEGORY: Record<string, KnowledgeCategory> = {
  BEST_PRACTICE: 'BUSINESS_PROCESS',
  HELP: 'TERMINOLOGY',
  DEFAULT_CONFIG: 'CUSTOM_FIELDS',
  SKILL_UPDATE: 'BUSINESS_PROCESS',
};

// ─── Edit & Accept schema ───────────────────────────────────────────────────

const editAcceptSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must be 500 characters or fewer'),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(100_000, 'Content must be 100,000 characters or fewer'),
  category: z.enum(
    ['BUSINESS_PROCESS', 'TERMINOLOGY', 'INDUSTRY_RULES', 'CUSTOM_FIELDS', 'HISTORICAL_PATTERN'],
    { message: 'Category is required' },
  ),
});

type EditAcceptFormValues = z.infer<typeof editAcceptSchema>;

// ─── Suggestion Card ────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
  onEditAccept,
  isAccepting,
  isRejecting,
  isSliding,
  animationIndex,
}: {
  suggestion: SuggestedKnowledgeArticle;
  onAccept: (id: string) => void;
  onReject: (suggestion: SuggestedKnowledgeArticle) => void;
  onEditAccept: (suggestion: SuggestedKnowledgeArticle) => void;
  isAccepting: boolean;
  isRejecting: boolean;
  isSliding: boolean;
  animationIndex: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const catConfig = getPlatformCategoryConfig(suggestion.category);
  const contentPreview = suggestion.content.slice(0, 200);
  const hasMore = suggestion.content.length > 200;

  return (
    <Card
      className={cn(
        'rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]',
        isSliding ? 'animate-slide-out-right opacity-0' : 'animate-fade-in-up',
      )}
      style={
        !isSliding && animationIndex <= 8
          ? { animationDelay: `${animationIndex * 50}ms` }
          : undefined
      }
    >
      <CardContent className="space-y-3 p-4">
        {/* Row 1: Title */}
        <h3 className="line-clamp-2 text-sm font-semibold font-serif leading-snug">
          {suggestion.title}
        </h3>

        {/* Row 2: Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className={cn('border-0 text-xs', catConfig.className)}>
            {catConfig.label}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">v{suggestion.version}</span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(suggestion.publishedAt), 'MMM d, yyyy')}
          </span>
        </div>

        {/* Previous response banner */}
        {suggestion.previousResponse && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <Info className="size-3.5 shrink-0 text-amber-600" />
            <span className="text-xs text-amber-700">
              Previously {suggestion.previousResponse.status.toLowerCase()} v
              {suggestion.previousResponse.articleVersion}
            </span>
          </div>
        )}

        {/* Content preview */}
        <div className="text-sm leading-relaxed text-muted-foreground">
          {expanded ? suggestion.content : contentPreview}
          {!expanded && hasMore && '…'}
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="ml-1 text-xs font-medium text-[#7c3aed] hover:text-[#5b21b6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed] focus-visible:ring-offset-2"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            className="gap-1.5 bg-[#7c3aed] hover:bg-[#5b21b6]"
            onClick={() => onAccept(suggestion.id)}
            disabled={isAccepting || isRejecting}
          >
            {isAccepting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Accept
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onEditAccept(suggestion)}
            disabled={isAccepting || isRejecting}
          >
            <Edit className="size-3.5" />
            Edit & Accept
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-[#dc2626]/30 text-[#dc2626] hover:bg-[#dc2626]/5 hover:text-[#b91c1c]"
            onClick={() => onReject(suggestion)}
            disabled={isAccepting || isRejecting}
          >
            {isRejecting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <X className="size-3.5" />
            )}
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Edit & Accept Dialog ───────────────────────────────────────────────────

function EditAcceptDialog({
  open,
  onOpenChange,
  suggestion,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: SuggestedKnowledgeArticle | null;
  onSubmit: (platformArticleId: string, data: EditAcceptFormValues) => void;
  isPending: boolean;
}) {
  const defaultValues = useMemo<EditAcceptFormValues>(
    () => ({
      title: suggestion?.title ?? '',
      content: suggestion?.content ?? '',
      category: (suggestion
        ? PLATFORM_TO_TENANT_CATEGORY[suggestion.category]
        : undefined) as unknown as KnowledgeCategory,
    }),
    [suggestion],
  );

  const form = useZodForm<EditAcceptFormValues>({
    schema: editAcceptSchema,
    defaultValues,
  });

  useEffect(() => {
    if (open && suggestion) {
      form.reset({
        title: suggestion.title,
        content: suggestion.content,
        category: (PLATFORM_TO_TENANT_CATEGORY[suggestion.category] ??
          undefined) as unknown as KnowledgeCategory,
      });
    }
  }, [open, suggestion, form]);

  const handleSubmit = useCallback(
    (values: EditAcceptFormValues) => {
      if (!suggestion) return;
      onSubmit(suggestion.id, values);
    },
    [suggestion, onSubmit],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="animate-step-in rounded-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">Edit & Accept Suggestion</DialogTitle>
          <DialogDescription>
            Modify the suggestion before adding it to your knowledge base.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                      placeholder="Article content"
                      className="min-h-[160px] resize-y"
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category (remap to tenant taxonomy) */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Map to tenant category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TENANT_CATEGORY_OPTIONS.map((opt) => (
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
                onClick={() => onOpenChange(false)}
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
                    Accepting…
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    Accept with Edits
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

// ─── Main Tab Component ────────────────────────────────────────────────────

export function SuggestedTab() {
  // ── Data query ──
  const {
    data: suggestedData,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    error,
  } = useSuggestedKnowledge();

  const suggestions = suggestedData?.data ?? [];

  // ── Accept mutation ──
  const acceptMutation = useAcceptSuggestion();

  // ── Reject mutation ──
  const rejectMutation = useRejectSuggestion();

  // ── Edit & Accept mutation ──
  const editAcceptMutation = useAcceptEditedSuggestion();

  // ── Slide-out animation tracking ──
  const [slidingIds, setSlidingIds] = useState<Set<string>>(new Set());

  const triggerSlideOut = useCallback((id: string, action: () => void) => {
    setSlidingIds((prev) => new Set(prev).add(id));
    // Allow slide-out animation to play before mutation removes from list
    setTimeout(() => {
      action();
      setSlidingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
  }, []);

  // ── Accept flow ──
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const handleAccept = useCallback(
    (platformArticleId: string) => {
      setAcceptingId(platformArticleId);
      triggerSlideOut(platformArticleId, () => {
        acceptMutation.mutate(platformArticleId, {
          onSettled: () => setAcceptingId(null),
        });
      });
    },
    [acceptMutation, triggerSlideOut],
  );

  // ── Reject flow ──
  const [rejectingSuggestion, setRejectingSuggestion] = useState<SuggestedKnowledgeArticle | null>(
    null,
  );
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const handleRejectConfirm = useCallback(() => {
    if (!rejectingSuggestion) return;
    const id = rejectingSuggestion.id;
    setRejectingSuggestion(null);
    setRejectingId(id);

    triggerSlideOut(id, () => {
      rejectMutation.mutate(id, {
        onSettled: () => setRejectingId(null),
      });
    });
  }, [rejectingSuggestion, rejectMutation, triggerSlideOut]);

  // ── Edit & Accept flow ──
  const [editingSuggestion, setEditingSuggestion] = useState<SuggestedKnowledgeArticle | null>(
    null,
  );

  const handleEditAcceptSubmit = useCallback(
    (platformArticleId: string, data: EditAcceptFormValues) => {
      triggerSlideOut(platformArticleId, () => {
        editAcceptMutation.mutate(
          { platformArticleId, data },
          {
            onSuccess: () => setEditingSuggestion(null),
          },
        );
      });
    },
    [editAcceptMutation, triggerSlideOut],
  );

  // ── Platform not configured detection ──
  // If the API returns a specific error or the data indicates no platform config,
  // show the "not available" state. We treat a 404/specific error as "not configured".
  const isPlatformNotConfigured =
    !!error &&
    (('status' in error && (error as { status: number }).status === 404) ||
      error.message?.includes('not configured'));

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  // ── Platform not configured state ──
  if (isPlatformNotConfigured) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-blue-50">
          <Info className="size-6 text-blue-600" />
        </div>
        <p className="text-sm font-medium">Platform suggestions are not available</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Contact your administrator to enable platform integration.
        </p>
      </div>
    );
  }

  // ── Empty state ──
  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-green-50">
          <Sparkles className="size-6 text-green-600" />
        </div>
        <p className="text-sm font-medium">You're all caught up</p>
        <p className="mt-1 text-xs text-muted-foreground">No new suggestions from the vendor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Suggestion cards */}
      {suggestions.map((suggestion, idx) => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          onAccept={handleAccept}
          onReject={setRejectingSuggestion}
          onEditAccept={setEditingSuggestion}
          isAccepting={acceptingId === suggestion.id}
          isRejecting={rejectingId === suggestion.id}
          isSliding={slidingIds.has(suggestion.id)}
          animationIndex={idx + 1}
        />
      ))}

      {/* Load more */}
      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="gap-1.5"
          >
            <ChevronDown className="size-4" />
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      {/* ── Reject Confirmation Dialog ──── */}
      <AlertDialog
        open={!!rejectingSuggestion}
        onOpenChange={(open) => {
          if (!open) setRejectingSuggestion(null);
        }}
      >
        <AlertDialogContent className="animate-step-in rounded-xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Reject Suggestion?</AlertDialogTitle>
            <AlertDialogDescription>
              Reject this suggestion? You can still see new versions if the vendor updates it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#dc2626] hover:bg-[#b91c1c]"
              onClick={handleRejectConfirm}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Edit & Accept Dialog ──── */}
      <EditAcceptDialog
        open={!!editingSuggestion}
        onOpenChange={(open) => {
          if (!open) setEditingSuggestion(null);
        }}
        suggestion={editingSuggestion}
        onSubmit={handleEditAcceptSubmit}
        isPending={editAcceptMutation.isPending}
      />
    </div>
  );
}
