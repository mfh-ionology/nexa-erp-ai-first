# Phase 6 — Integrations Health

Endpoint: apps/web/src/app/api/integrations/health/route.ts
- Returns validated connector health items (ConnectorKey: shopify, amazon, ebay, hmrc_rti, open_banking, edi)
- Logs via audit() with hasMasked:true
- DTO tests: route.test.ts
