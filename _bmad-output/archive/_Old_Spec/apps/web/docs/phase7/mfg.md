# Advanced MFG (Phase-7)

API routes (App Router):
- POST /api/mfg/mrp → body { tenantId?, itemCode, qty }
- POST /api/mfg/capacity → body { tenantId?, resourceCode, date, availableMins }
- POST /api/mfg/aps → body { tenantId?, workOrderNumber, durationMins }

Auth/RBAC:
- Header `x-role: admin`

Models:
- `WorkOrder`, `BomItem`, `RoutingStep`, `MrpPlan`, `CapacityCalendar`

Notes:
- Zod validation, correlation IDs, masked audit
- Defaults `tenantId` to header or local 't1' for tests




