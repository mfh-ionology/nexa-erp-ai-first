# Epic E9: Notifications

**Tier:** 1 | **Dependencies:** E3 (Event Bus), E6 (Frontend Shell) | **FRs:** FR184-FR186 | **NFRs:** NFR2 (CRUD <500ms)

---

## Story E9.S1: Notification Service

**User Story:** As a system, I want to create notifications from business events using templates, and orchestrate delivery across channels (in-app, email, push), so that users are informed of important events in their preferred way.

**Acceptance Criteria:**
1. GIVEN a business event fires (e.g., `approval.requested`) WHEN a NotificationTemplate exists for that event THEN a Notification record is created for each target user with rendered content
2. GIVEN a NotificationTemplate WHEN it renders THEN variable substitution populates entity-specific data (e.g., invoice number, amount, customer name)
3. GIVEN a notification is created WHEN the delivery orchestrator processes it THEN it dispatches to each enabled channel per the user's NotificationPreference
4. GIVEN a user has no explicit preference for an event type WHEN the notification is dispatched THEN it falls back to the template's default channels (BR-COM-014)
5. GIVEN the notification service WHEN processing a batch of events THEN it handles failures per channel independently (email failure does not block in-app delivery)

**Key Tasks:**
- [ ] Implement notification creation from event bus handlers (AC: #1)
  - [ ] Subscribe to business events via NotificationTemplate.eventName matching
  - [ ] Resolve target users from template rules (entity owner, role-based, specific users)
  - [ ] Create Notification records with PENDING status
- [ ] Implement template rendering engine (AC: #2)
  - [ ] Handlebars-based variable substitution in title and body
  - [ ] Support for entity data, user data, and computed values
- [ ] Implement delivery orchestrator (AC: #3, #4, #5)
  - [ ] Read user NotificationPreference for each event type and channel
  - [ ] Cascade: user preference -> template defaults (BR-COM-014)
  - [ ] Dispatch to each channel independently via BullMQ jobs
  - [ ] Update Notification.status per channel (DELIVERED, FAILED)
- [ ] Implement NotificationTemplate and NotificationPreference CRUD (AC: #1, #4)
  - [ ] Seed default templates for common events (approval.requested, invoice.approved, etc.)
  - [ ] Admin can manage templates

**FR/NFR:** FR184; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Notifications referenced in cross-cutting infrastructure |
| API Contracts | §2.25 Communications | GET /notifications, PATCH /notifications/:id/read, POST /notifications/:id/dismiss, GET/PUT /notifications/preferences |
| Data Models | §3.18 Communications Module | NotificationTemplate, NotificationPreference, Notification (channel, priority, status enums) |
| State Machines | §17 Communications State Machines | §17.2 Notification Status: PENDING -> DELIVERED -> READ -> DISMISSED / FAILED |
| Event Catalog | §14 Communications / Notifications Events | `notification.sent`, subscribes to ALL business events via template matching |
| Business Rules | §13 Communications Rules | BR-COM-014 (notification preferences cascade from template defaults) |
| UX Design Spec | §Key Design Challenges | Notifications tiered: toast vs. notification centre vs. audit-only |
| Project Context | §5 Notifications | Core infrastructure, delivery channels: in-app, push, email |

---

## Story E9.S2: In-App Notifications

**User Story:** As a user, I want real-time in-app notifications delivered via WebSocket with a notification centre (bell icon + dropdown), mark read/dismissed actions, and unread badge count, so that I am immediately aware of important events.

**Acceptance Criteria:**
1. GIVEN a notification is created for the user WHEN they are online THEN it is delivered in real-time via WebSocket and appears as a toast (for high priority) or silently in the notification centre
2. GIVEN the notification bell icon WHEN the user has unread notifications THEN a red badge shows the unread count
3. GIVEN the notification bell WHEN clicked THEN a dropdown displays recent notifications with title, body, timestamp, and entity link
4. GIVEN a notification in the dropdown WHEN clicked THEN the user navigates to the related record and the notification is marked as READ
5. GIVEN a notification WHEN the user clicks "Dismiss" THEN it is marked as DISMISSED and no longer appears in the active list

**Key Tasks:**
- [ ] Implement WebSocket notification delivery (AC: #1)
  - [ ] Push new notifications to connected users via Socket.io
  - [ ] Differentiate by priority: URGENT/HIGH = toast, NORMAL/LOW = silent badge update
- [ ] Build `<NotificationBell>` component in header (AC: #2)
  - [ ] Unread count badge (red dot with number)
  - [ ] Animate on new notification arrival
- [ ] Build `<NotificationDropdown>` component (AC: #3, #4, #5)
  - [ ] List of recent notifications with icon, title, body preview, timestamp
  - [ ] Click navigates to entity and marks as read
  - [ ] "Dismiss" action per notification
  - [ ] "Mark All Read" action
  - [ ] "View All" link to full notification centre page
- [ ] Implement `PATCH /notifications/:id/read` and `POST /notifications/:id/dismiss` endpoints (AC: #4, #5)
- [ ] Implement unread count endpoint for initial page load (AC: #2)

**FR/NFR:** FR186; NFR2

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 Frontend Architecture | WebSocket for real-time, Socket.io |
| API Contracts | §2.25 Communications | PATCH /notifications/:id/read, POST /notifications/:id/dismiss |
| Data Models | §3.18 Communications Module | Notification: channel (IN_APP), priority, status (PENDING/DELIVERED/READ/DISMISSED) |
| State Machines | §17.2 Notification Status | PENDING -> DELIVERED -> READ -> DISMISSED |
| Event Catalog | §14 Communications Events | `notification.sent` event |
| Business Rules | §13 Communications Rules | BR-COM-014 (preference cascade) |
| UX Design Spec | §Key Design Challenges | Notification centre (bell icon + dropdown), actionable notifications |
| Project Context | §5 Notifications | In-app delivery via WebSocket |

---

## Story E9.S3: Email Notification Channel

**User Story:** As a user, I want to receive notification emails for important events (approval requests, overdue alerts) using styled HTML templates, so that I stay informed even when not logged into the application.

**Acceptance Criteria:**
1. GIVEN a notification with EMAIL channel enabled WHEN the delivery orchestrator processes it THEN an email is queued for sending with the rendered template
2. GIVEN an email notification template WHEN rendered THEN it produces a styled HTML email with company branding, notification title, body, and action link
3. GIVEN the email channel WHEN sending fails THEN it retries with exponential backoff (3 attempts) and marks the notification as FAILED after exhausting retries
4. GIVEN a user has disabled EMAIL for a specific event type WHEN the event fires THEN no email is sent for that event (preference respected)

**Key Tasks:**
- [ ] Implement email notification delivery channel (AC: #1)
  - [ ] BullMQ job for email sending from notification service
  - [ ] Integrate with E10 (Email Integration) SMTP service
- [ ] Create HTML email templates for notifications (AC: #2)
  - [ ] Base template with header (logo), body, action button, footer
  - [ ] Variable substitution for notification content
  - [ ] Responsive email layout (inline CSS)
- [ ] Implement retry logic with exponential backoff (AC: #3)
  - [ ] BullMQ retry configuration: 3 attempts, backoff 30s/120s/300s
  - [ ] Mark notification channel status as FAILED after final retry
- [ ] Respect user email notification preferences (AC: #4)

**FR/NFR:** FR184; NFR31 (retry with exponential backoff)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | BullMQ workers for email sending |
| API Contracts | §2.25 Communications | Notification preferences endpoints |
| Data Models | §3.18 Communications Module | NotificationPreference, NotificationChannel.EMAIL |
| State Machines | §17.2 Notification Status | PENDING -> DELIVERED / FAILED |
| Event Catalog | §14 Communications Events | `notification.sent` after successful delivery |
| Business Rules | §13 Communications Rules | BR-COM-014 (preference cascade), BR-COM-015 (S3 presign for attachments) |
| UX Design Spec | N/A | N/A — email channel is backend-only |
| Project Context | §5 Notifications | Email delivery via E10 integration |

---

## Story E9.S4: Notification Preferences

**User Story:** As a user, I want to manage my notification preferences per channel and per event type, so that I receive only the notifications I care about through the channels I prefer.

**Acceptance Criteria:**
1. GIVEN the notification preferences page WHEN the user opens it THEN a matrix displays event types (rows) vs channels (columns: In-App, Email, Push) with toggle controls
2. GIVEN an event type with no user preference WHEN the default is evaluated THEN it falls back to the NotificationTemplate's defaultChannels
3. GIVEN a user toggles off EMAIL for "Invoice Approved" WHEN an invoice is approved THEN they receive in-app and push notifications but not email
4. GIVEN an ADMIN user WHEN they configure role-based defaults THEN the defaults apply to all users with that role who have not set personal preferences
5. GIVEN a new NotificationTemplate is added WHEN users view preferences THEN the new event type appears with the template's defaults pre-selected

**Key Tasks:**
- [ ] Implement `GET /notifications/preferences` endpoint (AC: #1)
  - [ ] Return user's preferences merged with role defaults and template defaults
  - [ ] Matrix format: eventName -> { inApp: boolean, email: boolean, push: boolean }
- [ ] Implement `PUT /notifications/preferences` endpoint (AC: #3)
  - [ ] Accept per-event-type, per-channel preference updates
  - [ ] Create/update NotificationPreference records
- [ ] Implement preference cascade logic in delivery orchestrator (AC: #2, #5)
  - [ ] Resolution order: user preference -> role default -> template default
  - [ ] New templates automatically visible with defaults
- [ ] Build notification preferences UI page (T7 Settings template) (AC: #1, #3)
  - [ ] Matrix grid with event type descriptions and channel toggles
  - [ ] "Reset to Defaults" action
- [ ] Implement role-based default management for ADMIN (AC: #4)

**FR/NFR:** FR185; NFR27

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | N/A | Notification preferences in cross-cutting infrastructure |
| API Contracts | §2.25 Communications | GET /notifications/preferences, PUT /notifications/preferences |
| Data Models | §3.18 Communications Module | NotificationPreference: userId, eventName, channel, enabled |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | §14 Communications Events | Template-based event subscription system |
| Business Rules | §13 Communications Rules | BR-COM-014 (preferences cascade from template defaults) |
| UX Design Spec | §Standardised Screen Templates | T7 Settings template for preferences page |
| Project Context | §5 Notifications | Per-channel, per-event-type opt-in/out |

---
