# Advanced WMS (Phase-7)

API routes (App Router):
- POST /api/wms/putaway → body { sku, qty, warehouseCode?, locationCode? }
- POST /api/wms/labels → body { sku, qty } returns mock labels

Auth/RBAC:
- Header `x-role: admin`

Models:
- `Warehouse`, `Location`, `InventoryItem`, `Asn`, `Wave`, `PickTask`

Notes:
- Correlation IDs and masked audit logging in routes
- Input validated with Zod; permissive for demo local testing




