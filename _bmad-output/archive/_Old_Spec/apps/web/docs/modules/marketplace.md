# Marketplace / EDI

- What it does: Connects to external channels, imports orders, and tracks shipments.
- Key endpoints: `/api/marketplace/orders` (GET/POST). Status routes under `/api/integrations/*/status` for mocks.
- Roles & permissions: superadmin/admin write; users read-only.
- Data model: `Channel`, `Listing`, `OrderExternal`, `ShipmentExternal`, `EdiMessage`.
- Jobs: `channel:sync:*` creates/imports demo orders.
- Common tasks: create channel, import a test order, reconcile shipments.
- Troubleshooting: ensure `channelId` exists; `extId` must be unique.
