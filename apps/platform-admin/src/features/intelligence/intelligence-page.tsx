// ---------------------------------------------------------------------------
// Intelligence Dashboard — Page Composition
// Story E5d-6 Task 10 (AC#10, #11)
// Composes all intelligence sections into a single scrollable dashboard
// with Concept D visual design, responsive layout, and accessibility.
// ---------------------------------------------------------------------------

import { Component, useState, useCallback } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { BookPlus } from 'lucide-react';

import { useIntelligenceSummary } from '@/api/use-intelligence';
import { cn } from '@/lib/utils';

import { SummaryPanel } from './components/summary-panel';
import { DataControls } from './components/data-controls';
import { FeatureGapsSection } from './components/feature-gaps-section';
import { WorkflowOpportunitiesSection } from './components/workflow-opportunities-section';
import { DefaultOptimisationSection } from './components/default-optimisation-section';
import { SkillEffectivenessTable } from './components/skill-effectiveness-table';
import { IndustryBreakdownSection } from './components/industry-breakdown-section';
import { CorrectionPatternsSection } from './components/correction-patterns-section';
import { PublishKnowledgePanel } from './components/publish-knowledge-panel';

import type { KnowledgePrefill } from './components/publish-knowledge-panel';
import type { CorrectionPrefill } from './components/correction-patterns-section';
import type { PlatformInsight } from '@/types/intelligence';

// ---------------------------------------------------------------------------
// Mobile Accordion Wrapper
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn('md:contents', className)}>
      {/* Mobile-only toggle */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg bg-card px-4 py-3 text-left text-sm font-semibold text-foreground shadow-[var(--shadow-card)] md:hidden"
        aria-expanded={isOpen}
      >
        {title}
        <span
          className={cn('inline-block transition-transform', isOpen && 'rotate-180')}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {/* Desktop: always visible. Mobile: collapsible. */}
      <div className={cn('md:block', isOpen ? 'block' : 'hidden')}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-Section Error Boundary (AC#11)
// ---------------------------------------------------------------------------

interface SectionErrorBoundaryProps {
  sectionName: string;
  children: ReactNode;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
}

class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): SectionErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[SectionErrorBoundary] ${this.props.sectionName}:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)]"
          role="alert"
        >
          <p className="text-sm font-medium text-destructive">
            Failed to load {this.props.sectionName}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 text-xs font-medium text-primary hover:text-[var(--primary-dark)]"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Intelligence Page
// ---------------------------------------------------------------------------

export function IntelligencePage() {
  const { data: summary } = useIntelligenceSummary();

  // Publish Knowledge panel state
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishPrefill, setPublishPrefill] = useState<KnowledgePrefill | undefined>();

  // Skill filter for corrections section (linked from skill effectiveness table)
  const [correctionSkillFilter, setCorrectionSkillFilter] = useState<string | undefined>();

  // Open publish panel with optional prefill
  const openPublishPanel = useCallback((prefill?: KnowledgePrefill) => {
    setPublishPrefill(prefill);
    setPublishOpen(true);
  }, []);

  const closePublishPanel = useCallback(() => {
    setPublishOpen(false);
    setPublishPrefill(undefined);
  }, []);

  // Handle "Create Automation Suggestion" from workflow opportunities
  const handleCreateAutomationSuggestion = useCallback(
    (insight: PlatformInsight) => {
      openPublishPanel({
        title: insight.title,
        content: insight.description ?? '',
        category: 'DEFAULT_CONFIG',
        sourceInsightId: insight.id,
      });
    },
    [openPublishPanel],
  );

  // Handle "Create Knowledge Article" from correction patterns
  const handleCreateKnowledgeFromCorrection = useCallback(
    (prefill: CorrectionPrefill) => {
      openPublishPanel({
        title: prefill.title,
        content: prefill.content,
        category: prefill.category,
        sourceInsightId: prefill.sourceInsightId,
      });
    },
    [openPublishPanel],
  );

  // Handle skill filter from skill effectiveness table
  const handleFilterBySkill = useCallback((skillKey: string) => {
    setCorrectionSkillFilter(skillKey);
    // Scroll to correction patterns section
    const el = document.getElementById('correction-patterns-section');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* ----------------------------------------------------------------- */}
      {/* Page Header                                                       */}
      {/* ----------------------------------------------------------------- */}
      <header className="mb-6 animate-fade-in-up">
        <p className="text-sm text-muted-foreground">Platform Admin &gt; AI Intelligence</p>
        <h1 className="page-title text-foreground">AI Intelligence</h1>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* Data Controls (last aggregated, refresh buttons)                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6 animate-fade-in-up delay-1">
        <DataControls lastAggregatedAt={summary?.lastAggregatedAt} />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Summary KPI Panel                                                 */}
      {/* ----------------------------------------------------------------- */}
      <section className="mb-6" aria-label="Summary KPIs">
        <SectionErrorBoundary sectionName="Summary KPIs">
          <SummaryPanel />
        </SectionErrorBoundary>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Two-column grid for paired insight sections (desktop only)         */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CollapsibleSection title="Feature Gaps" defaultOpen>
          <SectionErrorBoundary sectionName="Feature Gaps">
            <FeatureGapsSection />
          </SectionErrorBoundary>
        </CollapsibleSection>

        <CollapsibleSection title="Workflow Opportunities">
          <SectionErrorBoundary sectionName="Workflow Opportunities">
            <WorkflowOpportunitiesSection
              onCreateAutomationSuggestion={handleCreateAutomationSuggestion}
            />
          </SectionErrorBoundary>
        </CollapsibleSection>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Default Optimisation — full width                                  */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6">
        <CollapsibleSection title="Default Optimisation">
          <SectionErrorBoundary sectionName="Default Optimisation">
            <DefaultOptimisationSection />
          </SectionErrorBoundary>
        </CollapsibleSection>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Skill Effectiveness Table — full width                             */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6">
        <CollapsibleSection title="Skill Effectiveness">
          <SectionErrorBoundary sectionName="Skill Effectiveness">
            <SkillEffectivenessTable onFilterBySkill={handleFilterBySkill} />
          </SectionErrorBoundary>
        </CollapsibleSection>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Two-column grid for Industry + Corrections (desktop)               */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CollapsibleSection title="Industry Breakdown">
          <SectionErrorBoundary sectionName="Industry Breakdown">
            <IndustryBreakdownSection />
          </SectionErrorBoundary>
        </CollapsibleSection>

        <div id="correction-patterns-section">
          <CollapsibleSection title="Correction Patterns">
            <SectionErrorBoundary sectionName="Correction Patterns">
              <CorrectionPatternsSection
                onCreateKnowledgeArticle={handleCreateKnowledgeFromCorrection}
                externalSkillFilter={correctionSkillFilter}
              />
            </SectionErrorBoundary>
          </CollapsibleSection>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Floating "Publish Knowledge" FAB                                   */}
      {/* ----------------------------------------------------------------- */}
      <button
        onClick={() => openPublishPanel()}
        className={cn(
          'fixed bottom-6 right-6 z-30 flex items-center gap-2',
          'rounded-[var(--radius-button)] bg-primary px-4 py-3 text-sm font-medium text-primary-foreground',
          'shadow-lg hover:bg-[var(--primary-dark)] transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2',
          'animate-fade-in-up',
        )}
        aria-label="Publish Knowledge"
      >
        <BookPlus className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Publish Knowledge</span>
      </button>

      {/* ----------------------------------------------------------------- */}
      {/* Publish Knowledge Side Panel                                       */}
      {/* ----------------------------------------------------------------- */}
      <PublishKnowledgePanel
        isOpen={publishOpen}
        onClose={closePublishPanel}
        prefill={publishPrefill}
      />
    </div>
  );
}
