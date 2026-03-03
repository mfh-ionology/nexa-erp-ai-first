# CRM Sync (HubSpot) — Phase-7

API routes:
- GET  /api/crm/hubspot/status → { ok, configured }
- POST /api/crm/hubspot/sync → body { tenantId?, since? }

Auth/RBAC:
- Header `x-role: admin|user` (marketplace module allows user)

Models:
- `HubspotContact`, `HubspotCompany`, `HubspotDeal`

Notes:
- Mirrors ids and core fields, maintains `lastSyncAt`
- Status is env-gated via HUBSPOT_* envs




