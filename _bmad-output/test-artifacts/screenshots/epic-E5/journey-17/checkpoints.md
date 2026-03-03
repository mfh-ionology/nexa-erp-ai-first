# Visual Checkpoints — Journey 17: View Daily Briefing as Business Owner

## Checkpoint 1: Business Owner Dashboard with Daily Briefing
- **When**: After step 4 — logged in as Business Owner, navigated to dashboard
- **Screenshot file**: `step-4-owner-briefing-dashboard.png`
- **What to look for**:
  - Dashboard page loaded with a prominent Daily Briefing section
  - Personalised greeting visible (e.g., "Good morning/afternoon/evening, [Name]")
  - Owner/SUPER_ADMIN role-specific briefing categories are present:
    - "Revenue vs Prior Period" with revenue metric and delta (e.g., "+8% vs last month")
    - "Overdue Receivables" with total outstanding amount
    - "Pending Approvals" covering ALL modules (not just finance — wider scope than Finance Manager)
    - "AI-Detected Opportunities" or similar opportunity section
  - Content is visibly different from Finance Manager briefing (wider business scope)
  - Each briefing item has action buttons (Review, View, etc.)
  - A "Refresh" button or "cached at" timestamp is visible

## Checkpoint 2: Revenue vs Prior Period Detail
- **When**: After step 5 — verifying revenue briefing item exists with metric and comparison
- **Screenshot file**: `step-5-revenue-vs-prior-period.png`
- **What to look for**:
  - Revenue briefing item clearly visible with:
    - Current period revenue value in GBP (e.g., "£45,000")
    - Delta/trend indicator showing percentage change (e.g., "+8%")
    - Direction arrow (green up for positive, red down for negative)
    - Comparison period label (e.g., "vs last month")
  - The metric is prominently displayed, not hidden or truncated

## Checkpoint 3: Cross-module Pending Approvals
- **When**: After step 6 — verifying pending approvals span all modules
- **Screenshot file**: `step-6-cross-module-approvals.png`
- **What to look for**:
  - Pending Approvals section visible covering items across ALL modules
  - Owner sees a holistic view: finance approvals, sales approvals, HR approvals, etc.
  - This is broader than the Finance Manager's finance-only approvals
  - Count or badge showing total pending items across modules
  - Action buttons available to review/approve
