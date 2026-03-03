# Epic E9 — Notifications: v0 Prompt

> **Usage:** Paste the **Design System Base** from `epic-E5-E5b-v0-prompt.md` (lines 1–185) FIRST, then append the epic-specific section below.

---

## EPIC-SPECIFIC SECTION: E9 — Notifications

### Epic Context

Real-time notification system with bell icon in header, notification centre dropdown, and preferences settings page.

**Sidebar location:** None for bell (header component). Preferences under System > Notification Preferences.

---

### Component 1: Notification Bell + Dropdown

**Container:** Popover from header bell icon
**Trigger:** Bell icon in header bar (right section)
**Story:** E9.S2

```
┌──────────────────────────────────┐
│ Bell ③                           │  ← Bell with unread count badge
└──────┬───────────────────────────┘
       ▼
┌──────────────────────────────────────────┐
│ Notifications                [Mark All Read]│
├──────────────────────────────────────────┤
│                                          │
│ ● NEW ─────────────────────────────────  │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │ Invoice INV-00234 approved         │   │
│ │ Sarah approved your invoice        │   │
│ │ 5 min ago                  [Dismiss]│   │
│ └────────────────────────────────────┘   │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │ Payment overdue: CUST-00045       │   │
│ │ Acme Ltd has £12,400 overdue       │   │
│ │ 1h ago                     [Dismiss]│   │
│ └────────────────────────────────────┘   │
│                                          │
│ ● EARLIER ─────────────────────────────  │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │ Payroll run completed              │   │
│ │ March payroll processed — 24 slips │   │
│ │ Yesterday              [Read]      │   │
│ └────────────────────────────────────┘   │
│                                          │
│ [View All Notifications →]               │
└──────────────────────────────────────────┘
```

**Components needed:**
- Bell icon with animated red badge (count > 0), pulse animation on new notification
- Popover dropdown (max-height with scroll), 380px wide
- Notification card: icon (by category), title (bold), description, relative time, dismiss button
- Grouped: "New" (unread, white background) and "Earlier" (read, slightly muted `bg-muted/30`)
- Priority levels: URGENT (red left border `border-l-4 border-red-500` + toast), HIGH (amber left border `border-l-4 border-amber-500`), NORMAL (no border), LOW (no border, muted text)
- Click notification → navigate to linked entity
- "Mark All Read" button at top (ghost variant)
- Real-time updates via WebSocket (new notifications slide in at top with slideIn animation)
- Toast notifications for URGENT/HIGH priority (appears top-right via Sonner, auto-dismiss 6s for HIGH, persistent for URGENT)

**Notification Icon by Category:**
- Invoice: `FileText` icon, blue tint
- Payment: `CreditCard` icon, green tint
- Approval: `CheckCircle` icon, amber tint
- Task: `ListTodo` icon, purple tint
- System: `Settings` icon, grey tint
- AI: `Sparkles` icon, purple tint
- Alert/Warning: `AlertTriangle` icon, red tint

**Responsive:**
- Desktop: Popover dropdown, 380px wide, below bell icon
- Tablet: Same as desktop
- Phone: Bottom sheet instead of popover (full width, draggable, 60% viewport height)

---

### Screen 1: Notification Preferences

**Template:** T7 — Settings
**Route:** `/system/notification-preferences`
**Story:** E9.S4

```
┌─────────────────────────────────────────────────────────┐
│ System > Notification Preferences                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Configure how and when you receive notifications.        │
│                                                          │
│ ── Invoice Events ─────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Event                 │ In-App │ Email  │ Push     │   │
│ │ ───────────────────── │ ────── │ ────── │ ──────── │   │
│ │ Invoice Approved      │ [✓]    │ [✓]    │ [ ]      │   │
│ │ Invoice Overdue       │ [✓]    │ [✓]    │ [✓]      │   │
│ │ Payment Received      │ [✓]    │ [ ]    │ [ ]      │   │
│ │ Credit Note Created   │ [✓]    │ [ ]    │ [ ]      │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── Task Events ────────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Task Assigned to Me   │ [✓]    │ [✓]    │ [✓]      │   │
│ │ Task Completed        │ [✓]    │ [ ]    │ [ ]      │   │
│ │ Task Overdue          │ [✓]    │ [✓]    │ [ ]      │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ── System Events ──────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Permission Changed    │ [✓]    │ [✓]    │ [ ]      │   │
│ │ Import Completed      │ [✓]    │ [ ]    │ [ ]      │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ [Reset to Defaults]                           [Save]     │
└─────────────────────────────────────────────────────────┘
```

**Components needed:**
- Matrix grid: rows = event types (grouped by module), columns = channels (In-App, Email, Push)
- Each cell: Checkbox/Switch toggle (use Shadcn `<Switch>` for cleaner look)
- Column headers: Channel name with icon (Bell for In-App, Mail for Email, Smartphone for Push)
- Module sections: collapsible groups (Invoice Events, Task Events, System Events, etc.) using `<Collapsible>`
- "Reset to Defaults" button (outline variant) restores role-based defaults
- Save triggers immediate update (optimistic UI with toast confirmation)
- Disabled switches for mandatory notifications (e.g., security events always in-app) — shown with lock icon tooltip
- Each event type row shows description on hover (tooltip)

**Responsive:**
- Desktop: Full matrix grid with all 3 channel columns visible
- Tablet: Same layout, slightly compressed
- Phone: Switch to card-based layout — each event type as a card with 3 toggle rows (In-App / Email / Push) stacked vertically

---

## Generation Instructions

Generate all screens listed above as React components using:
- Shadcn UI components (already installed: accordion, alert-dialog, avatar, badge, breadcrumb, button, card, checkbox, collapsible, command, dialog, dropdown-menu, form, input, label, popover, progress, radio-group, scroll-area, select, separator, sheet, skeleton, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip)
- Tailwind CSS 4 classes
- TypeScript
- Lucide React icons

For each screen, provide:
1. The main page component
2. Any new sub-components listed under "Components needed"
3. Mock data that demonstrates the layout with realistic ERP data (UK company names, GBP amounts, realistic statuses)

Ensure:
- Page background is `#f4f2ff` throughout
- All cards use 12px radius and purple-tinted hover shadow
- Amounts use JetBrains Mono font
- Status badges use the semantic colour palette defined in the base
- All animations use fadeInUp/slideIn/stepIn as specified
- Loading states use skeleton patterns, not spinners
- Empty states have illustration + message + CTA
- Focus rings use `ring-2 ring-[#7c3aed]/30` on all interactive elements
- The overall feel is premium and polished — NOT generic SaaS
- NotificationBell integrates cleanly with the existing 56px header layout
- Priority levels use semantic left-border colours for visual hierarchy
