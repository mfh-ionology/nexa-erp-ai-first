# 5. Cross-Module Relationship Map

## Key Inter-Module Foreign Key Relationships

| Source Model | Source Module | Target Model | Target Module | FK Field | Relationship |
|-------------|-------------|-------------|--------------|----------|-------------|
| CustomerInvoice | AR | Customer | AR | customerId | Invoice belongs to customer |
| CustomerInvoiceLine | AR | InventoryItem | Inventory | (via itemId) | Invoice line references item |
| CustomerPayment | AR | Customer | AR | customerId | Payment from customer |
| PaymentAllocation | AR | CustomerInvoice + CustomerPayment | AR | invoiceId, paymentId | Links payments to invoices |
| SalesQuote / SalesOrder | Sales | Customer | AR | customerId | Quotes/orders for customer |
| Dispatch | Sales | SalesOrder | Sales | salesOrderId | Shipment fulfills order |
| DispatchLine | Sales | SalesOrderLine | Sales | salesOrderLineId | Line-level fulfillment |
| PurchaseOrder | Purchasing | Supplier | Purchasing | supplierId | PO placed with supplier |
| GoodsReceipt | Purchasing | PurchaseOrder + Supplier | Purchasing | purchaseOrderId, supplierId | Receipt against PO |
| GoodsReceiptLine | Purchasing | PurchaseOrderLine | Purchasing | purchaseOrderLineId | Line-level receipt |
| SupplierBill | Purchasing | Supplier + PurchaseOrder | Purchasing | supplierId, purchaseOrderId | Bill from supplier against PO |
| SupplierBillLine | Purchasing | PurchaseOrderLine | Purchasing | purchaseOrderLineId | 3-way matching |
| SupplierPayment | Purchasing | Supplier + BacsRun | Purchasing | supplierId, bacsRunId | Payment to supplier |
| JournalLine | Finance | ChartOfAccount | Finance | accountCode | Posting to GL account |
| JournalEntry | Finance | FinancialPeriod | Finance | periodId | Entry in financial period |
| BankTransaction | Finance | BankAccount | Finance | bankAccountId | Transaction on bank account |
| BankAccount | Finance | ChartOfAccount | Finance | glAccountCode | Bank mapped to GL |
| BudgetLine | Finance | ChartOfAccount + FinancialPeriod | Finance | accountCode, periodId | Budget per account per period |
| StockMovement | Inventory | InventoryItem + Warehouse | Inventory | itemId, warehouseId | Stock movement at item/warehouse |
| StockBalance | Inventory | InventoryItem + Warehouse | Inventory | itemId, warehouseId | Current stock position |
| FixedAsset | Fixed Assets | AssetClass + AssetGroup + DepreciationMethod | Fixed Assets | assetClassId, assetGroupId, depreciationMethodId | Asset classification |
| CrmOpportunity | CRM | CrmLead + CrmCampaign | CRM | leadId, campaignId | Opportunity from lead/campaign |
| CrmCampaignRecipient | CRM | CrmCampaign + CrmLead | CRM | campaignId, leadId | Campaign targeting |
| EmploymentContract | HR | Employee | HR | employeeId | Contract for employee |
| PayrollLine | HR | PayrollRun + Employee | HR | payrollRunId, employeeId | Pay calculation per employee |
| PayrollRun | HR | TaxYearConfig | HR | taxYearConfigId | Run uses tax year config |
| HMRCSubmission | HR | PayrollRun | HR | payrollRunId | HMRC filing from payroll |
| ProductionOrder | Production | Recipe + Routing + Machine | Production | recipeId, routingId, machineId | Order uses BOM + routing |
| Production | Production | ProductionOrder + Recipe + Routing | Production | productionOrderId, recipeId, routingId | Execution of order |
| ProjectTask | Projects | Project | Projects | projectId | Task within project |
| ProjectTransaction | Projects | Project + ProjectTask | Projects | projectId, taskId | Cost against project/task |
| TimesheetEntry | Projects | Timesheet + ProjectTask | Projects | timesheetId, taskId | Time logged against task |
| POSSale | POS | POSSession + POSTerminal | POS | sessionId, terminalId | Sale in session on terminal |
| POSPayment | POS | POSSale + POSPaymentMethod | POS | saleId, paymentMethodId | Payment tendered for sale |
| Agreement | Contracts | AgreementType | Contracts | agreementTypeId | Agreement template |
| LoanAgreement | Contracts | LoanAgreementType | Contracts | loanAgreementTypeId | Loan template |
| ForkliftTask | Warehouse | BinPosition (x2) + Forklift | Warehouse | fromPositionId, toPositionId, forkliftId | Movement between bins |
| ConsolidationMember | Intercompany | ConsolidationGroup | Intercompany | groupId | Company in consolidation |
| ChatMessage | Communications | ChatChannel | Communications | channelId | Message in channel |
| EmailRecipient | Communications | EmailMessage | Communications | emailMessageId | Recipient of email |
| ServiceOrderLine | Service | ServiceOrder | Service | serviceOrderId | Line on service order |
| WorkSheet | Service | ServiceOrder + WorkOrder | Service | serviceOrderId, workOrderId | Worksheet for service |
| UserAccessGroup | System (RBAC) | User + AccessGroup + CompanyProfile | System | userId, accessGroupId, companyId | User assigned to access group per company |
| AccessGroupPermission | System (RBAC) | AccessGroup + Resource | System | accessGroupId, resourceCode | Permission matrix entry per resource per group |
| AccessGroupFieldOverride | System (RBAC) | AccessGroup + Resource | System | accessGroupId, resourceCode | Field-level visibility override per group per resource |
| AccessGroup | System (RBAC) | CompanyProfile | System | companyId | Access group scoped to company |
| Resource | System (RBAC) | Resource (self) | System | parentCode | Parent resource (detail → list hierarchy) |

## RBAC Permission Chain

The granular RBAC system introduces a multi-hop relationship chain for permission resolution:

```
User → UserAccessGroup → AccessGroup → AccessGroupPermission → Resource
                                     → AccessGroupFieldOverride → Resource
```

- A **User** is assigned to one or more **AccessGroup**s per company via **UserAccessGroup**
- Each **AccessGroup** has a permission matrix: one **AccessGroupPermission** row per **Resource**, with action flags (`canAccess`, `canNew`, `canView`, `canEdit`, `canDelete`)
- Each **AccessGroup** can optionally have **AccessGroupFieldOverride** entries (sparse) controlling field visibility (`VISIBLE`, `READ_ONLY`, `HIDDEN`) per **Resource**
- Conflict resolution across multiple groups: **most permissive wins** (OR logic for action flags; VISIBLE > READ_ONLY > HIDDEN for field visibility)
- `SUPER_ADMIN` role on **UserCompanyRole** bypasses the permission matrix entirely

**Note:** The `enabledModules` JSON field on **User** is deprecated and will be removed. Module access is now derived from access group permissions (if any resource in a module has `canAccess: true`, the module is accessible).

---
