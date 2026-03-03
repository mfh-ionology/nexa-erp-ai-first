# Platform Admin Portal (Super Admin) — UX Overview

> The Platform Admin Portal is a **separate application** (`apps/platform-admin`) from the tenant ERP. It uses the same design system (Shadcn UI, Tailwind CSS 4, purple theme) but with a distinct visual identity marker — a dark sidebar with "PLATFORM ADMIN" branding — to prevent confusion with the tenant ERP.

## Target Users

| Persona | Role | Primary Tasks |
|---------|------|---------------|
| **Platform Admin** | Vendor operator (PLATFORM_ADMIN) | Tenant lifecycle, billing, AI quotas, impersonation, incident response |
| **Platform Viewer** | Vendor support/finance (PLATFORM_VIEWER) | Read-only dashboards, tenant status, AI usage reporting |

## Navigation Structure

```
Platform Admin Portal
├── Dashboard (platform health, active tenants, AI usage summary, alerts)
├── Tenants
│   ├── Tenant List (T1: Entity List template)
│   ├── Tenant Detail (T2: Record Detail template)
│   │   ├── Overview tab (status, plan, billing, last activity)
│   │   ├── Modules & Flags tab (module overrides, feature flags)
│   │   ├── Users tab (tenant user list, read-only + action buttons)
│   │   ├── AI Usage tab (token dashboard, quota settings)
│   │   ├── Billing tab (subscription, payment history, enforcement)
│   │   ├── Diagnostics tab (auth, webhooks, email, integrations)
│   │   └── Audit tab (tenant-specific platform actions)
│   └── Create Tenant (T6: Wizard template)
├── Plans
│   ├── Plan List
│   └── Plan Detail (limits, modules, AI quotas)
├── AI Usage
│   ├── Overview (cross-tenant usage, cost tracking)
│   ├── Alerts (quota warnings, anomaly flags)
│   └── Export (CSV for finance)
├── Billing
│   ├── Billing Overview (payment status across all tenants)
│   └── Enforcement Controls
├── Support Console
│   ├── Search (by domain, name, email, ID)
│   ├── Runbook Actions
│   └── Impersonation (start session → redirect to tenant ERP with banner)
├── Monitoring
│   ├── Health Dashboard
│   ├── Error Tracking
│   ├── Background Jobs
│   └── System Controls (maintenance mode, kill-switches)
├── Audit Log (immutable, filterable by actor, action, target, date range)
└── Settings
    ├── Platform Admins (manage accounts, enforce MFA)
    └── Global Feature Flags
```

## Key UX Patterns — Platform-Specific

**1. Impersonation Banner (Critical UX Safety)**

When a platform admin impersonates a tenant, the ERP displays a persistent, non-dismissable banner:

```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠️ IMPERSONATING: Acme Ltd (acme-ltd)  |  Expires: 45 min  |  [End Session]  │
│ Logged in as: mohammed@nexa-erp.com  |  Reason: "Support ticket #4521"      │
└──────────────────────────────────────────────────────────────────┘
```

- Banner uses `bg-amber-500 text-black` — high-contrast, impossible to miss
- Fixed to top of viewport, above all other content
- Shows countdown timer, admin identity, stated reason
- "End Session" button always visible
- All actions during impersonation are double-logged (platform audit + tenant audit)

**2. AI Usage Dashboard (Per-Tenant)**

```
┌────────────────────────────────────────────────────┐
│ AI Usage — Acme Ltd (Pro Plan)                      │
│                                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │ 1.2M     │ │ 2.0M     │ │ 60%      │            │
│ │ Used     │ │ Allowance│ │ Quota    │ ████████░░ │
│ └──────────┘ └──────────┘ └──────────┘            │
│                                                     │
│ Usage by Feature          │ Daily Trend (30d)       │
│ ┌───────────────────────┐ │ ┌─────────────────────┐│
│ │ Chat         ████ 45% │ │ │ ▁▂▃▄▅▆▇█▆▅▄▃▂▁   ││
│ │ Doc Process  ███  30% │ │ └─────────────────────┘│
│ │ Forecasting  ██   15% │ │                         │
│ │ Reconcile    █    10% │ │ [Export CSV]            │
│ └───────────────────────┘ │                         │
└────────────────────────────────────────────────────┘
```

**3. Tenant Status with Enforcement Indicators**

Tenant list rows show enforcement state with clear visual cues:

| Status | Billing | Visual |
|--------|---------|--------|
| ACTIVE + CURRENT | All good | `●` Green dot, no badge |
| ACTIVE + WARNING | Payment overdue | `●` Green dot + `⚠` Amber warning badge |
| READ_ONLY | Grace expired | `●` Amber dot + "Read-Only" badge |
| SUSPENDED | Hard stop | `●` Red dot + "Suspended" badge |
| ARCHIVED | Soft-deleted | `●` Grey dot + "Archived" badge, greyed row |

**4. Runbook Actions (Support Console)**

Safe operations presented as clearly labelled buttons with confirmation dialogs:

```
┌─────────────────────────────────────────────────┐
│ Runbook Actions — Acme Ltd                       │
│                                                   │
│ [🔄 Re-run Failed Jobs]  [📇 Rebuild Indexes]   │
│ [🔑 Rotate Tokens]       [🔁 Re-sync: Bank Feed]│
│                                                   │
│ ⚠ All actions are logged in the platform audit   │
└─────────────────────────────────────────────────┘
```

Each button triggers a confirmation dialog with action description and audit notice before executing.

## Template Reuse

The Platform Admin Portal reuses the same 8 screen templates from the ERP:
- **T1 (Entity List):** Tenant List, Plan List, Audit Log, AI Alerts
- **T2 (Record Detail):** Tenant Detail (tabbed), Plan Detail
- **T6 (Wizard):** Create Tenant
- **T7 (Settings):** Platform Admin accounts, Global Flags
- **T8 (Report):** AI Usage dashboards, Billing overview, Health dashboard

No new templates are needed — the Platform Admin is a consumer of the shared design system.

---
