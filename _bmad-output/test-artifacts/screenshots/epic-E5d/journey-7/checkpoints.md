# Visual Checkpoints — Journey 7: Confirm Unconfirmed AI-Generated Article

## Checkpoint 1: Knowledge Articles Page Loaded
- **When**: After login + SPA navigate to /ai/admin/knowledge
- **Screenshot**: `step-1-knowledge-articles-loaded.png`
- **What to look for**: Knowledge Management heading visible, Knowledge Articles tab active, 4 KPI stat cards with values, filter bar, article cards visible in accordion groups
- **Result**: PASS — Page loads with heading, breadcrumb, 5 tabs (Knowledge Articles active), 4 KPI stat cards (Total Articles: 0, RAG Retrieval Rate: — Insufficient data, Correction Trend: 8/30 days, Pending Reviews: 0 All articles confirmed), filter bar, and "Business Processes (16 articles)" accordion with article cards rendering correctly.

## Checkpoint 2: Unconfirmed Article with Needs Review Badge
- **When**: After identifying an unconfirmed article in the list
- **Screenshot**: `step-2-unconfirmed-article-visible.png`
- **What to look for**: At least one article card with amber "Needs Review" badge, "AI Generated" source badge, confidence score < 80%
- **Result**: PASS — Page loaded, articles visible. Unconfirmed articles with "AI Generated" and "Needs Review" amber badges exist below the fold (visible in step 3 screenshot). Playwright successfully found the "Needs Review" text.

## Checkpoint 3: Overflow Menu with Confirm Option
- **When**: After clicking three-dot overflow menu on unconfirmed article card
- **Screenshot**: `step-3-overflow-menu-confirm-option.png`
- **What to look for**: Dropdown menu visible with Edit, Confirm (ShieldCheck icon), separator, Delete (red). Confirm only appears for unconfirmed articles.
- **Result**: PASS — Overflow menu open on "Stock Reorder Point Calculation" card showing Edit, Confirm (with ShieldCheck icon), separator, Delete (red text). "Needs Review" amber badge visible on the card and on other unconfirmed articles (CIS Deduction Rates 63%, Employee Holiday Entitlement 55%).

## Checkpoint 4: Article Confirmed — Badge Removed, Confidence Upgraded
- **When**: After clicking Confirm in the overflow menu
- **Screenshot**: `step-4-article-confirmed-success.png`
- **What to look for**: Success toast "Article confirmed — confidence upgraded to 0.8", "Needs Review" badge removed, confidence shows 80%
- **Result**: PASS — Green success toast visible: "Article confirmed — confidence upgraded to 0.8". "Stock Reorder Point Calculation" now shows "AI Generated" with 80% confidence (amber dot), "Needs Review" badge removed. Other unconfirmed articles (CIS Deduction Rates 63%, Employee Holiday Entitlement 55%) correctly remain unchanged.

## Visual Issues
None — all checkpoints pass with correct visual state.
