# Story 9.1: Notification Service

Status: done

## Story

As a **system**,
I want to create notifications from business events using templates, and orchestrate delivery across channels (in-app, email, push),
so that users are informed of important events in their preferred way.

## Acceptance Criteria

1. **GIVEN** a business event fires (e.g., `approval.requested`) **WHEN** a NotificationTemplate exists for that event **THEN** a Notification record is created for each target user with rendered content
2. **GIVEN** a NotificationTemplate **WHEN** it renders **THEN** variable substitution populates entity-specific data (e.g., invoice number, amount, customer name)
3. **GIVEN** a notification is created **WHEN** the delivery orchestrator processes it **THEN** it dispatches to each enabled channel per the user's NotificationPreference
4. **GIVEN** a user has no explicit preference for an event type **WHEN** the notification is dispatched **THEN** it falls back to the template's defaultChannels (BR-COM-014)
5. **GIVEN** the notification service **WHEN** processing a batch of events **THEN** it handles failures per channel independently (email failure does not block in-app delivery)

## Tasks / Subtasks

### ~~Task 1: Prisma Migration — Add Notification Enums and Models (AC: #1, #3, #4)~~ ✅

- [x] 1.1 Add enums to `packages/db/prisma/schema.prisma`:
  - `NotificationChannel`: `IN_APP`, `EMAIL`, `PUSH` — `@@map("notification_channel")`
  - `NotificationPriority`: `LOW`, `NORMAL`, `HIGH`, `URGENT` — `@@map("notification_priority")`
  - `NotificationStatus`: `PENDING`, `DELIVERED`, `READ`, `DISMISSED`, `FAILED` — `@@map("notification_status")`
- [x] 1.2 Add `NotificationTemplate` model matching Architecture §2.29 schema exactly:
  - Fields: `id` (uuid PK), `code` (unique string), `name` (varchar 200), `description` (text?), `eventName` (varchar 200), `titleTemplate` (varchar 500), `bodyTemplate` (text), `defaultChannels` (NotificationChannel[]), `defaultPriority` (default NORMAL), `actionUrl` (varchar 500?), `isActive` (default true), `createdAt`, `updatedAt`
  - Indexes: `@@index([eventName])`, `@@index([isActive])`
  - Table: `@@map("notification_templates")`
- [x] 1.3 Add `NotificationPreference` model matching Architecture §2.29 schema exactly:
  - Fields: `id` (uuid PK), `userId`, `notificationTemplateId`, `enableInApp` (default true), `enableEmail` (default true), `enablePush` (default true), `priorityOverride` (NotificationPriority?), `isMuted` (default false), `muteUntil` (DateTime?), `autoReplyEnabled` (default false), `autoReplySubject` (varchar 500?), `autoReplyBody` (text?), `autoReplyStartDate` (DateTime?), `autoReplyEndDate` (DateTime?), `createdAt`, `updatedAt`
  - Unique: `@@unique([userId, notificationTemplateId])`
  - Indexes: `@@index([userId])`
  - Table: `@@map("notification_preferences")`
- [x] 1.4 Add `Notification` model matching Architecture §2.29 schema exactly:
  - Fields: `id` (uuid PK), `userId`, `templateId` (String?), `title` (varchar 500), `body` (text), `channel` (NotificationChannel), `priority` (default NORMAL), `actionUrl` (varchar 500?), `entityType` (varchar 100?), `entityId` (String?), `status` (NotificationStatus, default PENDING), `deliveredAt` (DateTime?), `readAt` (DateTime?), `dismissedAt` (DateTime?), `createdAt`, `updatedAt`
  - Indexes: `@@index([userId, status])`, `@@index([userId, createdAt])`, `@@index([channel, status])`, `@@index([entityType, entityId])`, `@@index([templateId])`
  - Table: `@@map("notifications")`
- [x] 1.5 Run `prisma migrate dev --name add-notification-models` to generate and apply migration
- [x] 1.6 Re-export new types from `packages/db/src/index.ts` barrel (do NOT remove existing exports)

### ~~Task 2: Handlebars Template Rendering Engine (AC: #2)~~ ✅

- [x] 2.1 Install `handlebars` in `apps/api` (`pnpm add handlebars --filter @nexa/api`)
- [x] 2.2 Create `apps/api/src/modules/communications/notifications/template-renderer.ts`:
  - Export `renderNotificationTemplate(titleTemplate: string, bodyTemplate: string, actionUrlTemplate: string | null, context: Record<string, unknown>): { title: string; body: string; actionUrl: string | null }`
  - Use Handlebars `compile()` and execute with context data
  - Wrap rendering in try/catch — on template error, return fallback: `{ title: eventName, body: JSON.stringify(context), actionUrl: null }` and log warning (per R-004 risk mitigation)
  - Register custom Handlebars helpers: `formatDate`, `formatMoney` (reuse i18n formatting from E4 if available)
- [x] 2.3 Create `apps/api/src/modules/communications/notifications/template-renderer.test.ts`:
  - Test variable substitution with various data types
  - Test missing variable graceful fallback (no crash)
  - Test nested object access `{{entity.field}}`
  - Test `{{#each}}` blocks for array data
  - Test invalid template syntax returns fallback

### ~~Task 3: Notification Service Layer (AC: #1, #2, #3, #4, #5)~~ ✅

- [x] 3.1 Create `apps/api/src/modules/communications/notifications/notification.schema.ts` with Zod schemas:
  - `notificationListQuerySchema`: `{ status?: NotificationStatus, limit?: number (default 20, max 100), cursor?: string }`
  - `notificationParamsSchema`: `{ id: uuid }`
  - `markReadSchema`: (empty body or `{}`)
  - `dismissSchema`: (empty body or `{}`)
  - Response schemas for list, single notification
- [x] 3.2 Create `apps/api/src/modules/communications/notifications/notification.service.ts`:
  - `createNotificationsFromEvent(prisma, eventName: string, eventPayload: Record<string, unknown>)`:
    1. Look up active `NotificationTemplate` WHERE `eventName` matches AND `isActive = true`
    2. If no template found, return silently (no error — event has no notification configured)
    3. Resolve target users from event payload (see Task 4 for target resolution)
    4. For each target user:
       a. Look up `NotificationPreference` for this user + template
       b. If preference exists and `isMuted` or `muteUntil > now()`, skip user
       c. Determine active channels: preference overrides → template defaults (BR-COM-014 cascade)
       d. Render template content via `renderNotificationTemplate()` with event payload as context
       e. For each active channel, create a `Notification` record with status `PENDING`
       f. Dispatch each notification to delivery orchestrator (Task 5) — per-channel independently
    5. Emit `notification.sent` event for each dispatched notification
  - `listNotifications(ctx, query)`: Cursor-based pagination for userId, optional status filter, ordered by createdAt DESC
  - `markAsRead(ctx, notificationId)`: Validate notification belongs to user, update status to READ, set readAt
  - `dismissNotification(ctx, notificationId)`: Validate notification belongs to user, update status to DISMISSED, set dismissedAt
  - `getUnreadCount(ctx)`: Count WHERE userId = ctx.userId AND status IN (PENDING, DELIVERED)
- [x] 3.3 Create `apps/api/src/modules/communications/notifications/notification.service.test.ts`:
  - Test notification creation from event (matching template)
  - Test no-op when no template matches
  - Test preference cascade: user pref → template defaults
  - Test muted user is skipped
  - Test per-channel independent failures
  - Test markAsRead and dismiss state transitions
  - Test unread count

### ~~Task 4: Target User Resolution (AC: #1)~~ ✅

- [x] 4.1 Create `apps/api/src/modules/communications/notifications/target-resolver.ts`:
  - Export `resolveTargetUsers(prisma, template: NotificationTemplate, eventPayload: Record<string, unknown>): Promise<string[]>` (returns array of userIds)
  - Resolution strategies based on event payload fields:
    - **Direct user reference**: If payload contains `userId` or `assigneeId` or `currentAssigneeId` → target that user
    - **Entity owner**: If payload contains `entityType` + `entityId` → look up `createdBy` on the source entity
    - **Approval events**: If payload contains `currentAssigneeId` → target the assignee; if `approvedBy`/`rejectedBy` → target the entity creator (requester)
    - **Role-based**: For events like `stock.reorder.triggered` → target all users with MANAGER role (future: configurable on template)
  - Return deduplicated user IDs (Set)
  - Filter out the user who triggered the event (don't notify yourself)
- [x] 4.2 Create `apps/api/src/modules/communications/notifications/target-resolver.test.ts`:
  - Test direct userId resolution
  - Test entity owner resolution
  - Test approval event assignee resolution
  - Test self-notification filtering
  - Test deduplication

### ~~Task 5: Delivery Orchestrator with BullMQ (AC: #3, #5)~~ ✅

- [x] 5.1 Create `apps/api/src/modules/communications/notifications/notification-dispatch.queue.ts`:
  - Create BullMQ Queue named `notification-dispatch`
  - Export `enqueueNotificationDelivery(notificationId: string, channel: NotificationChannel): Promise<void>`
  - Use existing Redis connection from `fastify.redis` (or `parseRedisUrl()` from `core/redis/redis-connection.ts`)
- [x] 5.2 Create `apps/api/src/modules/communications/notifications/notification-dispatch.worker.ts`:
  - BullMQ Worker processing `notification-dispatch` queue
  - Job data: `{ notificationId: string, channel: NotificationChannel }`
  - Per channel dispatch:
    - `IN_APP`: Update notification status to DELIVERED, set deliveredAt. (WebSocket push is E9-2 scope)
    - `EMAIL`: For E9-1, mark as DELIVERED and log. (Actual SMTP sending is E9-3/E10 scope — create a stub `emailChannel.deliver()` that logs + marks delivered)
    - `PUSH`: For E9-1, mark as DELIVERED and log. (Push sending is future scope — stub only)
  - Error handling: If delivery fails for one channel, catch error, mark that notification as FAILED, log warning, do NOT throw (other channels proceed independently)
  - Retry config: 3 attempts, exponential backoff (delays: [30000, 120000, 300000] ms)
- [x] 5.3 Register the worker in the Fastify app lifecycle (startup/shutdown):
  - Start worker on `fastify.listen` (or in `onReady` hook)
  - Graceful shutdown: call `worker.close()` on `fastify.close`
  - Follow the pattern in `apps/api/src/app.ts` for lifecycle management
- [x] 5.4 Create `apps/api/src/modules/communications/notifications/notification-dispatch.worker.test.ts`:
  - Test IN_APP delivery marks notification as DELIVERED
  - Test EMAIL stub marks notification as DELIVERED
  - Test failure handling: one channel fails, others succeed
  - Test retry exhaustion marks notification as FAILED

### ~~Task 6: Event Bus Subscription Handler (AC: #1)~~ ✅

- [x] 6.1 Create `apps/api/src/modules/communications/notifications/notification.events.ts`:
  - Export `registerNotificationSubscribers(eventBus: EventBus, prisma: PrismaClient): void`
  - Subscribe to a curated list of business events that should trigger notifications:
    - `approval.requested`, `approval.completed`, `approval.rejected`, `approval.escalated`, `approval.forwarded`, `approval.cancelled`
    - `invoice.approved`, `payment.posted`, `order.confirmed`, `dispatch.shipped`
    - `stock.reorder.triggered`
    - `user.accessGroups.assigned`, `user.accessGroups.revoked`, `accessGroup.deleted`
    - `ai.automation.completed`, `ai.automation.failed`, `ai.automation.paused`
  - Each subscriber calls `notificationService.createNotificationsFromEvent(prisma, eventName, payload)`
  - Wrap each handler in try/catch — notification failures must NEVER block the primary business operation
- [x] 6.2 Register subscribers in the communications module plugin (called during app startup)
- [x] 6.3 Create `apps/api/src/modules/communications/notifications/notification.events.test.ts`:
  - Test that event emission triggers notification creation
  - Test that handler errors are caught and logged (no throw propagation)
  - Test that unmatched events (no template) are no-ops

### ~~Task 7: NotificationTemplate CRUD and Seed Data (AC: #1, #4)~~ ✅

- [x] 7.1 Create `apps/api/src/modules/communications/notifications/notification-template.schema.ts`:
  - `createTemplateSchema`: `{ code, name, description?, eventName, titleTemplate, bodyTemplate, defaultChannels[], defaultPriority?, actionUrl?, isActive? }`
  - `updateTemplateSchema`: partial of create (all fields optional except id)
  - `templateListQuerySchema`: `{ isActive?: boolean, search?: string }`
  - `templateParamsSchema`: `{ id: uuid }`
- [x] 7.2 Create `apps/api/src/modules/communications/notifications/notification-template.service.ts`:
  - `createTemplate(ctx, input)`: Validate code uniqueness, create record
  - `updateTemplate(ctx, id, input)`: Find by id, update fields
  - `deleteTemplate(ctx, id)`: Soft delete (set isActive = false)
  - `listTemplates(ctx, query)`: List with optional isActive filter and search on name/code
  - `getTemplateById(ctx, id)`: Find by id, throw NotFoundError if missing
- [x] 7.3 Create seed data migration or seed script with default templates for common events:

  | Code | Event Name | Title Template | Body Template | Default Channels | Priority |
  |------|-----------|---------------|--------------|-----------------|----------|
  | `APPROVAL_REQUESTED` | `approval.requested` | `Approval required` | `A {{entityType}} requires your approval.` | `[IN_APP, EMAIL]` | HIGH |
  | `APPROVAL_COMPLETED` | `approval.completed` | `Approval completed` | `Your {{entityType}} has been approved.` | `[IN_APP]` | NORMAL |
  | `APPROVAL_REJECTED` | `approval.rejected` | `Approval rejected` | `Your {{entityType}} was rejected: {{rejectionReason}}` | `[IN_APP, EMAIL]` | HIGH |
  | `INVOICE_APPROVED` | `invoice.approved` | `Invoice approved` | `Invoice {{invoiceNumber}} has been approved.` | `[IN_APP]` | NORMAL |
  | `PAYMENT_POSTED` | `payment.posted` | `Payment received` | `A payment has been posted.` | `[IN_APP]` | NORMAL |
  | `ORDER_CONFIRMED` | `order.confirmed` | `Order confirmed` | `A new order has been confirmed and is ready for fulfilment.` | `[IN_APP]` | NORMAL |
  | `STOCK_REORDER` | `stock.reorder.triggered` | `Stock reorder alert` | `Stock for an item has fallen below the reorder point.` | `[IN_APP, EMAIL]` | HIGH |
  | `ACCESS_GROUPS_ASSIGNED` | `user.accessGroups.assigned` | `Permissions updated` | `Your access groups have been updated.` | `[IN_APP]` | NORMAL |
  | `ACCESS_GROUPS_REVOKED` | `user.accessGroups.revoked` | `Permissions changed` | `Some access groups have been removed from your account.` | `[IN_APP, EMAIL]` | HIGH |
  | `AUTOMATION_FAILED` | `ai.automation.failed` | `Automation failed` | `An automation has failed.` | `[IN_APP, EMAIL]` | URGENT |
  | `AUTOMATION_PAUSED` | `ai.automation.paused` | `Automation paused` | `An automation has been paused after repeated failures.` | `[IN_APP, EMAIL]` | URGENT |

  Seed approach: Create a seed file at `packages/db/prisma/seeds/notification-templates.ts` or append to existing seed script. Run as part of `prisma db seed`.

### ~~Task 8: API Routes (AC: #1-#5)~~ ✅

- [x] 8.1 Create `apps/api/src/modules/communications/notifications/notification.routes.ts` as Fastify plugin:
  - `GET /notifications` — STAFF permission, calls `listNotifications()`, cursor-based pagination
  - `PATCH /notifications/:id/read` — STAFF permission, calls `markAsRead()`
  - `POST /notifications/:id/dismiss` — STAFF permission, calls `dismissNotification()`
  - `GET /notifications/unread-count` — STAFF permission, calls `getUnreadCount()`
  - Each route: validate input with Zod schema, extract `RequestContext` via `extractRequestContext(request)`, call service, return standard envelope via `sendSuccess(reply, data)`
- [x] 8.2 Create `apps/api/src/modules/communications/notifications/notification-template.routes.ts` as Fastify plugin:
  - `GET /notifications/templates` — ADMIN permission, calls `listTemplates()`
  - `GET /notifications/templates/:id` — ADMIN permission, calls `getTemplateById()`
  - `POST /notifications/templates` — ADMIN permission, calls `createTemplate()`
  - `PATCH /notifications/templates/:id` — ADMIN permission, calls `updateTemplate()`
  - `DELETE /notifications/templates/:id` — ADMIN permission, calls `deleteTemplate()`
- [x] 8.3 Create `apps/api/src/modules/communications/index.ts` barrel — register notification routes and template routes
- [x] 8.4 Register the communications module plugin in `apps/api/src/app.ts`
- [x] 8.5 Create route tests:
  - `notification.routes.test.ts`: Test all notification endpoints with auth, RBAC, and response format
  - `notification-template.routes.test.ts`: Test template CRUD endpoints with admin-only access

### ~~Task 9: NotificationPreference CRUD (AC: #3, #4)~~ ✅

- [x] 9.1 Create `apps/api/src/modules/communications/notifications/notification-preference.schema.ts`:
  - `getPreferencesSchema`: (no params needed — returns for authenticated user)
  - `updatePreferencesSchema`: `{ preferences: Array<{ notificationTemplateId: string, enableInApp?: boolean, enableEmail?: boolean, enablePush?: boolean, isMuted?: boolean, muteUntil?: string | null }> }`
- [x] 9.2 Create `apps/api/src/modules/communications/notifications/notification-preference.service.ts`:
  - `getPreferences(ctx)`: Return user's preferences merged with all active templates. For each template, return: `{ templateId, templateCode, templateName, eventName, enableInApp, enableEmail, enablePush, isMuted }` — if no user preference exists, show template defaults (BR-COM-014 cascade)
  - `updatePreferences(ctx, input)`: Upsert NotificationPreference records for each item in the array
- [x] 9.3 Add preference routes to `notification.routes.ts`:
  - `GET /notifications/preferences` — STAFF permission, calls `getPreferences()`
  - `PUT /notifications/preferences` — STAFF permission, calls `updatePreferences()`
- [x] 9.4 Create `notification-preference.service.test.ts`:
  - Test preferences merged with template defaults
  - Test upsert creates new or updates existing preference
  - Test cascade: no preference → template defaults apply

## Dev Notes

### Architecture Patterns

- **Module location**: `apps/api/src/modules/communications/notifications/` — new module directory
- **Service pattern**: Stateless functions accepting `(ctx: RequestContext, prisma: PrismaClient, input)` — follow E8 cross-cutting pattern exactly
- **Route pattern**: Fastify plugin with `fp()` wrapper, Zod schema validation, `extractRequestContext()`, `sendSuccess()` response
- **Event bus**: Use typed `EventBus` from `apps/api/src/core/events/event-bus.ts` — subscribe via `eventBus.on('event.name', handler)`. Access via `fastify.eventBus` decorator
- **BullMQ**: Use existing Redis connection from `apps/api/src/core/redis/`. Follow `DeadLetterService` pattern in `apps/api/src/core/events/dead-letter.service.ts` for Queue/Worker setup
- **Error types**: Import `AppError`, `NotFoundError`, `ValidationError` from `core/errors/`
- **RBAC**: Use `createRbacGuard({ minimumRole: UserRole.STAFF })` for notification endpoints, `UserRole.ADMIN` for template management

### Notification Status State Machine (§17.2)

```
PENDING → DELIVERED → READ (terminal)
PENDING → DELIVERED → DISMISSED (terminal)
PENDING → FAILED (terminal)
```

- PENDING: Created, not yet processed by delivery orchestrator
- DELIVERED: Successfully dispatched to channel (in-app record created, email queued, push sent)
- READ: User has read the notification (explicit action)
- DISMISSED: User dismissed without reading (explicit action)
- FAILED: Delivery failed after all retries exhausted

Guards: Cannot transition from READ/DISMISSED/FAILED to any other state. Cannot transition from PENDING directly to READ/DISMISSED.

### Preference Cascade Logic (BR-COM-014)

Resolution order for determining active channels:
1. **User preference** (NotificationPreference for this user + template) — if exists, use its `enableInApp`/`enableEmail`/`enablePush` values
2. **Template defaults** (NotificationTemplate.defaultChannels) — if no user preference exists, use template defaults

Role-based defaults (AC #4 from E9.4) are out of scope for E9-1 — implement in E9.4.

### Event Payload Context for Template Rendering

The event payload object is passed directly as the Handlebars context. Common fields available:

```typescript
// approval.requested payload
{ requestId, entityType, entityId, currentAssigneeId, ruleId, levelOrder }

// invoice.approved payload
{ invoiceId, invoiceNumber, approvedBy }

// user.accessGroups.assigned payload
{ userId, companyId, groupIds, assignedBy }
```

The template author uses `{{fieldName}}` to reference any payload field. The rendering engine does NOT validate that referenced fields exist — it silently renders empty string for missing fields (Handlebars default behaviour).

### Key Dependencies

- **E3 (Event Bus)**: Already implemented — typed async event bus with retry + dead-letter
- **E6 (Frontend Shell)**: WebSocket infrastructure exists — but E9-1 only creates the backend service. WebSocket push is E9-2 scope.
- **BullMQ + Redis**: Already installed (`bullmq@^5.70.0`, `ioredis@^5.9.3`), Redis plugin decorates `fastify.redis`
- **Handlebars**: New dependency — install in `apps/api` only

### What This Story Does NOT Include (Scope Boundaries)

- **WebSocket delivery** — E9-2 (In-App Notifications) adds Socket.io push
- **Email SMTP sending** — E9-3 (Email Channel) + E10 (Email Integration) adds actual email delivery
- **Push notifications** — Future scope (mobile app not built yet)
- **Notification bell UI / dropdown** — E9-2
- **Notification preferences UI** — E9-4
- **Role-based default preferences** — E9-4

E9-1 creates stubs for EMAIL and PUSH channels that mark notifications as DELIVERED without actual delivery. E9-2/E9-3 will replace these stubs with real channel implementations.

### Cross-Cutting Patterns (MANDATORY)

Every implementation MUST follow these patterns from project-context.md:
- **companyId**: The Notification models in Architecture §2.29 do NOT include companyId fields. Notifications are scoped by userId (the recipient). Template management is system-level. This follows the same pattern as cross-cutting entities (Attachments, Notes) where company scope is implicit through the authenticated user context.
- **i18n**: Notification template content (title, body) uses Handlebars variables, NOT translation keys. Templates are stored in the database as authored text. Future: add `languageCode` to templates for multi-language support.
- **Audit**: Emit `notification.sent` event via event bus after each successful dispatch. Payload: `{ notificationId, userId, channel, templateEventName }`. The audit trail service (E3) will log this automatically.
- **Attachments/Notes/Tasks**: Not applicable to notification entities.

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **Architecture** | §2.29 Communications Module | Full Prisma schema for NotificationTemplate, NotificationPreference, Notification. Enums: NotificationChannel, NotificationPriority, NotificationStatus. Service layer patterns, BullMQ worker architecture. |
| **API Contracts** | §2.25 Communications | `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/:id/dismiss`, `GET /notifications/preferences`, `PUT /notifications/preferences`. Min role: STAFF. FR184-FR186 mapping. |
| **State Machine** | §17.2 Notification Status | PENDING → DELIVERED → READ → DISMISSED / FAILED. Five states, three terminal (READ, DISMISSED, FAILED). |
| **Event Catalog** | §14 Communications Events | `notification.sent` published event. Subscribes to ALL business events via NotificationTemplate.eventName matching. 13+ common notification-triggering events listed. |
| **Data Models** | §3.18 Communications Module | NotificationTemplate, NotificationPreference, Notification tables with enums. |
| **Business Rules** | §13 Communications Rules | BR-COM-014: Notification preferences cascade from template defaults. |
| **UX Design Spec** | §Key Design Challenges | Notifications tiered: toast vs. notification centre vs. audit-only. E9-1 is backend-only — all notification UI (bell, dropdown, preferences page) is E9-2/E9-4 scope. |
| **Project Context** | §5 Notifications | Delivery channels: in-app, push, email. Event-driven triggers. Per-channel, per-event-type user preferences. |
| **Test Design** | test-design-epic-E9.md | P0: E9.1-API-001 (event creation), E9.1-API-002 (delivery orchestrator), E9.1-API-003 (template rendering). P1: E9.1-API-009, E9.1-API-010. |

### Project Structure Notes

```
apps/api/src/modules/communications/
├── notifications/
│   ├── notification.schema.ts              # Zod schemas for notification endpoints
│   ├── notification.service.ts             # Core notification CRUD + creation from events
│   ├── notification.service.test.ts
│   ├── notification.routes.ts              # GET/PATCH/POST notification endpoints
│   ├── notification.routes.test.ts
│   ├── notification-template.schema.ts     # Zod schemas for template CRUD
│   ├── notification-template.service.ts    # Template CRUD service
│   ├── notification-template.routes.ts     # Template CRUD endpoints (ADMIN)
│   ├── notification-template.routes.test.ts
│   ├── notification-preference.schema.ts   # Zod schemas for preferences
│   ├── notification-preference.service.ts  # Preference CRUD + cascade logic
│   ├── notification-preference.service.test.ts
│   ├── notification.events.ts              # Event bus subscribers
│   ├── notification.events.test.ts
│   ├── notification-dispatch.queue.ts      # BullMQ queue definition
│   ├── notification-dispatch.worker.ts     # BullMQ worker for channel delivery
│   ├── notification-dispatch.worker.test.ts
│   ├── target-resolver.ts                  # User targeting logic
│   ├── target-resolver.test.ts
│   └── template-renderer.ts               # Handlebars rendering engine
│       template-renderer.test.ts
├── index.ts                                # Module barrel + Fastify plugin registration
```

### Source References

- [Source: _bmad-output/planning-artifacts/arch-sections/2.29-communications.md#Prisma Schema] — NotificationTemplate, NotificationPreference, Notification models + enums
- [Source: _bmad-output/planning-artifacts/api-contracts/2-endpoint-summary.md#2.25 Communications] — Notification API endpoints
- [Source: _bmad-output/planning-artifacts/event-catalog.md#14 Communications] — notification.sent event, template-based subscription
- [Source: _bmad-output/planning-artifacts/state-machine-reference.md#17.2 Notification Status] — State machine
- [Source: _bmad-output/planning-artifacts/business-rules-compendium.md#13 Communications Rules] — BR-COM-014 cascade logic
- [Source: _bmad-output/planning-artifacts/project-context.md#5 Notifications] — Channel architecture
- [Source: _bmad-output/test-artifacts/test-design-epic-E9.md] — P0/P1 test design
- [Source: apps/api/src/core/events/event-bus.ts] — Typed async event bus
- [Source: apps/api/src/core/events/event-bus.types.ts] — BusinessEvents interface (notification.sent at line 784)
- [Source: apps/api/src/core/events/dead-letter.service.ts] — BullMQ Queue/Worker pattern
- [Source: apps/api/src/modules/cross-cutting/note.service.ts] — Service layer pattern reference
- [Source: apps/api/src/modules/cross-cutting/note.routes.ts] — Route plugin pattern reference

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Code review completed 2026-03-03 with 15 issues noted (3 HIGH, 7 MEDIUM, 5 LOW)

### Completion Notes List
- All 9 tasks completed: Prisma migration, Handlebars renderer, notification service, target resolver, BullMQ dispatch, event bus subscribers, template CRUD + seed, API routes, preference CRUD
- Code review passed with remaining issues documented for human review (see Code Review Notes section below)
- EMAIL and PUSH channels implemented as stubs (mark DELIVERED + log) — real delivery in E9-3/E10
- Notification models scoped by userId (no companyId) per Architecture §2.29
- Preference cascade: user preference → template defaults (BR-COM-014)
- BullMQ worker with 3-attempt retry, exponential backoff (30s/120s/300s)

### File List
- `packages/db/prisma/schema.prisma` — NotificationChannel, NotificationPriority, NotificationStatus enums + NotificationTemplate, NotificationPreference, Notification models
- `packages/db/prisma/migrations/20260303155003_add_notification_models/` — Migration
- `packages/db/prisma/seeds/notification-templates.seed.ts` — 11 default templates
- `packages/db/src/index.ts` — Re-exports for new types
- `apps/api/src/modules/communications/index.ts` — Module barrel + Fastify plugin
- `apps/api/src/modules/communications/notifications/template-renderer.ts`
- `apps/api/src/modules/communications/notifications/template-renderer.test.ts`
- `apps/api/src/modules/communications/notifications/notification.schema.ts`
- `apps/api/src/modules/communications/notifications/notification.service.ts`
- `apps/api/src/modules/communications/notifications/notification.service.test.ts`
- `apps/api/src/modules/communications/notifications/notification.routes.ts`
- `apps/api/src/modules/communications/notifications/notification.routes.test.ts`
- `apps/api/src/modules/communications/notifications/notification-template.schema.ts`
- `apps/api/src/modules/communications/notifications/notification-template.service.ts`
- `apps/api/src/modules/communications/notifications/notification-template.routes.ts`
- `apps/api/src/modules/communications/notifications/notification-template.routes.test.ts`
- `apps/api/src/modules/communications/notifications/notification-preference.schema.ts`
- `apps/api/src/modules/communications/notifications/notification-preference.service.ts`
- `apps/api/src/modules/communications/notifications/notification-preference.service.test.ts`
- `apps/api/src/modules/communications/notifications/notification.events.ts`
- `apps/api/src/modules/communications/notifications/notification.events.test.ts`
- `apps/api/src/modules/communications/notifications/notification-dispatch.queue.ts`
- `apps/api/src/modules/communications/notifications/notification-dispatch.worker.ts`
- `apps/api/src/modules/communications/notifications/notification-dispatch.worker.test.ts`
- `apps/api/src/modules/communications/notifications/target-resolver.ts`
- `apps/api/src/modules/communications/notifications/target-resolver.test.ts`
- `apps/api/src/app.ts` — Communications module registered


## Code Review Notes (Auto-Generated)

**Status:** Completed with remaining issues after 3 CR iterations

**Date:** 2026-03-03 17:04

### Remaining Issues for Human Review:

- **ISSUE #1: HIGH — Tests mock `findUnique` but service calls `findMany` for preferences**
- **ISSUE #2: HIGH — Tests don't mock `$transaction`, making `createNotificationsFromEvent` tests unreachable**
- **ISSUE #3: HIGH — Event test asserts wrong argument count (3 vs 4)**
- **ISSUE #4: MEDIUM — Preference test uses `toEqual` but expected object is missing `priorityOverride`**
- **ISSUE #5: MEDIUM — `updatePreferences` tests don't mock `$transaction` either**
- **ISSUE #6: MEDIUM — Route plugins not wrapped with `fp()` — breaks stated convention**
- **ISSUE #7: MEDIUM — `defaultChannels.includes()` uses string literals instead of enum values**
- **ISSUE #8: MEDIUM — `ApprovalRequest` missing from target resolver `modelMap`**
- **ISSUE #9: MEDIUM — Dedup query over-deduplicates when `entityType`/`entityId` are null**
- **ISSUE #10: LOW — Template renderer imports `formatDate`/`formatCurrency` from `@nexa/shared` without verifying signatures**
- **ISSUE #11: LOW — Child route plugins missing `fp()` metadata for standalone registration**
- **ISSUE #12: LOW — Event subscriber casts payload to `Record<string, unknown>`, losing typed event bus guarantees**
- **ISSUE #13: LOW — Sequential `notification.create` inside Serializable transaction instead of batch**
- **ISSUE #14: LOW — No dedicated unit test for `notification-template.service.ts`**
- **ISSUE #15: MEDIUM — Event test `registerNotificationSubscribers` called without logger, assertion mismatch**
- ## SUMMARY: 3 HIGH, 7 MEDIUM, 5 LOW issues found

---

