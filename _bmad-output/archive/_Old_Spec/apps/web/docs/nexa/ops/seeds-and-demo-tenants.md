# Seeds and Demo Tenants — Task K Baseline

Default seed (non-demo)
- Root platform tenant only once, with SUPER_ADMIN user(s).
- 5–10 customer tenants (e.g., Acme Manufacturing, RetailCo, HealthcareCo, SupplyCo, ConsultingCo, ServicesCo).
- Each customer tenant:
  - Plan/billing set (LEGACY or STARTER), billingMethod INVOICE, billingStatus trial, billingDayOfMonth 1, nextBillingDate ~+30d.
  - Exactly one ADMIN user. No STAFF by default.
  - No transactional/demo data (no invoices, orders, inventory, payroll, projects, POS).
- No heavy vertical/demo data is created by default.

Demo seeds (opt-in only)
- Any heavy/demo or vertical data must live in dedicated demo scripts (e.g., `scripts/seed/demo-data.ts`, `scripts/seed/super-admin-minimal-demo.ts`).
- They must be guarded by env (e.g., `ENABLE_DEMO_SEEDS=1` or `SEED_DEMO_DATA=true`) and are NOT invoked by the default seed path or tests.

Invariants
- Preserve Task K rules: SUPER_ADMIN isolation; plan/catalog/caps/billing intact; AI access guard; dashboards and FX/timezone consistency untouched.
- Default seeds should be safe for prod/staging if ever run: minimal customers, no dummy transactions.

How to use
- Default baseline seed: seeds root + 5–10 minimal customers + ADMIN users only.
- To run demo/vertical seeds: explicitly set the demo guard env var and run the specific demo script; expect transactional data only then.
