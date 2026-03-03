# Purchase Orders

- What it does: Supplier master and purchase order lifecycle (draft -> approved -> received).
- Key endpoints: `/api/po/suppliers` (GET/POST), `/api/po/orders` (GET/POST).
- Roles & permissions: superadmin/admin write; users read-only.
- Data model: `Supplier`, `PurchaseOrder`, `PoLine`.
- Jobs: `po:remind-suppliers` demo reminders.
- Common tasks: create supplier, create PO with lines, receive.
- Troubleshooting: ensure `supplierId` exists; lines require positive `qty` and `price`.
