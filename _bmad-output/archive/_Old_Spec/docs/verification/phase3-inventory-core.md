# Phase 3 – Inventory Core

- BASE_REF: `9a9364c`
- HEAD: `df7dc69`
- Slice: `inventory_core`
- Evidence: `reports/verification/phase3-inventory_core-20260115-190745`

## Scope
- Items and warehouses CRUD with disable flags tracked per tenant.
- Deterministic on-hand derived from `StockMove` (signed qty); adjustments/transfers write ledger rows.
- Transfers support create → ship → receive lifecycle; prevents overship and respects disable/stock checks.

## Permissions & Gates
- READ: `ui:finance_reports:view`
- MANAGE: `inventory:manage`
- Module gate: `inventory`

## APIs
- `GET/POST /api/inventory/items`
- `GET/PATCH /api/inventory/items/[itemId]`
- `GET/POST /api/inventory/warehouses`
- `GET/PATCH /api/inventory/warehouses/[warehouseId]`
- `GET /api/inventory/on-hand?sku=&warehouseId=`
- `POST /api/inventory/adjustments`
- `GET/POST /api/inventory/transfers`
- `GET /api/inventory/transfers/[transferId]`
- `POST /api/inventory/transfers/[transferId]/ship`
- `POST /api/inventory/transfers/[transferId]/receive`

## UI Routes
- `/inventory/items`
- `/inventory/warehouses`
- `/inventory/on-hand`
- `/inventory/adjustments`
- `/inventory/transfers`

## On-hand computation
- Sum of signed `StockMove.qty` per tenant/sku/warehouse; adjustments use +/-; transfer_out negative, transfer_in positive; cached qtyOnHand not authoritative.

## Limitations / Storage
- Disable flags stored in TenantConfig because Warehouse/InventoryItem have no status/disabled fields in schema; enforced in services (items/warehouses/adjustments).

## QA
- Seed: `scripts/qa/seed_inventory_core.ts` (2 warehouses, 2 items, add stock, transfer A→B, negative adjustment attempt expected fail).
- Unseed: `scripts/qa/unseed_inventory_core.ts` (removes runId-tagged items/warehouses/moves/config).
- Verifier: `scripts/verification/verify_phase3_inventory_core.mjs` (DB check, uniqueness, on-hand after transfer, overship block, disable prevents movement, cleanup).
