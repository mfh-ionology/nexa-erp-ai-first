# Journey 21: Sidebar Navigation for All AI Admin Pages — Visual Checkpoints

## Checkpoint 1: AI Sidebar Sections Visible
- **When**: After login and app load (step 2)
- **Screenshot**: `step-2-ai-sidebar-sections.png`
- **What to look for**: Sidebar expanded showing two AI-related groups: "AI" group (Morning Briefing, My Memory, Automation Runs) and "AI Administration" group (Model Registry, Prompt Templates, Agent Configuration, Skill Packs, Automations). Both groups should have divider lines above them.

## Checkpoint 2: AI Administration Dashboard Active State
- **When**: After clicking "AI Administration" / navigating to /ai/admin (step 3 — but no direct dashboard link exists, so we navigate via SPA)
- **Screenshot**: `step-3-ai-admin-models-active.png`
- **What to look for**: Model Registry sidebar item highlighted with purple background (`bg-primary`) and white text, indicating active state per Concept D design.

## Checkpoint 3: All AI Admin Pages Navigated Successfully
- **When**: After clicking through all sidebar links (after step 9)
- **Screenshot**: `step-9-automation-runs-page.png`
- **What to look for**: Automation Runs page loaded correctly, sidebar shows Automation Runs link with active (purple bg + white text) state. URL should be /ai/admin/automations/runs.

## Visual Review Results

- **Checkpoint 1**: PASS — Sidebar visible with all navigation groups, Concept D theme applied.
- **Checkpoint 2**: PASS — Model Registry active with correct purple highlight, breadcrumb correct.
- **Checkpoint 3**: PASS with VISUAL ISSUE — Two sidebar items highlighted simultaneously: "Automation Runs" (AI group) AND "Automations" (AI Administration group) both show purple active state. Root cause: `isActivePath()` uses `pathname.startsWith(path)` and `/ai/admin/automations/runs` starts with `/ai/admin/automations`. This is a minor UX issue — only one item should be highlighted.
