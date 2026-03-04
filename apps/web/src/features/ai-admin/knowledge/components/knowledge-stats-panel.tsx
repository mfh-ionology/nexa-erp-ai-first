/* eslint-disable i18next/no-literal-string */
/**
 * Knowledge Stats Panel — 4 KPI cards displayed persistently above tabs.
 *
 * AC-9: Total Articles (with source breakdown), RAG Retrieval Rate,
 * Correction Trend (sparkline), Pending Reviews (clickable).
 * Concept D styling: 12px radius, custom shadow, purple-tinted hover.
 * Staggered animate-fade-in-up (0ms, 50ms, 100ms, 150ms).
 */

import { useMemo } from 'react';
import { BookOpen, Search, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

import { useKnowledgeArticleStats } from '../../api/use-knowledge-articles';
import { useCorrectionStats } from '../../api/use-corrections';
import type { KnowledgeArticle, KnowledgeSource, CorrectionStats } from '../../api/types';

// ─── Source breakdown config ──────────────────────────────────────────────────

const SOURCE_COLOURS: Record<KnowledgeSource, { bg: string; label: string }> = {
  ADMIN_UPLOADED: { bg: '#7c3aed', label: 'Admin' },
  AI_GENERATED: { bg: '#3b82f6', label: 'AI' },
  PLATFORM_SUGGESTED: { bg: '#10b981', label: 'Platform' },
  CORRECTION_DERIVED: { bg: '#f59e0b', label: 'Corrections' },
};

// ─── Sparkline component ──────────────────────────────────────────────────────

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 80;
  const height = 28;
  const padding = 2;

  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((v - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      width={width}
      height={height}
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

// ─── Ring indicator ───────────────────────────────────────────────────────────

function RingIndicator({ percentage }: { percentage: number }) {
  const size = 36;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className="shrink-0" aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-border"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

// ─── Source breakdown bar ─────────────────────────────────────────────────────

function SourceBreakdownBar({ articles }: { articles: KnowledgeArticle[] }) {
  const counts = useMemo(() => {
    const map: Record<KnowledgeSource, number> = {
      ADMIN_UPLOADED: 0,
      AI_GENERATED: 0,
      PLATFORM_SUGGESTED: 0,
      CORRECTION_DERIVED: 0,
    };
    for (const a of articles) {
      if (a.isActive && map[a.source] !== undefined) {
        map[a.source]++;
      }
    }
    return map;
  }, [articles]);

  const total = Object.values(counts).reduce((s, c) => s + c, 0);
  if (total === 0) return null;

  const segments = (Object.entries(counts) as [KnowledgeSource, number][]).filter(
    ([, count]) => count > 0,
  );

  return (
    <div className="mt-2 space-y-1">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-border/50">
        {segments.map(([source, count]) => (
          <div
            key={source}
            className="h-full transition-all"
            style={{
              width: `${(count / total) * 100}%`,
              backgroundColor: SOURCE_COLOURS[source].bg,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map(([source, count]) => (
          <span key={source} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span
              className="inline-block size-1.5 rounded-full"
              style={{ backgroundColor: SOURCE_COLOURS[source].bg }}
            />
            {SOURCE_COLOURS[source].label} {count}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Stats card shell ─────────────────────────────────────────────────────────

interface StatsCardProps {
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  children?: React.ReactNode;
  delay: number;
  onClick?: () => void;
  highlight?: boolean;
  ariaLabel?: string;
}

function StatsCard({
  icon,
  title,
  value,
  children,
  delay,
  onClick,
  highlight,
  ariaLabel,
}: StatsCardProps) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      className={`animate-fade-in-up rounded-xl border bg-card p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)] ${
        highlight ? 'border-amber-300 ring-1 ring-amber-200' : 'border-border'
      } ${onClick ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
      aria-label={ariaLabel}
      type={onClick ? 'button' : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="font-mono text-2xl font-bold tracking-tight">{value}</div>
          {children}
        </div>
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">{icon}</div>
      </div>
    </Tag>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function StatsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="size-10 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Helper: compute trend direction ──────────────────────────────────────────

function computeTrendDirection(trend: CorrectionStats['trend']): 'up' | 'down' | 'flat' {
  if (trend.length < 7) return 'flat';
  const recent7 = trend.slice(-7).reduce((s, d) => s + d.count, 0);
  const prior7 = trend.slice(-14, -7).reduce((s, d) => s + d.count, 0);
  if (recent7 > prior7) return 'up';
  if (recent7 < prior7) return 'down';
  return 'flat';
}

// ─── Main component ───────────────────────────────────────────────────────────

interface KnowledgeStatsPanelProps {
  onNavigateToPendingReviews: () => void;
}

export function KnowledgeStatsPanel({ onNavigateToPendingReviews }: KnowledgeStatsPanelProps) {
  // Fetch all active articles (non-paginated) for total count + source breakdown + pending reviews
  const articlesQuery = useKnowledgeArticleStats();
  const correctionStatsQuery = useCorrectionStats();

  const articles = articlesQuery.data?.data ?? [];
  const correctionStats = correctionStatsQuery.data;

  const isLoading = articlesQuery.isLoading || correctionStatsQuery.isLoading;

  // ── Derived stats ──────────────────────────────────────────────────────────

  const totalActive = useMemo(
    () => articlesQuery.data?.total ?? articles.filter((a) => a.isActive).length,
    [articles, articlesQuery.data?.total],
  );

  const pendingReviews = useMemo(
    () => articles.filter((a) => !a.isConfirmed && a.isActive).length,
    [articles],
  );

  const ragRetrievalRate = useMemo(() => {
    // Proxy: % of active articles that have been used in at least one AI response.
    // A dedicated /ai/stats endpoint would provide the true query-level retrieval rate.
    if (totalActive === 0) return null;
    const usedArticles = articles.filter((a) => a.isActive && a.usageCount > 0).length;
    return Math.round((usedArticles / totalActive) * 100);
  }, [articles, totalActive]);

  const trendDirection = useMemo(
    () => (correctionStats ? computeTrendDirection(correctionStats.trend) : 'flat'),
    [correctionStats],
  );

  const sparklineData = useMemo(
    () => (correctionStats?.trend ?? []).map((d) => d.count),
    [correctionStats],
  );

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return <StatsLoadingSkeleton />;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* KPI 1: Total Articles */}
      <StatsCard
        icon={<BookOpen className="size-5" />}
        title="Total Articles"
        value={totalActive}
        delay={0}
        ariaLabel={`${totalActive} active knowledge articles`}
      >
        <SourceBreakdownBar articles={articles} />
      </StatsCard>

      {/* KPI 2: RAG Retrieval Rate */}
      <StatsCard
        icon={<Search className="size-5" />}
        title="RAG Retrieval Rate"
        value={
          <div className="flex items-center gap-2">
            {ragRetrievalRate !== null ? (
              <>
                <RingIndicator percentage={ragRetrievalRate} />
                <span>{ragRetrievalRate}%</span>
              </>
            ) : (
              <span className="text-muted-foreground/50" title="Insufficient data">
                &mdash;
              </span>
            )}
          </div>
        }
        delay={50}
        ariaLabel={
          ragRetrievalRate !== null
            ? `RAG retrieval rate: ${ragRetrievalRate}%`
            : 'RAG retrieval rate: insufficient data'
        }
      >
        <p className="text-xs text-muted-foreground">
          {ragRetrievalRate !== null ? 'Article coverage (proxy)' : 'Insufficient data'}
        </p>
      </StatsCard>

      {/* KPI 3: Correction Trend */}
      <StatsCard
        icon={
          trendDirection === 'down' ? (
            <TrendingDown className="size-5" />
          ) : (
            <TrendingUp className="size-5" />
          )
        }
        title="Correction Trend"
        value={
          <div className="flex items-center gap-2">
            <span>{correctionStats?.last30Days ?? 0}</span>
            {trendDirection !== 'flat' && (
              <span
                className={`text-sm font-semibold ${
                  trendDirection === 'up' ? 'text-amber-600' : 'text-green-600'
                }`}
              >
                {trendDirection === 'up' ? '\u2191' : '\u2193'}
              </span>
            )}
          </div>
        }
        delay={100}
        ariaLabel={`${correctionStats?.last30Days ?? 0} corrections in last 30 days, trend ${trendDirection}`}
      >
        <div className="mt-1 flex items-center gap-2">
          <Sparkline
            data={sparklineData}
            className={
              trendDirection === 'up'
                ? 'text-amber-500'
                : trendDirection === 'down'
                  ? 'text-green-500'
                  : 'text-muted-foreground'
            }
          />
          <span className="text-[10px] text-muted-foreground">30 days</span>
        </div>
      </StatsCard>

      {/* KPI 4: Pending Reviews */}
      <StatsCard
        icon={<AlertCircle className="size-5" />}
        title="Pending Reviews"
        value={pendingReviews}
        delay={150}
        highlight={pendingReviews > 0}
        onClick={onNavigateToPendingReviews}
        ariaLabel={`${pendingReviews} articles pending review. Click to view.`}
      >
        <p className="text-xs text-muted-foreground">
          {pendingReviews > 0 ? 'Unconfirmed articles need review' : 'All articles confirmed'}
        </p>
      </StatsCard>
    </div>
  );
}
