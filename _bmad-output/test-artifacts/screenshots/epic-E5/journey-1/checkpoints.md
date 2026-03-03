# Visual Checkpoint Manifest — Journey 1: Verify AI UI Elements Present in App Shell

## Checkpoint 1: Dashboard After Login
- **When**: After step 3 — clicking Sign In and being redirected to the dashboard
- **Screenshot file**: `step-3-dashboard-after-login.png`
- **What to look for**:
  - Dashboard page loaded (not still on login page)
  - App shell visible: sidebar navigation on the left, top header bar across the top
  - Header contains a unified search/AI input bar (may show rotating placeholder examples like "Invoice Acme for March widgets" or "Show overdue invoices")
  - A chat toggle button (Co-Pilot button) is visible in the header area
  - No badge indicator on the chat toggle button (no pending AI suggestions)
  - Co-Pilot drawer is NOT visible (it should be closed by default on first login)
  - No error messages or broken layout

## Checkpoint 2: Unified Search/AI Input Verified
- **When**: After step 4 — verifying the unified search/AI input element exists
- **Screenshot file**: `step-4-search-input-verified.png`
- **What to look for**:
  - Search/AI input field clearly visible in the header bar
  - Placeholder text present (should rotate between entity search and AI command examples)
  - Input is styled as a prominent, accessible search bar (not hidden or tiny)

## Checkpoint 3: Chat Toggle Button Verified
- **When**: After step 5 — verifying the chat toggle button exists
- **Screenshot file**: `step-5-chat-toggle-verified.png`
- **What to look for**:
  - Chat/Co-Pilot toggle button visible in the header area
  - No badge dot visible (no pending AI suggestions for first login)
  - Button appears clickable/interactive (not greyed out or disabled)

## Checkpoint 4: Final State — All Elements Verified, Drawer Closed
- **When**: After step 6 — confirming the Co-Pilot drawer is NOT visible
- **Screenshot file**: `step-6-drawer-closed-confirmed.png`
- **What to look for**:
  - Full dashboard layout visible without any drawer overlay
  - Main content area takes full width (no right-side panel)
  - All previously verified elements still visible (search bar, chat toggle)
  - No Co-Pilot drawer panel on the right side of the screen
  - Clean, complete app shell layout
