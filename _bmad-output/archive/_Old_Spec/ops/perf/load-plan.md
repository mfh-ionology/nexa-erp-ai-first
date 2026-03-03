Last updated: 2025-11-14

Purpose
- Performance/load test plan for Nexa ERP after demo seeding.

Who should read this
- Engineers running perf tests and capacity planning.

Targeted areas
- AR/AP invoice list and posting
- Inventory valuation and stock movements
- Manufacturing WIP close
- POS session close and reconciliation

Method
- Seed 36 months of data (apps/web/scripts/seed/index.ts)
- Run k6 or artillery scripts (ops/load/) against API endpoints
- Capture P50/P95 latencies; identify slow queries

Optimisation
- Add indexes for frequent filters (schema change via Task 2 only)
- Convert long-running reports to streaming endpoints
- Use background jobs for heavy reconciliations (jobs package)


