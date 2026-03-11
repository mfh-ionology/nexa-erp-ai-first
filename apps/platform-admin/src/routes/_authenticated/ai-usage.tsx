// ---------------------------------------------------------------------------
// AI Usage Dashboard — Tabbed Page
// Story E13b-4 Task 4.1
// Tab 1: Overview (cross-tenant usage) — Task 4
// Tab 2: Alerts (quota warnings & anomalies) — Task 5
// Tab 3: Providers (vendor API key management) — Task 7
// ---------------------------------------------------------------------------

import { createFileRoute } from '@tanstack/react-router';
import { BarChart3, Bell, Key } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AiUsageOverview } from '@/features/ai-usage/components/ai-usage-overview';
import { AiAlertsTab } from '@/features/ai-usage/components/ai-alerts-tab';
import { ProvidersTab } from '@/features/ai-usage/components/providers-tab';

export const Route = createFileRoute('/_authenticated/ai-usage')({
  component: AiUsagePage,
});

function AiUsagePage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Page Header */}
      <header className="mb-6 animate-fade-in-up">
        <p className="text-sm text-muted-foreground">Platform Admin &gt; AI Usage</p>
        <h1 className="page-title text-foreground">AI Usage</h1>
      </header>

      {/* Tabbed Layout */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-2">
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <Bell className="h-4 w-4" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="providers">
            <Key className="h-4 w-4" />
            Providers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AiUsageOverview />
        </TabsContent>

        <TabsContent value="alerts">
          <AiAlertsTab />
        </TabsContent>

        <TabsContent value="providers">
          <ProvidersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
