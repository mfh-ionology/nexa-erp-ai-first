# Nexa ERP — Module Requirements

One file per module. Each file follows the same structure:

| Section | What goes here |
|---------|---------------|
| **Pages** | Main screens/windows the user interacts with |
| **Settings** | Configuration screens, LOVs, system parameters |
| **Reports** | All reports (use T8 report template) |
| **Maintenances** | Batch jobs / background processes |
| **Exports & Imports** | Data import/export capabilities |
| **Forms** | Printable documents (invoices, receipts, etc.) |
| **Features** | Grouped by page — drives field lists and behaviour |

## Cross-Cutting Frameworks

Before any module, these shared frameworks must be defined:

- [Cross-Cutting Requirements](cross-cutting.md) — Report runner, batch job runner, form creator, copilot enhancements, job monitor

## Modules

- [Finance (FIN)](finance.md)
- [Fixed Assets (FA)](fixed-assets.md)
- [Inventory & Stock (INV)](inventory.md)
- [Sales (SAL)](sales.md)
- [Purchasing (PUR)](purchasing.md)
- [POS](pos.md)
- [CRM](crm.md)
- [Warehouse (WH)](warehouse.md)
- [Production (PRD)](production.md)
- [Projects & Job Costing (PRJ)](projects.md)
- [HR (HR)](hr.md)
