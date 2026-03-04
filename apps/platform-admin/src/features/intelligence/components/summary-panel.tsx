import { Building2, BookOpen, AlertTriangle, TrendingUp } from 'lucide-react';

import { useIntelligenceSummary } from '@/api/use-intelligence';

import { KpiCard, type TrendDirection } from './kpi-card';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a health-level indicator from the current success rate.
 * Note: This shows current level (High/Medium/Low), NOT a time-based trend.
 * True trend detection would require comparing to a previous period, which
 * the summary endpoint does not currently return.
 */
function deriveHealthLevel(rate: number | null): TrendDirection {
  if (rate === null) return 'stable';
  if (rate >= 80) return 'up'; // High success → green
  if (rate >= 50) return 'stable'; // Moderate → amber
  return 'down'; // Low → red
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SummaryPanel() {
  const { data, isLoading, error, refetch } = useIntelligenceSummary();

  const handleRetry = () => void refetch();

  const successRate = data?.overallAiSuccessRate ?? null;
  const successTrend = deriveHealthLevel(successRate);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Contributing Tenants"
        value={data?.totalContributingTenants ?? null}
        icon={Building2}
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
        className="animate-fade-in-up delay-1"
      />
      <KpiCard
        label="Knowledge Articles"
        value={data?.totalKnowledgeArticles ?? null}
        icon={BookOpen}
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
        className="animate-fade-in-up delay-2"
      />
      <KpiCard
        label="Total Corrections"
        value={data?.totalCorrections ?? null}
        icon={AlertTriangle}
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
        className="animate-fade-in-up delay-3"
      />
      <KpiCard
        label="AI Success Rate"
        value={successRate}
        trend={successTrend}
        icon={TrendingUp}
        isPercentage
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
        className="animate-fade-in-up delay-4"
      />
    </div>
  );
}
