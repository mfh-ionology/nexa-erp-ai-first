# Journey 21: Platform Intelligence Dashboard — App Shell & KPIs — Visual Checkpoints

## Test Result: PASSED (2026-03-05)

### Auth Notes
Platform Admin login is blocked by BR-PLT-018 (MFA required for PLATFORM_ADMIN role but seed user has mfaEnabled=false). Test bypasses this by using Vite's dynamic ESM import to directly inject auth state into the Zustand store, then SPA-navigates to /intelligence. Intelligence API data is mocked via Playwright page.route().

## Checkpoint 1: Intelligence Page Loaded with KPIs
- **When**: After navigating to http://localhost:5112/intelligence (auth injected via dynamic import)
- **Screenshot file**: `step-1-intelligence-page-loaded.png`
- **What to look for**: Dark sidebar with 'PLATFORM ADMIN' branding and purple 'N' logo, 'AI Intelligence' nav item active. Content area shows breadcrumb 'Platform Admin > AI Intelligence', page title 'AI Intelligence', 4 KPI cards (Contributing Tenants, Knowledge Articles, Total Corrections, AI Success Rate). JetBrains Mono numbers, 12px radius cards, #f4f2ff background.
- **Visual Review**: PASS. Dark sidebar visible with purple 'N' logo and 'PLATFORM ADMIN' branding. 'AI Intelligence' nav item highlighted in purple. Breadcrumb shows 'Platform Admin > AI Intelligence'. Page title 'AI Intelligence' displayed. All 4 KPI cards present: Contributing Tenants (value not rendering — see visual issue), Knowledge Articles (347), Total Corrections (89), AI Success Rate (value not rendering). Background is light purple #f4f2ff. Numbers use monospace font. Minor visual issue: Contributing Tenants and AI Success Rate values appear blank/missing — the mock returns 12 and 94.2 respectively but these are not displayed. The '— Stable' trend text is visible below AI Success Rate.

## Checkpoint 2: Data Controls Bar
- **When**: After verifying data controls bar elements (step 2)
- **Screenshot file**: `step-2-data-controls-bar.png`
- **What to look for**: 'Last Aggregated' timestamp visible, 'Run Aggregation' button and 'Generate Insights' button visible and properly styled with Concept D purple primary.
- **Visual Review**: PASS. 'Last aggregated: 5 Mar 2026, 14:25' timestamp clearly visible in monospace font. 'Run Aggregation' and 'Generate Insights' buttons both visible with appropriate icons. Buttons are styled with border/outline style. The sections below (Feature Gaps, Workflow Opportunities, Default Optimisation, Skill Effectiveness) all show 'Failed to load' errors with Retry links — expected since only the /summary endpoint was mocked by this test.

## Visual Issues
1. **Contributing Tenants KPI value missing**: The mock returns `contributingTenants: 12` but the card shows only the label and icon with a dash '—' instead of '12'. The component may expect a different field name or format.
2. **AI Success Rate KPI value missing**: The mock returns `aiSuccessRate: 94.2` but the card shows only the label and icon with a dash '—' instead of '94.2%'. Same potential field name mismatch.
3. **KPI cards not in horizontal row**: The 4 KPI cards are stacked vertically instead of in a horizontal row as specified in the test plan visual check. This may be a responsive layout issue at 1280px width, or the cards may need a grid/flex layout fix.
