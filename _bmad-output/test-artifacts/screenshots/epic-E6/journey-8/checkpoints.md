# Visual Checkpoints — Journey 8: Co-Pilot Dock: Cmd+K and Drawer

## Checkpoint 1: Dashboard loaded with search input
- **When**: After login completes and dashboard loads (pre-condition)
- **Screenshot file**: step-0-dashboard-with-search.png
- **What to look for**: Dashboard page with header bar visible. Header contains search input ("Search or Ask Nexa anything...") with Cmd+K badge, chat button (MessageSquare icon), notifications bell, and user avatar. Sidebar visible on left.

## Checkpoint 2: Command palette focused via Cmd+K
- **When**: After pressing Cmd+K keyboard shortcut (Step 2)
- **Screenshot file**: step-2-cmd-k-search-focused.png
- **What to look for**: Search command palette popover is open. CommandInput inside the popover is focused with cursor visible. Rotating placeholder hint text displayed (e.g. "Try: 'Invoice Acme for March widgets'"). The popover appears below the search trigger in the header.

## Checkpoint 3: Entity search results for "INV-"
- **When**: After typing "INV-" in the search input (Step 3)
- **Screenshot file**: step-3-entity-results-inv.png
- **What to look for**: Command palette dropdown showing "Entities" section with invoice-related placeholder results (disabled, with "Entity search coming in E7" label). May also show "Pages" section if any page names match. Each entity result has a FileText icon and appears at reduced opacity (disabled).

## Checkpoint 4: Co-Pilot drawer open
- **When**: After clicking the Chat button in the header bar (Step 5)
- **Screenshot file**: step-5-copilot-drawer-open.png
- **What to look for**: 380px wide drawer panel visible on the right side of the screen (role="complementary"). Header shows Sparkles icon + "Co-Pilot" title with close (X) button. Empty state visible with "Hi! I'm your Nexa Co-Pilot..." message. Quick prompts section with chips. Input area at bottom with "Ask Nexa anything..." placeholder and disabled send button.

## Checkpoint 5: User message sent, AI response streaming
- **When**: After typing "Show me overdue invoices" and pressing Enter/Send (Step 7)
- **Screenshot file**: step-7-chat-message-sent.png
- **What to look for**: Chat area showing user message bubble on the right side (purple/primary background, rounded-br-md). User avatar with initials. AI assistant response below/left (grey/muted background, rounded-bl-md) with placeholder text. Sparkles icon avatar for AI. Streaming dots animation may be visible briefly. Timestamps on messages.

## Checkpoint 6: Co-Pilot drawer closed
- **When**: After clicking the Chat button again to close the drawer (Step 8)
- **Screenshot file**: step-8-drawer-closed.png
- **What to look for**: Drawer is no longer visible (width collapsed to 0). Main content area fills the full width again. Chat button in header shows "Open Co-Pilot" state (not active). Dashboard content visible without any overlay.
