import { useState, useCallback, useEffect, useRef } from 'react';
import { BookOpen, Check, Eye, Loader2, Save, Send, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  useCreateKnowledgeArticle,
  usePublishKnowledgeArticle,
} from '@/api/use-platform-knowledge';
import { useUpdateInsightStatus } from '@/api/use-intelligence';
import { cn } from '@/lib/utils';
import { usePlatformAuthStore } from '@/stores/auth-store';

import type { KnowledgeCategory } from '@/types/intelligence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KnowledgePrefill {
  title?: string;
  content?: string;
  category?: KnowledgeCategory;
  sourceInsightId?: string;
}

export interface PublishKnowledgePanelProps {
  isOpen: boolean;
  onClose: () => void;
  prefill?: KnowledgePrefill;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS: { value: KnowledgeCategory; label: string }[] = [
  { value: 'BEST_PRACTICE', label: 'Best Practice' },
  { value: 'HELP', label: 'Help' },
  { value: 'DEFAULT_CONFIG', label: 'Default Config' },
  { value: 'SKILL_UPDATE', label: 'Skill Update' },
];

const INDUSTRY_OPTIONS = [
  'Construction',
  'Retail',
  'Manufacturing',
  'Professional Services',
  'Other',
] as const;

const PLAN_TIER_OPTIONS = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const;

const MAX_TITLE_LENGTH = 500;

// ---------------------------------------------------------------------------
// Multi-Select Chips Component
// ---------------------------------------------------------------------------

function MultiSelectChips({
  label,
  id,
  options,
  selected,
  onChange,
}: {
  label: string;
  id: string;
  options: readonly string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const toggle = useCallback(
    (option: string) => {
      onChange(
        selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option],
      );
    },
    [selected, onChange],
  );

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-foreground">
        {label}
        <span className="ml-1 text-xs text-muted-foreground">(empty = all)</span>
      </legend>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={id}>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-primary/50',
                isSelected
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted/30',
              )}
              aria-pressed={isSelected}
            >
              {isSelected && <Check className="h-3 w-3" aria-hidden="true" />}
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Markdown Preview (simple)
// ---------------------------------------------------------------------------

/** Parse inline markdown markers (bold, inline code) into React nodes. */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Combined regex: inline code (`...`) or bold (**...**) — code takes priority
  const inlineRegex = /`([^`]+)`|\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let partIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      // Inline code
      parts.push(
        <code
          key={`c${partIdx++}`}
          className="rounded bg-muted px-1 py-0.5 text-xs font-mono text-foreground"
        >
          {match[1]}
        </code>,
      );
    } else if (match[2] !== undefined) {
      // Bold
      parts.push(<strong key={`b${partIdx++}`}>{match[2]}</strong>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

function MarkdownPreview({ content }: { content: string }) {
  if (!content.trim()) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Nothing to preview — enter content above
      </div>
    );
  }

  // Simple markdown rendering: headings, lists, code blocks, bold, inline code
  const lines = content.split('\n');
  const rendered: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Code block fences
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLines = [];
        codeBlockStart = i;
      } else {
        rendered.push(
          <pre
            key={`code-${codeBlockStart}`}
            className="my-2 overflow-x-auto rounded bg-muted p-3 text-xs font-mono text-foreground"
          >
            {codeBlockLines.join('\n')}
          </pre>,
        );
        inCodeBlock = false;
      }
      continue;
    }
    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      rendered.push(
        <h4 key={i} className="mt-3 mb-1 text-sm font-semibold text-foreground">
          {parseInlineMarkdown(line.slice(4))}
        </h4>,
      );
      continue;
    }
    if (line.startsWith('## ')) {
      rendered.push(
        <h3 key={i} className="mt-4 mb-1.5 text-base font-semibold text-foreground">
          {parseInlineMarkdown(line.slice(3))}
        </h3>,
      );
      continue;
    }
    if (line.startsWith('# ')) {
      rendered.push(
        <h2 key={i} className="mt-4 mb-2 text-lg font-bold text-foreground">
          {parseInlineMarkdown(line.slice(2))}
        </h2>,
      );
      continue;
    }

    // Unordered list items (- or *)
    const ulMatch = line.match(/^(\s*)[-*]\s+(.+)/);
    if (ulMatch) {
      rendered.push(
        <li key={i} className="ml-5 list-disc text-sm text-foreground leading-relaxed">
          {parseInlineMarkdown(ulMatch[2]!)}
        </li>,
      );
      continue;
    }

    // Ordered list items (1. 2. etc.)
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
    if (olMatch) {
      rendered.push(
        <li key={i} className="ml-5 list-decimal text-sm text-foreground leading-relaxed">
          {parseInlineMarkdown(olMatch[2]!)}
        </li>,
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      rendered.push(<br key={i} />);
      continue;
    }

    // Paragraph with inline formatting
    rendered.push(
      <p key={i} className="text-sm text-foreground leading-relaxed">
        {parseInlineMarkdown(line)}
      </p>,
    );
  }

  // Handle unterminated code block
  if (inCodeBlock && codeBlockLines.length > 0) {
    rendered.push(
      <pre
        key={`code-${codeBlockStart}`}
        className="my-2 overflow-x-auto rounded bg-muted p-3 text-xs font-mono text-foreground"
      >
        {codeBlockLines.join('\n')}
      </pre>,
    );
  }

  return <div className="space-y-0.5">{rendered}</div>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PublishKnowledgePanel({ isOpen, onClose, prefill }: PublishKnowledgePanelProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<KnowledgeCategory>('BEST_PRACTICE');
  const [targetIndustries, setTargetIndustries] = useState<string[]>([]);
  const [targetPlanTiers, setTargetPlanTiers] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // Validation
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});

  // Mutations
  const createArticle = useCreateKnowledgeArticle();
  const publishArticle = usePublishKnowledgeArticle();
  const updateInsightStatus = useUpdateInsightStatus();
  const user = usePlatformAuthStore((s) => s.user);

  // Ref for focus trap
  const panelRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Track previous isOpen to detect open transition
  const prevIsOpenRef = useRef(false);

  // ---- Pre-fill behaviour (9.2) + reset on close ----
  // Runs on every render where isOpen changes, handling both open (apply prefill)
  // and close (reset form). Using a ref avoids stale closure when the same prefill
  // reference is passed on re-open.
  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const justClosed = !isOpen && prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (justOpened) {
      setTitle(prefill?.title ?? '');
      setContent(prefill?.content ?? '');
      setCategory(prefill?.category ?? 'BEST_PRACTICE');
      setTargetIndustries([]);
      setTargetPlanTiers([]);
      setErrors({});
      setShowPreview(false);
    } else if (justClosed) {
      setTitle('');
      setContent('');
      setCategory('BEST_PRACTICE');
      setTargetIndustries([]);
      setTargetPlanTiers([]);
      setErrors({});
      setShowPreview(false);
    }
  }, [isOpen, prefill]);

  // Focus title input when panel opens
  useEffect(() => {
    if (isOpen) {
      // Delay to allow panel transition
      const timer = setTimeout(() => titleInputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Focus trap + Escape to close
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap: cycle Tab within the panel
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ---- Validation ----
  const validate = useCallback((): boolean => {
    const newErrors: { title?: string; content?: string } = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    else if (title.length > MAX_TITLE_LENGTH)
      newErrors.title = `Title must be ${MAX_TITLE_LENGTH} characters or fewer`;
    if (!content.trim()) newErrors.content = 'Content is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, content]);

  // ---- Success feedback (9.3) ----
  const handleSuccessToast = useCallback(
    (eligibleTenants: number | undefined, published: boolean) => {
      const tenantText = eligibleTenants != null ? ` — ${eligibleTenants} tenants eligible` : '';
      toast.success(
        published ? `Knowledge article published${tenantText}` : 'Knowledge article saved as draft',
      );
    },
    [],
  );

  const offerMarkInsightActioned = useCallback(
    (insightId: string) => {
      // Use a custom toast with an action button
      toast('Mark the source insight as actioned?', {
        action: {
          label: 'Mark Actioned',
          onClick: () => {
            updateInsightStatus.mutate({
              id: insightId,
              body: { status: 'ACTIONED', reviewedById: user?.id },
            });
          },
        },
        duration: 8000,
      });
    },
    [updateInsightStatus, user?.id],
  );

  // ---- Save as Draft ----
  const handleSaveAsDraft = useCallback(() => {
    if (!validate()) return;

    const body = {
      title: title.trim(),
      content: content.trim(),
      category,
      ...(targetIndustries.length > 0 ? { targetIndustries } : {}),
      ...(targetPlanTiers.length > 0 ? { targetPlanTiers } : {}),
    };

    createArticle.mutate(body, {
      onSuccess: () => {
        handleSuccessToast(undefined, false);
        onClose();

        if (prefill?.sourceInsightId) {
          offerMarkInsightActioned(prefill.sourceInsightId);
        }
      },
      onError: () => {
        toast.error('Failed to save knowledge article — please try again');
      },
    });
  }, [
    validate,
    title,
    content,
    category,
    targetIndustries,
    targetPlanTiers,
    createArticle,
    handleSuccessToast,
    onClose,
    prefill?.sourceInsightId,
    offerMarkInsightActioned,
  ]);

  // ---- Publish (create + publish in sequence) ----
  const handlePublish = useCallback(() => {
    if (!validate()) return;

    const body = {
      title: title.trim(),
      content: content.trim(),
      category,
      ...(targetIndustries.length > 0 ? { targetIndustries } : {}),
      ...(targetPlanTiers.length > 0 ? { targetPlanTiers } : {}),
    };

    createArticle.mutate(body, {
      onSuccess: (created) => {
        publishArticle.mutate(created.id, {
          onSuccess: (published) => {
            const eligible = published.distributionStats?.totalEligibleTenants;
            handleSuccessToast(eligible, true);
            onClose();

            if (prefill?.sourceInsightId) {
              offerMarkInsightActioned(prefill.sourceInsightId);
            }
          },
          onError: () => {
            toast.error(
              'Article created as draft but publish failed — you can publish later from Knowledge Management',
            );
          },
        });
      },
      onError: () => {
        toast.error('Failed to create knowledge article — please try again');
      },
    });
  }, [
    validate,
    title,
    content,
    category,
    targetIndustries,
    targetPlanTiers,
    createArticle,
    publishArticle,
    handleSuccessToast,
    onClose,
    prefill?.sourceInsightId,
    offerMarkInsightActioned,
  ]);

  const isBusy = createArticle.isPending || publishArticle.isPending;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Publish Knowledge Article"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col',
          'bg-card shadow-xl transition-transform duration-200',
          'animate-slide-in-right',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="heading-section text-lg font-semibold text-foreground">
              Publish Knowledge
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content — scrollable form area */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-5">
            {/* Title field */}
            <div>
              <label
                htmlFor="knowledge-title"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Title <span className="text-destructive">*</span>
              </label>
              <input
                ref={titleInputRef}
                id="knowledge-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                }}
                maxLength={MAX_TITLE_LENGTH}
                placeholder="Enter a descriptive title for this knowledge article"
                className={cn(
                  'w-full rounded-[var(--radius-button)] border bg-background px-3 py-2 text-sm',
                  'placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50',
                  errors.title ? 'border-destructive' : 'border-border',
                )}
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? 'title-error' : 'title-count'}
              />
              <div className="mt-1 flex items-center justify-between">
                {errors.title ? (
                  <p id="title-error" className="text-xs text-destructive" role="alert">
                    {errors.title}
                  </p>
                ) : (
                  <span />
                )}
                <span id="title-count" className="text-xs text-muted-foreground">
                  {title.length}/{MAX_TITLE_LENGTH}
                </span>
              </div>
            </div>

            {/* Content field */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="knowledge-content" className="text-sm font-medium text-foreground">
                  Content <span className="text-destructive">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPreview((p) => !p)}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50',
                    showPreview
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  {showPreview ? 'Edit' : 'Preview'}
                </button>
              </div>

              {showPreview ? (
                <div className="min-h-[200px] rounded-[var(--radius-button)] border border-border bg-muted/20 p-3">
                  <MarkdownPreview content={content} />
                </div>
              ) : (
                <>
                  <textarea
                    id="knowledge-content"
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value);
                      if (errors.content) setErrors((prev) => ({ ...prev, content: undefined }));
                    }}
                    rows={8}
                    placeholder="Write the article content (supports markdown)"
                    className={cn(
                      'w-full resize-y rounded-[var(--radius-button)] border bg-background px-3 py-2 text-sm font-mono',
                      'placeholder:text-muted-foreground',
                      'focus:outline-none focus:ring-2 focus:ring-primary/50',
                      errors.content ? 'border-destructive' : 'border-border',
                    )}
                    aria-invalid={!!errors.content}
                    aria-describedby={errors.content ? 'content-error' : undefined}
                  />
                  {errors.content && (
                    <p id="content-error" className="mt-1 text-xs text-destructive" role="alert">
                      {errors.content}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Category selector */}
            <div>
              <label
                htmlFor="knowledge-category"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Category
              </label>
              <select
                id="knowledge-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as KnowledgeCategory)}
                className={cn(
                  'w-full appearance-none rounded-[var(--radius-button)] border border-border bg-background',
                  'px-3 py-2 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50',
                )}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Industries */}
            <MultiSelectChips
              label="Target Industries"
              id="target-industries"
              options={INDUSTRY_OPTIONS}
              selected={targetIndustries}
              onChange={setTargetIndustries}
            />

            {/* Target Plan Tiers */}
            <MultiSelectChips
              label="Target Plan Tiers"
              id="target-plan-tiers"
              options={PLAN_TIER_OPTIONS}
              selected={targetPlanTiers}
              onChange={setTargetPlanTiers}
            />
          </div>
        </div>

        {/* Footer — action buttons */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={handleSaveAsDraft}
            disabled={isBusy}
            className={cn(
              'flex items-center gap-1.5 rounded-[var(--radius-button)] border border-border px-4 py-2 text-sm font-medium',
              'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {createArticle.isPending && !publishArticle.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            Save as Draft
          </button>

          <button
            type="button"
            onClick={handlePublish}
            disabled={isBusy}
            className={cn(
              'flex items-center gap-1.5 rounded-[var(--radius-button)] bg-primary px-4 py-2 text-sm font-medium text-white',
              'hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {publishArticle.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            Publish
          </button>
        </div>
      </div>
    </>
  );
}
