# Sub-Processors — Nexa ERP

Last updated: 2025-11-29

## Purpose
List of third-party service providers (sub-processors) used to deliver Nexa ERP, as required by GDPR Article 28.

## Sub-Processor List

### 1. Vercel Inc.
- **Purpose:** Cloud hosting and edge computing
- **Region:** EU/UK (primary), US (backup)
- **Data Processed:** Application code, user sessions, static assets
- **Contact:** https://vercel.com/legal/privacy-policy

### 2. Neon Postgres (Neon, Inc.)
- **Purpose:** Managed PostgreSQL database
- **Region:** EU/UK (primary)
- **Data Processed:** All application data (tenant data, users, transactions, audit logs)
- **Contact:** https://neon.tech/legal/privacy-policy

### 3. OpenAI, L.L.C.
- **Purpose:** AI inference (GPT-4o-mini model)
- **Region:** US/EU (configurable)
- **Data Processed:** AI prompts and responses (PHI redacted for healthcare tenants before sending)
- **Contact:** https://openai.com/policies/privacy-policy
- **Note:** For healthcare tenants, Protected Health Information (PHI) is redacted before data is sent to OpenAI.

### 4. Redis (Redis Labs / Upstash)
- **Purpose:** Caching and session storage
- **Region:** EU/UK (primary)
- **Data Processed:** Cache data, session tokens, rate limit counters
- **Contact:** https://redis.io/legal/privacy-policy

## Data Processing Agreements

All sub-processors are required to:
- Process data only as instructed by Nexa ERP
- Implement appropriate technical and organizational measures
- Comply with GDPR and applicable data protection laws
- Notify Nexa ERP of any data breaches

## Updates to This List

This list will be updated as new sub-processors are added or existing ones are changed. Changes will be:
- Documented in this file
- Notified to affected tenants (where required by GDPR)
- Reviewed quarterly as part of compliance audits

## Contact

For questions about sub-processors, contact:
- privacy@nexaai.co.uk
- Chief A.A Ltd. (legal entity)

---

**Note:** This list reflects current sub-processors as of 2025-11-29. Sub-processors may change as the service evolves. All sub-processors are selected based on their compliance with GDPR and data protection requirements.
