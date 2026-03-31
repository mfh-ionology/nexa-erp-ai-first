/* eslint-disable i18next/no-literal-string */
/**
 * FE13: Finance Dashboard Page — /finance
 *
 * Uses T4 (BriefingPage) template. Main finance landing page with
 * KPI cards, activity counts, and alerts.
 */

import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { BriefingPage } from '@/components/templates/briefing-page';
import type { BriefingCardConfig, SummaryMetric } from '@/components/templates/types';

import { useFinanceDashboard } from '../hooks/use-finance-dashboard';

export function FinanceDashboardPage() {
  const navigate = useNavigate();
  const { dashboard, isLoading } = useFinanceDashboard();

  const summaryMetrics = useMemo<SummaryMetric[]>(() => {
    if (!dashboard) return [];
    return [
      {
        labelKey: 'Cash Position',
        value: dashboard.cashPosition,
        previousValue: dashboard.cashPreviousValue,
        format: 'currency' as const,
        trend: dashboard.cashTrend,
      },
      {
        labelKey: 'Revenue YTD',
        value: dashboard.revenueYtd,
        previousValue: dashboard.revenuePreviousValue,
        format: 'currency' as const,
        trend: dashboard.revenueTrend,
      },
      {
        labelKey: 'Expenses YTD',
        value: dashboard.expensesYtd,
        previousValue: dashboard.expensesPreviousValue,
        format: 'currency' as const,
        trend: dashboard.expensesTrend,
      },
      {
        labelKey: 'Net Profit YTD',
        value: dashboard.profitYtd,
        previousValue: dashboard.profitPreviousValue,
        format: 'currency' as const,
        trend: dashboard.profitTrend,
      },
    ];
  }, [dashboard]);

  const cards = useMemo<BriefingCardConfig[]>(() => {
    if (!dashboard) return [];

    const actionCards: BriefingCardConfig[] = [
      {
        id: 'pending-journals',
        type: 'action',
        titleKey: 'Pending Journals',
        value: String(dashboard.pendingJournals),
        description: 'Journal entries awaiting approval',
        actionLabelKey: 'View Journals',
        onAction: () => void navigate({ to: '/finance/journals' as string }),
        icon: 'FileText',
      },
      {
        id: 'unreconciled',
        type: 'action',
        titleKey: 'Unreconciled Transactions',
        value: String(dashboard.unreconciledTransactions),
        description: 'Bank transactions needing reconciliation',
        actionLabelKey: 'Reconcile',
        onAction: () => void navigate({ to: '/finance/bank-accounts' as string }),
        icon: 'ArrowLeftRight',
      },
      {
        id: 'overdue-invoices',
        type: 'kpi',
        titleKey: 'Overdue Invoices',
        value: String(dashboard.overdueInvoices),
        description: 'Invoices past their due date',
        icon: 'AlertTriangle',
      },
      {
        id: 'upcoming-payments',
        type: 'kpi',
        titleKey: 'Upcoming Payments',
        value: String(dashboard.upcomingPayments),
        description: 'Payments due in the next 7 days',
        icon: 'Calendar',
      },
    ];

    const alertCards: BriefingCardConfig[] = dashboard.alerts.map((alert) => ({
      id: alert.id,
      type: 'alert' as const,
      titleKey: alert.titleKey,
      description: alert.description,
      severity: alert.severity,
      icon:
        alert.severity === 'error'
          ? 'AlertCircle'
          : alert.severity === 'warning'
            ? 'AlertTriangle'
            : 'Info',
    }));

    return [...actionCards, ...alertCards];
  }, [dashboard, navigate]);

  return (
    <BriefingPage
      title="Finance"
      subtitle="Financial overview and activity"
      breadcrumbs={[{ label: 'Finance' }]}
      isLoading={isLoading}
      cards={cards}
      summaryMetrics={summaryMetrics}
    />
  );
}
