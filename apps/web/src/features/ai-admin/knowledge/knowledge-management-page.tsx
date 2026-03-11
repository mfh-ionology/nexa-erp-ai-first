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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/templates/page-header';
import { useBreakpoint } from '@/hooks/use-breakpoint';

import { KnowledgeStatsPanel } from './components/knowledge-stats-panel';
import { KnowledgeArticlesTab } from './knowledge-articles-tab';
import { TrainingExamplesTab } from './training-examples-tab';
import { CorrectionsTab } from './corrections-tab';
import { SuggestedTab } from './suggested-tab';
import { KnowledgeSettingsTab } from './knowledge-settings-tab';
import { ArticleUploadDialog } from './components/article-upload-dialog';
import { ArticleFormDialog } from './components/article-form-dialog';
import { TrainingExampleFormDialog } from './components/training-example-form-dialog';
import type { CorrectionLog, KnowledgeArticle, TrainingExample } from '../api/types';
import {
  useDeleteKnowledgeArticle,
  useUpdateKnowledgeArticle,
} from '../api/use-knowledge-articles';
import { useCreateArticleFromCorrection } from '../api/use-corrections';
import { useDeleteTrainingExample } from '../api/use-training-examples';

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
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticle | null>(null);
  const [deletingArticle, setDeletingArticle] = useState<KnowledgeArticle | null>(null);

  const deleteArticle = useDeleteKnowledgeArticle();
  const updateArticle = useUpdateKnowledgeArticle();

  // ── Dialog state for training examples tab ──
  const [exampleDialogOpen, setExampleDialogOpen] = useState(false);
  const [editingExample, setEditingExample] = useState<TrainingExample | null>(null);
  const [deletingExample, setDeletingExample] = useState<TrainingExample | null>(null);

  const deleteExample = useDeleteTrainingExample();
  const createArticleFromCorrection = useCreateArticleFromCorrection();

  const handleUploadDocument = useCallback(() => setUploadDialogOpen(true), []);
  const handleCreateArticle = useCallback(() => {
    setEditingArticle(null);
    setArticleDialogOpen(true);
  }, []);
  const handleEditArticle = useCallback((article: KnowledgeArticle) => {
    setEditingArticle(article);
    setArticleDialogOpen(true);
  }, []);
  const handleDeleteArticle = useCallback((article: KnowledgeArticle) => {
    setDeletingArticle(article);
  }, []);

  // ── Create article from correction (AC-6: uses dedicated endpoint) ──
  const handleCreateArticleFromCorrection = useCallback(
    (correction: CorrectionLog) => {
      createArticleFromCorrection.mutate(correction.id);
    },
    [createArticleFromCorrection],
  );

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

      {/* ── Tabs / Dropdown ─────────────────────── */}
      {breakpoint === 'phone' ? (
        /* Phone: Dropdown selector layout (AC-11) */
        <div className="space-y-4">
          <Select value={activeTab} onValueChange={handleTabChange}>
            <SelectTrigger className="w-full" aria-label="Knowledge Management section">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAB_CONFIG.map((tab) => {
                const Icon = tab.icon;
                return (
                  <SelectItem key={tab.value} value={tab.value}>
                    <span className="flex items-center gap-1.5">
                      <Icon className="size-4" />
                      {tab.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <div role="tabpanel">
            {activeTab === 'articles' && (
              <KnowledgeArticlesTab
                onUploadDocument={handleUploadDocument}
                onCreateArticle={handleCreateArticle}
                onEditArticle={handleEditArticle}
                onDeleteArticle={handleDeleteArticle}
                filterPendingReviews={pendingReviewsFilter}
                onClearPendingReviewsFilter={() => setPendingReviewsFilter(false)}
              />
            )}
            {activeTab === 'training' && (
              <TrainingExamplesTab
                onAddExample={handleAddExample}
                onEditExample={handleEditExample}
                onDeleteExample={handleDeleteExample}
              />
            )}
            {activeTab === 'corrections' && (
              <CorrectionsTab onCreateArticleFromCorrection={handleCreateArticleFromCorrection} />
            )}
            {activeTab === 'suggested' && <SuggestedTab />}
            {activeTab === 'settings' && (
              <KnowledgeSettingsTab onDirtyChange={handleSettingsDirtyChange} />
            )}
          </div>
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
          }
        }}
        mode={editingArticle ? 'edit' : 'create'}
        article={editingArticle}
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
