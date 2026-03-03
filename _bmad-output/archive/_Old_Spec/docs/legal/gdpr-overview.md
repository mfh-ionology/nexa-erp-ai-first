# GDPR Overview — Nexa ERP

Last updated: 2025-11-29

## Purpose
Plain English overview of how Nexa ERP complies with UK GDPR and data protection requirements.

## Core Principles

**Data Minimisation:**
- We collect only what we need to deliver the service
- Field-level access controls mask sensitive data for unauthorized roles
- PHI redaction applied to AI logs for healthcare tenants

**Data Security:**
- Multi-tenant data isolation
- Role-based access control (RBAC)
- Sensitive read logging for high-risk data access
- Audit logging for configuration changes
- TLS encryption in transit
- Encrypted storage at rest

**Data Retention:**
- We keep data only for as long as necessary for stated purposes
- Retention periods are configurable per tenant (subject to further configuration)
- Data is deleted when no longer required (subject to legal obligations)

**Data Subject Rights:**
- Access: Request copies of your personal data
- Rectification: Request correction of inaccurate data
- Erasure: Request deletion (subject to legal obligations)
- Portability: Request transfer of your data
- Objection: Object to processing based on legitimate interests
- Restriction: Request restriction of processing

## Lawful Bases

- **Contract:** Processing necessary for service delivery
- **Legitimate Interests:** Security, fraud prevention, system improvement
- **Consent:** Where required for optional features

## Special Categories of Data

**Healthcare Data:**
- Healthcare mode enforces operational-only AI assistance
- PHI redaction applied to AI logs
- Nexa ERP is not a medical device and must not be used for clinical diagnosis or treatment decisions

**HR/Payroll Data:**
- Field-level access controls restrict sensitive fields (salary, addresses, IDs)
- Sensitive read logging tracks access
- Access restricted to authorized roles only

## Data Processing Details

**What We Process:**
- Account and authentication data
- Configuration data (tenant settings, user preferences)
- Operational data (financial transactions, inventory, HR, healthcare rota)
- Communication data (chat messages, call metadata)
- AI interaction data (prompts/responses with PHI redaction)
- Audit and access logs

**How We Process:**
- Data is processed within tenant boundaries (multi-tenant isolation)
- Access is controlled via RBAC and field-level visibility
- Sensitive operations are logged and audited
- High-risk configuration changes require re-authentication

**Where We Process:**
- Primary region: EU/UK
- Sub-processors: See `docs/legal/sub-processors.md`

## Contact

For GDPR-related queries:
- Your tenant administrator
- privacy@nexaai.co.uk
- Chief A.A Ltd. (legal entity)

---

**Note:** This is a high-level overview. For detailed information, see:
- `apps/web/docs/legal/privacy-policy.md` — Full privacy policy
- `apps/web/docs/compliance/ai-governance.md` — AI governance and healthcare constraints
- `docs/legal/sub-processors.md` — Sub-processor list
