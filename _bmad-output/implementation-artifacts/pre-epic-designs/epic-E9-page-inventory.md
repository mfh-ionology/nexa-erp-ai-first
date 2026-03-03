# Epic E9 — Notifications: Page Inventory

**Date:** 2026-03-03
**Epic:** E9 — Notifications
**Dependencies:** E3 (Event Bus), E6 (Frontend Shell)
**Status:** Pending Approval

---

## Page / Component Inventory

### 1. NotificationBell + Dropdown (Header Component)

| Property | Value |
|----------|-------|
| **Type** | Embedded component (header popover) |
| **Template** | N/A (Popover from header bar) |
| **Route** | N/A (triggers from bell icon in app header) |
| **Story** | E9.S2 |
| **Location** | Header bar, right section, next to user menu |

**Description:** Bell icon with animated red unread count badge. Click opens a popover dropdown (380px wide, max-height scrollable) showing recent notifications grouped by "New" (unread) and "Earlier" (read). Each notification card shows icon, title, body preview, relative timestamp, and dismiss button. Priority levels indicated by left border colour (URGENT=red, HIGH=amber). "Mark All Read" at top, "View All Notifications" link at bottom.

**Key Interactions:**
- Bell icon pulses on new notification arrival (WebSocket)
- Click notification → navigate to linked entity + mark READ
- Dismiss button → mark DISMISSED
- URGENT/HIGH priority → also shows toast notification (top-right)
- Real-time: new notifications slide in at top with animation

**Components Needed:**
- `<NotificationBell>` — Bell icon + badge (Lucide `Bell` icon)
- `<NotificationDropdown>` — Popover with notification list
- `<NotificationCard>` — Individual notification item
- `<NotificationToast>` — Toast for HIGH/URGENT priority
- WebSocket hook: `useNotificationSocket()` — listens for `notification:new` events

---

### 2. Notification Preferences Page

| Property | Value |
|----------|-------|
| **Type** | Full page |
| **Template** | T7 — Settings |
| **Route** | `/system/notification-preferences` |
| **Story** | E9.S4 |
| **Sidebar** | System > Notification Preferences |

**Description:** Matrix grid of event types (rows, grouped by module) vs channels (columns: In-App, Email, Push) with toggle checkboxes. Sections are collapsible (Invoice Events, Task Events, System Events, etc.). "Reset to Defaults" restores role-based defaults. Save is optimistic (immediate on toggle). Disabled checkboxes for mandatory notifications (e.g., security events always in-app).

**Key Interactions:**
- Toggle checkbox → immediate PATCH to API (optimistic UI)
- "Reset to Defaults" → confirmation dialog → restore template defaults
- Collapsible sections per module
- Admin section (ADMIN role only): role-based defaults management

**Components Needed:**
- `<NotificationPreferencesMatrix>` — Main matrix grid
- `<PreferenceRow>` — Single event type row with channel toggles
- `<PreferenceSection>` — Collapsible group header
- Reuses: `<Switch>` (Shadcn), `<Card>`, `<Button>`

---

## Template Assignment Summary

| # | Page/Component | Template | Story | New Components |
|---|---------------|----------|-------|----------------|
| 1 | NotificationBell + Dropdown | Popover (header) | E9.S2 | NotificationBell, NotificationDropdown, NotificationCard, NotificationToast |
| 2 | Notification Preferences | T7 (Settings) | E9.S4 | NotificationPreferencesMatrix, PreferenceRow, PreferenceSection |

---

## Shadcn Components Required

| Component | Status | Notes |
|-----------|--------|-------|
| `Popover` | Already installed | For notification dropdown |
| `Switch` | Already installed | For preference toggles |
| `Badge` | Already installed | For unread count |
| `Card` | Already installed | For notification cards |
| `Button` | Already installed | Standard actions |
| `Collapsible` | Check if installed | For preference sections |
| `Sonner/Toast` | Already installed | For priority notifications |

---

## Notes

- **No full Notification Centre page** — The v0 prompts cover the bell dropdown and preferences. A full "View All" notification centre page (T1 list) may be added later if needed, but the dropdown covers the primary use case for MVP.
- **WebSocket integration** — E9.S2 introduces Socket.io on the frontend for real-time notification delivery. This is the first feature using WebSocket.
- **Email channel** — E9.S3 is backend-only (email delivery via BullMQ). No UI component needed beyond the preference toggle.
- **Push channel** — Push notifications are mobile-only (Expo Push API). Toggle exists in preferences but actual delivery is deferred to mobile epic.
