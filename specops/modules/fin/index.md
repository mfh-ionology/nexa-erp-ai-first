# Finance Module (FIN)

General Ledger, budgeting, bank reconciliation, VAT, inter-company, and consolidation.

**Status:** Tier 2 — partially built (E14 Wave 1)
**Full requirements:** `docs/module-requirements/finance.md`
**HansaWorld prefixes:** `Acc` (Accounts), `TR` (Transactions/NL), `BA` (Bank), `CY` (Company/Year Settings)
**HansaWorld manual:** https://hansaworldmanuals.com → Nominal Ledger

---

## Workflows (Key Business Processes)

| Workflow            | Description                                                                                                   | Pages Involved                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Journal Posting     | Create journal → validate (debits = credits) → post to GL → update account balances                           | Journal Entries, Chart of Accounts           |
| Bank Reconciliation | Import bank statement → auto-match → manual match → post adjustments → mark reconciled                        | Bank Accounts, Bank Reconciliation           |
| Budget Cycle        | Create budget version → enter by account/period → approve → compare vs actual                                 | Budgets, Budget Reports                      |
| Period End          | Close period → run revaluations → generate accruals → lock period                                             | Financial Years, Journals                    |
| Year End            | Close all P&L to retained earnings → carry forward BS → lock year                                             | Financial Years, Journals, Chart of Accounts |
| IC Transaction      | Create IC journal in Company A → auto-generate counterpart in Company B → reconcile                           | Inter-Company Transactions                   |
| Consolidation       | Pull subsidiary data → map accounts → generate eliminations → translate currencies → produce group statements | Consolidation                                |

---

## Settings

| Setting                           | Type   | Spec                       | Status      |
| --------------------------------- | ------ | -------------------------- | ----------- |
| Accounting Periods                | Config | [settings.md](settings.md) | Built (E14) |
| Financial Years                   | Config | [settings.md](settings.md) | Built (E14) |
| Base Currencies (Base 1 & Base 2) | Config | [settings.md](settings.md) | Not started |
| Currencies                        | LOV    | [settings.md](settings.md) | Not started |
| Currency Exchange Rates           | Config | [settings.md](settings.md) | Not started |
| Number Series                     | Config | [settings.md](settings.md) | Built (E14) |
| VAT Codes                         | LOV    | [settings.md](settings.md) | Not started |
| Rate Gain/Loss                    | Config | [settings.md](settings.md) | Not started |
| Sub Systems                       | Config | [settings.md](settings.md) | Not started |
| Sub-Ledger Control Accounts       | Config | [settings.md](settings.md) | Not started |
| Budget Versions                   | LOV    | [settings.md](settings.md) | Not started |
| Budget Keys                       | Config | [settings.md](settings.md) | Not started |
| Inter-Company Settings            | Config | [settings.md](settings.md) | Not started |
| Consolidation Settings            | Config | [settings.md](settings.md) | Not started |

## Pages

| Page                       | Type        | Spec                                                         | Tasks | Status      |
| -------------------------- | ----------- | ------------------------------------------------------------ | ----- | ----------- |
| Chart of Accounts          | List + Form | [pages/chart-of-accounts.md](pages/chart-of-accounts.md)     | —     | Built (E14) |
| Journal Entries            | List + Form | [pages/journal-entries.md](pages/journal-entries.md)         | —     | Built (E14) |
| Bank Accounts              | List + Form | [pages/bank-accounts.md](pages/bank-accounts.md)             | —     | Built (E14) |
| Bank Reconciliation        | Custom      | [pages/bank-reconciliation.md](pages/bank-reconciliation.md) | —     | Built (E14) |
| Budgets                    | List + Grid | [pages/budgets.md](pages/budgets.md)                         | —     | Built (E14) |
| Simulations                | List + Form | [pages/simulations.md](pages/simulations.md)                 | —     | Built (E14) |
| Dimensions                 | List + Form | [pages/dimensions.md](pages/dimensions.md)                   | —     | Built (E14) |
| Financial Years & Periods  | Settings    | (in settings.md)                                             | —     | Built (E14) |
| Inter-Company Transactions | List + Form | [pages/inter-company.md](pages/inter-company.md)             | —     | Not started |
| Consolidation              | Custom      | [pages/consolidation.md](pages/consolidation.md)             | —     | Not started |

## Reports

| Report                     | Spec                                                                         | Status      |
| -------------------------- | ---------------------------------------------------------------------------- | ----------- |
| Profit & Loss              | [reports/profit-and-loss.md](reports/profit-and-loss.md)                     | Built (E14) |
| Balance Sheet              | [reports/balance-sheet.md](reports/balance-sheet.md)                         | Built (E14) |
| Trial Balance              | [reports/trial-balance.md](reports/trial-balance.md)                         | Built (E14) |
| Cash Flow Statement        | [reports/cash-flow.md](reports/cash-flow.md)                                 | Not started |
| Transaction Journal        | [reports/transaction-journal.md](reports/transaction-journal.md)             | Built (E14) |
| Nominal Ledger             | [reports/nominal-ledger.md](reports/nominal-ledger.md)                       | Not started |
| VAT Return                 | [reports/vat-return.md](reports/vat-return.md)                               | Not started |
| VAT Audit Report           | [reports/vat-audit.md](reports/vat-audit.md)                                 | Not started |
| Budget vs Actual           | [reports/budget-vs-actual.md](reports/budget-vs-actual.md)                   | Not started |
| Bank Reconciliation Report | [reports/bank-recon.md](reports/bank-recon.md)                               | Not started |
| Key Financial Ratios       | [reports/key-ratios.md](reports/key-ratios.md)                               | Not started |
| Aged Analysis              | [reports/aged-analysis.md](reports/aged-analysis.md)                         | Not started |
| Dimension Analysis         | [reports/dimension-analysis.md](reports/dimension-analysis.md)               | Not started |
| IC Transactions Report     | [reports/ic-transactions.md](reports/ic-transactions.md)                     | Not started |
| IC Balances Report         | [reports/ic-balances.md](reports/ic-balances.md)                             | Not started |
| IC Reconciliation Report   | [reports/ic-reconciliation.md](reports/ic-reconciliation.md)                 | Not started |
| Consolidated P&L           | [reports/consolidated-pl.md](reports/consolidated-pl.md)                     | Not started |
| Consolidated Balance Sheet | [reports/consolidated-bs.md](reports/consolidated-bs.md)                     | Not started |
| Consolidated Trial Balance | [reports/consolidated-tb.md](reports/consolidated-tb.md)                     | Not started |
| Consolidation Adjustments  | [reports/consolidation-adjustments.md](reports/consolidation-adjustments.md) | Not started |

## Batch Jobs

| Job                          | Status      |
| ---------------------------- | ----------- |
| Year End Close               | Not started |
| Period End Close             | Not started |
| Currency Revaluation         | Not started |
| VAT Return Generation        | Not started |
| Recurring Journal Processing | Not started |
| IC Reconciliation            | Not started |
| Consolidation Run            | Not started |

## Exports & Imports

| Item              | Direction            | Status      |
| ----------------- | -------------------- | ----------- |
| Chart of Accounts | Export + Import      | Not started |
| Journal Entries   | Export + Import      | Not started |
| Opening Balances  | Import               | Not started |
| Bank Statement    | Import (OFX/CSV/QIF) | Not started |
| Budget            | Import (Excel)       | Not started |
| Trial Balance     | Export               | Not started |
| VAT Return        | Export               | Not started |

## Forms (Printable Documents)

| Form                 | Status      |
| -------------------- | ----------- |
| Customer Statement   | Not started |
| Cash Receipt         | Not started |
| Bank Payment Voucher | Not started |
| Journal Voucher      | Not started |
