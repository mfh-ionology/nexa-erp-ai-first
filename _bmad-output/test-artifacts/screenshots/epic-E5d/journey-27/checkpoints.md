# Journey 27: Tenant Knowledge Management — Responsive Layout

## Visual Checkpoints

### Checkpoint 1: Tablet Layout (768px)
- **When**: After navigating to /ai/admin/knowledge at 768px viewport
- **Screenshot**: `step-1-tablet-layout.png`
- **What to look for**:
  - Stats KPI cards in 2-column grid (not 4-across)
  - All 5 tabs visible below stats panel
  - Content in single column layout
  - Sidebar collapsed or behind hamburger menu
  - Purple #f4f2ff background maintained
  - No horizontal overflow or broken layout

### Checkpoint 2: Tablet Tab Interaction
- **When**: After clicking Training Examples tab at tablet viewport
- **Screenshot**: `step-2-tablet-tab-interaction.png`
- **What to look for**:
  - Training Examples tab active
  - Tab content renders correctly in constrained width
  - Cards/list items stack or reflow properly

### Checkpoint 3: Mobile Layout (375px)
- **When**: After navigating to /ai/admin/knowledge at 375px viewport
- **Screenshot**: `step-3-mobile-layout.png`
- **What to look for**:
  - Stats KPI cards stacked vertically (1 column)
  - Sidebar fully collapsed behind hamburger menu
  - Mobile accordion layout for tab content (instead of horizontal tabs)
  - No horizontal overflow
  - Touch-friendly spacing

### Checkpoint 4: Mobile Tab/Accordion Navigation
- **When**: After interacting with tab/accordion on mobile
- **Screenshot**: `step-4-mobile-accordion-interaction.png`
- **What to look for**:
  - Accordion-style navigation working (if implemented)
  - Content sections expand/collapse properly
  - Training example cards stacked in single column (not 2-col grid)
