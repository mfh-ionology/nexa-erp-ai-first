# AI Governance — Nexa

Last updated: 2025-11-29

## Purpose
Set safe AI use in Nexa ERP, ensuring compliance with healthcare regulations and data protection requirements.

## Who should read this
Engineering, product, compliance, and healthcare tenant administrators.

## Principles
- Prompt masking. Never send secrets.
- Token caps per request and per user.
- Evaluation sets for critical prompts.
- Full audit logging of inputs/outputs (with masking).

## Healthcare Mode Constraints

**Operational Assistance Only:**
- Healthcare tenants can enable "healthcare mode" which enforces strict AI constraints
- AI MUST NOT provide medical diagnosis or treatment recommendations
- AI MUST NOT make clinical judgements or interpret clinical data
- AI MUST ONLY provide operational assistance (e.g., rota coverage counts, scheduling help)
- Explicit constraints are added to all AI prompts for healthcare tenants

**PHI Redaction:**
- Protected Health Information (PHI) is redacted from AI logs before storage
- Redaction covers:
  - Names (patient, staff, or identifiable individuals)
  - NHS numbers
  - Phone numbers (normalized detection, 9+ digits)
  - Email addresses
  - Postcodes
  - Clinical notes and free-text PHI
- Redaction is applied in "strict mode" for AI logs (more aggressive than prompt redaction)
- Non-healthcare tenant logs are unchanged

**Important:** Nexa ERP is not a medical device and must not be used for clinical diagnosis or treatment decisions.

## AI Logging and Retention

**Logging:**
- All AI prompts and responses are logged to `AIEngineLog` table
- Logs include: prompt, response, intent, metadata, timestamp, tenant ID, user ID
- For healthcare tenants: PHI is redacted before logging

**Retention:**
- AI log retention is configurable per tenant
- Retention periods are TBD (subject to further configuration)
- Logs are stored securely with access restricted to SUPER_ADMIN and tenant administrators

## Field-Level Visibility in AI Context

- AI prompt builders use field-level visibility controls for sensitive entities
- Healthcare rota data is filtered before inclusion in AI prompts
- Sensitive fields (patient IDs, NHS numbers, clinical notes) are masked for restricted roles
- This ensures AI responses do not expose sensitive data to unauthorized users

## BYOK (Enterprise)
- Bring Your Own Key support. Keys stored securely.
- Encryption keys can be managed per tenant for enhanced data protection.

## Access reviews
- Quarterly access review for AI features and logs.
- SUPER_ADMIN can view all AI logs with filtering by tenant, user, date range.
- Sensitive read logging tracks access to healthcare AI features.

## Audit and Compliance

**Sensitive Read Logging:**
- Access to healthcare AI features is logged as sensitive reads
- Logs include: user ID, tenant ID, timestamp, entity type, source (UI/API/chat)

**Configuration Changes:**
- AI profile settings changes are treated as high-risk
- Require explicit confirmation and re-authentication
- All changes are audited with before/after snapshots

## External AI Providers

**OpenAI:**
- Used for AI inference (GPT-4o-mini)
- Region: US/EU (configurable)
- Data sent to OpenAI is subject to their privacy policy
- For healthcare tenants: PHI is redacted before sending to OpenAI

**Sub-processor:** OpenAI is listed as a sub-processor in `docs/legal/sub-processors.md`.

## Future Enhancements

- Configurable AI log retention periods
- Enhanced PHI detection patterns
- Dual-approval for high-risk AI configuration changes
- AI usage analytics and monitoring
