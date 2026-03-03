# Phase 3 – WMS Extensions (cycle count, quality, shipments)

- BASE_REF: `43cdbba`
- HEAD: `61a69e4`
- Slice: `wms_extensions`
- Evidence: `reports/verification/phase3-wms_extensions-20260115-195641`

## Permissions / Gates
- Read: `ui:finance_reports:view`
- Manage: `inventory:manage`
- Module gate: `inventory` via API foundations (`financeGlHandler` alias with inventory module)

## APIs
- Cycle counts: `GET/POST /api/wms/cycle-counts`, `GET/PATCH /api/wms/cycle-counts/[countId]`, `POST /api/wms/cycle-counts/[countId]/start`, `post /api/wms/cycle-counts/[countId]/post`, `POST /api/wms/cycle-counts/[countId]/cancel`
- Quality: `GET/POST /api/wms/quality/holds`, `POST /api/wms/quality/holds/[holdId]/release`, `POST /api/wms/quality/holds/[holdId]/reject`
- Shipments: `GET/POST /api/wms/shipments`, `GET/PATCH /api/wms/shipments/[shipmentId]`, `POST /api/wms/shipments/[shipmentId]/pick`, `POST /api/wms/shipments/[shipmentId]/ship`, `POST /api/wms/shipments/[shipmentId]/cancel`

## UI routes
- `/wms` (landing)
- `/wms/cycle-counts` (list/create)
- `/wms/cycle-counts/[countId]` (detail, start/post/cancel)
- `/wms/quality` (holds list/create/release/reject)
- `/wms/shipments` (list/create)
- `/wms/shipments/[shipmentId]` (detail/pick/ship/cancel)

## Quarantine / availability logic
- Available quantity = inventory on-hand (`StockMove` sum) minus quarantine bucket stored per tenant/warehouse/sku in `TenantConfig.wms.quarantine`.
- Quality holds adjust the quarantine bucket; release restores availability; reject creates an `adjustment_out` stock move.
- Disabled items/warehouses reuse `TenantConfig.inventory.disabled*` flags.

## Cycle counts
- Cycle count plans stored in Prisma `CycleCountPlan/Line` (frequency set to `ad_hoc`, status `draft` → `counting` → `posted`).
- Start captures expected qty from on-hand (less quarantine); post writes variance movements and is idempotent (second post 409).

## Shipments
- Shipments use Prisma `Shipment`/`ShipmentLine` with statuses `pending` → `picked` → `shipped` (cancel before ship).
- Shipping writes `issue` stock moves and blocks over-available or disabled item/warehouse.

## QA
- Seed: `scripts/qa/seed_wms_extensions.ts` (creates tenant/warehouse/items, stock-in, hold+release, cycle count with variance, shipment pick+ship, overship blocked).
- Unseed: `scripts/qa/unseed_wms_extensions.ts` (removes runId-tagged WMS data/stock moves/config).
- Verifier: `scripts/verification/verify_phase3_wms_extensions.mjs` (DB-backed: quarantine reduces/restores availability, cycle count post idempotent, shipment ship idempotent, disabled blocks actions).
