# Enterprise (Intercompany, Consolidation, Treasury)

- What it does: Intercompany journals, consolidation mappings, treasury movements, and KPIs.
- Key endpoints: `/api/enterprise/intercompany` (GET/POST).
- Roles & permissions: superadmin/admin to post; users read-only.
- Data model: `IntercompanyTxn`, `ConsolidationMap`, `TreasuryMovement`, `KpiSnapshot`, `Ledger`.
- Jobs: `consolidation:rollup`, `treasury:reconcile` add demo entries.
- Common tasks: post intercompany, update consolidation map, review KPIs.
- Troubleshooting: ensure entity IDs are valid and referenceable.
