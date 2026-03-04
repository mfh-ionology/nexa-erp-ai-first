/* eslint-disable i18next/no-literal-string */
/**
 * Knowledge Management Page — AI Knowledge Base admin interface.
 *
 * AC-1: Page shell with 5 tabs (Knowledge Articles, Training Examples,
 * Corrections, Suggested, Settings), persistent stats panel above tabs,
 * hash-based deep-linking, Concept D styling.
 */

import { useCallback, useMemo, useState, useRef } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import {
  BookOpen,
  ChevronDown,
  GraduationCap,
  GitCompareArrows,
  Lightbulb,
  Loader2,
  Settings,
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
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/templates/page-header';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';

import { KnowledgeStatsPanel } from './components/knowledge-stats-panel';
import { KnowledgeArticlesTab } from './knowledge-articles-tab';
import { TrainingExamplesTab } from './training-examples-tab';
import { CorrectionsTab } from './corrections-tab';
import { SuggestedTab } from './suggested-tab';
import { KnowledgeSettingsTab } from './knowledge-settings-tab';
import { ArticleUploadDialog } from './components/article-upload-dialog';
import { ArticleFormDialog } from './components/article-form-dialog';
import { TrainingExampleFormDialog } from './components/training-example-form-dialog';
import type {
  CorrectionLog,
  CorrectionType,
  KnowledgeArticle,
  KnowledgeCategory,
  TrainingExample,
} from '../api/types';
import {
  useDeleteKnowledgeArticle,
  useUpdateKnowledgeArticle,
} from '../api/use-knowledge-articles';
import { useDeleteTrainingExample } from '../api/use-training-examples';

// ─── Correction → Article category mapping (AC-6) ──────────────────────────

const CORRECTION_TO_ARTICLE_CATEGORY: Record<CorrectionType, KnowledgeCategory> = {
  TERMINOLOGY: 'TERMINOLOGY',
  PROCESS: 'BUSINESS_PROCESS',
  DATA: 'CUSTOM_FIELDS',
  PREFERENCE: 'BUSINESS_PROCESS',
  OTHER: 'BUSINESS_PROCESS',
};

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TAB_CONFIG = [
  { value: 'articles', label: 'Knowledge Articles', icon: BookOpen },
  { value: 'training', label: 'Training Examples', icon: GraduationCap },
  { value: 'corrections', label: 'Corrections', icon: GitCompareArrows },
  { value: 'suggested', label: 'Suggested', icon: Lightbulb },
  { value: 'settings', label: 'Settings', icon: Settings },
] as const;

type TabValue = (typeof TAB_CONFIG)[number]['value'];

const DEFAULT_TAB: TabValue = 'articles';

function parseTabFromHash(hash: string): TabValue {
  const cleaned = hash.replace('#', '');
  const found = TAB_CONFIG.find((t) => t.value === cleaned);
  return found ? found.value : DEFAULT_TAB;
}

// ─── Main page component ──────────────────────────────────────────────────────

export function KnowledgeManagementPage() {
  const navigate = useNavigate();
  const hash = useRouterState({ select: (s) => s.location.hash });
  const breakpoint = useBreakpoint();

  const activeTab = useMemo(() => parseTabFromHash(hash), [hash]);

  // Phone accordion state — track which panels are open
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>(() => ({
    [activeTab]: true,
  }));
  const toggleAccordion = useCallback(
    (key: string) => {
      if (activeTab === 'settings' && settingsDirtyRef.current && key !== 'settings') {
        const confirmed = window.confirm('You have unsaved settings changes. Discard them?');
        if (!confirmed) return;
      }
      setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
      void navigate({ hash: key === DEFAULT_TAB ? '' : key, replace: true });
    },
    [navigate, activeTab],
  );

  // ── Settings dirty state tracking ──
  const settingsDirtyRef = useRef(false);
  const handleSettingsDirtyChange = useCallback((isDirty: boolean) => {
    settingsDirtyRef.current = isDirty;
  }, []);

  const handleTabChange = useCallback(
    (value: string) => {
      if (activeTab === 'settings' && settingsDirtyRef.current) {
        const confirmed = window.confirm('You have unsaved settings changes. Discard them?');
        if (!confirmed) return;
      }
      void navigate({
        hash: value === DEFAULT_TAB ? '' : value,
        replace: true,
      });
    },
    [navigate, activeTab],
  );

  // ── Pending reviews filter (AC-9: stats card navigates to filtered articles) ──
  const [pendingReviewsFilter, setPendingReviewsFilter] = useState(false);

  const handleNavigateToPendingReviews = useCallback(() => {
    setPendingReviewsFilter(true);
    void navigate({ hash: 'articles', replace: true });
  }, [navigate]);

  // ── Dialog state for articles tab ──
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [articleDialogOpen, setArticleDialogOpen] = useState(false);
  const [articleDialogPrefill, setArticleDialogPrefill] = useState<
    | {
        title?: string;
        content?: string;
        category?: KnowledgeCategory;
      }
    | undefined
  >(undefined);
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticle | null>(null);
  const [deletingArticle, setDeletingArticle] = useState<KnowledgeArticle | null>(null);

  const deleteArticle = useDeleteKnowledgeArticle();
  const updateArticle = useUpdateKnowledgeArticle();

  // ── Dialog state for training examples tab ──
  const [exampleDialogOpen, setExampleDialogOpen] = useState(false);
  const [editingExample, setEditingExample] = useState<TrainingExample | null>(null);
  const [deletingExample, setDeletingExample] = useState<TrainingExample | null>(null);

  const deleteExample = useDeleteTrainingExample();

  const handleUploadDocument = useCallback(() => setUploadDialogOpen(true), []);
  const handleCreateArticle = useCallback(() => {
    setEditingArticle(null);
    setArticleDialogPrefill(undefined);
    setArticleDialogOpen(true);
  }, []);
  const handleEditArticle = useCallback((article: KnowledgeArticle) => {
    setEditingArticle(article);
    setArticleDialogPrefill(undefined);
    setArticleDialogOpen(true);
  }, []);
  const handleDeleteArticle = useCallback((article: KnowledgeArticle) => {
    setDeletingArticle(article);
  }, []);

  // ── Create article from correction (AC-6: opens pre-filled dialog) ──
  const handleCreateArticleFromCorrection = useCallback((correction: CorrectionLog) => {
    setEditingArticle(null);
    setArticleDialogPrefill({
      title: `From correction: ${correction.correctedResponse.slice(0, 80)}`,
      content: correction.correctedResponse,
      category: CORRECTION_TO_ARTICLE_CATEGORY[correction.correctionType],
    });
    setArticleDialogOpen(true);
  }, []);

  const handleAddExample = useCallback(() => {
    setEditingExample(null);
    setExampleDialogOpen(true);
  }, []);
  const handleEditExample = useCallback((example: TrainingExample) => {
    setEditingExample(example);
    setExampleDialogOpen(true);
  }, []);
  const handleDeleteExample = useCallback((example: TrainingExample) => {
    setDeletingExample(example);
  }, []);

  const handleConfirmDeleteExample = useCallback(() => {
    if (!deletingExample) return;
    const exampleToDelete = deletingExample;
    setDeletingExample(null);

    deleteExample.mutate(exampleToDelete.id, {
      onSuccess: () => {
        toast.success('Training example deleted');
      },
      onError: (error: Error) => {
        toast.error(error.message || 'Failed to delete training example');
      },
    });
  }, [deletingExample, deleteExample]);

  const handleConfirmDelete = useCallback(() => {
    if (!deletingArticle) return;
    const articleToDelete = deletingArticle;
    setDeletingArticle(null);

    deleteArticle.mutate(articleToDelete.id, {
      onSuccess: () => {
        // Show undo toast with 5-second window
        toast.success(`"${articleToDelete.title}" deactivated`, {
          action: {
            label: 'Undo',
            onClick: () => {
              updateArticle.mutate(
                { id: articleToDelete.id, data: { isActive: true } },
                {
                  onSuccess: () => toast.success('Article reactivated'),
                },
              );
            },
          },
          duration: 5000,
        });
      },
      onError: (error: Error) => {
        toast.error(error.message || 'Failed to deactivate article');
      },
    });
  }, [deletingArticle, deleteArticle, updateArticle]);

  const breadcrumbs = useMemo(
    () => [{ label: 'AI Administration', path: '/ai/admin' }, { label: 'Knowledge Management' }],
    [],
  );

  return (
    <div className="animate-fade-in-up mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader title="Knowledge Management" breadcrumbs={breadcrumbs} />

      {/* ── Stats panel (persistent above tabs) ──── */}
      <KnowledgeStatsPanel onNavigateToPendingReviews={handleNavigateToPendingReviews} />

      {/* ── Tabs / Accordion ─────────────────────── */}
      {breakpoint === 'phone' ? (
        /* Phone: Collapsible accordion layout */
        <div className="space-y-2" role="tablist" aria-label="Knowledge Management">
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon;
            return (
              <Collapsible
                key={tab.value}
                open={openAccordions[tab.value] ?? false}
                onOpenChange={() => toggleAccordion(tab.value)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      'w-full justify-between text-left font-medium',
                      openAccordions[tab.value] && 'bg-muted/50',
                    )}
                    role="tab"
                    aria-selected={openAccordions[tab.value] ?? false}
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon className="size-4" />
                      {tab.label}
                    </span>
                    <ChevronDown
                      className={cn(
                        'size-4 transition-transform duration-200',
                        openAccordions[tab.value] && 'rotate-180',
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div role="tabpanel" className="px-1 pt-3 pb-4">
                    {tab.value === 'articles' && (
                      <KnowledgeArticlesTab
                        onUploadDocument={handleUploadDocument}
                        onCreateArticle={handleCreateArticle}
                        onEditArticle={handleEditArticle}
                        onDeleteArticle={handleDeleteArticle}
                        filterPendingReviews={pendingReviewsFilter}
                        onClearPendingReviewsFilter={() => setPendingReviewsFilter(false)}
                      />
                    )}
                    {tab.value === 'training' && (
                      <TrainingExamplesTab
                        onAddExample={handleAddExample}
                        onEditExample={handleEditExample}
                        onDeleteExample={handleDeleteExample}
                      />
                    )}
                    {tab.value === 'corrections' && (
                      <CorrectionsTab
                        onCreateArticleFromCorrection={handleCreateArticleFromCorrection}
                      />
                    )}
                    {tab.value === 'suggested' && <SuggestedTab />}
                    {tab.value === 'settings' && (
                      <KnowledgeSettingsTab onDirtyChange={handleSettingsDirtyChange} />
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      ) : (
        /* Desktop/Tablet: Standard tabs */
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="w-full justify-start overflow-x-auto">
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                  <Icon className="size-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="articles" className="mt-4">
            <KnowledgeArticlesTab
              onUploadDocument={handleUploadDocument}
              onCreateArticle={handleCreateArticle}
              onEditArticle={handleEditArticle}
              onDeleteArticle={handleDeleteArticle}
              filterPendingReviews={pendingReviewsFilter}
              onClearPendingReviewsFilter={() => setPendingReviewsFilter(false)}
            />
          </TabsContent>

          <TabsContent value="training" className="mt-4">
            <TrainingExamplesTab
              onAddExample={handleAddExample}
              onEditExample={handleEditExample}
              onDeleteExample={handleDeleteExample}
            />
          </TabsContent>

          <TabsContent value="corrections" className="mt-4">
            <CorrectionsTab onCreateArticleFromCorrection={handleCreateArticleFromCorrection} />
          </TabsContent>

          <TabsContent value="suggested" className="mt-4">
            <SuggestedTab />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <KnowledgeSettingsTab onDirtyChange={handleSettingsDirtyChange} />
          </TabsContent>
        </Tabs>
      )}

      {/* ── Upload Dialog ──── */}
      <ArticleUploadDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} />

      {/* ── Create / Edit Article Dialog ──── */}
      <ArticleFormDialog
        open={articleDialogOpen}
        onOpenChange={(open) => {
          setArticleDialogOpen(open);
          if (!open) {
            setEditingArticle(null);
            setArticleDialogPrefill(undefined);
          }
        }}
        mode={editingArticle ? 'edit' : 'create'}
        article={editingArticle}
        prefill={articleDialogPrefill}
      />

      {/* ── Delete Confirmation Dialog (AC-4) ──── */}
      <AlertDialog
        open={!!deletingArticle}
        onOpenChange={(open) => {
          if (!open) setDeletingArticle(null);
        }}
      >
        <AlertDialogContent className="animate-step-in rounded-xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">
              Deactivate Knowledge Article?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the article. It will no longer be used for AI responses.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#dc2626] hover:bg-[#b91c1c]"
              onClick={handleConfirmDelete}
              disabled={deleteArticle.isPending}
            >
              {deleteArticle.isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Deactivating…
                </>
              ) : (
                'Deactivate'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Training Example Create / Edit Dialog (AC-5) ──── */}
      <TrainingExampleFormDialog
        open={exampleDialogOpen}
        onOpenChange={(open) => {
          setExampleDialogOpen(open);
          if (!open) setEditingExample(null);
        }}
        mode={editingExample ? 'edit' : 'create'}
        example={editingExample}
      />

      {/* ── Training Example Delete Confirmation (AC-5) ──── */}
      <AlertDialog
        open={!!deletingExample}
        onOpenChange={(open) => {
          if (!open) setDeletingExample(null);
        }}
      >
        <AlertDialogContent className="animate-step-in rounded-xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Delete Training Example?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the training example. The AI will no longer use it as a reference for
              responses.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#dc2626] hover:bg-[#b91c1c]"
              onClick={handleConfirmDeleteExample}
              disabled={deleteExample.isPending}
            >
              {deleteExample.isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
