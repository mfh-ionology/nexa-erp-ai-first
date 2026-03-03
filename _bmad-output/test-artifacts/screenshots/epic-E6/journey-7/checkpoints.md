# Visual Checkpoint Manifest — Journey 7: Responsive Sidebar Behaviour

## Checkpoint 1: Desktop Full Sidebar
- **When**: After login, on dashboard at default 1280px viewport
- **Screenshot file**: `step-1-desktop-full-sidebar.png`
- **What to look for**: Full sidebar (256px / w-64) visible on left with icon + label for each module group (System, Finance, Sales). Main content area on the right showing Dashboard heading. Header bar at top with company switcher in sidebar, user avatar in header.

## Checkpoint 2: Tablet Collapsed Sidebar
- **When**: After resizing viewport to tablet width (900px — within the 768–1023px tablet range)
- **Screenshot file**: `step-2-tablet-collapsed-sidebar.png`
- **What to look for**: Sidebar collapsed to icon-only mode (64px / w-16). Only module group icons visible, no text labels. Main content area fills remaining width. No hamburger button visible (tablet still shows inline sidebar).

**Note**: The test plan specifies 1100px for "tablet" but the actual breakpoint is <1024px. Using 900px to actually trigger tablet mode. The 1100px width is tested separately as a verification.

## Checkpoint 3: Phone — No Sidebar, Hamburger Visible
- **When**: After resizing viewport to 375px (phone width)
- **Screenshot file**: `step-3-phone-no-sidebar.png`
- **What to look for**: No sidebar visible at all. Header shows hamburger menu icon (three horizontal lines) on the left side. Content fills full width. Bottom tab bar visible at the bottom of the screen.

## Checkpoint 4: Mobile Drawer Open
- **When**: After clicking the hamburger menu button on phone viewport
- **Screenshot file**: `step-4-mobile-drawer-open.png`
- **What to look for**: Off-canvas sidebar drawer (Sheet) slides in from left, 256px wide. Shows full navigation with module groups (System, Finance, Sales) with icons and text labels. Company switcher visible at top. Semi-transparent backdrop overlay behind the drawer.

## Checkpoint 5: Navigation Complete — Drawer Closed
- **When**: After clicking "Users" sub-item under System group in the mobile drawer
- **Screenshot file**: `step-5-users-page-drawer-closed.png`
- **What to look for**: Mobile drawer is closed (no sidebar visible). URL should be /system/users. Main content shows Users page content. Hamburger menu still visible in header. Bottom tab bar still visible.
