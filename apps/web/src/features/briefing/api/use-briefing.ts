/**
 * TanStack Query hook for the Morning Briefing.
 *
 * Fetches the AI-generated daily briefing from GET /ai/briefing.
 * Refetches every 60 minutes to keep data fresh.
 */

import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types — match the backend briefing.schema.ts response
// ---------------------------------------------------------------------------

export interface BriefingAction {
  label: string;
  actionType: 'navigate' | 'approve' | 'chase' | 'dismiss';
  route?: string;
  entityType?: string;
  entityIds?: string[];
}

export interface BriefingMetric {
  value: string;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
  comparisonPeriod?: string;
}

export interface BriefingEntityLink {
  entityType: string;
  entityId?: string;
  route: string;
}

export interface BriefingItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  metric?: BriefingMetric;
  actions: BriefingAction[];
  entityLink?: BriefingEntityLink;
}

export interface BriefingData {
  generatedAt: string;
  userId: string;
  role: 'OWNER' | 'FINANCE' | 'SALES' | 'HR' | 'WAREHOUSE' | 'ADMIN';
  greeting: string;
  summary: string;
  items: BriefingItem[];
  cachedAt?: string;
  isStale?: boolean;
}

// ---------------------------------------------------------------------------
// Derived UI types (computed from BriefingItem by category)
// ---------------------------------------------------------------------------

export interface UrgencyCard {
  id: string;
  type: 'overdue' | 'approval' | 'insight';
  title: string;
  detail: string;
  count: number;
  actions: BriefingAction[];
  priority: 'high' | 'medium' | 'low';
}

export interface BriefingKpi {
  key: string;
  label: string;
  value: string;
  trend?: { direction: 'up' | 'down' | 'flat'; value: string; positive: boolean };
}

export interface BriefingRecommendation {
  id: string;
  title: string;
  detail: string;
  actions: BriefingAction[];
}

export interface BriefingScheduleItem {
  id: string;
  time: string;
  title: string;
  detail: string;
  status: 'completed' | 'upcoming' | 'future';
}

// ---------------------------------------------------------------------------
// Category classification helpers
// ---------------------------------------------------------------------------

const URGENCY_CATEGORIES = new Set([
  'overdue',
  'overdue_invoices',
  'overdue_payments',
  'pending_approvals',
  'approval',
  'critical',
]);

const KPI_CATEGORIES = new Set([
  'kpi',
  'metric',
  'revenue',
  'cash_flow',
  'cash_position',
  'margin',
  'expenses',
]);

const SCHEDULE_CATEGORIES = new Set(['schedule', 'calendar', 'meeting', 'deadline', 'task']);

function classifyUrgencyType(
  category: string,
  priority: string,
): 'overdue' | 'approval' | 'insight' {
  if (category.includes('overdue') || priority === 'high') return 'overdue';
  if (category.includes('approval')) return 'approval';
  return 'insight';
}

function isTrendPositive(direction: 'up' | 'down' | 'flat', category: string): boolean {
  // For expenses/overdue, "up" is negative
  if (category.includes('expense') || category.includes('overdue')) {
    return direction === 'down';
  }
  return direction === 'up';
}

// ---------------------------------------------------------------------------
// Transform raw briefing items into UI sections
// ---------------------------------------------------------------------------

export function transformBriefingItems(items: BriefingItem[]) {
  const urgencyCards: UrgencyCard[] = [];
  const kpis: BriefingKpi[] = [];
  const recommendations: BriefingRecommendation[] = [];
  const scheduleItems: BriefingScheduleItem[] = [];

  for (const item of items) {
    const cat = item.category.toLowerCase();

    if (URGENCY_CATEGORIES.has(cat)) {
      urgencyCards.push({
        id: item.id,
        type: classifyUrgencyType(cat, item.priority),
        title: item.title,
        detail: item.description,
        count: item.metric?.value ? parseInt(item.metric.value, 10) || 1 : 1,
        actions: item.actions,
        priority: item.priority,
      });
    } else if (KPI_CATEGORIES.has(cat) && item.metric) {
      kpis.push({
        key: item.id,
        label: item.title,
        value: item.metric.value,
        trend: item.metric.trend
          ? {
              direction: item.metric.trend,
              value: item.metric.delta ?? '',
              positive: isTrendPositive(item.metric.trend, cat),
            }
          : undefined,
      });
    } else if (SCHEDULE_CATEGORIES.has(cat)) {
      scheduleItems.push({
        id: item.id,
        time: item.metric?.value ?? '',
        title: item.title,
        detail: item.description,
        status:
          item.priority === 'low' ? 'completed' : item.priority === 'high' ? 'upcoming' : 'future',
      });
    } else {
      // Default: treat as recommendation
      recommendations.push({
        id: item.id,
        title: item.title,
        detail: item.description,
        actions: item.actions,
      });
    }
  }

  return { urgencyCards, kpis, recommendations, scheduleItems };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBriefing(forceRefresh = false) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: queryKeys.briefing.current(forceRefresh),
    queryFn: async () => {
      const path = forceRefresh ? '/ai/briefing?forceRefresh=true' : '/ai/briefing';
      const result = await apiGet<BriefingData>(path);
      return result.data;
    },
    enabled: isAuthenticated,
    refetchInterval: 60 * 60 * 1000, // 60 minutes
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    retry: false, // AI service may be unavailable — don't retry 503s
    throwOnError: false, // Never let AI failure crash the page
  });

  const transformed = query.data ? transformBriefingItems(query.data.items) : null;

  return {
    ...query,
    briefing: query.data ?? null,
    urgencyCards: transformed?.urgencyCards ?? [],
    kpis: transformed?.kpis ?? [],
    recommendations: transformed?.recommendations ?? [],
    scheduleItems: transformed?.scheduleItems ?? [],
  };
}
