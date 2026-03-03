# Phase 3.17 – ai_core

- BASE_REF: `e3efec9`
- HEAD: `ad791c4`
- Slice: `ai_core`
- Evidence: `reports/verification/phase3-ai_core-20260116-005736`

## Permissions & Module Gate
- Module gate: `assertModuleEnabled('ai')`.
- READ permission: `ai:use`.
- MANAGE permission: `inventory:manage` (automation management).

## Endpoints
- `POST /api/ai/run`
- `GET/POST /api/ai/automations`
- `GET/PATCH /api/ai/automations/[automationId]`
- `POST /api/ai/automations/[automationId]/enable`
- `POST /api/ai/automations/[automationId]/disable`
- `POST /api/ai/automations/[automationId]/run`

## UI Routes
- `/ai` landing (links).
- `/ai/run` prompt runner.
- `/ai/automations` list/create.
- `/ai/automations/[automationId]` detail + test run.

## Test Mode Behaviour
- When `CI=1` or `NODE_ENV=test`, AI responses return deterministic `echo:<hash>` without external calls for safe CI runs.

## Guardrails
- Prompt length limit 8k chars; rejects detected secrets (API keys, JWT-like, RSA headers).
- Resource refs validated for tenant scope (unsupported types rejected).
- Module gate + permission enforcement on all endpoints.

## Audit
- AI calls recorded to `ai_engine_logs` when available; fallback to `TenantConfig.ai.audit` ring buffer (max 200).

## Automations
- Stored in `TenantConfig.ai.automations`; templates render `{{var}}`.
- Idempotency per automation + `idempotencyKey` stores last result to avoid re-run; second run returns cached result.

## Seed / Unseed / Verifier
- Seed `scripts/qa/seed_ai_core.ts`: creates tenant, automation, runs once (stores idempotent result).
- Unseed `scripts/qa/unseed_ai_core.ts`: removes TenantConfig.ai, ai_engine_logs, tenant.
- Verifier `scripts/verification/verify_phase3_ai_core.mjs`: checks prompt guardrails (length/secret), deterministic test-mode run, automation CRUD/run idempotency, and cleanup.

## Commands
- Slice gate (ran & passed):
  - `TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/nexa_vitest?schema=phase3_main_ai_db01' SLICE_KEY=ai_core BASE_REF=e3efec9 bash scripts/verification/run_phase3_slice.sh`
