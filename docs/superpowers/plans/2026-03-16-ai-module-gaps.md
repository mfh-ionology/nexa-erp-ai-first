# AI Module Gaps Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 4 missing AI features (Morning Briefing, Setup Wizard, Analytics, Knowledge Base nav) and restructure the AI navigation with renames.

**Architecture:** Schema-first approach — add `settings` JSON column to `CompanyProfile` and new columns to `AiUsage` before building features. Nav restructure is independent. Frontend pages follow existing EntityListPage/dashboard patterns. Backend services follow AdminModelService pattern.

**Tech Stack:** React 19, TanStack Router, Zustand, Tailwind 4, Shadcn UI, Fastify 5, Prisma 7, Recharts

**Spec:** `docs/superpowers/specs/2026-03-16-ai-module-gaps-design.md`

---

## Chunk 1: Foundation (Schema + Nav Restructure)

### Task 1: Add `settings` JSON column to CompanyProfile

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (CompanyProfile model)
- Modify: `packages/db/src/index.ts` (if new export needed)

- [ ] **Step 1: Create migration (create-only)**

```bash
cd packages/db
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes pnpm exec prisma migrate dev --create-only --name add-company-profile-settings
```

- [ ] **Step 2: Add column to schema**

In `packages/db/prisma/schema.prisma`, inside the `CompanyProfile` model, add after the last field before relations:

```prisma
  settings       Json?    @map("settings")
```

- [ ] **Step 3: Apply migration**

```bash
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes pnpm exec prisma migrate dev
```

- [ ] **Step 4: Regenerate Prisma client**

```bash
pnpm exec prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/
git commit -m "feat(db): add settings JSON column to CompanyProfile"
```

---

### Task 2: Add analytics columns to AiUsage

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (AiUsage model)

- [ ] **Step 1: Create migration (create-only)**

```bash
cd packages/db
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes pnpm exec prisma migrate dev --create-only --name add-ai-usage-analytics-columns
```

- [ ] **Step 2: Add columns to AiUsage model**

In the `AiUsage` model, add after `agentId`:

```prisma
  userId       String?  @map("user_id")
  moduleId     String?  @map("module_id")
  requestType  String   @default("chat") @map("request_type") @db.VarChar(20)
  latencyMs    Int?     @map("latency_ms")
```

Update the `@@unique` constraint to include the new dimensions:

```prisma
  @@unique([tenantId, modelId, agentId, userId, moduleId, requestType, date], map: "uq_ai_usage_tenant_model_agent_user_module_type_date")
```

Add relations:

```prisma
  user         User?    @relation(fields: [userId], references: [id])
```

- [ ] **Step 3: Apply migration**

```bash
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes pnpm exec prisma migrate dev
```

- [ ] **Step 4: Regenerate Prisma client and commit**

```bash
pnpm exec prisma generate
git add packages/db/prisma/
git commit -m "feat(db): add userId, moduleId, requestType, latencyMs to AiUsage"
```

---

### Task 3: Extend NavigationItem interface with `type` field

**Files:**
- Modify: `apps/web/src/lib/navigation-config.ts`

- [ ] **Step 1: Add `type` field to NavigationItem interface**

Add `type?: 'item' | 'header';` to the `NavigationItem` interface (around line 22).

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/navigation-config.ts
git commit -m "feat(nav): add type field to NavigationItem for section headers"
```

---

### Task 4: Update mega-menu-item to render section headers

**Files:**
- Modify: `apps/web/src/components/layout/mega-menu-item.tsx`

- [ ] **Step 1: Add header rendering logic**

In the `module.items.map()` block, add a check before the existing button rendering:

```tsx
if (item.type === 'header') {
  return (
    <p
      key={item.key}
      className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-0"
    >
      {t(item.labelKey)}
    </p>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/mega-menu-item.tsx
git commit -m "feat(nav): render section headers in mega-menu"
```

---

### Task 5: Restructure AI navigation config + i18n keys

**Files:**
- Modify: `apps/web/src/lib/navigation-config.ts` (AI module items array)
- Modify: `packages/i18n/locales/en/navigation.json`

- [ ] **Step 1: Update i18n keys**

In `packages/i18n/locales/en/navigation.json`, update the AI keys:

```json
"ai.skills": "My Skills",
"ai.knowledge": "Knowledge Base",
"ai.admin": "Dashboard",
"ai.admin.settings": "AI Settings",
"ai.admin.models": "AI Models",
"ai.admin.prompts": "AI Prompts",
"ai.admin.agents": "AI Agents",
"ai.admin.skills": "Skill Packs",
"ai.admin.analytics": "AI Analytics",
"ai.admin.automations.section": "Automations",
"ai.admin.automations": "Automations",
"ai.admin.automationRuns": "Run History",
"ai.admin.knowledge": "Knowledge Base"
```

- [ ] **Step 2: Restructure AI module items array**

Replace the AI module's `items` array in `navigation-config.ts` with the new structure:

```typescript
items: [
  // User-facing (always visible, favouritable)
  { key: 'ai.briefing', labelKey: 'navigation:ai.briefing', icon: 'Sun', path: '/ai/briefing', alwaysVisible: true, category: 'page' },
  { key: 'ai.memory', labelKey: 'navigation:ai.memory', icon: 'Brain', path: '/ai/memory', alwaysVisible: true, category: 'page' },
  { key: 'ai.skills', labelKey: 'navigation:ai.skills', icon: 'Wand2', path: '/ai/skills', alwaysVisible: true, category: 'page' },
  { key: 'ai.knowledge', labelKey: 'navigation:ai.knowledge', icon: 'LibraryBig', path: '/ai/admin/knowledge', alwaysVisible: true, category: 'page' },

  // AI Settings section header
  { key: 'ai.admin.settings', labelKey: 'navigation:ai.admin.settings', icon: '', path: '', type: 'header', resourceCode: 'system.settings.detail', category: 'setting' },
  { key: 'ai.admin', labelKey: 'navigation:ai.admin', icon: 'Brain', path: '/ai/admin', resourceCode: 'system.settings.detail', category: 'setting' },
  { key: 'ai.admin.models', labelKey: 'navigation:ai.admin.models', icon: 'Cpu', path: '/ai/admin/models', resourceCode: 'system.settings.detail', category: 'setting' },
  { key: 'ai.admin.prompts', labelKey: 'navigation:ai.admin.prompts', icon: 'FileCode', path: '/ai/admin/prompts', resourceCode: 'system.settings.detail', category: 'setting' },
  { key: 'ai.admin.agents', labelKey: 'navigation:ai.admin.agents', icon: 'Bot', path: '/ai/admin/agents', resourceCode: 'system.settings.detail', category: 'setting' },
  { key: 'ai.admin.skills', labelKey: 'navigation:ai.admin.skills', icon: 'Wand2', path: '/ai/admin/skills', resourceCode: 'system.settings.detail', category: 'setting' },
  { key: 'ai.admin.analytics', labelKey: 'navigation:ai.admin.analytics', icon: 'BarChart3', path: '/ai/admin/analytics', resourceCode: 'system.settings.detail', category: 'setting' },

  // Automations section header
  { key: 'ai.admin.automations.section', labelKey: 'navigation:ai.admin.automations.section', icon: '', path: '', type: 'header', resourceCode: 'system.settings.detail', category: 'setting' },
  { key: 'ai.admin.automations', labelKey: 'navigation:ai.admin.automations', icon: 'Workflow', path: '/ai/admin/automations', resourceCode: 'system.settings.detail', category: 'setting' },
  { key: 'ai.admin.automationRuns', labelKey: 'navigation:ai.admin.automationRuns', icon: 'History', path: '/ai/admin/automations/runs', resourceCode: 'system.settings.detail', category: 'setting' },
],
```

- [ ] **Step 3: Run web tests to verify nothing breaks**

```bash
pnpm --filter @nexa/web test
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/navigation-config.ts packages/i18n/locales/en/navigation.json
git commit -m "feat(nav): restructure AI navigation with renames and new entries"
```

---

## Chunk 2: Company AI Settings Endpoint + Setup Wizard

### Task 6: Add PATCH /system/company/ai-settings endpoint

**Files:**
- Modify: `apps/api/src/modules/system/company.routes.ts`
- Modify: `apps/api/src/modules/system/company-profile.service.ts`

- [ ] **Step 1: Add service method**

In `company-profile.service.ts`, add:

```typescript
export async function updateCompanyAiSettings(
  prisma: PrismaClient,
  companyId: string,
  key: string,
  value: unknown,
) {
  const profile = await prisma.companyProfile.findUnique({ where: { id: companyId } });
  if (!profile) throw new NotFoundError('NOT_FOUND', 'Company profile not found');

  const currentSettings = (profile.settings as Record<string, unknown>) ?? {};
  const updatedSettings = { ...currentSettings, [key]: value };

  return prisma.companyProfile.update({
    where: { id: companyId },
    data: { settings: updatedSettings },
  });
}
```

- [ ] **Step 2: Add route**

In `company.routes.ts`, add PATCH route:

```typescript
fastify.patch(
  '/company/ai-settings',
  { preHandler: [createPermissionGuard('system.settings.detail', 'edit')] },
  async (request, reply) => {
    const { key, value } = request.body as { key: string; value: unknown };
    const companyId = request.tenantId;
    const result = await updateCompanyAiSettings(fastify.prisma, companyId, key, value);
    return reply.send(successEnvelope({ settings: result.settings }));
  },
);
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/system/
git commit -m "feat(api): add PATCH /system/company/ai-settings endpoint"
```

---

### Task 7: Add GET /ai/admin/setup-status endpoint

**Files:**
- Modify: `apps/api/src/ai/admin/admin.routes.ts`

- [ ] **Step 1: Add setup-status route**

In `admin.routes.ts`, add:

```typescript
fastify.get(
  '/setup-status',
  { preHandler: [createPermissionGuard('system.settings.detail', 'view')] },
  async (request, reply) => {
    const tenantId = request.tenantId;
    const prisma = fastify.prisma;

    const [modelCount, agentCount, skillOverrideCount, automationCount, profile] = await Promise.all([
      prisma.aiModel.count({ where: { tenantId, isActive: true } }),
      prisma.aiAgent.count({ where: { tenantId, isActive: true } }),
      prisma.aiSkillOverride.count({ where: { tenantId, isActive: true } }),
      prisma.aiAutomation.count({ where: { tenantId } }),
      prisma.companyProfile.findUnique({ where: { id: tenantId }, select: { settings: true } }),
    ]);

    const settings = (profile?.settings as Record<string, unknown>) ?? {};

    return reply.send(successEnvelope({
      modelsConnected: modelCount > 0,
      agentsConfigured: agentCount > 0,
      skillsActivated: skillOverrideCount > 0,
      automationCreated: automationCount > 0,
      copilotTested: settings.aiCopilotTested === true,
      wizardCompleted: settings.aiSetupWizardCompleted === true,
      checklistDismissed: settings.aiSetupChecklistDismissed === true,
    }));
  },
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/ai/admin/admin.routes.ts
git commit -m "feat(api): add GET /ai/admin/setup-status endpoint"
```

---

### Task 8: Create frontend API hooks for setup wizard

**Files:**
- Create: `apps/web/src/features/ai-admin/api/use-ai-setup-status.ts`
- Create: `apps/web/src/features/ai-admin/api/use-company-ai-settings.ts`

- [ ] **Step 1: Create use-ai-setup-status.ts**

```typescript
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { apiGet } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export interface SetupStatus {
  modelsConnected: boolean;
  agentsConfigured: boolean;
  skillsActivated: boolean;
  automationCreated: boolean;
  copilotTested: boolean;
  wizardCompleted: boolean;
  checklistDismissed: boolean;
}

export function useAiSetupStatus() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.aiAdmin.setupStatus(),
    queryFn: async () => {
      const result = await apiGet<SetupStatus>('/ai/admin/setup-status');
      return result.data;
    },
    enabled: isAuthenticated,
  });
}
```

- [ ] **Step 2: Create use-company-ai-settings.ts**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function useUpdateCompanyAiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      return apiPatch('/system/company/ai-settings', { key, value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAdmin.setupStatus() });
    },
  });
}
```

- [ ] **Step 3: Add query key**

In `apps/web/src/lib/query-keys.ts`, add `setupStatus` to the `aiAdmin` section:

```typescript
setupStatus: () => [...aiAdmin.all, 'setup-status'] as const,
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/ai-admin/api/ apps/web/src/lib/query-keys.ts
git commit -m "feat(web): add API hooks for AI setup status and company settings"
```

---

### Task 9: Build AI Setup Wizard modal

**Files:**
- Create: `apps/web/src/features/ai-admin/setup-wizard/ai-setup-wizard.tsx`
- Create: `apps/web/src/features/ai-admin/setup-wizard/wizard-steps.tsx`
- Create: `apps/web/src/features/ai-admin/setup-wizard/ai-setup-checklist.tsx`
- Create: `apps/web/src/features/ai-admin/setup-wizard/index.ts`

- [ ] **Step 1: Create wizard step components**

Create `apps/web/src/features/ai-admin/setup-wizard/wizard-steps.tsx` with 5 step components:
- `VerifyModelsStep` — fetches `useAiModels()`, shows model cards with connected/not-connected status
- `ReviewAgentsStep` — fetches `useAiAgents()`, shows agent cards with active status
- `ActivateSkillsStep` — module checkbox toggles using `useAiSkills()` + `useSkillOverrideMutation()`
- `FirstAutomationStep` — optional, offers template activation
- `TestCopilotStep` — "Open Copilot" button that opens the copilot drawer

Each step is a pure component receiving `onNext` and `onBack` props.

- [ ] **Step 2: Create wizard modal**

Create `apps/web/src/features/ai-admin/setup-wizard/ai-setup-wizard.tsx`:
- Modal overlay using Shadcn `Dialog`
- Progress bar at top (width = `${(step / 5) * 100}%`)
- Step content area rendering current step component
- Footer: "Skip setup" link, "Back"/"Next" buttons
- On final step or skip: calls `useUpdateCompanyAiSettings({ key: 'aiSetupWizardCompleted', value: true })`

- [ ] **Step 3: Create persistent checklist card**

Create `apps/web/src/features/ai-admin/setup-wizard/ai-setup-checklist.tsx`:
- Purple gradient header card with progress counter
- 5 checklist items, each auto-detected from `useAiSetupStatus()` data
- Completed items: green check + strikethrough
- Pending items: empty checkbox + "Go →" link
- "Dismiss" link at bottom calls `useUpdateCompanyAiSettings({ key: 'aiSetupChecklistDismissed', value: true })`

- [ ] **Step 4: Create barrel export**

Create `apps/web/src/features/ai-admin/setup-wizard/index.ts`:

```typescript
export { AiSetupWizard } from './ai-setup-wizard';
export { AiSetupChecklist } from './ai-setup-checklist';
```

- [ ] **Step 5: Integrate into AI admin dashboard**

Modify `apps/web/src/features/ai-admin/dashboard/ai-config-dashboard.tsx`:
- Import `AiSetupWizard` and `AiSetupChecklist`
- Add `useAiSetupStatus()` hook call
- Show `AiSetupWizard` modal if `!setupStatus.wizardCompleted`
- Show `AiSetupChecklist` card above existing content if wizard completed but checklist not dismissed and not all 5 items complete

- [ ] **Step 6: Export from ai-admin barrel**

Add to `apps/web/src/features/ai-admin/index.ts`:

```typescript
export { AiSetupWizard, AiSetupChecklist } from './setup-wizard';
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/ai-admin/
git commit -m "feat(web): add AI setup wizard modal and persistent checklist"
```

---

## Chunk 3: Morning Briefing Page

### Task 10: Create Morning Briefing frontend page

**Files:**
- Create: `apps/web/src/features/briefing/morning-briefing-page.tsx`
- Create: `apps/web/src/features/briefing/components/urgency-card.tsx`
- Create: `apps/web/src/features/briefing/components/kpi-row.tsx`
- Create: `apps/web/src/features/briefing/components/recommendations-panel.tsx`
- Create: `apps/web/src/features/briefing/components/schedule-timeline.tsx`
- Create: `apps/web/src/features/briefing/api/use-briefing.ts`
- Create: `apps/web/src/features/briefing/index.ts`
- Modify: `apps/web/src/routes/_authenticated/index.tsx`
- Create: `apps/web/src/routes/_authenticated/ai/briefing/index.tsx`

- [ ] **Step 1: Create briefing API hook**

Create `apps/web/src/features/briefing/api/use-briefing.ts`:
- `useBriefing(forceRefresh?: boolean)` — calls `GET /briefing`
- Returns: urgencyCards, kpis, recommendations, scheduleItems, lastRefreshed
- Auto-refetch every 60 minutes

- [ ] **Step 2: Create urgency card component**

Create `apps/web/src/features/briefing/components/urgency-card.tsx`:
- Props: `type: 'overdue' | 'approval' | 'insight'`, `title`, `detail`, `count`, `actions`
- Left border colour based on type (red/amber/purple)
- Action buttons follow Concept D styling

- [ ] **Step 3: Create KPI row, recommendations panel, schedule timeline components**

Create the remaining 3 components following the mockup layout from the spec.

- [ ] **Step 4: Create MorningBriefingPage**

Create `apps/web/src/features/briefing/morning-briefing-page.tsx`:
- Greeting header with time-based greeting + date
- 3-column urgency cards grid
- 4-column KPI row
- 2-column layout: recommendations (2/3) + schedule (1/3)
- "Last refreshed X minutes ago · Refresh now" footer
- Loading skeleton state
- Error state with fallback message

- [ ] **Step 5: Create barrel export**

Create `apps/web/src/features/briefing/index.ts`:

```typescript
export { MorningBriefingPage } from './morning-briefing-page';
```

- [ ] **Step 6: Replace authenticated index route**

Update `apps/web/src/routes/_authenticated/index.tsx` to lazy-load `MorningBriefingPage`:

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const MorningBriefingPage = lazy(() =>
  import('@/features/briefing').then((m) => ({
    default: m.MorningBriefingPage,
  })),
);

export const Route = createFileRoute('/_authenticated/')({
  component: MorningBriefingPage,
});
```

- [ ] **Step 7: Create briefing redirect route**

Create `apps/web/src/routes/_authenticated/ai/briefing/index.tsx`:

```typescript
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/ai/briefing/')({
  beforeLoad: () => {
    throw redirect({ to: '/' });
  },
});
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/briefing/ apps/web/src/routes/_authenticated/
git commit -m "feat(web): add Morning Briefing page as dashboard replacement"
```

---

## Chunk 4: AI Usage Analytics

### Task 11: Create AdminAnalyticsService backend

**Files:**
- Create: `apps/api/src/ai/admin/analytics.service.ts`
- Modify: `apps/api/src/ai/admin/admin.routes.ts`
- Modify: `apps/api/src/ai/index.ts`

- [ ] **Step 1: Create analytics service**

Create `apps/api/src/ai/admin/analytics.service.ts`:

```typescript
import type { PrismaClient } from '@nexa/db';

export interface AnalyticsSummary {
  totalTokens: number;
  totalCost: number;
  requestCount: { chat: number; automation: number; total: number };
  avgLatencyMs: number;
  trends: { tokens: number; cost: number; latency: number }; // % change
}

export interface BreakdownItem {
  group: string;
  groupId: string;
  requests: number;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  avgLatencyMs: number | null;
}

export interface AnalyticsAlert {
  type: 'cost_threshold' | 'anomaly';
  severity: 'warning' | 'critical';
  title: string;
  detail: string;
  moduleOrAgent: string;
  currentValue: number;
  thresholdValue: number;
}

export class AdminAnalyticsService {
  constructor(private prisma: PrismaClient) {}

  async getSummary(tenantId: string, startDate: Date, endDate: Date): Promise<AnalyticsSummary> {
    // Aggregate AiUsage for current period
    // Calculate previous period for trends
    // Return summary with trend percentages
  }

  async getBreakdown(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'model' | 'agent' | 'module' | 'user' | 'day',
  ): Promise<BreakdownItem[]> {
    // Group AiUsage by specified dimension
    // Join to AiModel/AiAgent/User for display names
    // Return sorted by cost descending
  }

  async getAlerts(tenantId: string): Promise<AnalyticsAlert[]> {
    // Check per-module budgets from CompanyProfile.settings.aiTokenBudgets
    // Compare current month spend vs budget (80% threshold)
    // Check 7-day vs previous 7-day per-agent averages (2x threshold)
    // Return active alerts
  }

  async exportCsv(tenantId: string, startDate: Date, endDate: Date): Promise<string> {
    // Query raw AiUsage rows with joins
    // Format as CSV string with header row
    // Columns: date,agent,model,module,user_email,tokens_in,tokens_out,cost_gbp,latency_ms,request_type
  }
}
```

- [ ] **Step 2: Register service in ai/index.ts**

In `apps/api/src/ai/index.ts`:
- Import `AdminAnalyticsService`
- Add to type augmentation: `aiAdminAnalyticsService: AdminAnalyticsService`
- Instantiate and decorate: `fastify.decorate('aiAdminAnalyticsService', new AdminAnalyticsService(prisma))`

- [ ] **Step 3: Add analytics routes**

In `apps/api/src/ai/admin/admin.routes.ts`, add 4 routes:
- `GET /analytics/summary` — params: startDate, endDate
- `GET /analytics/breakdown` — params: startDate, endDate, groupBy
- `GET /analytics/alerts` — no params
- `GET /analytics/export` — params: startDate, endDate; returns CSV with `Content-Type: text/csv`

All use `createPermissionGuard('system.settings.detail', 'view')`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ai/
git commit -m "feat(api): add AdminAnalyticsService with summary, breakdown, alerts, export"
```

---

### Task 12: Create AI Analytics frontend page

**Files:**
- Create: `apps/web/src/features/ai-admin/analytics/ai-analytics-page.tsx`
- Create: `apps/web/src/features/ai-admin/analytics/components/alert-banner.tsx`
- Create: `apps/web/src/features/ai-admin/analytics/components/summary-cards.tsx`
- Create: `apps/web/src/features/ai-admin/analytics/components/token-chart.tsx`
- Create: `apps/web/src/features/ai-admin/analytics/components/cost-by-model.tsx`
- Create: `apps/web/src/features/ai-admin/analytics/components/breakdown-table.tsx`
- Create: `apps/web/src/features/ai-admin/analytics/components/top-users.tsx`
- Create: `apps/web/src/features/ai-admin/analytics/index.ts`
- Create: `apps/web/src/features/ai-admin/api/use-ai-analytics.ts`
- Create: `apps/web/src/routes/_authenticated/ai/admin/analytics/index.tsx`

- [ ] **Step 1: Create analytics API hooks**

Create `apps/web/src/features/ai-admin/api/use-ai-analytics.ts`:
- `useAiAnalyticsSummary(startDate, endDate)`
- `useAiAnalyticsBreakdown(startDate, endDate, groupBy)`
- `useAiAnalyticsAlerts()`
- `useAiAnalyticsExport()` — mutation that triggers CSV download

Add query keys to `apps/web/src/lib/query-keys.ts`:

```typescript
analytics: {
  summary: (params: Record<string, unknown>) => [...aiAdmin.all, 'analytics', 'summary', params] as const,
  breakdown: (params: Record<string, unknown>) => [...aiAdmin.all, 'analytics', 'breakdown', params] as const,
  alerts: () => [...aiAdmin.all, 'analytics', 'alerts'] as const,
},
```

- [ ] **Step 2: Create alert banner component**

Create `alert-banner.tsx`:
- Props: `alert: AnalyticsAlert`
- Red banner for cost_threshold, amber for anomaly
- Dismiss button, action button
- Icon, title, detail text

- [ ] **Step 3: Create summary cards, token chart, cost-by-model, breakdown table, top users**

Build each component following the mockup layout. Use Recharts `BarChart` for token chart (same pattern as existing `TokenUsageChart` in `ai-config-dashboard.tsx`). Use standard `<table>` with Concept D styling for breakdown tables.

- [ ] **Step 4: Create AiAnalyticsPage**

Create `apps/web/src/features/ai-admin/analytics/ai-analytics-page.tsx`:
- Page header with title + date range dropdown + Export CSV button
- Alert banners (conditional)
- Summary KPI cards (4-grid)
- 2-column: token chart (2/3) + cost by model (1/3)
- 2-column: usage by agent table + usage by module table
- Top users section
- State: `dateRange` controlled by dropdown (`7d` | `30d` | `month`)

- [ ] **Step 5: Create barrel export and route**

Create `apps/web/src/features/ai-admin/analytics/index.ts`:

```typescript
export { AiAnalyticsPage } from './ai-analytics-page';
```

Add to `apps/web/src/features/ai-admin/index.ts`:

```typescript
export { AiAnalyticsPage } from './analytics';
```

Create `apps/web/src/routes/_authenticated/ai/admin/analytics/index.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';
import { createAdminModuleBeforeLoad } from '@/lib/route-guards';

const AiAnalyticsPage = lazy(() =>
  import('@/features/ai-admin').then((m) => ({ default: m.AiAnalyticsPage })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/analytics/')({
  beforeLoad: createAdminModuleBeforeLoad('system'),
  component: AiAnalyticsPage,
});
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @nexa/web test
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/ai-admin/analytics/ apps/web/src/features/ai-admin/api/ apps/web/src/features/ai-admin/index.ts apps/web/src/routes/_authenticated/ai/admin/analytics/ apps/web/src/lib/query-keys.ts
git commit -m "feat(web): add AI Analytics page with charts, tables, alerts, CSV export"
```

---

## Chunk 5: Final Integration & Tests

### Task 13: Write tests for new components

**Files:**
- Create: `apps/web/src/features/ai-admin/setup-wizard/__tests__/ai-setup-checklist.test.tsx`
- Create: `apps/web/src/features/ai-admin/analytics/__tests__/ai-analytics-page.test.tsx`
- Create: `apps/web/src/features/briefing/__tests__/morning-briefing-page.test.tsx`

- [ ] **Step 1: Write setup checklist tests**

Test: renders 5 items, completed items show strikethrough, pending items show "Go →" links, dismiss button hides card.

- [ ] **Step 2: Write analytics page tests**

Test: renders KPI cards, renders alert banners when alerts exist, date range dropdown changes query params, export button triggers download.

- [ ] **Step 3: Write morning briefing page tests**

Test: renders greeting with user name, renders urgency cards, renders KPI row, renders recommendations, shows loading skeleton while fetching.

- [ ] **Step 4: Run full test suite**

```bash
pnpm --filter @nexa/web test
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/
git commit -m "test: add tests for setup wizard, analytics, and morning briefing"
```

---

### Task 14: Final verification

- [ ] **Step 1: Start servers and verify all pages load**

```bash
pnpm --filter @nexa/api dev &
pnpm --filter @nexa/web dev &
```

- [ ] **Step 2: Verify navigation shows new structure**

Open http://localhost:5110, navigate to AI module. Confirm:
- Morning Briefing, My Memory, My Skills, Knowledge Base in user section
- AI Settings header with Dashboard, AI Models, AI Prompts, AI Agents, Skill Packs, AI Analytics
- Automations header with Automations, Run History

- [ ] **Step 3: Verify AI Analytics page loads**

Navigate to `/ai/admin/analytics` — page should render with empty state (no data yet).

- [ ] **Step 4: Verify Setup Wizard appears**

Navigate to `/ai/admin` — wizard modal should appear on first visit.

- [ ] **Step 5: Verify Morning Briefing**

Navigate to `/` — should show morning briefing page (or loading/fallback state).

- [ ] **Step 6: Verify `/ai/briefing` redirects to `/`**

Navigate to `/ai/briefing` — should redirect to `/`.
