# Phase 3 – Purchasing Core (suppliers, POs, RFQs)

- BASE_REF: `980fe90`
- HEAD: `8b6308a`
- Slice: `purchasing_core`
- Evidence: `reports/verification/phase3-purchasing_core-20260115-202219`

## Permissions / Module gate
- Read: `ui:finance_reports:view`
- Manage: `inventory:manage`
- Module gate: `inventory` (purchasing piggybacks v1)

## APIs
- Suppliers: `GET/POST /api/purchasing/suppliers`, `GET/PATCH /api/purchasing/suppliers/[supplierId]`, `POST /api/purchasing/suppliers/[supplierId]/disable`, `POST /api/purchasing/suppliers/[supplierId]/enable`
- Purchase Orders: `GET/POST /api/purchasing/purchase-orders`, `GET/PATCH /api/purchasing/purchase-orders/[poId]`, `POST /api/purchasing/purchase-orders/[poId]/issue`, `POST /api/purchasing/purchase-orders/[poId]/close`, `POST /api/purchasing/purchase-orders/[poId]/cancel`
- RFQs: `GET/POST /api/purchasing/rfqs`, `GET/PATCH /api/purchasing/rfqs/[rfqId]`, `POST /api/purchasing/rfqs/[rfqId]/send`, `POST /api/purchasing/rfqs/[rfqId]/close`, `POST /api/purchasing/rfqs/[rfqId]/cancel`, `POST /api/purchasing/rfqs/[rfqId]/convert-to-po`

## UI routes
- `/purchasing` (landing)
- `/purchasing/suppliers` (list + create/disable/enable)
- `/purchasing/purchase-orders` (list + create)
- `/purchasing/purchase-orders/[poId]` (detail, edit draft, issue/close/cancel)
- `/purchasing/rfqs` (list + create)
- `/purchasing/rfqs/[rfqId]` (detail, edit draft, send/close/cancel, convert to PO)

## Lifecycle rules
- Supplier codes unique per tenant; disabled suppliers stored in `TenantConfig.purchasing.disabledSuppliers`; disabled suppliers block RFQ/PO creation.
- Purchase Orders: statuses use `draft -> sent (issue) -> closed`; issue idempotent (second issue 409); cancel allowed from draft/sent; close only after issued; totals derived from sum(qty*price).
- RFQs: statuses `draft -> sent -> closed/cancelled`; send idempotent; optional convert-to-PO creates draft PO lines.

## Disable storage
- Supplier disable flags stored in `TenantConfig.purchasing.disabledSuppliers` (Supplier model lacks status flag); enforced in services and verifier.

## QA
- Seed: `scripts/qa/seed_purchasing_core.ts` (create tenant/supplier, RFQ draft→sent→convert-to-PO, issue PO idempotency, disable supplier)
- Unseed: `scripts/qa/unseed_purchasing_core.ts` (removes tenant, suppliers, POs, config for runId tenant)
- Verifier: `scripts/verification/verify_phase3_purchasing_core.mjs` (DB-backed: RFQ send idempotent, PO issue idempotent, convert-to-PO, disabled supplier blocks new PO, unseed cleanup)
