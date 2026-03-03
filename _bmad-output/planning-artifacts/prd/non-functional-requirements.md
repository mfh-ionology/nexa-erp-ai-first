# Non-Functional Requirements

## Performance

- NFR1: AI conversational responses must complete within 3 seconds for 95th percentile of requests
- NFR2: Traditional CRUD operations must complete within 500ms for 95th percentile
- NFR3: Standard report generation must complete within 5 seconds for datasets up to 100,000 transactions
- NFR4: Bank feed processing must complete within 15 minutes of feed availability
- NFR5: Bulk operations (month-end close, payroll for up to 250 employees) must complete within 60 seconds with progress indication
- NFR6: Page load time must be under 2 seconds on standard broadband (10Mbps+)
- NFR7: The system must support 50 concurrent users per tenant without degradation

## Security

- NFR8: All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- NFR9: Database-per-tenant architecture must provide complete isolation with zero cross-tenant access, verified by automated cross-tenant penetration tests per release cycle and continuous connection-routing validation in CI
- NFR10: Authentication must support MFA (TOTP at minimum)
- NFR11: Sessions must expire after configurable inactivity period (default 30 minutes)
- NFR12: All API endpoints authenticated and authorised against role and module access
- NFR13: Password storage must use bcrypt or argon2 with minimum 10 rounds
- NFR14: All financial transaction modifications logged in immutable, tamper-evident audit trail
- NFR15: Failed logins rate-limited (max 5 per 15 minutes) with account lockout
- NFR16: AI-generated actions must never execute without explicit user approval for financial operations, verified by mandatory approval-gate integration tests and zero-bypass audit log validation per release

## Reliability

- NFR17: System uptime 99.9% (max 8.76 hours unplanned downtime per year)
- NFR18: Zero data loss for committed financial transactions (ACID compliance), verified by RPO=0 for committed transactions with ACID integrity tests and point-in-time recovery drills quarterly
- NFR19: Automated daily backups with point-in-time recovery
- NFR20: Backup restoration within 1 hour for databases up to 50GB
- NFR21: If AI layer unavailable, all traditional form operations must continue functioning
- NFR22: External integration failures handled gracefully with retry, dead-letter queue, and user notification

## Scalability

- NFR23: Support up to 1,000 tenants without architectural changes
- NFR24: Each tenant database must handle up to 1 million transactions per year without degradation
- NFR25: Schema migrations applicable per-tenant without system-wide downtime
- NFR26: New tenant provisioning within 60 seconds

## Accessibility

- NFR27: WCAG 2.1 Level AA compliance for all traditional form interfaces
- NFR28: All interactive elements keyboard-navigable
- NFR29: Colour contrast minimum 4.5:1 normal text, 3:1 large text
- NFR30: AI conversational interface must support screen reader compatibility

## Integration

- NFR31: All external API integrations must implement retry with exponential backoff (max 3 retries)
- NFR32: HMRC MTD/RTI submissions must complete within HMRC API timeout windows
- NFR33: Bank feed sync must handle failures without data loss or duplicate transactions
- NFR34: Integration credentials stored encrypted, never exposed in logs or API responses
- NFR35: Integration health monitorable from admin dashboard with alerting on failures

## Data Integrity

- NFR36: Double-entry bookkeeping enforced at database level — no unbalanced journals
- NFR37: Financial period locks enforced at database level — no DML on locked periods
- NFR38: All monetary values use fixed-point decimal (not floating point)
- NFR39: Audit trail records append-only — no update or delete
- NFR40: Data retention supports minimum 6 years for financial records per HMRC

## Platform Operations

- NFR46: Platform API entitlement checks must complete within 50ms (95th percentile) to avoid impacting ERP login/navigation performance
- NFR47: AI Gateway quota check + usage recording must add no more than 100ms latency to AI calls (95th percentile)
- NFR48: Platform Admin portal must enforce MFA for all platform administrator accounts with no exceptions
- NFR49: Every platform admin action must be recorded in an immutable audit log with actor identity, timestamp, IP address, and action details — no audit log entry may be modified or deleted
- NFR50: AI usage records must be durable — zero loss of billable AI call records even during Platform API outages (local queue with guaranteed delivery)
- NFR51: Tenant entitlement cache in the ERP must support webhook-based invalidation, ensuring enforcement actions (suspend, read-only) take effect within 30 seconds of platform admin action

## Maintainability

- NFR41: All code written in TypeScript with strict mode
- NFR42: All coding performed exclusively using Claude Opus 4.6
- NFR43: Test coverage minimum 80% for business logic and financial calculation modules
- NFR44: Database schema changes managed through versioned migrations
- NFR45: All API endpoints documented with OpenAPI/Swagger specifications
