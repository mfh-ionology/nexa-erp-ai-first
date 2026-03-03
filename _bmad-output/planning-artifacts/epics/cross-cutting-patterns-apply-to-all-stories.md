# Cross-Cutting Patterns (Apply to ALL Stories)

Every implementation story MUST follow these patterns from `project-context.md`:

| Pattern | Requirement |
|---------|-------------|
| **companyId** | Every ERP model has `companyId`; every query scopes by `companyId` (check `RegisterSharingRule` for shared entities) |
| **i18n** | All user-facing strings use translation keys via `t('key')` — even in MVP (English-only) |
| **Audit** | All state-changing operations emit typed events via the event bus |
| **Platform** | AI calls go through AI Gateway; module access checked via Platform Client SDK |
| **Attachments/Notes/Tasks** | Consider if each entity needs cross-cutting record support |
| **Mobile** | Each business epic ends with a Mobile Adaptation story |
