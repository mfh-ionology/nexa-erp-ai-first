# Visual Checkpoints — Journey 11: Training Examples — Filtering

## Checkpoint 1: Training Tab with Filter Bar
- **When**: After navigating to Training Examples tab (Step 1)
- **Screenshot file**: `step-1-training-tab-with-filters.png`
- **What to look for**: Training Examples tab active, filter bar visible with category dropdown/button, skill key input, search input, training example cards below filter bar, purple #f4f2ff background
- **Result**: PASS — Training Examples tab active with purple underline. Filter bar shows "All Categories" button, "Filter by skill" monospace input, All/Active/Inactive toggle, Search input, and purple "+ Add Example" button. Cards display training examples in 2-column grid with "When user asks:" / "AI should answer:" layout, skill key badges (monospace purple), category badges, source badges, active toggles, and overflow menus. Mixed categories visible (Business Processes, Historical Patterns, Industry Rules). Purple-tinted background present.

## Checkpoint 2: Category Filter Applied (TERMINOLOGY)
- **When**: After selecting TERMINOLOGY from Category filter popover (Step 2)
- **Screenshot file**: `step-2-category-terminology-filtered.png`
- **What to look for**: Category button/badge shows "Terminology" selected, card list reduced to only Terminology-category examples, Clear filters button visible
- **Result**: PASS — Filter button changed to "Terminology" with purple border/bg tint. All visible cards show Terminology category badge and vat_lookup/finance.vat skill key badges. "Clear" button appeared in filter bar. Card count visibly reduced.

## Checkpoint 3: Skill Key Filter Applied (vat_lookup)
- **When**: After typing "vat_lookup" in skill key input (Step 3)
- **Screenshot file**: `step-3-skill-key-filtered.png`
- **What to look for**: Skill key input filled with "vat_lookup" in monospace font, filtered list shows only examples with "vat_lookup" skill key badge, combined with category filter should show fewer results
- **Result**: PASS — Skill key input shows "vat_lookup" in monospace font with purple border accent. Combined with Terminology filter, cards further reduced. All visible cards show vat_lookup skill key badge. KPI stats panel visible at top (Total Articles: 0, RAG Retrieval Rate: Insufficient data, Correction Trend: 8, Pending Reviews: 0). Clear button still visible.

## Checkpoint 4: Search Filter Applied (reverse charge)
- **When**: After typing "reverse charge" in search input (Step 4)
- **Screenshot file**: `step-4-search-filtered.png`
- **What to look for**: Search input shows "reverse charge", further filtered results containing "reverse charge" in input or output text
- **Result**: PASS — Search input shows "reverse charge" text. All 3 filters stacked: Terminology + vat_lookup + "reverse charge". Visible cards all contain "reverse charge" in their AI response text ("Use reverse charge — VAT code 3 for goods..."). Cards correctly filtered to matching content only.

## Checkpoint 5: All Filters Cleared
- **When**: After clicking Clear filters button (Step 5)
- **Screenshot file**: `step-5-filters-cleared.png`
- **What to look for**: All filter inputs reset to defaults, full list of training examples restored, clear button hidden or disabled
- **Result**: PASS — All filters reset: "All Categories" button (no purple tint), skill key input empty with "Filter by skill" placeholder, search input empty with "Search..." placeholder, Clear button gone. Full list of training examples restored showing mixed categories (Business Processes first with chat-router, ar-collection-advisor, create_credit_note skill keys). Cards rendering with proper fade-in animation (some appear slightly faded, indicating staggered animation in progress).
