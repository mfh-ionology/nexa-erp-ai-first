# Story 9.3: Email Notification Channel

Status: done

## Story

As a **user**,
I want to receive notification emails for important events (approval requests, overdue alerts) using styled HTML templates,
so that I stay informed even when not logged into the application.

## Acceptance Criteria

1. **GIVEN** a notification with EMAIL channel enabled **WHEN** the delivery orchestrator processes it **THEN** an email is queued for sending with the rendered template
2. **GIVEN** an email notification template **WHEN** rendered **THEN** it produces a styled HTML email with company branding, notification title, body, and action link
3. **GIVEN** the email channel **WHEN** sending fails **THEN** it retries with exponential backoff (3 attempts) and marks the notification as FAILED after exhausting retries
4. **GIVEN** a user has disabled EMAIL for a specific event type **WHEN** the event fires **THEN** no email is sent for that event (preference respected)

## Tasks / Subtasks

### Task 1: Install Nodemailer and Add SMTP Configuration (AC: #1) ✅

- [x] 1.1 Install `nodemailer` in `apps/api` (`pnpm add nodemailer --filter @nexa/api`) and `@types/nodemailer` as dev dependency (`pnpm add -D @types/nodemailer --filter @nexa/api`)
- [x] 1.2 Add SMTP environment variables to `.env.example` and `.env`:
  - `SMTP_HOST` — SMTP server hostname (e.g., `smtp.mailtrap.io` for dev, `smtp.sendgrid.net` for prod)
  - `SMTP_PORT` — SMTP port (default: `587`)
  - `SMTP_SECURE` — Use TLS (default: `false`, set `true` for port 465)
  - `SMTP_USER` — SMTP username
  - `SMTP_PASS` — SMTP password
  - `SMTP_FROM_NAME` — Default sender name (e.g., `Nexa ERP`)
  - `SMTP_FROM_EMAIL` — Default sender email (e.g., `noreply@nexa-erp.com`)
- [x] 1.3 Create `apps/api/src/modules/communications/email/email-config.ts`:
  - Export `EmailConfig` interface: `{ host: string, port: number, secure: boolean, user: string, pass: string, fromName: string, fromEmail: string }`
  - Export `getEmailConfig(): EmailConfig` — reads from `process.env`, throws `AppError('EMAIL_CONFIG_MISSING', ...)` if `SMTP_HOST` is unset
  - Export `isEmailConfigured(): boolean` — returns `true` only if `SMTP_HOST` is set and non-empty

### Task 2: Email Sender Service (AC: #1, #3) ✅

- [x] 2.1 Create `apps/api/src/modules/communications/email/email-sender.service.ts`:
  - Import `nodemailer` and `createTransport`
  - Export `EmailSendOptions` interface: `{ to: string, subject: string, html: string, text?: string, replyTo?: string }`
  - Export `createEmailSender(config: EmailConfig, logger: Logger)`:
    - Creates a Nodemailer transport (`nodemailer.createTransport({ host, port, secure, auth: { user, pass } })`)
    - Returns an object with:
      - `sendEmail(options: EmailSendOptions): Promise<void>` — sends email via transport, wraps Nodemailer errors in `AppError('EMAIL_SEND_FAILED', ...)`
      - `verifyConnection(): Promise<boolean>` — calls `transport.verify()`, returns `true`/`false`, logs warning on failure (non-blocking — allows app to start even if SMTP is down)
      - `close(): void` — calls `transport.close()` for graceful shutdown
  - Factory pattern (not a singleton) so it can be instantiated with different configs in tests
- [x] 2.2 Create `apps/api/src/modules/communications/email/email-sender.service.test.ts`:
  - Test `sendEmail` calls Nodemailer `sendMail` with correct `from`, `to`, `subject`, `html`, `text` fields
  - Test `sendEmail` throws `AppError` on Nodemailer failure
  - Test `verifyConnection` returns `true` on success, `false` on failure (without throwing)
  - Mock `nodemailer.createTransport` to avoid real SMTP calls

### Task 3: Notification Email HTML Template (AC: #2) ✅

- [x] 3.1 Create `apps/api/src/modules/communications/email/notification-email-template.ts`:
  - Export `NotificationEmailData` interface:
    ```typescript
    {
      title: string;
      body: string;
      actionUrl: string | null;
      actionLabel?: string; // defaults to "View Details"
      companyName?: string; // defaults to "Nexa ERP"
      logoUrl?: string | null;
      unsubscribeHint?: string; // defaults to "Manage your notification preferences in Settings"
    }
    ```
  - Export `renderNotificationEmailHtml(data: NotificationEmailData): string`:
    - Returns a complete HTML email document with inline CSS (no external stylesheets — email client compatibility)
    - Layout structure:
      1. **Wrapper**: Centered container, max-width 600px, `#f4f2ff` background (Concept D purple tint)
      2. **Header**: Company logo (if `logoUrl` provided) or `companyName` text, purple `#7c3aed` accent bar
      3. **Body card**: White card with 12px radius, `title` as `<h1>`, `body` as paragraph text (supports basic HTML from Handlebars rendering)
      4. **Action button**: Purple `#7c3aed` CTA button linking to `actionUrl` (only rendered if `actionUrl` is non-null), label from `actionLabel`
      5. **Footer**: Muted grey text with `unsubscribeHint` and "Powered by Nexa ERP"
    - All CSS inlined directly on elements (no `<style>` blocks — stripped by many email clients)
    - Responsive: single-column layout, fluid widths, readable on mobile (320px+)
    - Accessibility: `role="presentation"` on layout tables, `alt` text on images, sufficient colour contrast
  - Export `renderNotificationEmailText(data: Pick<NotificationEmailData, 'title' | 'body' | 'actionUrl'>): string`:
    - Plain text fallback: `title\n\nbody\n\nactionUrl`
- [x] 3.2 Create `apps/api/src/modules/communications/email/notification-email-template.test.ts`:
  - Test HTML output contains title, body, action URL
  - Test action button is omitted when `actionUrl` is null
  - Test custom `actionLabel` appears in output
  - Test default values for `companyName` and `unsubscribeHint`
  - Test `logoUrl` renders `<img>` tag when provided
  - Test plain text fallback format
  - Test HTML contains inline styles (no `<style>` block in `<head>`)

### Task 4: Replace deliverEmail Stub in Dispatch Worker (AC: #1, #3) ✅

- [x] 4.1 Modify `apps/api/src/modules/communications/notifications/notification-dispatch.worker.ts`:
  - Replace the `deliverEmail` stub function with actual email delivery logic:
    ```typescript
    async function deliverEmail(
      prisma: PrismaClient,
      notificationId: string,
      emailSender: EmailSender | null,
      logger: Logger,
    ): Promise<void> {
      // 1. If email sender is not configured, log warning and mark DELIVERED (graceful degradation)
      if (!emailSender) {
        logger.warn({ notificationId }, 'notification-dispatch: EMAIL sender not configured — marking DELIVERED without sending');
        await prisma.notification.update({
          where: { id: notificationId },
          data: { status: NotificationStatus.DELIVERED, deliveredAt: new Date() },
        });
        return;
      }

      // 2. Fetch notification with user email
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
        include: { /* no relation — userId is a plain string */ },
      });
      if (!notification) throw new Error(`Notification ${notificationId} not found`);

      // 3. Look up user's email address
      const user = await prisma.user.findUnique({
        where: { id: notification.userId },
        select: { email: true, firstName: true, companyId: true },
      });
      if (!user?.email) {
        logger.warn({ notificationId, userId: notification.userId }, 'notification-dispatch: user has no email — skipping');
        await prisma.notification.update({
          where: { id: notificationId },
          data: { status: NotificationStatus.DELIVERED, deliveredAt: new Date() },
        });
        return;
      }

      // 4. Optionally fetch company branding
      const company = await prisma.companyProfile.findUnique({
        where: { id: user.companyId },
        select: { name: true, logoUrl: true },
      });

      // 5. Render HTML email from notification content
      const html = renderNotificationEmailHtml({
        title: notification.title,
        body: notification.body,
        actionUrl: notification.actionUrl,
        companyName: company?.name,
        logoUrl: company?.logoUrl,
      });
      const text = renderNotificationEmailText({
        title: notification.title,
        body: notification.body,
        actionUrl: notification.actionUrl,
      });

      // 6. Send email (throws on failure — BullMQ will retry)
      await emailSender.sendEmail({
        to: user.email,
        subject: notification.title,
        html,
        text,
      });

      // 7. Mark notification as DELIVERED
      await prisma.notification.update({
        where: { id: notificationId },
        data: { status: NotificationStatus.DELIVERED, deliveredAt: new Date() },
      });

      logger.debug({ notificationId, to: user.email, channel: 'EMAIL' }, 'notification-dispatch: EMAIL delivered');
    }
    ```
  - Note: If `emailSender.sendEmail()` throws, the error propagates to BullMQ which handles retry via the existing 3-attempt exponential backoff configuration
- [x] 4.2 Update `createNotificationDispatchWorker` function signature to accept `emailSender`:
  - Change: `createNotificationDispatchWorker(prisma, logger, connection)` → `createNotificationDispatchWorker(prisma, logger, connection, emailSender: EmailSender | null)`
  - Pass `emailSender` through to the `deliverEmail` call in the worker's job processor
  - The `EmailSender` parameter is nullable — if SMTP is not configured, the worker still starts but email delivery is a no-op with warning log
- [x] 4.3 Update the worker registration in the app lifecycle (wherever `createNotificationDispatchWorker` is called):
  - Create the email sender from SMTP env vars at startup (if configured)
  - Pass it to `createNotificationDispatchWorker`
  - Call `emailSender.verifyConnection()` on startup (non-blocking — log warning if SMTP unreachable)
  - Call `emailSender.close()` on shutdown

### Task 5: Email Sender Registration in Communications Module (AC: #1) ✅

- [x] 5.1 Create `apps/api/src/modules/communications/email/index.ts` barrel file:
  - Export `createEmailSender`, `EmailSendOptions`, `EmailConfig`, `getEmailConfig`, `isEmailConfigured`
  - Export `renderNotificationEmailHtml`, `renderNotificationEmailText`, `NotificationEmailData`
- [x] 5.2 Update the notification dispatch plugin (wherever the worker is initialised during Fastify startup):
  - Import `isEmailConfigured`, `getEmailConfig`, `createEmailSender` from the email module
  - At startup:
    1. Check `isEmailConfigured()` — if `false`, log info message and pass `null` to worker (graceful degradation)
    2. If configured: `const emailSender = createEmailSender(getEmailConfig(), fastify.log)`
    3. Call `emailSender.verifyConnection()` — log result (non-blocking)
    4. Pass `emailSender` to `createNotificationDispatchWorker()`
  - At shutdown: call `emailSender.close()` if it exists
- [x] 5.3 Emit `email.sent` event after successful email delivery:
  - In `deliverEmail` after marking DELIVERED, emit:
    ```typescript
    eventBus.emit('email.sent', {
      emailMessageId: notificationId, // using notification ID as reference
      recipientEmail: user.email,
      subject: notification.title,
      documentType: 'notification',
    });
    ```
  - This matches the event catalog §14 `email.sent` event schema

### Task 6: Dispatch Worker Tests — Email Channel (AC: #1, #2, #3, #4) ✅

- [x] 6.1 Update `apps/api/src/modules/communications/notifications/notification-dispatch.worker.test.ts`:
  - Add test cases for EMAIL channel with real sender:
    - **E9.3-API-007**: Test that EMAIL channel looks up user email, renders HTML template, calls `emailSender.sendEmail()` with correct `to`, `subject`, `html`, `text`, and marks notification DELIVERED
    - **E9.3-API-014**: Test that when `emailSender.sendEmail()` throws, the error propagates to BullMQ (verify the function throws, not catches internally), enabling BullMQ retry
    - **E9.3-API-015**: Test that when `emailSender` is `null` (SMTP not configured), notification is marked DELIVERED with warning log (graceful degradation)
    - **E9.3-API-023**: Test that after BullMQ exhausts all retries (simulated), the worker's `failed` event handler marks the notification as FAILED (this logic already exists in the worker)
    - **E9.3-API-024**: Test that rendered email HTML contains notification title, body, action URL, and company branding
  - Mock Prisma, mock email sender, verify all interactions
- [x] 6.2 Create `apps/api/src/modules/communications/email/email-sender.service.test.ts` (if not done in Task 2.2):
  - Test email sender with mocked Nodemailer transport
  - Test error wrapping in `AppError`
  - Test `verifyConnection()` success/failure paths
- [x] 6.3 Verify existing preference cascade test coverage (AC: #4):
  - Confirm that `notification.service.test.ts` already covers the case where a user has `enableEmail: false` — the `resolveChannels()` function excludes `EMAIL` from the channel list, so `deliverEmail` is never called
  - If not covered, add a test in `notification.service.test.ts` confirming: when `enableEmail: false` in preference, no EMAIL notification is created and no email job is enqueued

## Dev Notes

### Architecture Patterns

- **Module location**: New email files in `apps/api/src/modules/communications/email/` — alongside the existing `notifications/` subdirectory
- **Factory pattern**: `createEmailSender(config, logger)` returns an object (not a class) — consistent with existing service patterns. Instantiated once at startup and passed to the worker.
- **Graceful degradation**: If SMTP is not configured (`SMTP_HOST` unset), the entire email channel operates as a no-op. This allows development without an SMTP server and ensures the notification system functions for IN_APP/PUSH even if email is unavailable.
- **Error propagation for retry**: `deliverEmail` must **throw** on SMTP failure (not catch and mark FAILED internally). The BullMQ worker's existing retry logic handles the throw → retry cycle. Only after all retries are exhausted does the `worker.on('failed')` handler mark the notification as FAILED.

### Scope Boundaries — What This Story Does NOT Include

| Not included | Reason | Where it belongs |
|---|---|---|
| **EmailMessage/EmailRecipient/EmailQueue Prisma models** | Full email system models are E10 scope; E9-3 only sends notification emails via Nodemailer directly | E10 (Email Integration) |
| **EmailTemplate model (database)** | Document-to-email templates with `documentType`, `attachPdf`, language variants | E10 (Email Integration) |
| **Per-company SMTP settings** | CompanyProfile SMTP config (different SMTP per company) | E10 (Email Integration) |
| **Email inbox/outbox UI** | Email messaging UI for users | E10 (Email Integration) |
| **Document-to-email pipeline** | "Email this invoice" workflow with PDF attachment | E10 (Email Integration) |
| **Push notification sending** | Mobile push (Expo Push API) | Future scope (mobile app) |
| **Email bounce tracking** | SMTP bounce detection and handling | E10 (Email Integration) |
| **Auto-reply system** | Out-of-office auto-reply per BR-COM-004/005 | E10 (Email Integration) |

E9-3 creates a minimal, focused email sending capability for notifications only. E10 will add the full email subsystem (EmailMessage, EmailQueue, per-company SMTP, document emails, inbound email).

### Notification Email Template Design (AC: #2)

The HTML email follows these design principles from the UX Design Spec (Concept D):

```
+--------------------------------------------------+
|  [Logo] Company Name          (Purple #7c3aed)   |  <- Header bar
+--------------------------------------------------+
|                                                   |
|  Notification Title                               |  <- <h1> in body card
|                                                   |
|  Notification body text with rendered             |
|  Handlebars content from the notification         |
|  template. Supports basic HTML.                   |
|                                                   |
|  +-------------------------------------------+   |
|  |           [View Details]                   |   |  <- Purple CTA button
|  +-------------------------------------------+   |
|                                                   |
+--------------------------------------------------+
|  Manage your notification preferences in Settings |  <- Footer
|  Powered by Nexa ERP                              |
+--------------------------------------------------+
```

- Background: `#f4f2ff` (light purple, Concept D)
- Accent: `#7c3aed` (primary purple)
- Button: `#7c3aed` bg, white text, 8px radius
- Card: White bg, 12px radius
- Font: System font stack (email clients don't load web fonts)
- All CSS inline on elements (no `<style>` — stripped by Gmail, Outlook)

### Retry Strategy (AC: #3)

The BullMQ retry logic is already configured in E9-1:

```
Queue config:  defaultJobOptions.attempts = 3, backoff.type = 'custom'
Worker config: backoffStrategy returns [30_000, 120_000, 300_000] ms
Worker event:  'failed' handler marks notification FAILED after attemptsMade >= attempts
```

E9-3 leverages this by ensuring `deliverEmail` **throws** on SMTP failure. The error propagates to BullMQ which:
1. Attempt 1 fails → waits 30s → retries
2. Attempt 2 fails → waits 120s → retries
3. Attempt 3 fails → `worker.on('failed')` marks notification as FAILED

No changes to the retry configuration are needed. The key change is that `deliverEmail` now performs a real SMTP call that can throw, instead of the stub which always succeeded.

### Preference Cascade (AC: #4)

User email preferences are already handled by E9-1's `resolveChannels()` function in `notification.service.ts`:

```typescript
// From E9-1: resolveChannels()
if (preference.enableEmail) channels.push(NotificationChannel.EMAIL);
```

If `enableEmail: false`, the EMAIL channel is excluded, no EMAIL notification record is created, and `deliverEmail` is never called. **No new code needed for AC #4** — it's verified by testing the existing flow.

### File Structure

```
apps/api/src/modules/communications/
├── email/                                    # NEW — E9-3
│   ├── index.ts                              # Barrel exports
│   ├── email-config.ts                       # SMTP env var config
│   ├── email-sender.service.ts               # Nodemailer email sender
│   ├── email-sender.service.test.ts          # Sender unit tests
│   ├── notification-email-template.ts        # HTML email template renderer
│   └── notification-email-template.test.ts   # Template unit tests
├── notifications/                            # EXISTING — E9-1/E9-2
│   ├── notification-dispatch.worker.ts       # MODIFIED — replace EMAIL stub
│   ├── notification-dispatch.worker.test.ts  # MODIFIED — add EMAIL tests
│   └── ... (other E9-1 files unchanged)
└── index.ts                                  # MODIFIED — register email sender
```

### Key Dependencies

- **E9-1 (Notification Service)**: Already implemented — provides the dispatch worker, BullMQ queue, preference cascade, notification service
- **Nodemailer**: New dependency — `pnpm add nodemailer --filter @nexa/api` + `pnpm add -D @types/nodemailer --filter @nexa/api`
- **BullMQ + Redis**: Already installed and configured from E9-1
- **CompanyProfile**: Already exists — used to fetch company name and logo for email branding

### Environment Variables

For local development, use [Mailtrap](https://mailtrap.io/) or [Ethereal](https://ethereal.email/) (Nodemailer's test SMTP):

```env
# .env (development)
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_mailtrap_user
SMTP_PASS=your_mailtrap_pass
SMTP_FROM_NAME=Nexa ERP (Dev)
SMTP_FROM_EMAIL=noreply@nexa-erp.dev
```

If SMTP env vars are not set, the email channel operates as a no-op (logs warning, marks DELIVERED). This allows all developers to run the system without SMTP configuration.

### Cross-Cutting Patterns (MANDATORY)

- **companyId**: Email branding fetches company name/logo from `CompanyProfile` via the recipient user's `companyId`. No companyId on the Notification model itself (scoped by userId per Architecture §2.29).
- **i18n**: Notification email content uses the pre-rendered title/body from the template engine (Handlebars). No additional i18n for email templates in E9-3. Future: `languageCode` support when EmailTemplate model is created in E10.
- **Audit**: Emit `email.sent` event per event catalog §14 after successful delivery. The audit trail service (E3) logs this automatically.

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **PRD** | §FR184, §FR187 | Email channel delivery for notifications; configurable SMTP settings |
| **Architecture** | §2.29.2 EmailQueue model, §2.29.5 BullMQ email-send worker, §2.29.6 Email template merge fields, §2.29.8 Notification routing EMAIL branch | Full email architecture including queue status states, retry strategy, Handlebars template system, and notification-to-email routing |
| **API Contracts** | §2.25 Communications | Notification API endpoints (no new endpoints in E9-3 — email sending is internal) |
| **Data Models** | §3.18 Communications Module | EmailQueue (PENDING/PROCESSING/SENT/FAILED/RETRYING), NotificationPreference (enableEmail) |
| **State Machines** | §17.1 EmailMessage Status, §17.2 Notification Status | EmailQueue: PENDING → PROCESSING → SENT/FAILED/RETRYING. Notification: PENDING → DELIVERED / FAILED |
| **Event Catalog** | §14 Communications Events | `email.sent` event: `{ emailMessageId, recipientEmail, subject, documentType? }` |
| **Business Rules** | §13 Communications Rules | BR-COM-014 (preference cascade), BR-COM-015 (S3 presign for attachments — future), BR-COM-001 (email validation), BR-COM-009 (signature append once — E10) |
| **UX Design Spec** | N/A | E9-3 is backend-only — no UI changes |
| **Project Context** | §5 Notifications | Email delivery via SMTP, notification channels |
| **Test Design** | E9.3-API-007, E9.3-API-014, E9.3-API-015, E9.3-API-023, E9.3-API-024 | P0: email queued with rendered HTML. P1: retry backoff, preference respected. P2: FAILED after retries, HTML template rendering |

### Source References

- [Source: apps/api/src/modules/communications/notifications/notification-dispatch.worker.ts#L86-95] — `deliverEmail` stub to replace
- [Source: apps/api/src/modules/communications/notifications/notification-dispatch.queue.ts] — BullMQ queue config (3 attempts, custom backoff)
- [Source: apps/api/src/modules/communications/notifications/notification.service.ts#L23-36] — `resolveChannels()` preference cascade (AC #4)
- [Source: apps/api/src/modules/communications/index.ts] — Communications module plugin registration
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#2.29.5] — BullMQ email-send worker architecture
- [Source: _bmad-output/planning-artifacts/event-catalog.md#14] — `email.sent` event schema
- [Source: _bmad-output/planning-artifacts/business-rules-compendium.md#13] — BR-COM-014 preference cascade
- [Source: _bmad-output/test-artifacts/test-design-epic-E9.md] — E9.3 test scenarios (P0/P1/P2)


## Code Review Notes (Auto-Generated)

**Status:** Completed with remaining issues after 3 CR iterations

**Date:** 2026-03-03 19:40

### Remaining Issues for Human Review:

- **ISSUE #1: [HIGH] Story spec vs implementation contradiction — `emailSender` null behaviour**
- **ISSUE #2: [HIGH] Duplicate email sends on crash recovery with no mitigation**
- **ISSUE #3: [HIGH] `email.sent` event silently dropped when email was actually sent**
- **ISSUE #4: [MEDIUM] `auth` block always sent even when credentials are empty**
- **ISSUE #5: [MEDIUM] No unit tests for `email-config.ts`**
- **ISSUE #6: [MEDIUM] `escapeHtml` and `escapeAttr` are identical duplicate functions**
- **ISSUE #7: [MEDIUM] Potential email header injection via `fromName` env var**
- **ISSUE #8: [MEDIUM] `sanitize-html` dependency undocumented in story spec**
- **ISSUE #9: [LOW] `renderNotificationEmailText` body is not sanitised**
- **ISSUE #10: [LOW] `deliverInApp` uses `.update()` but `deliverEmail` uses `.updateMany()` — inconsistent race condition handling**
- **ISSUE #11: [LOW] Plugin shutdown order may lose emails**
- **3 HIGH, 5 MEDIUM, 3 LOW** issues found.

---

