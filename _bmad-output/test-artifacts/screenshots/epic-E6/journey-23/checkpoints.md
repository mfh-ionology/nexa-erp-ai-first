# Visual Checkpoints — Journey 23: Breadcrumb Navigation and Skip Link

## Checkpoint 1: Resource Registry page with breadcrumbs
- **When**: After navigating to `/system/resources` (Step 1)
- **Screenshot file**: `step-1-resource-registry-breadcrumbs.png`
- **What to look for**:
  - Breadcrumb nav visible below the header bar
  - Trail shows two segments: "System" (as a link) and "Resource Registry" (as current page text)
  - ChevronRight separator icon visible between the two segments
  - The last segment ("Resource Registry") has `aria-current="page"` and appears in bolder/darker text
  - "System" segment is styled as a clickable link (muted text color)

## Checkpoint 2: Navigation to System module root after clicking breadcrumb
- **When**: After clicking "System" breadcrumb link (Step 2)
- **Screenshot file**: `step-2-system-root-after-breadcrumb-click.png`
- **What to look for**:
  - URL has changed to `/system` (not `/system/resources`)
  - Page content reflects the System module root (may show a system landing page or redirect)
  - Breadcrumbs updated to show only "System" as the current page

## Checkpoint 3: Access Groups page with breadcrumbs
- **When**: After navigating to `/system/access-groups` and verifying breadcrumb text (Steps 3-4)
- **Screenshot file**: `step-4-access-groups-breadcrumbs.png`
- **What to look for**:
  - Breadcrumb trail shows "System" (link) > "Access Groups" (current page)
  - ChevronRight separator visible between segments
  - "Access Groups" segment has `aria-current="page"` styling (bolder/darker)
  - The page content area shows the Access Groups list page

## Checkpoint 4: Skip-to-content link visible on focus
- **When**: After pressing Tab to focus the skip link (Step 5)
- **Screenshot file**: `step-5-skip-to-content-link-visible.png`
- **What to look for**:
  - "Skip to content" link visible at the top-left of the page (fixed position)
  - Link has purple/primary background color with white text (from `focus:bg-primary focus:text-primary-foreground`)
  - Link is rendered with a rounded border and shadow (`focus:rounded-md focus:shadow-lg`)
  - The link was previously hidden (sr-only) and only became visible on keyboard focus
