# Capability Gap Report (Phase 0)
- Generated: 2026-01-12T11:34:03.428Z
- Required capabilities: 459
- PASS: 236
- FAIL: 223 (missing 214, placeholder 3, disabled 6, manual 0)
- As-built source: docs/verification/as-built.capabilities.json
- CRM vs Sales mapping (ui/api): 19/17

## Module/Submodule Status

### AI
| Submodule | Status | Missing/Failing Capability IDs | Notes |
| --- | --- | --- | --- |
| automation | PARTIAL | ai.automation.api.list, ai.automation.api.get, ai.automation.api.create, ai.automation.api.update, ai.automation.api.delete, ai.automation.api.lifecycle | Fail counts: {"MISSING":6,"PASS":3} |
| service | PARTIAL | ai.service.api.delete | Fail counts: {"PASS":8,"MISSING":1} |

### Chat
| Submodule | Status | Missing/Failing Capability IDs | Notes |
| --- | --- | --- | --- |
| calls | PARTIAL | chat.calls.api.create, chat.calls.api.update, chat.calls.api.delete, chat.calls.api.lifecycle, chat.calls.ui.page | Fail counts: {"PASS":4,"MISSING":4,"PLACEHOLDER":1} |
| workspace | PARTIAL | chat.workspace.api.create, chat.workspace.api.update, chat.workspace.api.delete, chat.workspace.api.lifecycle, chat.workspace.ui.page, chat.workspace.rbac.permission | Fail counts: {"PASS":3,"MISSING":6} |

### CRM
| Submodule | Status | Missing/Failing Capability IDs | Notes |
| --- | --- | --- | --- |
| accounts | PARTIAL | crm.accounts.api.update, crm.accounts.api.delete | Fail counts: {"PASS":7,"MISSING":2} |
| activities | PARTIAL | crm.activities.api.update, crm.activities.api.delete | Fail counts: {"PASS":7,"MISSING":2} |
| contacts | PARTIAL | crm.contacts.api.update, crm.contacts.api.delete | Fail counts: {"PASS":7,"MISSING":2} |
| leads | PARTIAL | crm.leads.api.update, crm.leads.api.delete, crm.leads.data.model | Fail counts: {"PASS":6,"MISSING":3} |
| opportunities | PARTIAL | crm.opportunities.api.update, crm.opportunities.api.delete, crm.opportunities.data.model | Fail counts: {"PASS":6,"MISSING":3} |
| orders | PARTIAL | crm.orders.api.update, crm.orders.api.delete | Fail counts: {"PASS":7,"MISSING":2} |
| price books | PARTIAL | crm.price-books.api.update, crm.price-books.api.delete, crm.price-books.data.model | Fail counts: {"PASS":6,"MISSING":3} |
| quotes | PARTIAL | crm.quotes.api.update, crm.quotes.api.delete, crm.quotes.data.model | Fail counts: {"PASS":6,"MISSING":3} |

### Finance
| Submodule | Status | Missing/Failing Capability IDs | Notes |
| --- | --- | --- | --- |
| accounts payable | PARTIAL | finance.accounts-payable.api.delete | Fail counts: {"PASS":8,"MISSING":1} |
| accounts receivable | PARTIAL | finance.accounts-receivable.api.delete | Fail counts: {"PASS":8,"MISSING":1} |
| bank & cash | PARTIAL | finance.bank-cash.api.list, finance.bank-cash.api.get, finance.bank-cash.api.create, finance.bank-cash.api.update, finance.bank-cash.api.delete, finance.bank-cash.api.lifecycle | Fail counts: {"MISSING":6,"PASS":3} |
| bills | PARTIAL | finance.bills.api.delete | Fail counts: {"PASS":8,"MISSING":1} |
| fixed assets | PARTIAL | finance.fixed-assets.api.delete | Fail counts: {"PASS":8,"MISSING":1} |
| fx revaluation | PARTIAL | finance.fx-revaluation.api.list, finance.fx-revaluation.api.get, finance.fx-revaluation.api.update, finance.fx-revaluation.api.delete | Fail counts: {"MISSING":4,"PASS":5} |
| general ledger | PARTIAL | finance.general-ledger.api.update, finance.general-ledger.api.delete | Fail counts: {"PASS":7,"MISSING":2} |
| invoices | PARTIAL | finance.invoices.api.delete | Fail counts: {"PASS":8,"MISSING":1} |
| payments | PARTIAL | finance.payments.api.update, finance.payments.api.delete | Fail counts: {"PASS":7,"MISSING":2} |
| period close | PARTIAL | finance.period-close.api.update, finance.period-close.api.delete | Fail counts: {"PASS":7,"MISSING":2} |
| purchase orders | PARTIAL | finance.purchase-orders.api.list, finance.purchase-orders.api.get, finance.purchase-orders.api.update, finance.purchase-orders.api.delete | Fail counts: {"MISSING":4,"PASS":5} |
| vat (mtd) | PARTIAL | finance.vat-mtd.api.update, finance.vat-mtd.api.delete | Fail counts: {"PASS":7,"MISSING":2} |

### HR & payroll
| Submodule | Status | Missing/Failing Capability IDs | Notes |
| --- | --- | --- | --- |
| employees | PARTIAL | hr-payroll.employees.api.list, hr-payroll.employees.api.get, hr-payroll.employees.api.create, hr-payroll.employees.api.update, hr-payroll.employees.api.delete, hr-payroll.employees.api.lifecycle, hr-payroll.employees.ui.page, hr-payroll.employees.rbac.permission | Fail counts: {"MISSING":7,"DISABLED-BY-CONFIG":1,"PASS":1} |
| leave | MISSING | hr-payroll.leave.api.list, hr-payroll.leave.api.get, hr-payroll.leave.api.create, hr-payroll.leave.api.update, hr-payroll.leave.api.delete, hr-payroll.leave.api.lifecycle, hr-payroll.leave.ui.page, hr-payroll.leave.rbac.permission, hr-payroll.leave.data.model | Fail counts: {"MISSING":8,"DISABLED-BY-CONFIG":1} |
| payroll | PARTIAL | hr-payroll.payroll.api.list, hr-payroll.payroll.api.get, hr-payroll.payroll.api.create, hr-payroll.payroll.api.update, hr-payroll.payroll.api.delete, hr-payroll.payroll.api.lifecycle, hr-payroll.payroll.ui.page, hr-payroll.payroll.rbac.permission | Fail counts: {"MISSING":7,"DISABLED-BY-CONFIG":1,"PASS":1} |

### Inventory & wms
| Submodule | Status | Missing/Failing Capability IDs | Notes |
| --- | --- | --- | --- |
| adjustments | PARTIAL | inventory-wms.adjustments.api.list, inventory-wms.adjustments.api.get, inventory-wms.adjustments.api.create, inventory-wms.adjustments.api.update, inventory-wms.adjustments.api.delete, inventory-wms.adjustments.api.lifecycle, inventory-wms.adjustments.ui.page | Fail counts: {"MISSING":7,"PASS":2} |
| cycle count | PARTIAL | inventory-wms.cycle-count.api.list, inventory-wms.cycle-count.api.get, inventory-wms.cycle-count.api.create, inventory-wms.cycle-count.api.update, inventory-wms.cycle-count.api.delete, inventory-wms.cycle-count.api.lifecycle, inventory-wms.cycle-count.ui.page | Fail counts: {"MISSING":7,"PASS":2} |
| items | PARTIAL | inventory-wms.items.api.list, inventory-wms.items.api.get, inventory-wms.items.api.create, inventory-wms.items.api.update, inventory-wms.items.api.delete, inventory-wms.items.api.lifecycle, inventory-wms.items.ui.page | Fail counts: {"MISSING":7,"PASS":2} |
| quality | PARTIAL | inventory-wms.quality.api.list, inventory-wms.quality.api.get, inventory-wms.quality.api.create, inventory-wms.quality.api.update, inventory-wms.quality.api.delete, inventory-wms.quality.api.lifecycle, inventory-wms.quality.ui.page | Fail counts: {"MISSING":7,"PASS":2} |
| shipments | PARTIAL | inventory-wms.shipments.api.list, inventory-wms.shipments.api.get, inventory-wms.shipments.api.create, inventory-wms.shipments.api.update, inventory-wms.shipments.api.delete, inventory-wms.shipments.api.lifecycle, inventory-wms.shipments.ui.page | Fail counts: {"MISSING":7,"PASS":2} |
| transfers | PARTIAL | inventory-wms.transfers.api.list, inventory-wms.transfers.api.get, inventory-wms.transfers.api.create, inventory-wms.transfers.api.update, inventory-wms.transfers.api.delete, inventory-wms.transfers.api.lifecycle, inventory-wms.transfers.ui.page | Fail counts: {"MISSING":7,"PASS":2} |
| warehouses | PARTIAL | inventory-wms.warehouses.api.list, inventory-wms.warehouses.api.get, inventory-wms.warehouses.api.create, inventory-wms.warehouses.api.update, inventory-wms.warehouses.api.delete, inventory-wms.warehouses.api.lifecycle, inventory-wms.warehouses.ui.page | Fail counts: {"MISSING":7,"PASS":2} |

### Manufacturing
| Submodule | Status | Missing/Failing Capability IDs | Notes |
| --- | --- | --- | --- |
| BOMs | PARTIAL | manufacturing.boms.api.update, manufacturing.boms.api.delete | Fail counts: {"PASS":7,"MISSING":1,"DISABLED-BY-CONFIG":1} |
| schedules | PARTIAL | manufacturing.schedules.api.list, manufacturing.schedules.api.get, manufacturing.schedules.api.create, manufacturing.schedules.api.update, manufacturing.schedules.api.delete, manufacturing.schedules.api.lifecycle | Fail counts: {"MISSING":6,"PASS":3} |
| work orders | PARTIAL | manufacturing.work-orders.api.list, manufacturing.work-orders.api.get, manufacturing.work-orders.api.update, manufacturing.work-orders.api.delete | Fail counts: {"DISABLED-BY-CONFIG":2,"PASS":5,"MISSING":2} |

### POS
| Submodule | Status | Missing/Failing Capability IDs | Notes |
| --- | --- | --- | --- |
| receipts | PARTIAL | pos.receipts.api.update, pos.receipts.api.delete | Fail counts: {"PASS":7,"MISSING":2} |
| register | PARTIAL | pos.register.api.update, pos.register.api.delete, pos.register.ui.page | Fail counts: {"PASS":6,"MISSING":2,"PLACEHOLDER":1} |

### Projects
| Submodule | Status | Missing/Failing Capability IDs | Notes |
| --- | --- | --- | --- |
| boards | PARTIAL | projects.boards.api.list, projects.boards.api.get, projects.boards.api.create, projects.boards.api.update, projects.boards.api.delete, projects.boards.api.lifecycle, projects.boards.data.model | Fail counts: {"MISSING":7,"PASS":2} |
| tasks | PARTIAL | projects.tasks.api.list, projects.tasks.api.get, projects.tasks.api.create, projects.tasks.api.update, projects.tasks.api.delete, projects.tasks.api.lifecycle | Fail counts: {"MISSING":6,"PASS":3} |
| timesheets | PARTIAL | projects.timesheets.api.update, projects.timesheets.api.delete, projects.timesheets.data.model | Fail counts: {"PASS":6,"MISSING":3} |

### Purchasing
| Submodule | Status | Missing/Failing Capability IDs | Notes |
| --- | --- | --- | --- |
| contracts | PARTIAL | purchasing.contracts.api.update, purchasing.contracts.api.delete, purchasing.contracts.data.model | Fail counts: {"PASS":6,"MISSING":3} |
| pick / pack / ship | PARTIAL | purchasing.pick-pack-ship.api.list, purchasing.pick-pack-ship.api.get, purchasing.pick-pack-ship.api.create, purchasing.pick-pack-ship.api.update, purchasing.pick-pack-ship.api.delete, purchasing.pick-pack-ship.api.lifecycle, purchasing.pick-pack-ship.ui.page | Fail counts: {"MISSING":7,"PASS":2} |
| purchase orders | PARTIAL | purchasing.purchase-orders.api.list, purchasing.purchase-orders.api.get, purchasing.purchase-orders.api.update, purchasing.purchase-orders.api.delete | Fail counts: {"MISSING":4,"PASS":5} |
| replenishment | PARTIAL | purchasing.replenishment.api.list, purchasing.replenishment.api.get, purchasing.replenishment.api.create, purchasing.replenishment.api.update, purchasing.replenishment.api.delete, purchasing.replenishment.api.lifecycle, purchasing.replenishment.ui.page, purchasing.replenishment.data.model | Fail counts: {"MISSING":8,"PASS":1} |
| RFQs | PARTIAL | purchasing.rfqs.api.update, purchasing.rfqs.api.delete, purchasing.rfqs.ui.page, purchasing.rfqs.data.model | Fail counts: {"PASS":5,"MISSING":3,"PLACEHOLDER":1} |
| RMA | PARTIAL | purchasing.rma.api.list, purchasing.rma.api.get, purchasing.rma.api.create, purchasing.rma.api.update, purchasing.rma.api.delete, purchasing.rma.api.lifecycle, purchasing.rma.ui.page | Fail counts: {"MISSING":7,"PASS":2} |
| scorecards | PARTIAL | purchasing.scorecards.api.list, purchasing.scorecards.api.get, purchasing.scorecards.api.create, purchasing.scorecards.api.update, purchasing.scorecards.api.delete, purchasing.scorecards.api.lifecycle, purchasing.scorecards.ui.page, purchasing.scorecards.data.model | Fail counts: {"MISSING":8,"PASS":1} |
| suppliers | PARTIAL | purchasing.suppliers.api.update, purchasing.suppliers.api.delete | Fail counts: {"PASS":7,"MISSING":2} |
| supply dashboard | PARTIAL | purchasing.supply-dashboard.api.list, purchasing.supply-dashboard.api.get, purchasing.supply-dashboard.api.create, purchasing.supply-dashboard.api.update, purchasing.supply-dashboard.api.delete, purchasing.supply-dashboard.api.lifecycle, purchasing.supply-dashboard.ui.page, purchasing.supply-dashboard.data.model | Fail counts: {"MISSING":8,"PASS":1} |

## Top 20 Failing Capabilities
- finance.general-ledger.api.update → MISSING (No matching implementation found) [No pointers]
- finance.general-ledger.api.delete → MISSING (No matching implementation found) [No pointers]
- finance.accounts-payable.api.delete → MISSING (No matching implementation found) [No pointers]
- finance.accounts-receivable.api.delete → MISSING (No matching implementation found) [No pointers]
- finance.bank-cash.api.list → MISSING (No matching implementation found) [No pointers]
- finance.bank-cash.api.get → MISSING (No matching implementation found) [No pointers]
- finance.bank-cash.api.create → MISSING (No matching implementation found) [No pointers]
- finance.bank-cash.api.update → MISSING (No matching implementation found) [No pointers]
- finance.bank-cash.api.delete → MISSING (No matching implementation found) [No pointers]
- finance.bank-cash.api.lifecycle → MISSING (No matching implementation found) [No pointers]
- finance.vat-mtd.api.update → MISSING (No matching implementation found) [No pointers]
- finance.vat-mtd.api.delete → MISSING (No matching implementation found) [No pointers]
- finance.fixed-assets.api.delete → MISSING (No matching implementation found) [No pointers]
- finance.period-close.api.update → MISSING (No matching implementation found) [No pointers]
- finance.period-close.api.delete → MISSING (No matching implementation found) [No pointers]
- finance.fx-revaluation.api.list → MISSING (No matching implementation found) [No pointers]
- finance.fx-revaluation.api.get → MISSING (No matching implementation found) [No pointers]
- finance.fx-revaluation.api.update → MISSING (No matching implementation found) [No pointers]
- finance.fx-revaluation.api.delete → MISSING (No matching implementation found) [No pointers]
- finance.invoices.api.delete → MISSING (No matching implementation found) [No pointers]