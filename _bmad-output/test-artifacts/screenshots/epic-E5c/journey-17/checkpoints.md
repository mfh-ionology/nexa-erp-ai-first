# Journey 17: Run Detail Page with Step Timeline — Visual Checkpoints

## Checkpoint 1: Run Detail Page Loaded
- **When**: After clicking first run row from the runs list (Step 2)
- **Screenshot file**: `step-2-run-detail-page-loaded.png`
- **What to look for**: T2 Detail page with run summary header showing automation name as link, run ID in mono font, large StatusBadge (colored dot + text), triggered by info, timestamps. Metrics cards row visible below header. Step timeline section visible.

## Checkpoint 2: Step Timeline Visible
- **When**: After verifying step timeline exists (Step 4)
- **Screenshot file**: `step-4-step-timeline-visible.png`
- **What to look for**: Vertical timeline with purple connector line between steps. Each step card shows a colored status indicator circle (green=completed, red=failed, amber=running, grey=pending), step number, agent name, status badge, duration, and token count.

## Checkpoint 3: Step Details Expanded
- **When**: After clicking first step header to expand (Step 5)
- **Screenshot file**: `step-5-step-details-expanded.png`
- **What to look for**: Expanded step card showing: goal text, collapsible JSON viewers for input/output data (mono font), model ID in mono, turns count, token breakdown (Input: X / Output: Y), timing info. JSON viewer should have copy button and collapse/expand toggle.

## Checkpoint 4: JSON Copy Feedback
- **When**: After clicking copy button on JSON viewer (Step 7)
- **Screenshot file**: `step-7-json-copy-feedback.png`
- **What to look for**: Visual feedback that JSON was copied — either a toast notification, or the copy button changing to a checkmark/copied state.
