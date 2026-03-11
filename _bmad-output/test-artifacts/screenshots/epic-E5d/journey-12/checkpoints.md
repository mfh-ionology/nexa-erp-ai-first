# Visual Checkpoints — Journey 12: Corrections Tab — Stats Panel & Grouped List

## Checkpoint 1: Corrections Tab Initial Load
- **When**: After navigating to `/ai/admin/knowledge#corrections`
- **Screenshot**: `step-1-corrections-tab-loaded.png`
- **What to look for**:
  - Corrections tab is active (highlighted)
  - Top row shows 4 KPI stat cards (Total Corrections, Last 30 Days with trend arrow, By Type segmented color bar with legend, Auto-resolved count + percentage)
  - Cards have rounded-xl styling, custom shadow, JetBrains Mono numbers
  - Below stats: corrections grouped by type in collapsible accordion sections
  - Color-coded type labels: TERMINOLOGY (purple), PROCESS (blue), DATA (green), PREFERENCE (amber), OTHER (gray)
  - Purple #f4f2ff page background
  - If no corrections exist, empty state message should appear

## Checkpoint 2: Correction Card Details
- **When**: After verifying individual correction card content
- **Screenshot**: `step-2-correction-card-details.png`
- **What to look for**:
  - Correction card shows original AI response (italic/muted text)
  - Corrected response in bold
  - Skill key badge visible (monospace, purple tint) if corrections have skill keys
  - Status badge: green "Auto-resolved" or muted "Pending"
  - Relative timestamp (e.g. "2 hours ago")
  - "Create Article" action button with BookPlus icon
  - Cards have fadeInUp animation, rounded-xl, purple hover shadow

## Checkpoint 3: Accordion Collapsed
- **When**: After clicking to collapse a correction type group accordion
- **Screenshot**: `step-3-accordion-collapsed.png`
- **What to look for**:
  - Clicked accordion section is collapsed (content hidden)
  - Accordion header still shows the type label and count badge
  - Other groups remain in their previous state
  - Visual toggle indicator changed (chevron rotated or similar)
