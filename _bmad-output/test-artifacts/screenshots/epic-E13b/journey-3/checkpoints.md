# Journey 3: PLATFORM_VIEWER Sees Read-Only UI — Visual Checkpoints

## CP1: Dashboard with read-only indicator
- **When**: After login as PLATFORM_VIEWER, landing on dashboard
- **Screenshot**: `01-dashboard-read-only-indicator.png`
- **What to look for**: Warning-styled banner with text "Read-only mode" visible on the dashboard. Sidebar navigation should be fully visible (all nav items accessible).

## CP2: Tenants list without New Tenant button
- **When**: After navigating to /tenants
- **Screenshot**: `02-tenants-list-no-create-button.png`
- **What to look for**: Tenants page header shows "Tenants" title. The action area (top-right) should NOT contain a "+ New Tenant" button. Table and filters should still be visible and functional.

## CP3: Tenant detail without lifecycle action buttons
- **When**: After clicking first tenant row to open detail page
- **Screenshot**: `03-tenant-detail-no-action-bar.png`
- **What to look for**: Tenant detail page loads with tenant name and status badge. The action bar area (top-right) should NOT show Suspend, Reactivate, Archive, or Impersonate buttons. Tabs should still be visible.

## CP4: Modules & Flags tab with disabled toggles
- **When**: After clicking the "Modules & Flags" tab on tenant detail
- **Screenshot**: `04-modules-flags-disabled-toggles.png`
- **What to look for**: Module override toggle switches should be visible but disabled (greyed out / non-interactive). Feature flag toggles should also be disabled.

## CP5: Plans page without New Plan button
- **When**: After navigating to /plans
- **Screenshot**: `05-plans-no-create-button.png`
- **What to look for**: Plans page with plan cards visible (Core, Pro, Enterprise). No "+ New Plan" button in the header area.

## CP6: Billing dashboard
- **When**: After navigating to /billing
- **Screenshot**: `06-billing-dashboard.png`
- **What to look for**: Billing page loads with KPI cards and/or issues table. Verify the page renders without errors.

## CP7: AI Usage page without Export CSV
- **When**: After navigating to /ai-usage
- **Screenshot**: `07-ai-usage-no-export.png`
- **What to look for**: AI Usage overview with KPI cards and chart visible. No "Export CSV" button should be visible (hidden by RequirePlatformRole guard for non-admin users).

## CP8: Support console without Impersonate buttons
- **When**: After navigating to /support
- **Screenshot**: `08-support-no-impersonate.png`
- **What to look for**: Support console search bar visible. If results are shown, "View" buttons should be present but "Impersonate" buttons should be hidden. The empty state is also acceptable if no search has been performed.
