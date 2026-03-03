import { KpiCards } from '@/components/dashboard/kpi-cards';
import { RevenueChart, CashFlowChart } from '@/components/dashboard/charts';
import { TasksCard, RecentActivityCard } from '@/components/dashboard/bottom-cards';

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="font-serif text-3xl font-bold text-foreground">Good morning, Sarah</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {'Here\u2019s your business overview for Monday, 17 February 2026'}
        </p>
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
