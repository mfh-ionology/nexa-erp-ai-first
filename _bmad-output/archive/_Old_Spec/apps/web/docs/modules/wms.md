# Warehouse Management (WMS)

- What it does: Inbound (ASN), wave creation, pick tasks, and inventory snapshots.
- Key endpoints: `/api/wms/asn` (GET/POST), `/api/wms/waves` (GET/POST).
- Roles & permissions: superadmin/admin write; users read-only.
- Data model: `Warehouse`, `Location`, `InventoryItem`, `Asn`, `Wave`, `PickTask`.
- Jobs: `wms:replenish`, `wms:wave:dispatch`, `asn:auto-close` (demo).
- Common tasks: create ASN, create wave, view picks.
- Troubleshooting: relation fields require valid IDs; watch for 400 on invalid input.
