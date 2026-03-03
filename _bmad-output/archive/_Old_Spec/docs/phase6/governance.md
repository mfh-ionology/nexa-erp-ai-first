# Phase 6 — AI Governance

Location: apps/web/src/lib/ai/governance.ts

- enforceTokenCaps(input: string, maxTokens: number): string
  - Enforces approximate token caps (4 chars ~= 1 token) for demo purposes
  - Non-negative, finite caps only; otherwise returns empty string
- recordEvaluation(name: string, meta?: Record<string, unknown>): void
  - Records evaluation events via centralized audit() logger
  - All audit logs include hasMasked: true and redact IPv4 to xxx

Notes:
- All assistant/AI logs across Phase 6 use audit() from apps/web/src/lib/log/mask.ts to maintain masking guarantees.
- Extend these helpers as models and evaluation sets grow; keep masking and authz in place.
