# Phase 6 — Connectors

Endpoints:
- GET /api/integrations/health — aggregated health
- GET /api/integrations/{shopify|amazon|ebay|hmrc-rti|open-banking|edi}/status — per-connector health
- POST /api/integrations/{connector}/connect — demo connect flow

DTOs:
- ConnectorHealth, ConnectorConnectInput, ConnectorConnectResult (see apps/web/src/types/phase6.ts)

Security & Masking:
- All endpoints use audit() from apps/web/src/lib/log/mask.ts with hasMasked:true and IPv4 redaction
- Inputs validated via Zod; results validated before returning

Tests:
- DTO tests for health and connect routes under the corresponding route.test.ts files
