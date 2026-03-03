/**
 * TanStack Query hook for Automation Health dashboard section.
 *
 * Composes health stats from multiple existing endpoints since the
 * backend does not provide a single `/ai/automations/health` endpoint.
 *
 * - useAutomationHealth: Query returning composed AutomationHealthStats
 */

import { useQuery } from '@tanstack/react-query';
import { subDays, subHours, startOfDay, format } from 'date-fns';

import { apiGet, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type { AiAutomationListItem, AiAutomationRunListItem, AutomationHealthStats } from './types';

/**
 * Compose automation health stats from multiple API calls.
 * Parallelises fetches for automations list and recent failed runs.
 */
async function fetchAutomationHealth(): Promise<AutomationHealthStats> {
  const now = new Date();
  const twentyFourHoursAgo = subHours(now, 24).toISOString();
  const sevenDaysAgo = subDays(now, 7).toISOString();

  // Parallel fetch: automations list + failed runs (24h) + recent runs (7d for token spend).
  // NOTE: Each fetch is capped at limit=200. The failed runs count uses meta.total (from the
  // server's full count) when available, so the displayed count is accurate even if >200.
  // Token spend aggregation is approximate if >200 runs exist in 7 days.
  const [automationsResult, failedRunsResult, recentRunsResult] = await Promise.all([
    apiGet<AiAutomationListItem[]>('/ai/automations?limit=200'),
    apiGet<AiAutomationRunListItem[]>(
      `/ai/automations/runs${buildQueryString({ status: 'FAILED', dateFrom: twentyFourHoursAgo, limit: 200 })}`,
    ),
    apiGet<AiAutomationRunListItem[]>(
      `/ai/automations/runs${buildQueryString({ dateFrom: sevenDaysAgo, limit: 200 })}`,
    ),
  ]);

  const automations = automationsResult.data;
  const failedRuns = failedRunsResult.data;
  const recentRuns = recentRunsResult.data;
  // Use meta.total from server when available for accurate count (not capped by limit)
  const failedRunsCount = failedRunsResult.meta?.total ?? failedRuns.length;

  // Count automations by status
  const activeCount = automations.filter((a) => a.isActive).length;
  const pausedCount = automations.filter((a) => !a.isActive && a.schedule?.isPaused).length;
  const inactiveCount = automations.length - activeCount - pausedCount;

  // Detect circuit breaker alerts: inactive automations with paused schedules
  // that also have recent failed runs.
  // LIMITATION: This is a heuristic. The actual circuit breaker state is tracked in-memory
  // on the backend (automation-circuit-breaker.ts) and not exposed via API. An admin who
  // manually deactivates + pauses an automation that happened to have a failed last run
  // could trigger a false positive here. The `consecutiveFailures` value is hardcoded to 3
  // (the circuit breaker threshold) rather than derived from actual consecutive failure count.
  // TODO: Add a `circuitBreakerTripped` flag to the automation API response for reliable detection.
  const failedAutomationIds = new Set(failedRuns.map((r) => r.automationId));
  const circuitBreakerAlerts = automations
    .filter(
      (a) =>
        !a.isActive &&
        a.schedule?.isPaused &&
        (failedAutomationIds.has(a.id) || a.lastRunStatus === 'FAILED'),
    )
    .map((a) => ({
      automationId: a.id,
      automationName: a.name,
      consecutiveFailures: 3, // hardcoded: circuit breaker threshold, not actual count
      lastFailedAt: a.lastRunAt ?? a.updatedAt,
    }));

  // Upcoming scheduled runs: active scheduled automations with nextRunAt
  const upcomingRuns = automations
    .filter(
      (a) =>
        a.isActive &&
        a.triggerType === 'SCHEDULED' &&
        a.schedule &&
        !a.schedule.isPaused &&
        a.schedule.nextRunAt,
    )
    .map((a) => ({
      automationId: a.id,
      automationName: a.name,
      nextRunAt: a.schedule!.nextRunAt!,
    }))
    .sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())
    .slice(0, 6);

  // Aggregate daily token spend from recent runs (last 7 days)
  const dailyTokenMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const day = format(subDays(now, i), 'yyyy-MM-dd');
    dailyTokenMap.set(day, 0);
  }
  for (const run of recentRuns) {
    if (run.startedAt) {
      const day = format(startOfDay(new Date(run.startedAt)), 'yyyy-MM-dd');
      if (dailyTokenMap.has(day)) {
        dailyTokenMap.set(day, dailyTokenMap.get(day)! + run.totalTokens);
      }
    }
  }
  const dailyTokenSpend = Array.from(dailyTokenMap.entries()).map(([date, tokens]) => ({
    date,
    tokens,
  }));

  return {
    totalAutomations: automations.length,
    activeCount,
    pausedCount,
    inactiveCount,
    failedRunsLast24h: failedRunsCount,
    upcomingRuns,
    dailyTokenSpend,
    circuitBreakerAlerts,
  };
}

/**
 * Automation health stats for the dashboard section.
 * Composes data from automations list and recent runs.
 * Cached for 60 seconds since dashboard data doesn't need real-time updates.
 */
export function useAutomationHealth() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiAdmin.automationHealth(),
    queryFn: fetchAutomationHealth,
    enabled: isAuthenticated,
    staleTime: 60_000, // 60 seconds
  });
}
