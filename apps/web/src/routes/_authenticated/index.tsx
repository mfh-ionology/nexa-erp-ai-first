/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';

import { useI18n, useLocale } from '@nexa/i18n';

import { useAuthStore } from '@/stores/auth-store';

import { KpiCards } from '@/components/dashboard/kpi-cards';
import { RevenueChart, CashFlowChart } from '@/components/dashboard/charts';
import { TasksCard, RecentActivityCard } from '@/components/dashboard/bottom-cards';

export const Route = createFileRoute('/_authenticated/')({
  component: DashboardPage,
});

function getGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'dashboard.greeting.morning';
  if (hour < 18) return 'dashboard.greeting.afternoon';
  return 'dashboard.greeting.evening';
}

function DashboardPage() {
  const { t } = useI18n();
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? '';

  const dateStr = new Date().toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="font-serif text-3xl font-bold text-foreground">
          {t(getGreetingKey(), { name: firstName })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{dateStr}</p>
      </div>

      <section aria-label="Key performance indicators" className="mb-6">
        <KpiCards />
      </section>

      <section aria-label="Charts" className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevenueChart />
        <CashFlowChart />
      </section>

      <section aria-label="Tasks and activity" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TasksCard />
        <RecentActivityCard />
      </section>
    </div>
  );
}
