# Phase 6 — Final Report (CRM UI + AI consolidation + QA hardening)

Canonical final verification index: see `docs/verification/phase1-crm-merge.final.md`.

Branch: `phase1/crm-step6-20260114`

Commits
- A UI canonicalisation: `ba97f12`
- B AI canonical services: `ebf3fbd`
- C evidence/doc: `8e26632`
- QA bypass hardening: `09655eb`

Latest CI (PASS)
- ci: `20993099737`
- api-ci: `20993099757`

Verifier evidence (after hardening)
- Command: `BASE_URL='http://127.0.0.1:3000' SEED_EMAIL='info@nexaai.co.uk' SEED_PASSWORD='Wolfish123' TEST_AUTH_ENABLED='1' TEST_AUTH_SECRET='devsecret' ALLOW_QA_BYPASS='1' QA_BYPASS_SECRET='devsecret-bypass' TENANT_SLUG='demo-tenant' pnpm tsx scripts/verification/verify_phase1_crm_step5.mjs`
- Result: PASS
- Evidence: `reports/verification/phase1-crm-step5-2026-01-14T11-50-40-412Z`

QA bypass hardening summary
- Bypass allowed only when **all** hold: `NODE_ENV !== "production"`, request host is localhost/127.0.0.1, `TEST_AUTH_ENABLED=1`, `QA_BYPASS_MODULE_DISABLED=1`, header `x-qa-bypass` matches `QA_BYPASS_SECRET`.
- Preview/prod cannot satisfy host + NODE_ENV + header/secret + test-auth combination; bypass is effectively disabled there.
- Functional proof:
  - Without header → `curl /api/crm/accounts` (with test cookie) returns `403 module_disabled`.
  - With header `x-qa-bypass: devsecret-bypass` → same request succeeds (200).

Notes
- QA scripts (seed/unseed/verifier) send `x-qa-bypass` only when `ALLOW_QA_BYPASS=1` and `QA_BYPASS_SECRET` are set.
- CRM UI remains canonical (`/crm/*`), legacy `/sales/*` routes redirect, and AI intents read canonical CRM services.
