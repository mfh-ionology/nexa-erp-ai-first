# Phase 1 Plan (≤12 files)

Create/modify the following in a single batch to keep within the 12-file limit:

1. `packages/core/src/finance/journalService.js` — Double-entry posting, period controls, intercompany eliminations, adjustment mode.
2. `packages/core/src/finance/journalService.test.js` — Tests: balanced/unbalanced, period close/reopen, intercompany.
3. `packages/core/src/finance/bankImport.js` — CSV parser + auto-match rules + success rate.
4. `packages/core/src/finance/bankImport.test.js` — Tests: ≥80% match on sample file.
5. `packages/core/src/payroll/payrollEngine.js` — PAYE/NI (sample codes), statutory pay stubs, AE assessment, payroll journal.
6. `packages/core/src/payroll/payrollEngine.test.js` — Tests: PAYE/NI for K/BR/W1/M1/Scottish, SMP/SSP examples, AE assessment, journal balances.
7. `scripts/gate-phase1.cjs` — Runs Phase 1 domain gate checks with PASS/FAIL logs.
8. `FINANCE.md` — Finance scope, data model overview, posting rules.
9. `PAYROLL.md` — Payroll scope, calculation rules, AE assessment.
10. Modify `package.json` — Add `gate:phase1`, extend Vitest coverage excludes for scripts.
11. Modify `ARCHITECTURE.md` — Note Phase 1 domain services and future API/UI integration.
12. Update `AI-GOVERNANCE.md` — Reference AI hooks in Finance & Payroll flows (draft only submissions, confirmation).
