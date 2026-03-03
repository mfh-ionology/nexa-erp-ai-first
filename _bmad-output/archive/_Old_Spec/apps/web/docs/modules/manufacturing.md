# Manufacturing (APS, Capacity, MRP)

- What it does: Plans and executes production via work orders, BOM, routing, MRP, and capacity calendars.
- Key endpoints: `/api/mfg/workorders` (GET/POST).
- Roles & permissions: superadmin/admin can create; users read-only.
- Data model: `WorkOrder`, `BomItem`, `RoutingStep`, `MrpPlan`, `CapacityCalendar`.
- Jobs: `mrp:plan`, `capacity:recalc` compute demo suggestions.
- Common tasks: create work order, review MRP, export exceptions.
- Troubleshooting: ensure request payload matches schema; check 400 errors from Zod.
