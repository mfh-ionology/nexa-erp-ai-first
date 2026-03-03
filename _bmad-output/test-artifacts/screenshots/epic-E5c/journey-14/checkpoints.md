# Journey 14: Run Detail — Step Timeline & Expandable Details
## Visual Checkpoint Manifest

### Checkpoint 1: Run Detail Page Loaded
- **When**: After step 2 — clicking a run row to navigate to detail page
- **Screenshot file**: `step-2-run-detail-loaded.png`
- **What to look for**: Run detail page visible with automation name heading (linked), run ID in mono font code tag, large status badge (green for COMPLETED or red for FAILED), triggered-by label, started/completed timestamps. Purple-themed Concept D styling.

### Checkpoint 2: Metrics Cards Row
- **When**: After step 4 — verifying the 4 metrics cards
- **Screenshot file**: `step-4-metrics-cards.png`
- **What to look for**: 4 metrics cards in a horizontal row: Total Tokens (with input/output breakdown), Total Cost (£ formatted), Steps (completed/total with progress bar in purple #7c3aed), Duration. Cards should have 12px radius (rounded-xl), subtle shadow, mono font for numbers. Staggered fade-in-up animation.

### Checkpoint 3: Step Timeline Overview
- **When**: After step 5 — verifying the step timeline structure
- **Screenshot file**: `step-5-step-timeline.png`
- **What to look for**: "Step Execution Timeline" heading with Zap icon. Vertical timeline with coloured status circles (green=completed, red=failed, grey=pending/skipped) connected by purple line. Each step shows step number, agent name, status badge, duration, and token count.

### Checkpoint 4: Step Expanded with Details
- **When**: After step 6 — clicking first step to expand
- **Screenshot file**: `step-6-step-expanded.png`
- **What to look for**: Expanded step card showing: goal text in light purple background (#f5f3ff), Input Data section with collapsible JSON viewer (mono font, copy button), Output Data section, model ID in mono, turns count, token breakdown (input/output), timing details. If failed step: red border accent and error message.

### Checkpoint 5: JSON Viewer Toggle
- **When**: After step 7 — toggling Input Data JSON viewer
- **Screenshot file**: `step-7-json-viewer-toggled.png`
- **What to look for**: JSON viewer showing formatted JSON with 2-space indentation in mono font (text-xs). Container has light purple background (#f8f7ff), border, rounded-lg. Copy button visible in top-right corner. Max height with overflow scroll if content is long.

### Checkpoint 6: Step Collapsed Back
- **When**: After step 9 — collapsing the first step
- **Screenshot file**: `step-9-step-collapsed.png`
- **What to look for**: Step timeline back to collapsed/summary view. Only step headers visible with status badges, duration, and token counts. No expanded detail cards visible.
