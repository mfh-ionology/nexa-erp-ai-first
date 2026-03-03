# Visual Checkpoint Manifest — Journey 14: Memory Page Responsive Behaviour

## Checkpoint 1: Phone Layout (375x812)
- **When**: After navigating to /ai/memory with 375x812 viewport
- **Screenshot file**: step-1-phone-375x812.png
- **What to look for**:
  - Single column layout — no side-by-side panels
  - Settings panel stacks vertically (toggle, checkboxes, retention all full-width)
  - Category checkboxes wrap within available width
  - Memory cards are full-width within the container
  - Touch-friendly button sizes (min 44px tap targets)
  - No horizontal overflow or scrollbar
  - Page fits within 375px width without clipping
  - Light purple (#f4f2ff) background visible
  - Brain icon + "My Memory" heading visible at top

## Checkpoint 2: Tablet Layout (768x1024)
- **When**: After navigating to /ai/memory with 768x1024 viewport
- **Screenshot file**: step-2-tablet-768x1024.png
- **What to look for**:
  - Single column but wider form layout compared to phone
  - Settings panel and memory list occupy full width
  - Search bar and filter pills may sit on same row (sm breakpoint kicks in at 640px)
  - Memory cards have more breathing room
  - Content is centered with max-w-3xl constraint
  - No horizontal overflow

## Checkpoint 3: Desktop Layout (1440x900)
- **When**: After navigating to /ai/memory with 1440x900 viewport
- **Screenshot file**: step-3-desktop-1440x900.png
- **What to look for**:
  - Full desktop layout with generous whitespace
  - Content centered within max-w-3xl container (768px max)
  - Two-column settings layout if applicable (label left, input right)
  - Wider memory cards with more visible content
  - Search + filter bar on a single horizontal row
  - Settings panel, stats panel, and memory list all visible
  - More vertical content visible (900px viewport height)
  - Sidebar visible on the left side
