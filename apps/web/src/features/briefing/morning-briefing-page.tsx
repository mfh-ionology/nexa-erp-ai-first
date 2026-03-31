/* eslint-disable i18next/no-literal-string */
import { useI18n, useLocale } from '@nexa/i18n';

import { useAuthStore } from '@/stores/auth-store';
import { Skeleton } from '@/components/ui/skeleton';

import { useBriefing } from './api/use-briefing';
import { UrgencyCard } from './components/urgency-card';
import { KpiRow } from './components/kpi-row';
import { RecommendationsPanel } from './components/recommendations-panel';
import { ScheduleTimeline } from './components/schedule-timeline';

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function BriefingSkeleton() {
  return (
    <div className="mx-auto max-w-7xl p-6" aria-busy="true">
      {/* Greeting skeleton */}
      <div className="mb-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>

      {/* Urgency cards skeleton */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>

      {/* KPI row skeleton */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>

      {/* Bottom panels skeleton */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Greeting helper
// ---------------------------------------------------------------------------

function getGreetingKey(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function MorningBriefingPage() {
  const { t } = useI18n();
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? '';
  const greetingKey = getGreetingKey();

  const {
    briefing,
    urgencyCards,
    kpis,
    recommendations,
    scheduleItems,
    isLoading,
    isError,
    refetch,
  } = useBriefing();

  const dateStr = new Date().toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Loading state
  if (isLoading) return <BriefingSkeleton />;

  // AI service unavailable — show a friendly fallback instead of crashing
  if (isError || !briefing) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl p-6">
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-bold text-foreground">
            {t(`briefing.greeting.${greetingKey}`, { name: firstName })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{dateStr}</p>
        </div>
        <div className="rounded-xl border border-dashed border-muted-foreground/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            AI briefing is not available right now. Use the sidebar to navigate to your modules.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl p-6" aria-label={t('briefing.title')}>
      {/* ── Greeting ──────────────────────────────────────────────────── */}
      <div className="mb-6 animate-fade-in-up">
        <h1 className="font-serif text-2xl font-bold text-foreground">
          {briefing?.greeting ?? t(`briefing.greeting.${greetingKey}`, { name: firstName })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {dateStr}
          {' \u00B7 '}
          {briefing?.summary ?? t('briefing.subtitle')}
        </p>
      </div>

      {/* ── Urgency Cards ─────────────────────────────────────────────── */}
      {urgencyCards.length > 0 && (
        <section
          className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          aria-label={t('briefing.urgency.section')}
        >
          {urgencyCards.map((card) => (
            <UrgencyCard key={card.id} card={card} />
          ))}
        </section>
      )}

      {/* ── KPI Row ───────────────────────────────────────────────────── */}
      {kpis.length > 0 && (
        <section className="mb-6" aria-label="Key performance indicators">
          <KpiRow kpis={kpis} />
        </section>
      )}

      {/* ── Recommendations + Schedule ────────────────────────────────── */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <RecommendationsPanel recommendations={recommendations} />
        <ScheduleTimeline items={scheduleItems} />
      </div>

      {/* ── Refresh footer ────────────────────────────────────────────── */}
      <div className="mt-6 text-center text-xs text-muted-foreground">
        {briefing?.generatedAt
          ? t('briefing.lastRefreshed', {
              time: new Date(briefing.generatedAt).toLocaleTimeString(locale, {
                hour: '2-digit',
                minute: '2-digit',
              }),
            })
          : null}
        {briefing?.generatedAt ? ' \u00B7 ' : null}
        <button
          onClick={() => refetch()}
          className="text-[#7c3aed] transition-colors hover:text-[#5b21b6] hover:underline"
        >
          {t('briefing.refreshNow')}
        </button>
        {briefing?.isStale && (
          <span className="ml-2 text-amber-600">({t('briefing.staleWarning')})</span>
        )}
      </div>
    </main>
  );
}
