# Nexa ERP -- Data Models Reference

> Generated: 2026-02-16 | Updated: 2026-02-17 | Source: Architecture sections 2.8--2.31

---

## 1. Overview

| Metric | Count |
|--------|-------|
| **Total Prisma Models (ERP)** | 234 |
| **Total Prisma Models (Platform)** | 10 |
| **Total Prisma Enums (ERP)** | 170 |
| **Total Prisma Enums (Platform)** | 5 |
| **Architecture Sections** | 19 (2.8--2.31) |
| **Module Domains** | 18 ERP + 1 Platform |

**Key Architectural Patterns:**

- **Two databases** -- ERP database (per-tenant) + Platform database (central, cross-tenant). Separate Prisma schemas.
- **Database-per-tenant** -- no `tenant_id` columns in any ERP table. Tenant isolation at connection routing level.
- **UUID primary keys** -- `@id @default(uuid())` on all models (except `Currency` and `Country` which use natural keys).
- **snake_case table names** -- all models use `@@map("snake_case_name")` for PostgreSQL table naming.
- **Fixed-point decimals** -- all monetary fields use `Decimal @db.Decimal(precision, scale)`, never `Float`.
- **Soft delete** -- `isActive Boolean @default(true)` on reference entities (Customer, Supplier, Item, etc.). Transactional entities use status enums (DRAFT/POSTED/CANCELLED/VOID).
- **Audit trails** -- `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, plus `createdBy`/`updatedBy` String fields on transactional entities.
- **Polymorphic linking** -- Attachments, Notes, RecordLinks, and ApprovalRequests use `entityType String` + `entityId String` pattern.
- **Self-referential hierarchies** -- ChartOfAccount, ItemGroup, AssetGroup, ProjectTask, ConsolidationMember, ConferenceRoom use named `@relation` pairs.

---

## 2. Entity Relationship Summary

### All Models by Module

| Module | Section | Models | Key Entities |
|--------|---------|--------|-------------|
| System | 2.8--2.12 | 12 | CompanyProfile, Currency, ExchangeRate, Country, Department, PaymentTerms, VatCode, Tag, BankHoliday, SystemSetting, SavedView, DocumentTemplate (+Version) |
| Finance/GL | 2.13 | 12 | ChartOfAccount, AccountClassification, AccountMapping, FinancialPeriod, JournalEntry, JournalLine, BankAccount, BankTransaction, BankReconciliation, BankReconciliationLine, Budget, BudgetLine |
| Inventory | 2.14 | 7 | ItemGroup, Warehouse, InventoryItem, StockMovement, StockBalance, SerialNumber, UnitOfMeasure |
| Sales Ledger (AR) | 2.15 | 7 | Customer, CustomerAddress, CustomerContact, CustomerInvoice, CustomerInvoiceLine, CustomerPayment, PaymentAllocation |
| Sales Orders | 2.16 | 7 | SalesQuote, SalesQuoteLine, SalesOrder, SalesOrderLine, Dispatch, DispatchLine, ShippingMethod |
| Purchasing (AP) | 2.17 | 10 | Supplier, PurchaseOrder, PurchaseOrderLine, GoodsReceipt, GoodsReceiptLine, SupplierBill, SupplierBillLine, SupplierPayment, SupplierPaymentAllocation, BacsRun |
| Fixed Assets | 2.18 | 8 | DepreciationMethod, AssetGroup, AssetClass, FixedAsset, DepreciationEntry, AssetDisposal, AssetTransfer, AssetTransaction |
| Pricing | 2.19 | 5 | PriceList, PriceListEntry, QuantityBreak, Rebate, RebateTier |
| Cross-Cutting | 2.20 | 7 | Attachment, Note, RecordLink, ApprovalRule, ApprovalRuleLevel, ApprovalRequest, Activity |
| CRM | 2.21 | 16 | CrmLeadStatus, CrmLeadSource, CrmIndustry, CrmMediaType, CrmOpportunityClass, CrmActivityType, CrmActivityTypeGroup, CrmLead, CrmCampaign, CrmCampaignRecipient, CrmOpportunity, CrmOpportunityStageLog, CrmPipelineView, CrmPipelineColumn, CrmActivityAutoRule, CrmModuleSetting |
| HR & Payroll | 2.22 | 36 | Employee, JobTitle, ContractClass, ContractType, ResidencyType, EmploymentContract, ContractChange, BenefitType, ContractBenefit, AppraisalCategory, PerformanceFactor, PerformanceRating, PerformanceAppraisal, AppraisalLine, Skill, SkillRating, SkillsEvaluation, SkillsEvaluationLine, Checkpoint, Checklist, ChecklistItem, JobPosition, PositionIncumbent, TrainingPlan, PaymentType, LeaveEntitlement, LeaveRequest, LeaveBalance, TaxYearConfig, PensionEnrolment, PayrollRun, PayrollLine, StatutoryPayment, HMRCSubmission, PayslipDocument, HrModuleSetting |
| Production/MRP | 2.23 | 23 | Recipe, RecipeLine, Routing, RoutingStep, StandardOperation, StandardOperationMaterial, Machine, MachineGroup, MachineShift, MachineSwitchTime, MachineItemDefault, ProductionClass, AutoProductionRule, ProductionOrder, ProductionOrderLine, Production, ProductionLine, ProductionOperation, ProductionOperationLine, ProductionPlan, ProductionPlanLine, ProductionPlanComponent, ProductionSetting |
| POS | 2.24 | 14 | POSTerminal, CashDrawer, POSSession, POSPaymentMethod, POSSale, POSSaleLine, POSPayment, POSCashMovement, POSCashup, POSCashupLine, POSJournalEntry, POSButtonLayout, POSButton, POSSerialBlock |
| Projects | 2.25 | 11 | Project, ProjectTask, Timesheet, TimesheetEntry, ProjectExpense, ProjectTransaction, ProjectBudget, ProjectBudgetLine, ProjectRateCard, ProjectRateCardEntry, ProjectInvoiceSchedule |
| Contracts & Agreements | 2.26 | 13 | AgreementType, Agreement, AgreementLine, AgreementCharge, OffHire, OffHireLine, ContractClass, Contract, ContractLine, LoanAgreementType, LoanAgreement, LoanAgreementItem, LoanScheduleRow |
| Warehouse Management | 2.27 | 9 | WarehouseGroup, WarehouseZone, WarehouseWmsConfig, BinPosition, PositionStock, PickingList, PickingLine, Forklift, ForkliftTask |
| Intercompany & Consolidation | 2.28 | 11 | IntercompanyRule, IntercompanyTransaction, ConsolidationGroup, ConsolidationMember, OwnershipPercentage, ConsolidationAccountMap, ConsolidationExchangeRate, EliminationTemplate, EliminationEntry, ConsolidationRun, SharedRegisterConfig |
| Communications | 2.29 | 15 | ChatChannel, ChatParticipant, ChatMessage, EmailMessage, EmailRecipient, EmailQueue, EmailTemplate, EmailAlias, EmailSignature, ConferenceRoom, ConferenceAccess, NotificationTemplate, NotificationPreference, Notification, MassMailCampaign |
| Service Orders & Timekeeper | 2.30 | 11 | ServiceOrder, ServiceOrderLine, WorkOrder, WorkOrderLine, WorkSheet, WorkSheetLine, KnownSerialNumber, FaultCode, FaultCodeModifier, TargetTime, TargetTimeLine |
| **Platform Admin** (separate DB) | **2.31** | **10** | **Tenant, Plan, TenantModuleOverride, TenantFeatureFlag, TenantAiUsage, TenantAiQuota, TenantBilling, PlatformUser, PlatformAuditLog, ImpersonationSession** |

---

## 3. Module-by-Module Models

---

### 3.1 System Module (Sections 2.8--2.12)

#### CompanyProfile
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `company_profiles` | |
| **PK** | `id` UUID | |
| name | String | Trading name |
| legalName | String? | Registered name |
| registrationNumber | String? | Companies House number |
| vatNumber | String? | GB VAT registration |
| utrNumber | String? | HMRC Unique Taxpayer Reference |
| baseCurrencyCode | String | Default "GBP", FK to Currency |
| timezone | String | Default "Europe/London" |
| vatScheme | String | STANDARD, FLAT_RATE, CASH |
| **Relations** | -- | Address fields, contact fields, branding fields inline |

#### Currency
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `currencies` | |
| **PK** | `code` String(3) | Natural key, ISO 4217 |
| name | String | e.g. "British Pound Sterling" |
| symbol | String | e.g. "GBP" |
| minorUnit | Int | Decimal places (2 for GBP, 0 for JPY) |
| roundTotal / roundVat / roundLine | Int | Per-currency rounding rules |
| isActive | Boolean | Soft delete |
| **Relations** | exchangeRates | ExchangeRate[] |

#### ExchangeRate
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `exchange_rates` | |
| **PK** | `id` UUID | |
| currencyCode | String(3) | FK to Currency |
| rateDate | Date | Effective date |
| buyRate / sellRate / midRate | Decimal(18,8) | Exchange rates |
| source | String | BOE, ECB, MANUAL |
| **Unique** | [currencyCode, rateDate] | |
| **Relations** | currency | -> Currency |

#### Country
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `countries` | |
| **PK** | `code` String(2) | Natural key, ISO 3166-1 alpha-2 |
| iso3Code | String(3) | ISO 3166-1 alpha-3 |
| name | String | |
| defaultCurrencyCode | String?(3) | FK to Currency |
| region | String? | EU, EEA, Rest of World |
| vatPrefix | String? | VAT number prefix (e.g. "GB") |
| dateFormat | String? | Default date format for country |
| isActive | Boolean | |

#### Department
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `departments` | |
| **PK** | `id` UUID | |
| code | String | Unique, e.g. "FIN", "SALES" |
| name | String | |
| costCentre | String? | GL cost centre code |
| managerId | String? | FK to User |
| isActive | Boolean | |

#### PaymentTerms
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `payment_terms` | |
| **PK** | `id` UUID | |
| code | String | Unique, e.g. "NET30" |
| name | String | |
| dueDays | Int | |
| discountPercent | Decimal?(5,2) | Early payment discount |
| discountDays | Int? | Discount window |
| isDefault | Boolean | |
| isActive | Boolean | |

#### VatCode
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `vat_codes` | |
| **PK** | `id` UUID | |
| code | String | Unique, e.g. "S", "R", "Z" |
| rate | Decimal(5,2) | e.g. 20.00 |
| type | VatType (enum) | |
| salesAccountCode / purchaseAccountCode | String? | GL account codes |
| isDefault | Boolean | |
| isActive | Boolean | |

#### Tag
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tags` | |
| **PK** | `id` UUID | |
| code | String | e.g. "PREMIUM" |
| tagType | String | "customer", "item", "order", "general" |
| color | String | Hex colour |
| **Unique** | [code, tagType] | |

#### BankHoliday
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `bank_holidays` | |
| **PK** | `id` UUID | |
| name | String | |
| date | Date | |
| countryCode | String(2) | |
| holidayType | String | PUBLIC, COMPANY, SPECIAL |
| isRecurring | Boolean | |
| **Unique** | [date, countryCode] | |

#### SystemSetting
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `system_settings` | |
| **PK** | `id` UUID | |
| key | String | Unique, e.g. "invoice.autoApproveBelow" |
| value | String | JSON-serialised |
| valueType | String | STRING, NUMBER, BOOLEAN, JSON |
| category | String | "general", "finance", "ar", etc. |

#### SavedView
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `saved_views` | |
| **PK** | `id` UUID | |
| userId | String | FK to User |
| entityType | String | e.g. "customer_invoices" |
| name | String | |
| isDefault / isFavourite | Boolean | |
| columns / filters / sorting | Json (JSONB) | View configuration |
| scope | ViewScope (enum) | PERSONAL, ROLE, GLOBAL |
| **Unique** | [userId, entityType, name] | |
| **Relations** | user | -> User |

#### DocumentTemplate
| Field | Type | Notes |
|-------|------|-------|
| **Table** | (no explicit @@map) | |
| **PK** | `id` cuid | |
| documentType | DocumentType (enum) | |
| htmlTemplate | Text | HTML with Handlebars placeholders |
| pageSize / orientation | String | A4, portrait, etc. |
| showLogo / showBankDetails / showVatNumber | Boolean | Branding toggles |
| **Unique** | [documentType, name] | |
| **Relations** | versions | DocumentTemplateVersion[] |

#### DocumentTemplateVersion
| Field | Type | Notes |
|-------|------|-------|
| **PK** | `id` cuid | |
| templateId | String | FK to DocumentTemplate |
| languageCode / branchCode / numberSeriesId / accessGroup / customerGroupId | String? | Selection criteria |
| htmlOverride / cssOverride | Text? | Version-specific overrides |
| emailSubject / emailBody | String? / Text? | Email settings |
| priority | Int | Higher = checked first |
| **Relations** | template | -> DocumentTemplate |

---

### 3.2 Finance / GL Module (Section 2.13)

#### ChartOfAccount
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `chart_of_accounts` | |
| **PK** | `id` UUID | |
| code | String | Unique account code |
| name | String | |
| accountType | AccountType (enum) | ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE |
| normalBalance | NormalBalance (enum) | DEBIT, CREDIT |
| parentCode | String? | Self-referential FK to parent account |
| classificationId | String? | FK to AccountClassification |
| isActive | Boolean | |
| **Relations** | parent/children (self), classification, journalLines, bankAccounts, budgetLines |

#### AccountClassification
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `account_classifications` | |
| **PK** | `id` UUID | |
| code / name | String | Unique classification |
| **Relations** | accounts | ChartOfAccount[] |

#### AccountMapping
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `account_mappings` | |
| **PK** | `id` UUID | |
| mappingType | AccountMappingType (enum) | 28 mapping types (AR_CONTROL, AP_CONTROL, STOCK, POS_CLEARING, etc.) |
| accountCode | String | FK to ChartOfAccount |
| departmentId | String? | Optional department scope |

#### FinancialPeriod
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `financial_periods` | |
| **PK** | `id` UUID | |
| name / code | String | e.g. "2026-01" |
| startDate / endDate | Date | |
| status | PeriodStatus (enum) | OPEN, CLOSED, LOCKED |
| fiscalYear | Int | |
| **Relations** | journalEntries, budgetLines |

#### JournalEntry
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `journal_entries` | |
| **PK** | `id` UUID | |
| entryNumber | String | Unique, number series |
| entryDate | Date | |
| source | JournalSource (enum) | MANUAL, AR_INVOICE, AP_BILL, etc. (21 values) |
| status | JournalStatus (enum) | DRAFT, POSTED, REVERSED |
| periodId | String | FK to FinancialPeriod |
| totalDebit / totalCredit | Decimal | Must balance |
| reversalOfId | String? | Self-ref FK for reversals |
| **Relations** | period, reversalOf/reversedBy (self), lines |

#### JournalLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `journal_lines` | |
| **PK** | `id` UUID | |
| journalEntryId | String | FK to JournalEntry (cascade delete) |
| accountCode | String | FK to ChartOfAccount |
| debitAmount / creditAmount | Decimal | |
| description | String? | |
| **Relations** | journalEntry, account |

#### BankAccount
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `bank_accounts` | |
| **PK** | `id` UUID | |
| glAccountCode | String | FK to ChartOfAccount |
| sortCode / accountNumber | String? | UK bank details |
| iban / bic | String? | International |
| currencyCode | String | |
| isActive | Boolean | |
| **Relations** | glAccount, transactions, reconciliations |

#### BankTransaction
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `bank_transactions` | |
| **PK** | `id` UUID | |
| bankAccountId | String | FK to BankAccount |
| transactionDate | Date | |
| amount | Decimal | |
| importSource | BankImportSource (enum) | CSV, OFX, QIF, OPEN_BANKING, MANUAL |
| matchStatus | ReconciliationMatchStatus (enum) | |
| **Relations** | bankAccount |

#### BankReconciliation
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `bank_reconciliations` | |
| **PK** | `id` UUID | |
| bankAccountId | String | FK to BankAccount |
| status | ReconciliationStatus (enum) | IN_PROGRESS, COMPLETED |
| statementBalance / reconciledBalance | Decimal | |
| **Relations** | bankAccount, lines |

#### BankReconciliationLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `bank_reconciliation_lines` | |
| reconciliationId | String | FK to BankReconciliation (cascade) |
| bankTransactionId | String | FK to BankTransaction |
| matchedJournalLineId | String? | FK to JournalLine |
| **Relations** | reconciliation, bankTransaction, matchedJournalLine |

#### Budget
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `budgets` | |
| **PK** | `id` UUID | |
| name | String | |
| budgetType | BudgetType (enum) | REVENUE, EXPENSE, CAPITAL, FULL |
| status | BudgetStatus (enum) | DRAFT, APPROVED, LOCKED |
| **Relations** | lines |

#### BudgetLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `budget_lines` | |
| **PK** | `id` UUID | |
| budgetId | String | FK to Budget (cascade) |
| accountCode | String | FK to ChartOfAccount |
| periodId | String | FK to FinancialPeriod |
| amount | Decimal | |
| **Relations** | budget, account, period |

---

### 3.3 Inventory Module (Section 2.14)

#### ItemGroup
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `item_groups` | |
| **PK** | `id` UUID | |
| code / name | String | Unique |
| parentGroupId | String? | Self-referential hierarchy |
| isActive | Boolean | |
| **Relations** | parentGroup/childGroups (self), items |

#### Warehouse
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `warehouses` | |
| **PK** | `id` UUID | |
| code / name | String | Unique |
| addressLine1, city, postcode | String? | Location |
| isActive | Boolean | |
| **Relations** | defaultForItems, stockMovements, stockBalances |

#### InventoryItem
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `inventory_items` | |
| **PK** | `id` UUID | |
| code / barcode | String | Unique item identifiers |
| itemType | ItemType (enum) | STOCK, SERVICE, NON_STOCK, KIT |
| costingMethod | CostingMethod (enum) | FIFO, WEIGHTED_AVERAGE, STANDARD, LAST_PURCHASE |
| groupId | String? | FK to ItemGroup |
| defaultWarehouseId | String? | FK to Warehouse |
| isActive | Boolean | |
| **Key Fields** | sellingPrice1/sellingPrice2/sellingPrice3, costPrice, weight, dimensions, etc. | ~50+ typed fields |
| **Relations** | group, defaultWarehouse, stockMovements, stockBalances, serialNumbers |

#### StockMovement
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `stock_movements` | |
| **PK** | `id` UUID | |
| itemId | String | FK to InventoryItem |
| warehouseId | String | FK to Warehouse |
| movementType | StockMovementType (enum) | 12 values (GOODS_RECEIPT through SCRAP) |
| status | StockMovementStatus (enum) | DRAFT, POSTED, REVERSED |
| sourceType | StockMovementSourceType (enum) | PURCHASE_ORDER, SALES_ORDER, MANUAL, etc. |
| quantity | Decimal | |
| reversedById | String? | Self-ref FK for reversal chain |
| **Relations** | item, warehouse, reversedBy/reversalOf (self) |

#### StockBalance
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `stock_balances` | |
| **PK** | `id` UUID | |
| itemId | String | FK to InventoryItem |
| warehouseId | String | FK to Warehouse |
| onHand / reserved / available | Decimal | Stock quantities |
| **Relations** | item, warehouse |

#### SerialNumber
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `serial_numbers` | |
| **PK** | `id` UUID | |
| itemId | String | FK to InventoryItem |
| serialNumber | String | |
| status | SerialNumberStatus (enum) | AVAILABLE, RESERVED, SOLD, RETURNED, QUARANTINE |
| warehouseId | String? | FK to Warehouse |
| **Relations** | item, warehouse |

#### UnitOfMeasure
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `units_of_measure` | |
| **PK** | `id` UUID | |
| code / name | String | |
| baseUomId | String? | Self-ref FK for conversion chains |
| conversionFactor | Decimal? | |
| **Relations** | baseUom/derivedUoms (self) |

---

### 3.4 Sales Ledger / AR Module (Section 2.15)

#### Customer
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `customers` | |
| **PK** | `id` UUID | |
| customerNumber | String | Unique, number series |
| name / legalName | String | |
| customerType | CustomerType (enum) | COMPANY, INDIVIDUAL |
| invoiceToCustomerId | String? | Self-ref FK for bill-to parent |
| isActive | Boolean | |
| **Key Fields** | ~80+ fields: credit limit, payment terms, VAT number, etc. |
| **Relations** | invoiceToCustomer/billToChildren (self), addresses, contacts, invoices, payments |

#### CustomerAddress
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `customer_addresses` | |
| customerId | String | FK to Customer |
| addressType | AddressType (enum) | BILLING, SHIPPING, REGISTERED, OTHER |
| **Relations** | customer |

#### CustomerContact
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `customer_contacts` | |
| customerId | String | FK to Customer |
| **Relations** | customer |

#### CustomerInvoice
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `customer_invoices` | |
| **PK** | `id` UUID | |
| invoiceNumber | String | Unique, number series |
| customerId | String | FK to Customer |
| invoiceType | InvoiceType (enum) | STANDARD, CASH, CREDIT_NOTE, DEBIT_NOTE, PROFORMA |
| status | InvoiceStatus (enum) | DRAFT, APPROVED, POSTED, CANCELLED, VOID |
| subtotal / vatAmount / totalAmount | Decimal | |
| currencyCode / exchangeRate | String / Decimal? | Multi-currency |
| **Relations** | customer, lines, paymentAllocations |

#### CustomerInvoiceLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `customer_invoice_lines` | |
| invoiceId | String | FK to CustomerInvoice (cascade) |
| **Relations** | invoice |

#### CustomerPayment
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `customer_payments` | |
| **PK** | `id` UUID | |
| customerId | String | FK to Customer |
| paymentMethod | PaymentMethod (enum) | BANK_TRANSFER, CARD, CASH, CHEQUE, DIRECT_DEBIT |
| status | PaymentStatus (enum) | DRAFT, POSTED, CANCELLED |
| amount | Decimal | |
| **Relations** | customer, allocations |

#### PaymentAllocation
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `payment_allocations` | |
| paymentId | String | FK to CustomerPayment |
| invoiceId | String | FK to CustomerInvoice |
| amount | Decimal | |
| **Relations** | payment, invoice |

---

### 3.5 Sales Orders Module (Section 2.16)

#### SalesQuote
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `sales_quotes` | |
| **PK** | `id` UUID | |
| quoteNumber | String | Unique |
| status | SalesQuoteStatus (enum) | DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED, CONVERTED, CANCELLED |
| customerId | String | FK to Customer |
| validUntil | Date | |
| **Relations** | lines |

#### SalesQuoteLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `sales_quote_lines` | |
| quoteId | String | FK to SalesQuote (cascade) |
| **Relations** | quote |

#### SalesOrder
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `sales_orders` | |
| **PK** | `id` UUID | |
| orderNumber | String | Unique |
| status | SalesOrderStatus (enum) | DRAFT through CANCELLED (9 values) |
| customerId | String | FK to Customer |
| subtotal / vatAmount / totalAmount | Decimal | |
| **Relations** | lines, dispatches |

#### SalesOrderLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `sales_order_lines` | |
| orderId | String | FK to SalesOrder (cascade) |
| lineStatus | SalesOrderLineStatus (enum) | OPEN, PARTIALLY_FULFILLED, FULFILLED, CANCELLED |
| **Relations** | order |

#### Dispatch
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `dispatches` | |
| **PK** | `id` UUID | |
| salesOrderId | String | FK to SalesOrder |
| status | DispatchStatus (enum) | DRAFT, PICKED, PACKED, SHIPPED, DELIVERED, CANCELLED |
| **Relations** | salesOrder, lines |

#### DispatchLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `dispatch_lines` | |
| dispatchId | String | FK to Dispatch (cascade) |
| salesOrderLineId | String | FK to SalesOrderLine |
| **Relations** | dispatch, salesOrderLine |

#### ShippingMethod
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `shipping_methods` | |
| **PK** | `id` UUID | |
| code / name | String | |
| isActive | Boolean | |

---

### 3.6 Purchasing / AP Module (Section 2.17)

#### Supplier
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `suppliers` | |
| **PK** | `id` UUID | |
| supplierNumber | String | Unique |
| supplierType | SupplierType (enum) | COMPANY, INDIVIDUAL |
| status | SupplierStatus (enum) | ACTIVE, ON_HOLD, BLOCKED, TERMINATED |
| isActive | Boolean | |
| **Relations** | purchaseOrders, bills, payments |

#### PurchaseOrder
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `purchase_orders` | |
| **PK** | `id` UUID | |
| orderNumber | String | Unique |
| supplierId | String | FK to Supplier |
| status | PurchaseOrderStatus (enum) | DRAFT through CANCELLED (9 values) |
| **Relations** | supplier, lines, goodsReceipts, bills |

#### PurchaseOrderLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `purchase_order_lines` | |
| orderId | String | FK to PurchaseOrder |
| lineStatus | PurchaseOrderLineStatus (enum) | OPEN, PARTIALLY_RECEIVED, RECEIVED, CANCELLED |
| **Relations** | order |

#### GoodsReceipt
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `goods_receipts` | |
| **PK** | `id` UUID | |
| purchaseOrderId | String? | FK to PurchaseOrder |
| supplierId | String | FK to Supplier |
| status | GoodsReceiptStatus (enum) | DRAFT, POSTED, CANCELLED |
| **Relations** | purchaseOrder, supplier, lines |

#### GoodsReceiptLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `goods_receipt_lines` | |
| goodsReceiptId | String | FK to GoodsReceipt |
| purchaseOrderLineId | String? | FK to PurchaseOrderLine |
| **Relations** | goodsReceipt, purchaseOrderLine |

#### SupplierBill
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `supplier_bills` | |
| **PK** | `id` UUID | |
| supplierId | String | FK to Supplier |
| purchaseOrderId | String? | FK to PurchaseOrder |
| status | SupplierBillStatus (enum) | DRAFT, APPROVED, POSTED, PARTIALLY_PAID, PAID, CANCELLED |
| matchStatus | MatchStatus (enum) | UNMATCHED, PARTIALLY_MATCHED, FULLY_MATCHED |
| **Relations** | supplier, purchaseOrder, lines, paymentAllocations |

#### SupplierBillLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `supplier_bill_lines` | |
| billId | String | FK to SupplierBill |
| purchaseOrderLineId | String? | FK to PurchaseOrderLine |
| **Relations** | bill, purchaseOrderLine |

#### SupplierPayment
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `supplier_payments` | |
| **PK** | `id` UUID | |
| supplierId | String | FK to Supplier |
| bacsRunId | String? | FK to BacsRun |
| status | SupplierPaymentStatus (enum) | DRAFT, APPROVED, SENT, COMPLETED, CANCELLED |
| paymentMethod | PaymentMethod (enum) | BACS, BANK_TRANSFER, CHEQUE, DIRECT_DEBIT, CARD |
| **Relations** | supplier, bacsRun, allocations |

#### SupplierPaymentAllocation
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `supplier_payment_allocations` | |
| paymentId | String | FK to SupplierPayment |
| billId | String | FK to SupplierBill |
| **Relations** | payment, bill |

#### BacsRun
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `bacs_runs` | |
| **PK** | `id` UUID | |
| status | BacsRunStatus (enum) | DRAFT, APPROVED, SUBMITTED, COMPLETED, FAILED |
| **Relations** | payments (SupplierPayment[]) |

---

### 3.7 Fixed Assets Module (Section 2.18)

#### DepreciationMethod
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `depreciation_methods` | |
| **PK** | `id` UUID | |
| code / name | String | Unique |
| methodType | DepreciationMethodType (enum) | STRAIGHT_LINE, DECLINING_BALANCE, UNITS_OF_PRODUCTION, SUM_OF_YEARS_DIGITS |
| **Relations** | bookAssets, fiscalAssets (FixedAsset[]) |

#### AssetGroup
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `asset_groups` | |
| **PK** | `id` UUID | |
| parentGroupId | String? | Self-referential hierarchy |
| **Relations** | parentGroup/childGroups (self), assets |

#### AssetClass
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `asset_classes` | |
| **PK** | `id` UUID | |
| code / name | String | Unique |
| **Relations** | assets (FixedAsset[]) |

#### FixedAsset
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `fixed_assets` | |
| **PK** | `id` UUID | |
| assetCode | String | Unique |
| assetClassId | String | FK to AssetClass |
| assetGroupId | String? | FK to AssetGroup |
| status | FixedAssetStatus (enum) | ACTIVE, FULLY_DEPRECIATED, DISPOSED, WRITTEN_OFF, UNDER_CONSTRUCTION |
| depreciationMethodId | String | FK to DepreciationMethod ("BookDepreciationMethod") |
| fiscalDepreciationMethodId | String? | FK to DepreciationMethod ("FiscalDepreciationMethod") |
| acquisitionCost / accumulatedDepreciation / bookValue | Decimal | |
| **Relations** | assetClass, assetGroup, depreciationMethod, fiscalDepreciationMethod, entries, disposals, transfersFrom, transactions |

#### DepreciationEntry
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `depreciation_entries` | |
| fixedAssetId | String | FK to FixedAsset |
| status | DepreciationEntryStatus (enum) | DRAFT, POSTED |
| **Relations** | fixedAsset |

#### AssetDisposal
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `asset_disposals` | |
| fixedAssetId | String | FK to FixedAsset |
| disposalType | DisposalType (enum) | SALE, SCRAP, WRITE_OFF, TRADE_IN |
| status | AssetDisposalStatus (enum) | DRAFT, APPROVED, POSTED, CANCELLED |
| **Relations** | fixedAsset |

#### AssetTransfer
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `asset_transfers` | |
| fixedAssetId | String | FK to FixedAsset |
| status | AssetTransferStatus (enum) | DRAFT, APPROVED, POSTED, CANCELLED |
| **Relations** | fixedAsset |

#### AssetTransaction
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `asset_transactions` | |
| fixedAssetId | String | FK to FixedAsset |
| transactionType | AssetTransactionType (enum) | ACQUISITION, DEPRECIATION, TRANSFER, REVALUATION, DISPOSAL, ADJUSTMENT |
| **Relations** | fixedAsset |

---

### 3.8 Pricing Module (Section 2.19)

#### PriceList
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `price_lists` | |
| **PK** | `id` UUID | |
| code / name | String | |
| replacementPriceListId | String? | Self-ref FK for replacement chain |
| isActive | Boolean | |
| **Relations** | replacementPriceList/replacedByLists (self), entries |

#### PriceListEntry
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `price_list_entries` | |
| priceListId | String | FK to PriceList |
| priceType | PriceType (enum) | FIXED, QUANTITY_BREAK, CUSTOMER_SPECIFIC |
| **Relations** | priceList, quantityBreaks |

#### QuantityBreak
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `quantity_breaks` | |
| priceListEntryId | String | FK to PriceListEntry (cascade) |
| **Relations** | priceListEntry |

#### Rebate
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `rebates` | |
| **PK** | `id` UUID | |
| rebateType | RebateType (enum) | PERCENTAGE, FIXED_AMOUNT, TIERED |
| **Relations** | tiers |

#### RebateTier
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `rebate_tiers` | |
| rebateId | String | FK to Rebate (cascade) |
| **Relations** | rebate |

---

### 3.9 Cross-Cutting Module (Section 2.20)

#### Attachment (Polymorphic)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `attachments` | |
| **PK** | `id` UUID | |
| entityType | String | e.g. "customer", "invoice", "employee" |
| entityId | String | UUID of the related entity |
| fileName / mimeType / fileSize / storageUrl | String / Int | |

#### Note (Polymorphic)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `notes` | |
| **PK** | `id` UUID | |
| entityType | String | Polymorphic entity type |
| entityId | String | |
| noteType | NoteType (enum) | GENERAL, INTERNAL, CUSTOMER_VISIBLE, SYSTEM |

#### RecordLink (Polymorphic)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `record_links` | |
| **PK** | `id` UUID | |
| sourceEntityType / sourceEntityId | String | Source entity |
| targetEntityType / targetEntityId | String | Target entity |
| linkType | RecordLinkType (enum) | CREATED_FROM, FULFILLS, PAYMENT_FOR, CREDIT_FOR, RELATES_TO, PARENT_CHILD |

#### ApprovalRule
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `approval_rules` | |
| **PK** | `id` UUID | |
| entityType | String | Which entity type requires approval |
| scopeType | ApprovalScopeType (enum) | PER_RECORD, PER_LINE |
| **Relations** | levels (ApprovalRuleLevel[]), requests |

#### ApprovalRuleLevel
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `approval_rule_levels` | |
| approvalRuleId | String | FK to ApprovalRule (cascade) |
| approverType | ApproverType (enum) | SPECIFIC_USER, ROLE, DEPARTMENT_MANAGER, CUSTOM |
| **Relations** | approvalRule |

#### ApprovalRequest (Polymorphic)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `approval_requests` | |
| **PK** | `id` UUID | |
| entityType / entityId | String | Polymorphic |
| approvalRuleId | String | FK to ApprovalRule |
| approvalRuleLevelId | String | FK to ApprovalRuleLevel |
| status | ApprovalStatus (enum) | PENDING, APPROVED, REJECTED, CANCELLED, ESCALATED, FORWARDED |
| **Relations** | approvalRule, approvalRuleLevel |

#### Activity
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `activities` | |
| **PK** | `id` UUID | |
| entityType / entityId | String | Polymorphic |
| activityType | ActivityType (enum) | MEETING, CALL, EMAIL, TODO, NOTE, FOLLOW_UP, WORK_HOURS |
| status | ActivityStatus (enum) | PLANNED, IN_PROGRESS, COMPLETED, CANCELLED |
| priority | ActivityPriority (enum) | LOW, NORMAL, HIGH, URGENT |
| parentActivityId | String? | Self-ref FK for recurrence |
| **Relations** | parentActivity/childActivities (self) |

---

### 3.10 CRM Module (Section 2.21)

**Reference Entities (6):** CrmLeadStatus, CrmLeadSource, CrmIndustry, CrmMediaType, CrmOpportunityClass, CrmActivityType, CrmActivityTypeGroup -- all follow the standard reference entity pattern with `id`, `code`, `name`, `isActive`.

#### CrmLead
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `crm_leads` | |
| **PK** | `id` UUID | |
| statusId | String? | FK to CrmLeadStatus |
| sourceId | String? | FK to CrmLeadSource |
| industryId | String? | FK to CrmIndustry |
| rating | CrmLeadRating (enum) | NONE, COLD, WARM, HOT |
| lifecycle | CrmLeadLifecycle (enum) | NEW, CONTACTED, QUALIFIED, UNQUALIFIED, CONVERTED, LOST |
| **Relations** | status, source, industry, campaigns, opportunities |

#### CrmCampaign
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `crm_campaigns` | |
| **PK** | `id` UUID | |
| mediaTypeId | String? | FK to CrmMediaType |
| status | CrmCampaignStatus (enum) | DRAFT, ACTIVE, COMPLETED, CANCELLED |
| **Relations** | mediaType, recipients, opportunities |

#### CrmCampaignRecipient
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `crm_campaign_recipients` | |
| campaignId | String | FK to CrmCampaign (cascade) |
| leadId | String? | FK to CrmLead |
| recipientType | CrmCampaignRecipientType (enum) | LEAD, CUSTOMER |
| **Relations** | campaign, lead |

#### CrmOpportunity
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `crm_opportunities` | |
| **PK** | `id` UUID | |
| classId | String? | FK to CrmOpportunityClass |
| leadId | String? | FK to CrmLead |
| campaignId | String? | FK to CrmCampaign |
| status | CrmOpportunityStatus (enum) | OPEN, WON, LOST, CANCELLED |
| **Relations** | class, lead, campaign, stageLogs |

#### CrmOpportunityStageLog
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `crm_opportunity_stage_logs` | |
| opportunityId | String | FK to CrmOpportunity (cascade) |
| **Relations** | opportunity |

#### CrmPipelineView / CrmPipelineColumn
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `crm_pipeline_views` / `crm_pipeline_columns` | |
| CrmPipelineView.entityType | CrmPipelineEntityType (enum) | LEAD, OPPORTUNITY, ACTIVITY, SALES_QUOTE, SALES_ORDER |
| CrmPipelineColumn.viewId | String | FK to CrmPipelineView (cascade) |

#### CrmActivityAutoRule
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `crm_activity_auto_rules` | |
| activityTypeId | String | FK to CrmActivityType |
| trigger | CrmActivityAutoTrigger (enum) | 9 trigger types |
| **Relations** | activityType |

#### CrmModuleSetting
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `crm_module_settings` | |
| Singleton config entity for CRM module settings | |

---

### 3.11 HR & Payroll Module (Section 2.22)

**Reference Entities (5):** JobTitle, ContractClass, ContractType, ResidencyType, PaymentType -- standard pattern.

#### Employee
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `employees` | |
| **PK** | `id` UUID | |
| employeeNumber | String | Unique |
| status | EmployeeStatus (enum) | ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED, RETIRED |
| gender | Gender (enum) | 4 values |
| maritalStatus | MaritalStatus (enum) | 7 values |
| managerId | String? | Self-ref FK for reporting hierarchy |
| **Key Fields** | ~30+ typed fields: NI number, tax code, bank details, emergency contacts |
| **Relations** | manager/directReports (self), contracts, appraisals, training, leave, payroll |

#### EmploymentContract
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `employment_contracts` | |
| employeeId | String | FK to Employee |
| status | ContractStatus (enum) | DRAFT, APPROVED, TERMINATED |
| salaryFrequency | SalaryFrequency (enum) | MONTHLY, YEARLY, WEEKLY, FORTNIGHTLY, HOURLY |
| previousContractId | String? | Self-ref FK for renewal chain |
| **Relations** | employee, previousContract/renewedContracts (self), changes, benefits |

#### ContractChange
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `contract_changes` | |
| contractId | String | FK to EmploymentContract |
| reason | ContractChangeReason (enum) | NEW, PROMOTION, TRANSFER, DEMOTION, etc. |
| **Relations** | contract |

#### ContractBenefit
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `contract_benefits` | |
| contractId | String | FK to EmploymentContract (cascade) |
| benefitTypeId | String | FK to BenefitType |
| frequency | BenefitFrequency (enum) | ONE_OFF through YEARLY |
| **Relations** | contract, benefitType |

#### PerformanceAppraisal
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `performance_appraisals` | |
| employeeId | String | FK to Employee ("AppraisalEmployee") |
| reviewerId | String | FK to Employee ("AppraisalReviewer") |
| status | AppraisalStatus (enum) | DRAFT, APPROVED |
| **Relations** | employee, reviewer, lines |

#### SkillsEvaluation
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `skills_evaluations` | |
| employeeId | String | FK to Employee |
| status | SkillsEvalStatus (enum) | DRAFT, APPROVED, TERMINATED |
| **Relations** | employee, lines |

#### Checklist
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `checklists` | |
| employeeId | String | FK to Employee |
| checklistType | ChecklistType (enum) | ONBOARDING, OFFBOARDING, OTHER |
| **Relations** | employee, items |

#### JobPosition
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `job_positions` | |
| status | JobPositionStatus (enum) | OPENING, VACANT, FILLED, CANCELLED |
| **Relations** | incumbents (PositionIncumbent[]) |

#### TrainingPlan
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `training_plans` | |
| employeeId | String | FK to Employee ("TraineeEmployee") |
| trainerId | String? | FK to Employee ("TrainerEmployee") |
| status | TrainingStatus (enum) | SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, CLOSED |
| **Relations** | employee, trainer |

#### LeaveEntitlement / LeaveRequest / LeaveBalance
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `leave_entitlements` / `leave_requests` / `leave_balances` | |
| All FK to Employee | |
| LeaveRequest.status | LeaveRequestStatus (enum) | PENDING, APPROVED, REJECTED, CANCELLED, TAKEN |
| LeaveType (enum) | 12 values | ANNUAL through OTHER |

#### TaxYearConfig
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tax_year_configs` | |
| **PK** | `id` UUID | |
| UK tax year config: PAYE thresholds, NI thresholds, student loan thresholds, pension rates | |

#### PensionEnrolment
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `pension_enrolments` | |
| employeeId | String | FK to Employee |
| status | PensionEnrolmentStatus (enum) | 7 values |
| schemeType | PensionSchemeType (enum) | 5 values |
| contributionMethod | PensionContributionMethod (enum) | RELIEF_AT_SOURCE, NET_PAY |
| **Relations** | employee, taxYearConfig |

#### PayrollRun
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `payroll_runs` | |
| **PK** | `id` UUID | |
| taxYearConfigId | String | FK to TaxYearConfig |
| status | PayrollRunStatus (enum) | DRAFT, CALCULATED, REVIEWED, APPROVED, PAID, POSTED, CANCELLED |
| frequency | PayrollFrequency (enum) | WEEKLY, FORTNIGHTLY, FOUR_WEEKLY, MONTHLY |
| **Relations** | taxYearConfig, lines, hmrcSubmissions, payslips |

#### PayrollLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `payroll_lines` | |
| payrollRunId | String | FK to PayrollRun (cascade) |
| employeeId | String | FK to Employee |
| lineType | PayrollLineType (enum) | 25 values (GROSS_PAY through NET_PAY) |
| **Relations** | payrollRun, employee |

#### StatutoryPayment
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `statutory_payments` | |
| employeeId | String | FK to Employee |
| payType | StatutoryPayType (enum) | SSP, SMP, SPP, ShPP, SAP, SPBP |
| **Relations** | employee |

#### HMRCSubmission
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `hmrc_submissions` | |
| payrollRunId | String? | FK to PayrollRun |
| submissionType | HMRCSubmissionType (enum) | FPS, EPS, EARLIER_YEAR_UPDATE, P45, P46 |
| status | HMRCSubmissionStatus (enum) | DRAFT, GENERATED, SUBMITTED, ACCEPTED, REJECTED, ERROR |
| **Relations** | payrollRun |

#### PayslipDocument
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `payslip_documents` | |
| payrollRunId | String | FK to PayrollRun |
| employeeId | String | FK to Employee |
| **Relations** | payrollRun, employee |

#### HrModuleSetting
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `hr_module_settings` | |
| Singleton config entity for HR module | |

---

### 3.12 Production / MRP Module (Section 2.23)

#### Recipe (BOM Template)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `recipes` | |
| **PK** | `id` UUID | |
| code / name | String | Unique |
| defaultRoutingId | String? | FK to Routing |
| **Relations** | defaultRouting, lines, productionOrders, productions |

#### RecipeLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `recipe_lines` | |
| recipeId | String | FK to Recipe (cascade) |
| direction | RecipeLineDirection (enum) | INPUT, OUTPUT |
| **Relations** | recipe |

#### Routing / RoutingStep
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `routings` / `routing_steps` | |
| RoutingStep FK to Routing (cascade), optional FK to StandardOperation, Machine, MachineGroup |

#### StandardOperation / StandardOperationMaterial
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `standard_operations` / `standard_operation_materials` | |
| StandardOperation has defaultMachine, defaultMachineGroup FKs |

#### Machine / MachineGroup / MachineShift / MachineSwitchTime / MachineItemDefault
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `machines` / `machine_groups` / `machine_shifts` / `machine_switch_times` / `machine_item_defaults` | |
| Machine references MachineGroup; MachineShift, MachineSwitchTime cascade from Machine |

#### ProductionClass / AutoProductionRule
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `production_classes` / `auto_production_rules` | |
| AutoProductionRule has defaultMachine, defaultRecipe FKs |

#### ProductionOrder
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `production_orders` | |
| **PK** | `id` UUID | |
| status | ProductionOrderStatus (enum) | CREATED, RELEASED, STARTED, FINISHED, CANCELLED |
| recipeId | String? | FK to Recipe |
| routingId | String? | FK to Routing |
| machineId | String? | FK to Machine |
| productionClassId | String? | FK to ProductionClass |
| **Relations** | recipe, routing, machine, productionClass, lines, productions |

#### ProductionOrderLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `production_order_lines` | |
| orderId | String | FK to ProductionOrder (cascade) |

#### Production
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `productions` | |
| **PK** | `id` UUID | |
| status | ProductionStatus (enum) | CREATED, STARTED, FINISHED, CANCELLED, FINISHED_DISCARDED |
| productionOrderId | String? | FK to ProductionOrder |
| glMode | ProductionGlMode (enum) | FROM_PRODUCTION, FROM_OPERATIONS |
| **Relations** | productionOrder, recipe, routing, machine, productionClass, lines, operations |

#### ProductionLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `production_lines` | |
| productionId | String | FK to Production (cascade) |

#### ProductionOperation
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `production_operations` | |
| productionId | String | FK to Production |
| status | ProductionOperationStatus (enum) | CREATED, STARTED, FINISHED, CANCELLED, FINISHED_DISCARDED |
| parentOperationId | String? | Self-ref FK for partial completion |
| **Relations** | production, standardOperation, machine, machineGroup, parentOperation/childOperations (self), lines |

#### ProductionOperationLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `production_operation_lines` | |
| operationId | String | FK to ProductionOperation (cascade) |

#### ProductionPlan / ProductionPlanLine / ProductionPlanComponent
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `production_plans` / `production_plan_lines` / `production_plan_components` | |
| ProductionPlan.status | ProductionPlanStatus (enum) | DRAFT, APPROVED, CLOSED |
| Lines and components cascade from plan |

#### ProductionSetting
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `production_settings` | |
| Singleton config for production module | |

---

### 3.13 POS Module (Section 2.24)

#### POSTerminal
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `pos_terminals` | |
| **PK** | `id` UUID | |
| status | POSTerminalStatus (enum) | ACTIVE, INACTIVE, MAINTENANCE |
| defaultDrawerId | String? | FK to CashDrawer |
| **Relations** | defaultDrawer, sessions, sales, cashMovements, journalEntries |

#### CashDrawer
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `cash_drawers` | |
| **Relations** | defaultForTerminals, sessions, cashMovements, cashups |

#### POSSession
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `pos_sessions` | |
| terminalId | String | FK to POSTerminal |
| drawerId | String | FK to CashDrawer |
| status | POSSessionStatus (enum) | OPEN, CLOSED |
| **Relations** | terminal, drawer, sales, cashMovements, cashups |

#### POSPaymentMethod
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `pos_payment_methods` | |
| methodType | POSPaymentMethodType (enum) | 10 values (CASH through OTHER) |

#### POSSale
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `pos_sales` | |
| **PK** | `id` UUID | |
| sessionId | String | FK to POSSession |
| terminalId | String | FK to POSTerminal |
| status | POSSaleStatus (enum) | IN_PROGRESS, SUSPENDED, COMPLETED, VOIDED |
| saleType | POSSaleType (enum) | SALE, RETURN |
| returnAgainstSaleId | String? | Self-ref FK for returns |
| **Relations** | session, terminal, returnAgainstSale/returns (self), lines, payments |

#### POSSaleLine / POSPayment
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `pos_sale_lines` / `pos_payments` | |
| Both FK to POSSale (cascade) |
| POSSaleLine.lineStatus | POSSaleLineStatus (enum) | ACTIVE, VOIDED |
| POSPayment.paymentMethodId | FK to POSPaymentMethod |

#### POSCashMovement
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `pos_cash_movements` | |
| terminalId, drawerId, sessionId | FKs | |
| movementType | POSCashMovementType (enum) | CASH_IN, CASH_OUT, WRITE_OFF |

#### POSCashup / POSCashupLine
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `pos_cashups` / `pos_cashup_lines` | |
| POSCashup.status | POSCashupStatus (enum) | DRAFT, COMPLETED, POSTED |
| POSCashupLine FK to POSCashup (cascade) + POSPaymentMethod |

#### POSJournalEntry
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `pos_journal_entries` | |
| terminalId | String | FK to POSTerminal |
| action | POSJournalAction (enum) | 30 values (ADD_ITEM through SHUTDOWN) |

#### POSButtonLayout / POSButton
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `pos_button_layouts` / `pos_buttons` | |
| POSButton.actionType | POSButtonActionType (enum) | 40+ values |
| POSButton FK to POSButtonLayout (cascade) |

#### POSSerialBlock
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `pos_serial_blocks` | |
| Serial number blocks for POS receipts | |

---

### 3.14 Projects & Job Costing Module (Section 2.25)

#### Project
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `projects` | |
| **PK** | `id` UUID | |
| status | ProjectStatus (enum) | DRAFT, ACTIVE, ON_HOLD, COMPLETED, CANCELLED, ARCHIVED |
| billingMethod | ProjectBillingMethod (enum) | TIME_AND_MATERIALS, FIXED_PRICE, NON_BILLABLE |
| **Relations** | tasks, timesheets, expenses, transactions, budgets, rateCards, invoiceSchedules |

#### ProjectTask
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `project_tasks` | |
| projectId | String | FK to Project (cascade) |
| parentTaskId | String? | Self-ref FK for task hierarchy |
| taskStatus | ProjectTaskStatus (enum) | NOT_STARTED, IN_PROGRESS, COMPLETED, CANCELLED |
| **Relations** | project, parentTask/childTasks (self), timesheetEntries, transactions |

#### Timesheet / TimesheetEntry
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `timesheets` / `timesheet_entries` | |
| Timesheet.status | TimesheetStatus (enum) | DRAFT, SUBMITTED, APPROVED, REJECTED |
| TimesheetEntry FK to Timesheet (cascade) + optional FK to ProjectTask |

#### ProjectExpense
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `project_expenses` | |
| status | ProjectExpenseStatus (enum) | DRAFT, SUBMITTED, APPROVED, REJECTED, INVOICED |

#### ProjectTransaction
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `project_transactions` | |
| projectId | String | FK to Project |
| taskId | String? | FK to ProjectTask |
| sourceType | ProjectTransactionSourceType (enum) | TIMESHEET, VENDOR_INVOICE, EXPENSE, GOODS_RECEIPT, ACTIVITY, PURCHASE_ORDER, MANUAL |
| status | ProjectTransactionStatus (enum) | PENDING, APPROVED, INVOICED, WRITTEN_OFF |

#### ProjectBudget / ProjectBudgetLine
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `project_budgets` / `project_budget_lines` | |
| ProjectBudget FK to Project (cascade); line FK to budget (cascade) |

#### ProjectRateCard / ProjectRateCardEntry
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `project_rate_cards` / `project_rate_card_entries` | |
| ProjectRateCardEntry.rateType | ProjectRateType (enum) | ROLE, EMPLOYEE, ITEM, TASK |

#### ProjectInvoiceSchedule
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `project_invoice_schedules` | |
| projectId | String | FK to Project (cascade) |
| status | ProjectInvoiceScheduleStatus (enum) | PENDING, INVOICED, CANCELLED |

---

### 3.15 Contracts & Agreements Module (Section 2.26)

**Three sub-domains:** Agreements (Rentals), Contracts (Service/Maintenance), Loan Agreements.

#### AgreementType
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `agreement_types` | |
| Template/config entity for rental agreements |

#### Agreement
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `agreements` | |
| **PK** | `id` UUID | |
| agreementTypeId | String? | FK to AgreementType |
| status | AgreementStatus (enum) | DRAFT, ACTIVE, CLOSED, CANCELLED |
| invoiceBase | AgreementInvoiceBase (enum) | PER_CHARGE, PER_LINE, PER_AGREEMENT |
| invoiceGrouping | AgreementInvoiceGrouping (enum) | PER_AGREEMENT, PER_CUSTOMER, SPLIT_BY_SITE |
| bankHolidayHandling | BankHolidayHandling (enum) | IGNORE, EXCLUDE_GLOBAL, EXCLUDE_BY_COUNTRY |
| **Relations** | agreementType, lines, charges, offHires |

#### AgreementLine / AgreementCharge
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `agreement_lines` / `agreement_charges` | |
| AgreementCharge.chargePeriodType | ChargePeriodType (enum) | DAYS, MONTHS, FIXED |
| AgreementCharge.category | AgreementChargeCategory (enum) | RENTAL, CONSUMABLE |
| AgreementCharge.chargeStatus | AgreementChargeStatus (enum) | UNINVOICED, INVOICED |

#### OffHire / OffHireLine
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `off_hires` / `off_hire_lines` | |
| OffHire.status | OffHireStatus (enum) | DRAFT, CONFIRMED, CANCELLED |

#### ContractClass (Agreements module)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `contract_classes` | |
| Note: name collision with HR ContractClass, different table |

#### Contract (Service/Maintenance)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `contracts` | |
| contractClassId | String? | FK to ContractClass |
| status | ContractStatus (enum) | DRAFT, ACTIVE, RENEWED, CANCELLED, EXPIRED |
| periodType | ContractPeriodType (enum) | DAYS, MONTHS |
| **Relations** | contractClass, lines |

#### ContractLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `contract_lines` | |
| FK to Contract (cascade) |

#### LoanAgreementType
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `loan_agreement_types` | |
| Config entity with default scheduleType, interestRateMethod, dayCountConvention |

#### LoanAgreement
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `loan_agreements` | |
| **PK** | `id` UUID | |
| loanAgreementTypeId | String? | FK to LoanAgreementType |
| status | LoanAgreementStatus (enum) | NEW, APPROVED, SIGNED, ACTIVE, DISBURSED, PAUSED, CANCELLED, FINISHED |
| scheduleType | LoanScheduleType (enum) | ANNUITY, LINEAR, LINEAR_EQUAL, BULLET |
| interestRateMethod | LoanInterestRateMethod (enum) | MONTHLY, ANNUAL |
| dayCountConvention | LoanDayCountConvention (enum) | THIRTY_360, ACTUAL |
| **Relations** | loanAgreementType, items, scheduleRows |

#### LoanAgreementItem / LoanScheduleRow
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `loan_agreement_items` / `loan_schedule_rows` | |
| Both FK to LoanAgreement (cascade) |
| LoanScheduleRow.rowType | LoanScheduleRowType (enum) | INVOICE, CREDIT_INVOICE, BUYOUT, DISBURSEMENT |

---

### 3.16 Warehouse Management Module (Section 2.27)

#### WarehouseGroup
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `warehouse_groups` | |
| Reporting groups of warehouses |

#### WarehouseZone
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `warehouse_zones` | |
| **Relations** | wmsConfigsPalletZone, wmsConfigsPickZone, wmsConfigsDeliveryZone |

#### WarehouseWmsConfig
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `warehouse_wms_configs` | |
| warehouseGroupId | String? | FK to WarehouseGroup |
| palletZoneId / pickZoneId / deliveryZoneId | String? | FKs to WarehouseZone (3 named relations) |
| forkliftSystemMode | ForkliftSystemMode (enum) | NONE, SEMI_AUTOMATED, FULL_CONFIRMATION |
| **Relations** | warehouseGroup, palletZone, pickZone, deliveryZone, binPositions, positionStocks, pickingLists, forklifts, forkliftTasks |

#### BinPosition
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `bin_positions` | |
| warehouseWmsConfigId | String | FK to WarehouseWmsConfig |
| zoneId | String? | FK to WarehouseZone |
| status | BinPositionStatus (enum) | FREE, OCCUPIED, RESERVED, ERROR |
| **Relations** | warehouseWmsConfig, zone, positionStocks, forkliftTasksFrom, forkliftTasksTo |

#### PositionStock
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `position_stock` | |
| binPositionId | String | FK to BinPosition |
| warehouseWmsConfigId | String | FK to WarehouseWmsConfig |
| zoneId | String? | FK to WarehouseZone |

#### PickingList / PickingLine
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `picking_lists` / `picking_lines` | |
| PickingList.status | PickingListStatus (enum) | DRAFT, IN_PROGRESS, COMPLETED, CANCELLED |
| PickingLine.lineStatus | PickingLineStatus (enum) | PENDING, PICKED, SHORT_PICKED, CANCELLED |

#### Forklift
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `forklifts` | |
| warehouseWmsConfigId | String | FK to WarehouseWmsConfig |

#### ForkliftTask
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `forklift_tasks` | |
| warehouseWmsConfigId | String | FK to WarehouseWmsConfig |
| fromPositionId | String? | FK to BinPosition ("TaskFromPosition") |
| toPositionId | String? | FK to BinPosition ("TaskToPosition") |
| forkliftId | String? | FK to Forklift |
| taskType | ForkliftTaskType (enum) | MANUAL_PICK, DELIVERY, STOCK_MOVEMENT |
| status | ForkliftTaskStatus (enum) | PENDING, SENT, IN_PROGRESS, COMPLETED, ERROR, WAITING_CONVEYOR |
| priority | ForkliftTaskPriority (enum) | DEFAULT, EXPRESS, EXPRESS_DELIVERY |

---

### 3.17 Intercompany & Consolidation Module (Section 2.28)

**Note:** Some models are [PLATFORM] (stored in platform DB), others are [TENANT] (stored in tenant DB).

#### IntercompanyRule [TENANT]
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `intercompany_rules` | |
| sourceAccountCode | String | Account to match |
| direction | IntercompanyRuleDirection (enum) | DEBIT, CREDIT |

#### IntercompanyTransaction [PLATFORM]
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `intercompany_transactions` | |
| transactionType | IntercompanyTransactionType (enum) | NL_MIRROR, PO_TO_SO, INVOICE_MIRROR |
| status | IntercompanyTransactionStatus (enum) | INITIATED, TARGET_PENDING, TARGET_POSTED, COMPLETED, FAILED, COMPENSATED, CANCELLED |

#### ConsolidationGroup [PLATFORM]
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `consolidation_groups` | |
| **Relations** | members, accountMaps, exchangeRates, runs |

#### ConsolidationMember [PLATFORM]
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `consolidation_members` | |
| groupId | String | FK to ConsolidationGroup (cascade) |
| parentMemberId | String? | Self-ref FK for hierarchy |
| status | ConsolidationMemberStatus (enum) | ACTIVE, SUSPENDED, REMOVED |
| **Relations** | group, parentMember/childMembers (self), ownershipPercentages |

#### OwnershipPercentage / ConsolidationAccountMap / ConsolidationExchangeRate [PLATFORM]
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `ownership_percentages` / `consolidation_account_maps` / `consolidation_exchange_rates` | |
| All FK to ConsolidationMember or ConsolidationGroup |

#### EliminationTemplate / EliminationEntry [TENANT]
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `elimination_templates` / `elimination_entries` | |
| EliminationEntry.outputType | EliminationOutputType (enum) | JOURNAL, SIMULATION |

#### ConsolidationRun [PLATFORM]
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `consolidation_runs` | |
| groupId | String | FK to ConsolidationGroup |
| status | ConsolidationRunStatus (enum) | IN_PROGRESS, COMPLETED, FAILED |

#### SharedRegisterConfig [PLATFORM]
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `shared_register_configs` | |
| groupId | String | FK to ConsolidationGroup (cascade) |
| registerType | SharedRegisterType (enum) | CUSTOMER, SUPPLIER, ITEM, CHART_OF_ACCOUNT |

#### IntercompanySupplierMode (P2 Extension)
| Field | Type | Notes |
|-------|------|-------|
| Enum added to Supplier model | NONE, DEFAULT, INTERNAL |

---

### 3.18 Communications Module (Section 2.29)

#### ChatChannel / ChatParticipant / ChatMessage
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `chat_channels` / `chat_participants` / `chat_messages` | |
| ChatChannel.channelType | ChatChannelType (enum) | DIRECT, GROUP, AI_ASSISTANT |
| ChatMessage.parentMessageId | String? | Self-ref FK for threading |
| **Relations** | ChatParticipant FK to ChatChannel (cascade); ChatMessage FK to ChatChannel (cascade), parentMessage/replies (self) |

#### EmailMessage / EmailRecipient / EmailQueue
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `email_messages` / `email_recipients` / `email_queue` | |
| EmailMessage.status | EmailMessageStatus (enum) | DRAFT, SENT, QUEUED, FAILED, BOUNCED |
| EmailMessage.direction | EmailDirection (enum) | INBOUND, OUTBOUND |
| EmailRecipient.recipientType | EmailRecipientType (enum) | FROM, TO, CC, BCC |
| EmailRecipient.status | EmailRecipientStatus (enum) | UNREAD, READ, DELETED, ARCHIVED |
| EmailQueue.queueStatus | EmailQueueStatus (enum) | PENDING, PROCESSING, SENT, FAILED, RETRYING |

#### EmailTemplate / EmailAlias / EmailSignature
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `email_templates` / `email_aliases` / `email_signatures` | |
| Reference/configuration entities |

#### ConferenceRoom / ConferenceAccess
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `conference_rooms` / `conference_access` | |
| ConferenceRoom.roomType | ConferenceRoomType (enum) | DISCUSSION, ANNOUNCEMENTS, KNOWLEDGE_BASE |
| ConferenceRoom.parentRoomId | String? | Self-ref FK for hierarchy |
| ConferenceAccess.accessLevel | ConferenceAccessLevel (enum) | FULL, READ_WRITE, READ_ONLY, NONE |

#### NotificationTemplate / NotificationPreference / Notification
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `notification_templates` / `notification_preferences` / `notifications` | |
| Notification.channel | NotificationChannel (enum) | IN_APP, EMAIL, PUSH |
| Notification.priority | NotificationPriority (enum) | LOW, NORMAL, HIGH, URGENT |
| Notification.status | NotificationStatus (enum) | PENDING, DELIVERED, READ, DISMISSED, FAILED |

#### MassMailCampaign
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `mass_mail_campaigns` | |
| Bulk email campaign management |

---

### 3.19 Service Orders & Timekeeper Module (Section 2.30)

#### ServiceOrder
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `service_orders` | |
| **PK** | `id` UUID | |
| status | ServiceOrderStatus (enum) | DRAFT, OPEN, IN_PROGRESS, ON_HOLD, COMPLETED, INVOICED, CANCELLED |
| **Relations** | lines, workOrders, workSheets |

#### ServiceOrderLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `service_order_lines` | |
| serviceOrderId | String | FK to ServiceOrder (cascade) |
| lineItemType | ServiceLineItemType (enum) | PLAIN, INVOICEABLE, WARRANTY, CONTRACT |
| lineItemKind | ServiceLineItemKind (enum) | MAIN_ITEM, SUB_ITEM |

#### WorkOrder / WorkOrderLine
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `work_orders` / `work_order_lines` | |
| WorkOrder FK to ServiceOrder |
| WorkOrder.status | WorkOrderStatus (enum) | OPEN, IN_PROGRESS, CLOSED |
| WorkOrderLine FK to WorkOrder (cascade) |

#### WorkSheet / WorkSheetLine
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `work_sheets` / `work_sheet_lines` | |
| WorkSheet FK to ServiceOrder + optional FK to WorkOrder |
| WorkSheet.status | WorkSheetStatus (enum) | DRAFT, SUBMITTED, APPROVED, INVOICED, REJECTED |
| WorkSheetLine FK to WorkSheet (cascade) |

#### KnownSerialNumber
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `known_serial_numbers` | |
| Tracks known serial numbers for service items |
| warrantyStatus | WarrantyStatus (enum) | UNKNOWN, UNDER_WARRANTY, OUT_OF_WARRANTY, EXPIRED, CONTRACT_COVERED |

#### FaultCode / FaultCodeModifier
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `fault_codes` / `fault_code_modifiers` | |
| Reference entities for fault classification |

#### TargetTime / TargetTimeLine
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `target_times` / `target_time_lines` | |
| Standard time targets for service operations |
| TargetTimeLine FK to TargetTime (cascade) |

---

## 4. Enum Reference

### 4.1 System Module

| Enum | Values | @@map |
|------|--------|-------|
| VatType | STANDARD, REDUCED, ZERO, EXEMPT, OUTSIDE_SCOPE, REVERSE_CHARGE, SECOND_HAND | (none) |
| ViewScope | PERSONAL, ROLE, GLOBAL | (none) |
| DocumentType | SALES_INVOICE, CREDIT_NOTE, CASH_RECEIPT, PROFORMA_INVOICE, CUSTOMER_STATEMENT, SALES_ORDER, SALES_QUOTE, DELIVERY_NOTE, PURCHASE_ORDER, GOODS_RECEIPT_NOTE, SUPPLIER_REMITTANCE, PAYSLIP, P45, P60 | (none) |

### 4.2 Finance / GL

| Enum | Values | @@map |
|------|--------|-------|
| AccountType | ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE | (none) |
| NormalBalance | DEBIT, CREDIT | (none) |
| AccountMappingType | AR_CONTROL, AP_CONTROL, STOCK, STOCK_COST, STOCK_VARIANCE, SALES_REVENUE, PURCHASE_EXPENSE, VAT_OUTPUT, VAT_INPUT, EXCHANGE_GAIN, EXCHANGE_LOSS, ROUNDING, BANK_CHARGES, DISCOUNT_GIVEN, DISCOUNT_RECEIVED, INTEREST_INCOME, INTEREST_EXPENSE, DEPRECIATION_EXPENSE, ACCUMULATED_DEPRECIATION, ASSET_DISPOSAL_GAIN, ASSET_DISPOSAL_LOSS, WIP, PRODUCTION_OVERHEAD, PAYROLL_EXPENSE, PAYROLL_LIABILITY, RETENTION, CASH_IN_TRANSIT, POS_CLEARING | (none) |
| JournalSource | MANUAL, AR_INVOICE, AR_CREDIT_NOTE, AR_PAYMENT, AP_BILL, AP_CREDIT_NOTE, AP_PAYMENT, BANK_PAYMENT, BANK_RECEIPT, BANK_TRANSFER, STOCK_MOVEMENT, STOCK_REVALUATION, GOODS_RECEIPT, SHIPMENT, DEPRECIATION, PAYROLL, PRODUCTION, VAT_ADJUSTMENT, YEAR_END, OPENING_BALANCE, POS_CASHUP | (none) |
| JournalStatus | DRAFT, POSTED, REVERSED | (none) |
| PeriodStatus | OPEN, CLOSED, LOCKED | (none) |
| BankImportSource | CSV, OFX, QIF, OPEN_BANKING, MANUAL | (none) |
| ReconciliationMatchStatus | UNMATCHED, MATCHED, RECONCILED | (none) |
| ReconciliationStatus | IN_PROGRESS, COMPLETED | (none) |
| BudgetStatus | DRAFT, APPROVED, LOCKED | (none) |
| BudgetType | REVENUE, EXPENSE, CAPITAL, FULL | (none) |

### 4.3 Inventory

| Enum | Values | @@map |
|------|--------|-------|
| ItemType | STOCK, SERVICE, NON_STOCK, KIT | `item_type` |
| CostingMethod | FIFO, WEIGHTED_AVERAGE, STANDARD, LAST_PURCHASE | `costing_method` |
| StockMovementType | GOODS_RECEIPT, GOODS_ISSUE, TRANSFER_IN, TRANSFER_OUT, ADJUSTMENT_IN, ADJUSTMENT_OUT, RETURN_IN, RETURN_OUT, PRODUCTION_IN, PRODUCTION_OUT, OPENING_BALANCE, SCRAP | `stock_movement_type` |
| StockMovementStatus | DRAFT, POSTED, REVERSED | `stock_movement_status` |
| StockMovementSourceType | PURCHASE_ORDER, SALES_ORDER, MANUAL, PRODUCTION, TRANSFER, RETURN | `stock_movement_source_type` |
| SerialNumberStatus | AVAILABLE, RESERVED, SOLD, RETURNED, QUARANTINE | `serial_number_status` |

### 4.4 Sales Ledger (AR)

| Enum | Values | @@map |
|------|--------|-------|
| CustomerType | COMPANY, INDIVIDUAL | `customer_type` |
| AddressType | BILLING, SHIPPING, REGISTERED, OTHER | `address_type` |
| InvoiceType | STANDARD, CASH, CREDIT_NOTE, DEBIT_NOTE, PROFORMA | `invoice_type` |
| InvoiceStatus | DRAFT, APPROVED, POSTED, CANCELLED, VOID | `invoice_status` |
| PaymentMethod | BANK_TRANSFER, CARD, CASH, CHEQUE, DIRECT_DEBIT | `payment_method` |
| PaymentStatus | DRAFT, POSTED, CANCELLED | `payment_status` |

### 4.5 Sales Orders

| Enum | Values | @@map |
|------|--------|-------|
| SalesQuoteStatus | DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED, CONVERTED, CANCELLED | `sales_quote_status` |
| SalesOrderStatus | DRAFT, APPROVED, IN_PROGRESS, PARTIALLY_SHIPPED, FULLY_SHIPPED, PARTIALLY_INVOICED, FULLY_INVOICED, CLOSED, CANCELLED | `sales_order_status` |
| SalesOrderLineStatus | OPEN, PARTIALLY_FULFILLED, FULFILLED, CANCELLED | `sales_order_line_status` |
| DispatchStatus | DRAFT, PICKED, PACKED, SHIPPED, DELIVERED, CANCELLED | `dispatch_status` |

### 4.6 Purchasing (AP)

| Enum | Values | @@map |
|------|--------|-------|
| SupplierType | COMPANY, INDIVIDUAL | (none) |
| SupplierStatus | ACTIVE, ON_HOLD, BLOCKED, TERMINATED | (none) |
| PurchaseOrderStatus | DRAFT, APPROVED, SENT, PARTIALLY_RECEIVED, FULLY_RECEIVED, PARTIALLY_INVOICED, FULLY_INVOICED, CLOSED, CANCELLED | (none) |
| PurchaseOrderLineStatus | OPEN, PARTIALLY_RECEIVED, RECEIVED, CANCELLED | (none) |
| GoodsReceiptStatus | DRAFT, POSTED, CANCELLED | (none) |
| SupplierBillStatus | DRAFT, APPROVED, POSTED, PARTIALLY_PAID, PAID, CANCELLED | (none) |
| MatchStatus | UNMATCHED, PARTIALLY_MATCHED, FULLY_MATCHED | (none) |
| SupplierPaymentStatus | DRAFT, APPROVED, SENT, COMPLETED, CANCELLED | (none) |
| PaymentMethod (AP) | BACS, BANK_TRANSFER, CHEQUE, DIRECT_DEBIT, CARD | (none) |
| BacsRunStatus | DRAFT, APPROVED, SUBMITTED, COMPLETED, FAILED | (none) |

### 4.7 Fixed Assets

| Enum | Values | @@map |
|------|--------|-------|
| DepreciationMethodType | STRAIGHT_LINE, DECLINING_BALANCE, UNITS_OF_PRODUCTION, SUM_OF_YEARS_DIGITS | `depreciation_method_type` |
| FixedAssetStatus | ACTIVE, FULLY_DEPRECIATED, DISPOSED, WRITTEN_OFF, UNDER_CONSTRUCTION | `fixed_asset_status` |
| DisposalType | SALE, SCRAP, WRITE_OFF, TRADE_IN | `disposal_type` |
| AssetTransactionType | ACQUISITION, DEPRECIATION, TRANSFER, REVALUATION, DISPOSAL, ADJUSTMENT | `asset_transaction_type` |
| DepreciationEntryStatus | DRAFT, POSTED | `depreciation_entry_status` |
| AssetDisposalStatus | DRAFT, APPROVED, POSTED, CANCELLED | `asset_disposal_status` |
| AssetTransferStatus | DRAFT, APPROVED, POSTED, CANCELLED | `asset_transfer_status` |

### 4.8 Pricing

| Enum | Values | @@map |
|------|--------|-------|
| PriceType | FIXED, QUANTITY_BREAK, CUSTOMER_SPECIFIC | `price_type` |
| FormulaBaseSource | COST_PRICE, SALES_PRICE_1, SALES_PRICE_2, SALES_PRICE_3, LAST_PURCHASE_PRICE, WEIGHTED_AVERAGE, BASE_PRICE_LIST | `formula_base_source` |
| RebateType | PERCENTAGE, FIXED_AMOUNT, TIERED | `rebate_type` |

### 4.9 Cross-Cutting

| Enum | Values | @@map |
|------|--------|-------|
| NoteType | GENERAL, INTERNAL, CUSTOMER_VISIBLE, SYSTEM | `note_type` |
| RecordLinkType | CREATED_FROM, FULFILLS, PAYMENT_FOR, CREDIT_FOR, RELATES_TO, PARENT_CHILD | `record_link_type` |
| ApprovalScopeType | PER_RECORD, PER_LINE | `approval_scope_type` |
| ApproverType | SPECIFIC_USER, ROLE, DEPARTMENT_MANAGER, CUSTOM | `approver_type` |
| ApprovalStatus | PENDING, APPROVED, REJECTED, CANCELLED, ESCALATED, FORWARDED | `approval_status` |
| ActivityType | MEETING, CALL, EMAIL, TODO, NOTE, FOLLOW_UP, WORK_HOURS | `activity_type` |
| ActivityStatus | PLANNED, IN_PROGRESS, COMPLETED, CANCELLED | `activity_status` |
| ActivityPriority | LOW, NORMAL, HIGH, URGENT | `activity_priority` |

### 4.10 CRM

| Enum | Values | @@map |
|------|--------|-------|
| CrmLeadRating | NONE, COLD, WARM, HOT | `crm_lead_rating` |
| CrmLeadLifecycle | NEW, CONTACTED, QUALIFIED, UNQUALIFIED, CONVERTED, LOST | `crm_lead_lifecycle` |
| CrmCampaignStatus | DRAFT, ACTIVE, COMPLETED, CANCELLED | `crm_campaign_status` |
| CrmCampaignRecipientType | LEAD, CUSTOMER | `crm_campaign_recipient_type` |
| CrmOpportunityStatus | OPEN, WON, LOST, CANCELLED | `crm_opportunity_status` |
| CrmPipelineEntityType | LEAD, OPPORTUNITY, ACTIVITY, SALES_QUOTE, SALES_ORDER | `crm_pipeline_entity_type` |
| CrmActivityAutoTrigger | SALES_ORDER_CREATED, SALES_ORDER_APPROVED, INVOICE_POSTED, PAYMENT_RECEIVED, OPPORTUNITY_WON, OPPORTUNITY_LOST, LEAD_CONVERTED, EMAIL_SENT, EMAIL_RECEIVED | `crm_activity_auto_trigger` |

### 4.11 HR & Payroll

| Enum | Values | @@map |
|------|--------|-------|
| EmployeeStatus | ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED, RETIRED | `employee_status` |
| Gender | MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY | `gender` |
| MaritalStatus | SINGLE, MARRIED, CIVIL_PARTNERSHIP, DIVORCED, WIDOWED, SEPARATED, OTHER | `marital_status` |
| SalaryFrequency | MONTHLY, YEARLY, WEEKLY, FORTNIGHTLY, HOURLY | `salary_frequency` |
| ContractStatus | DRAFT, APPROVED, TERMINATED | `contract_status` |
| TerminationReason | RESIGNATION, NON_RENEWAL, DISMISSAL_OPERATIONAL, DISMISSAL_MISCONDUCT, DISMISSAL_INCAPACITY, DISMISSAL_RETIREMENT, DEATH, TRANSFER_DEPARTMENT, TRANSFER_COUNTRY, END_OF_INTERNSHIP, TRIAL_PERIOD_FAILED, DISMISSAL_NON_PERFORMANCE, REDUNDANCY, MUTUAL_AGREEMENT | `termination_reason` |
| ContractChangeReason | NEW, PROMOTION, TRANSFER, DEMOTION, SALARY_REVIEW, ROLE_CHANGE, DEPARTMENT_CHANGE, OTHER | `contract_change_reason` |
| BenefitFrequency | ONE_OFF, WEEKLY, FORTNIGHTLY, MONTHLY, QUARTERLY, YEARLY | `benefit_frequency` |
| JobPositionStatus | OPENING, VACANT, FILLED, CANCELLED | `job_position_status` |
| ChecklistType | ONBOARDING, OFFBOARDING, OTHER | `checklist_type` |
| ChecklistItemStatus | PENDING, IN_PROGRESS, COMPLETED, NOT_APPLICABLE | `checklist_item_status` |
| AppraisalStatus | DRAFT, APPROVED | `appraisal_status` |
| SkillsEvalStatus | DRAFT, APPROVED, TERMINATED | `skills_eval_status` |
| TrainingStatus | SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, CLOSED | `training_status` |
| LeaveType | ANNUAL, SICK, MATERNITY, PATERNITY, SHARED_PARENTAL, ADOPTION, BEREAVEMENT, COMPASSIONATE, JURY_SERVICE, UNPAID, STUDY, OTHER | `leave_type` |
| LeaveRequestStatus | PENDING, APPROVED, REJECTED, CANCELLED, TAKEN | `leave_request_status` |
| LeaveCalculationBase | CALENDAR_DAYS, WORKING_HOURS | `leave_calculation_base` |
| TaxBasis | CUMULATIVE, WEEK1_MONTH1, EMERGENCY | `tax_basis` |
| NICategory | A, B, C, F, H, I, J, L, M, S, V, Z | `ni_category` |
| StudentLoanPlan | PLAN_1, PLAN_2, PLAN_4, PLAN_5, POSTGRADUATE | `student_loan_plan` |
| StatutoryPayType | SSP, SMP, SPP, ShPP, SAP, SPBP | `statutory_pay_type` |
| PensionSchemeType | DEFINED_CONTRIBUTION, DEFINED_BENEFIT, NEST, SMART_PENSION, OTHER | `pension_scheme_type` |
| PensionEnrolmentStatus | ELIGIBLE_JOBHOLDER, NON_ELIGIBLE_JOBHOLDER, ENTITLED_WORKER, ENROLLED, OPTED_IN, OPTED_OUT, CEASED_MEMBERSHIP | `pension_enrolment_status` |
| PensionContributionMethod | RELIEF_AT_SOURCE, NET_PAY | `pension_contribution_method` |
| PayrollRunStatus | DRAFT, CALCULATED, REVIEWED, APPROVED, PAID, POSTED, CANCELLED | `payroll_run_status` |
| PayrollFrequency | WEEKLY, FORTNIGHTLY, FOUR_WEEKLY, MONTHLY | `payroll_frequency` |
| PayrollLineType | GROSS_PAY, OVERTIME, BONUS, COMMISSION, ALLOWANCE, BENEFIT_IN_KIND, SALARY_SACRIFICE, PAYE_TAX, EMPLOYEE_NI, EMPLOYER_NI, STUDENT_LOAN, POSTGRAD_LOAN, EMPLOYEE_PENSION, EMPLOYER_PENSION, SSP, SMP, SPP, ShPP, SAP, SPBP, ATTACHMENT_OF_EARNINGS, COURT_ORDER, OTHER_DEDUCTION, OTHER_ADDITION, NET_PAY | `payroll_line_type` |
| HMRCSubmissionType | FPS, EPS, EARLIER_YEAR_UPDATE, P45, P46 | `hmrc_submission_type` |
| HMRCSubmissionStatus | DRAFT, GENERATED, SUBMITTED, ACCEPTED, REJECTED, ERROR | `hmrc_submission_status` |

### 4.12 Production / MRP

| Enum | Values | @@map |
|------|--------|-------|
| ProductionOrderStatus | CREATED, RELEASED, STARTED, FINISHED, CANCELLED | `production_order_status` |
| ProductionStatus | CREATED, STARTED, FINISHED, CANCELLED, FINISHED_DISCARDED | `production_status` |
| ProductionOperationStatus | CREATED, STARTED, FINISHED, CANCELLED, FINISHED_DISCARDED | `production_operation_status` |
| ProductionPlanStatus | DRAFT, APPROVED, CLOSED | `production_plan_status` |
| ProductionPlanPeriodType | MONTHLY, WEEKLY | `production_plan_period_type` |
| ProductionPlanLineType | NORMAL, SUBRECIPE | `production_plan_line_type` |
| RecipeLineDirection | INPUT, OUTPUT | `recipe_line_direction` |
| ProductionGlMode | FROM_PRODUCTION, FROM_OPERATIONS | `production_gl_mode` |
| QuantityMode | PER_UNIT, ABSOLUTE | `quantity_mode` |
| ProductionPlanGenerationMode | DIRECT_PRODUCTION, VIA_PRODUCTION_ORDER | `production_plan_generation_mode` |

### 4.13 POS

| Enum | Values | @@map |
|------|--------|-------|
| POSTerminalStatus | ACTIVE, INACTIVE, MAINTENANCE | `pos_terminal_status` |
| POSSessionStatus | OPEN, CLOSED | `pos_session_status` |
| POSSaleStatus | IN_PROGRESS, SUSPENDED, COMPLETED, VOIDED | `pos_sale_status` |
| POSSaleType | SALE, RETURN | `pos_sale_type` |
| POSSaleLineStatus | ACTIVE, VOIDED | `pos_sale_line_status` |
| POSPaymentMethodType | CASH, CREDIT_CARD, DEBIT_CARD, GIFT_VOUCHER, CHEQUE, ON_ACCOUNT, LOYALTY_POINTS, MOBILE_PAYMENT, QR_PAYMENT, OTHER | `pos_payment_method_type` |
| POSCashMovementType | CASH_IN, CASH_OUT, WRITE_OFF | `pos_cash_movement_type` |
| POSCashupStatus | DRAFT, COMPLETED, POSTED | `pos_cashup_status` |
| POSJournalAction | ADD_ITEM, VOID_ITEM, DELETE_ITEM, CHANGE_PRICE, CHANGE_QUANTITY, APPLY_DISCOUNT, PAYMENT_CASH, PAYMENT_CARD, PAYMENT_OTHER, FINISH_SALE, VOID_SALE, PRINT_RECEIPT, PRINT_RECEIPT_COPY, PRINT_X_REPORT, PRINT_Z_REPORT, OPEN_DRAWER, OPEN_SESSION, CLOSE_SESSION, LOGIN, LOGOUT, RETURN_ITEM, RETURN_SALE, SUSPEND_SALE, RESUME_SALE, TRANSFER_TO_INVOICE, CASH_IN, CASH_OUT, PRICE_LOOKUP, STARTUP, SHUTDOWN | `pos_journal_action` |
| POSButtonActionType | (40+ values covering item selection, payment, transaction control, navigation, modifiers, session/cash, reports, customer, transfers, printing) | `pos_button_action_type` |

### 4.14 Projects & Job Costing

| Enum | Values | @@map |
|------|--------|-------|
| ProjectStatus | DRAFT, ACTIVE, ON_HOLD, COMPLETED, CANCELLED, ARCHIVED | `project_status` |
| ProjectBillingMethod | TIME_AND_MATERIALS, FIXED_PRICE, NON_BILLABLE | `project_billing_method` |
| ProjectTaskStatus | NOT_STARTED, IN_PROGRESS, COMPLETED, CANCELLED | `project_task_status` |
| TimesheetStatus | DRAFT, SUBMITTED, APPROVED, REJECTED | `timesheet_status` |
| ProjectExpenseStatus | DRAFT, SUBMITTED, APPROVED, REJECTED, INVOICED | `project_expense_status` |
| ProjectTransactionSourceType | TIMESHEET, VENDOR_INVOICE, EXPENSE, GOODS_RECEIPT, ACTIVITY, PURCHASE_ORDER, MANUAL | `project_transaction_source_type` |
| ProjectTransactionStatus | PENDING, APPROVED, INVOICED, WRITTEN_OFF | `project_transaction_status` |
| ProjectRateType | ROLE, EMPLOYEE, ITEM, TASK | `project_rate_type` |
| ProjectInvoiceScheduleStatus | PENDING, INVOICED, CANCELLED | `project_invoice_schedule_status` |

### 4.15 Contracts & Agreements

| Enum | Values | @@map |
|------|--------|-------|
| AgreementStatus | DRAFT, ACTIVE, CLOSED, CANCELLED | `agreement_status` |
| AgreementInvoiceBase | PER_CHARGE, PER_LINE, PER_AGREEMENT | `agreement_invoice_base` |
| AgreementInvoiceGrouping | PER_AGREEMENT, PER_CUSTOMER, SPLIT_BY_SITE | `agreement_invoice_grouping` |
| ChargePeriodType | DAYS, MONTHS, FIXED | `charge_period_type` |
| BankHolidayHandling | IGNORE, EXCLUDE_GLOBAL, EXCLUDE_BY_COUNTRY | `bank_holiday_handling` |
| AgreementChargeCategory | RENTAL, CONSUMABLE | `agreement_charge_category` |
| AgreementChargeStatus | UNINVOICED, INVOICED | `agreement_charge_status` |
| OffHireStatus | DRAFT, CONFIRMED, CANCELLED | `off_hire_status` |
| ContractStatus (Agreements) | DRAFT, ACTIVE, RENEWED, CANCELLED, EXPIRED | `contract_status` |
| ContractPeriodType | DAYS, MONTHS | `contract_period_type` |
| LoanAgreementStatus | NEW, APPROVED, SIGNED, ACTIVE, DISBURSED, PAUSED, CANCELLED, FINISHED | `loan_agreement_status` |
| LoanScheduleType | ANNUITY, LINEAR, LINEAR_EQUAL, BULLET | `loan_schedule_type` |
| LoanInterestRateMethod | MONTHLY, ANNUAL | `loan_interest_rate_method` |
| LoanDayCountConvention | THIRTY_360, ACTUAL | `loan_day_count_convention` |
| LoanScheduleRowType | INVOICE, CREDIT_INVOICE, BUYOUT, DISBURSEMENT | `loan_schedule_row_type` |

### 4.16 Warehouse Management

| Enum | Values | @@map |
|------|--------|-------|
| BinPositionStatus | FREE, OCCUPIED, RESERVED, ERROR | `bin_position_status` |
| ForkliftSystemMode | NONE, SEMI_AUTOMATED, FULL_CONFIRMATION | `forklift_system_mode` |
| ForkliftTaskType | MANUAL_PICK, DELIVERY, STOCK_MOVEMENT | `forklift_task_type` |
| ForkliftTaskStatus | PENDING, SENT, IN_PROGRESS, COMPLETED, ERROR, WAITING_CONVEYOR | `forklift_task_status` |
| ForkliftTaskPriority | DEFAULT, EXPRESS, EXPRESS_DELIVERY | `forklift_task_priority` |
| PickingListStatus | DRAFT, IN_PROGRESS, COMPLETED, CANCELLED | `picking_list_status` |
| PickingLineStatus | PENDING, PICKED, SHORT_PICKED, CANCELLED | `picking_line_status` |

### 4.17 Intercompany & Consolidation

| Enum | Values | @@map |
|------|--------|-------|
| IntercompanyRuleDirection | DEBIT, CREDIT | `intercompany_rule_direction` |
| IntercompanyTransactionStatus | INITIATED, TARGET_PENDING, TARGET_POSTED, COMPLETED, FAILED, COMPENSATED, CANCELLED | `intercompany_transaction_status` |
| IntercompanyTransactionType | NL_MIRROR, PO_TO_SO, INVOICE_MIRROR | `intercompany_transaction_type` |
| ConsolidationMemberStatus | ACTIVE, SUSPENDED, REMOVED | `consolidation_member_status` |
| EliminationOutputType | JOURNAL, SIMULATION | `elimination_output_type` |
| ConsolidationRunStatus | IN_PROGRESS, COMPLETED, FAILED | `consolidation_run_status` |
| SharedRegisterType | CUSTOMER, SUPPLIER, ITEM, CHART_OF_ACCOUNT | `shared_register_type` |
| IntercompanySupplierMode | NONE, DEFAULT, INTERNAL | `intercompany_supplier_mode` |

### 4.18 Communications

| Enum | Values | @@map |
|------|--------|-------|
| ChatChannelType | DIRECT, GROUP, AI_ASSISTANT | `chat_channel_type` |
| EmailMessageStatus | DRAFT, SENT, QUEUED, FAILED, BOUNCED | `email_message_status` |
| EmailRecipientType | FROM, TO, CC, BCC | `email_recipient_type` |
| EmailRecipientStatus | UNREAD, READ, DELETED, ARCHIVED | `email_recipient_status` |
| EmailQueueStatus | PENDING, PROCESSING, SENT, FAILED, RETRYING | `email_queue_status` |
| EmailDirection | INBOUND, OUTBOUND | `email_direction` |
| ConferenceRoomType | DISCUSSION, ANNOUNCEMENTS, KNOWLEDGE_BASE | `conference_room_type` |
| ConferenceAccessLevel | FULL, READ_WRITE, READ_ONLY, NONE | `conference_access_level` |
| NotificationChannel | IN_APP, EMAIL, PUSH | `notification_channel` |
| NotificationPriority | LOW, NORMAL, HIGH, URGENT | `notification_priority` |
| NotificationStatus | PENDING, DELIVERED, READ, DISMISSED, FAILED | `notification_status` |

### 4.19 Service Orders & Timekeeper

| Enum | Values | @@map |
|------|--------|-------|
| ServiceOrderStatus | DRAFT, OPEN, IN_PROGRESS, ON_HOLD, COMPLETED, INVOICED, CANCELLED | `service_order_status` |
| ServiceLineItemType | PLAIN, INVOICEABLE, WARRANTY, CONTRACT | `service_line_item_type` |
| ServiceLineItemKind | MAIN_ITEM, SUB_ITEM | `service_line_item_kind` |
| WorkOrderStatus | OPEN, IN_PROGRESS, CLOSED | `work_order_status` |
| WorkSheetStatus | DRAFT, SUBMITTED, APPROVED, INVOICED, REJECTED | `work_sheet_status` |
| WarrantyStatus | UNKNOWN, UNDER_WARRANTY, OUT_OF_WARRANTY, EXPIRED, CONTRACT_COVERED | `warranty_status` |

---

## 5. Cross-Module Relationship Map

### Key Inter-Module Foreign Key Relationships

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

---

## 6. Common Patterns

### 6.1 Polymorphic Linking (entityType + entityId)

Used by models that can attach to any entity across the system:

| Model | Pattern | Usage |
|-------|---------|-------|
| **Attachment** | entityType + entityId | File attachments on any record |
| **Note** | entityType + entityId | Notes/comments on any record |
| **RecordLink** | sourceEntityType/Id + targetEntityType/Id | Links between any two records |
| **ApprovalRequest** | entityType + entityId | Approval workflow on any approvable record |
| **Activity** | entityType + entityId | Calendar/task activities linked to any record |

The `entityType` is a string like `"customer"`, `"invoice"`, `"employee"` -- not an enum, allowing any module to use these models without schema changes.

### 6.2 Number Series Integration

Documents use auto-generated sequential numbers:
- `CustomerInvoice.invoiceNumber`
- `SalesOrder.orderNumber`
- `SalesQuote.quoteNumber`
- `PurchaseOrder.orderNumber`
- `JournalEntry.entryNumber`
- `Customer.customerNumber`
- `Supplier.supplierNumber`
- `Employee.employeeNumber`
- `FixedAsset.assetCode`
- `IntercompanyRule.code`

All use unique constraints and are generated via the Number Series service (configurable prefix + sequential counter with concurrent-safe allocation).

### 6.3 Soft Delete Pattern

**Reference entities** use `isActive Boolean @default(true)`:
- Customer, Supplier, InventoryItem, Warehouse, ItemGroup, BankAccount, Currency, Country, Department, PaymentTerms, VatCode, Tag, ShippingMethod, all CRM reference entities, etc.
- Query pattern: LOV/dropdown queries filter `isActive = true`; list/search queries include inactive with visual indicator.

**Transactional entities** use status enums instead of soft delete:
- JournalEntry: DRAFT / POSTED / REVERSED
- CustomerInvoice: DRAFT / APPROVED / POSTED / CANCELLED / VOID
- StockMovement: DRAFT / POSTED / REVERSED
- AuditLog: Append-only, never modified or deleted

### 6.4 Self-Referential Hierarchies

| Model | Relation Name | Purpose |
|-------|--------------|---------|
| ChartOfAccount | "AccountHierarchy" | Parent-child account tree |
| ItemGroup | "ItemGroupHierarchy" | Item group nesting |
| AssetGroup | "AssetGroupHierarchy" | Asset group nesting |
| ProjectTask | "TaskHierarchy" | WBS task breakdown |
| ConsolidationMember | "MemberHierarchy" | Company ownership structure |
| ConferenceRoom | "ConferenceHierarchy" | Room/folder nesting |
| Employee | "EmployeeManager" | Reporting hierarchy |
| Activity | "ActivityRecurrence" | Recurring activity chain |
| ChatMessage | "ChatMessageThread" | Message threading |
| ProductionOperation | "OperationPartialCompletion" | Split operations |
| JournalEntry | "JournalReversal" | Reversal linkage |
| StockMovement | "StockMovementReversal" | Reversal linkage |
| PriceList | "PriceListReplacement" | Replacement chain |
| EmploymentContract | "ContractRenewal" | Contract renewal chain |
| Customer | "BillToParent" | Bill-to consolidation |
| POSSale | "SaleReturn" | Return against original sale |
| UnitOfMeasure | "UomConversion" | UoM conversion chain |

### 6.5 JSON Custom Fields Pattern

Several models use `Json @db.JsonB` fields for flexible, schema-less data:
- `SavedView.columns / filters / sorting` -- user view configuration
- `InventoryItem.customFields` -- tenant-defined item attributes
- `Customer.customFields` -- tenant-defined customer attributes
- `SystemSetting.value` -- serialised configuration values

### 6.6 Audit Trail Fields

Standard audit fields on most models:
```
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
createdBy   String                    // User ID (on transactional entities)
updatedBy   String                    // User ID (on transactional entities)
```

Financial transactional entities also track:
```
postedAt    DateTime?                 // When status changed to POSTED
postedBy    String?                   // User who posted
```

### 6.7 Multi-Currency Pattern

Transactional entities that support foreign currencies include:
```
currencyCode    String    @default("GBP")   // Transaction currency
exchangeRate    Decimal?  @db.Decimal(18,8)  // Rate at transaction date
baseAmount      Decimal?                     // Amount in base currency
```

Used by: CustomerInvoice, SupplierBill, SalesOrder, PurchaseOrder, BankTransaction, etc.

---

*End of Data Models Reference*

---

## Validation Report

**Validation Date:** 2026-02-16
**Validator:** Claude Opus 4.6 (automated cross-check agent)
**Sources Checked:** 18 arch-section files (2.13--2.30), data-models.md sections 1--6

### Verdict: PASS (all warnings resolved 2026-02-16)

### Summary Metrics

| Metric | Result |
|--------|--------|
| Arch-section files validated | 18/18 |
| Unique models in arch-sections (2.13--2.30) | 222 (224 declarations minus 2 extensions in 2.27) |
| Models documented in data-models.md (sections 3.2--3.19) | 222 (all present) |
| System module models (2.8--2.12, not in arch-sections) | 12 (documented from architecture.md) |
| Enums in arch-sections (unique) | ~165 (170 declarations minus 5 duplicates/extensions) |
| Enums documented in data-models.md (section 4) | 170 (corrected from 119) |
| Field spot-checks performed | 6 models |
| Relationship spot-checks performed | 6 relationships |
| Critical issues | 0 |
| Warnings | 0 (8 original, all resolved) |
| Info items | 5 |

### Model Coverage (Check 1) -- PASS

Every `model` declaration found in arch-sections 2.13 through 2.30 has a corresponding entry in data-models.md Section 3. No models are missing. The 2.27 `StockMovement` and `InventoryItem` declarations are correctly treated as field extensions of the 2.14 originals (not separate models). The `ContractClass` model appearing in both 2.22 (HR) and 2.26 (Agreements) is correctly noted in data-models.md line 1399 as a name collision with different tables.

### Enum Coverage (Check 2) -- PASS

All enum declarations from the arch-sections have corresponding entries in data-models.md Section 4.

**W-01 (RESOLVED):** Extended enum values `WORK_HOURS` (ActivityType), `POS_CLEARING` (AccountMappingType), and `POS_CASHUP` (JournalSource) have been added to both Section 4 enum tables and inline model references.

**W-02 (RESOLVED):** Overview total enum count corrected from 119 to 170.

### Field Accuracy Spot-Checks (Check 3) -- PASS

**Checked Models:**

1. **ChartOfAccount (2.13)** -- Accurate. Fields `code`, `name`, `accountType`, `normalBalance`, `parentCode`, `classificationId`, `isActive` all match. Relations to `parent/children`, `classification`, `journalLines`, `bankAccount`, `budgetLines` correctly documented. The arch-section includes additional fields (`isPostable`, `isControl`, `isBankAccount`, `isSystemAccount`, `taxCode`, `departmentCode`, `currencyCode`, `openingBalance`, `currentBalance`) not individually listed in data-models.md but implicitly covered.

2. **CustomerInvoice (2.15)** -- **W-03 (RESOLVED):** Field names corrected to `subtotal / vatAmount / totalAmount` matching the arch-section Prisma definitions. The arch-section also includes `discountAmount`, `discountPercent`, `paidAmount`, `outstandingAmount`, `journalEntryId`, `salesOrderId`, `quotationId`, `customerReference`, and control flags (`isExported`, `isDisputed`, `noInterest`, `noReminder`) which are summarised rather than listed individually.

3. **SalesOrder (2.16)** -- **W-04 (RESOLVED):** Field names corrected to `subtotal / vatAmount / totalAmount` matching the arch-section Prisma definitions.

4. **InventoryItem (2.14)** -- **W-05 (RESOLVED):** Field names corrected to `sellingPrice1/sellingPrice2/sellingPrice3` matching the arch-section Prisma definitions. The `~50+ typed fields` note is reasonable given the arch has approximately 45 explicitly typed fields.

5. **Employee (2.22)** -- Accurate. Key fields (`employeeNumber`, `status`, `gender`, `maritalStatus`, `managerId`) all match. Self-referential relation (`EmployeeManager`) correctly documented. The `~30+ typed fields` note is conservative; the arch has approximately 40+ fields.

6. **Recipe (2.23)** -- Accurate. Fields `code`, `name`, `defaultRoutingId`, `isActive` match. Relations to `defaultRouting`, `lines`, `productionOrders`, `productions` correctly documented.

### Relationship Consistency (Check 4) -- PASS

The cross-module relationship map in Section 5 was spot-checked against 6 FK relationships:

1. **CustomerInvoice -> Customer (customerId)** -- Correct.
2. **PurchaseOrder -> Supplier (supplierId)** -- Correct.
3. **JournalLine -> ChartOfAccount (accountCode)** -- Correct.
4. **ProductionOrder -> Recipe + Routing + Machine** -- Correct.
5. **ForkliftTask -> BinPosition (fromPositionId, toPositionId) + Forklift** -- Correct.
6. **POSSale -> POSSession + POSTerminal** -- Correct.

No broken or incorrect relationships found in spot-check.

### Naming Convention Compliance (Check 5) -- PASS

- **UUID primary keys:** Verified across all spot-checked models. Exception for `Currency` (natural key `code`) and `Country` (natural key `code`) correctly noted in Overview.
- **`@@map("snake_case")` table naming:** Verified in all arch-section models checked.
- **Audit fields:** `createdAt`, `updatedAt`, `createdBy`, `updatedBy` present on all transactional models checked.
- **`Decimal(19,4)` for monetary fields:** Verified on CustomerInvoice (`subtotal`, `vatAmount`, `totalAmount`), SalesOrder, InventoryItem pricing fields, Employee payroll fields. All use `@db.Decimal(19, 4)`.

### Common Patterns Accuracy (Check 6) -- PASS

All 7 common patterns described in Section 6 were verified:

1. **Polymorphic Linking (6.1):** Correctly identifies Attachment, Note, RecordLink, ApprovalRequest, Activity as using `entityType + entityId`. Confirmed in arch-section 2.20.
2. **Number Series (6.2):** Listing of number-series fields is accurate.
3. **Soft Delete (6.3):** `isActive` pattern on reference entities and status enums on transactional entities correctly described.
4. **Self-Referential Hierarchies (6.4):** All 16 self-referential relations listed match the arch-sections. Relation names (e.g., "AccountHierarchy", "EmployeeManager") are correct.
5. **JSON Custom Fields (6.5):** Correct.
6. **Audit Trail Fields (6.6):** Correct, including `postedAt`/`postedBy` for financial entities.
7. **Multi-Currency Pattern (6.7):** Correct.

### Warnings Summary

All 8 warnings have been resolved (2026-02-16):

| ID | Severity | Status | Description |
|----|----------|--------|-------------|
| W-01 | Medium | RESOLVED | Added `WORK_HOURS` to ActivityType, `POS_CLEARING` to AccountMappingType, `POS_CASHUP` to JournalSource |
| W-02 | Low | RESOLVED | Total enum count corrected from 119 to 170 |
| W-03 | Medium | RESOLVED | CustomerInvoice field names corrected to `subtotal/vatAmount/totalAmount` |
| W-04 | Medium | RESOLVED | SalesOrder field names corrected to `subtotal/vatAmount/totalAmount` |
| W-05 | Low | RESOLVED | InventoryItem field names corrected to `sellingPrice1/sellingPrice2/sellingPrice3` |
| W-06 | Low | RESOLVED | Summary table model counts corrected for 9 rows (Fixed Assets 8, CRM 16, HR 36, Production 23, Contracts 13, Warehouse 9, Intercompany 11, Communications 15, Service Orders 11) |
| W-07 | Low | RESOLVED | Total model count corrected from 195 to 234 |
| W-08 | Low | RESOLVED | Inline count notes corrected: JournalSource 21 values, POSJournalAction 30 values, LeaveType 12 values |

### Info / Suggestions

| ID | Description |
|----|-------------|
| I-01 | Consider adding a "Field Extensions" subsection to Warehouse Management (3.16) documenting the WMS fields added to StockMovement and InventoryItem from section 2.27 |
| I-02 | The ContractClass model name collision between HR (2.22) and Agreements (2.26) is correctly noted but could benefit from noting the distinct `@@map` table names (`contract_classes` in 2.26 vs. the HR version) to avoid implementation confusion |
| I-03 | The PaymentMethod enum appears in both AR (2.15) and AP (2.17) with different values (AR: BANK_TRANSFER, CARD, CASH, CHEQUE, DIRECT_DEBIT; AP: BACS, BANK_TRANSFER, CHEQUE, DIRECT_DEBIT, CARD). Data-models.md correctly documents them as separate but could note they are distinct enums |
| I-04 | ContractStatus enum also appears in both HR (2.22) and Agreements (2.26) with different values. Data-models.md correctly documents them separately with "(Agreements)" suffix |
| I-05 | The document could benefit from an index/glossary of all 168 enums with their source section for quick lookup during implementation |

---

## 5. Platform Database Models (Section 2.31)

> **IMPORTANT:** These models live in a **separate database** from the ERP tenant databases. They are defined in `apps/platform-api/prisma/schema.prisma`, NOT in the tenant Prisma schema. The Platform database is central (not per-tenant) and holds cross-tenant operational data.

### Tenant
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tenants` | Central tenant registry |
| **PK** | `id` UUID | |
| code | String(50) | Unique slug, e.g. "acme-ltd" |
| displayName | String | Trading name |
| legalName | String? | Registered legal name |
| status | TenantStatus | PROVISIONING, ACTIVE, SUSPENDED, READ_ONLY, ARCHIVED |
| planId | String | FK to Plan |
| billingStatus | BillingStatus | CURRENT, GRACE, OVERDUE, BLOCKED |
| region | String(30) | Default "uk-south" |
| dbHost, dbName, dbPort | String/Int | Tenant database connection metadata |
| sandboxEnabled | Boolean | Default false |
| lastActivityAt | DateTime? | Last user activity in tenant |
| **Relations** | plan, moduleOverrides[], featureFlags[], aiQuota, aiUsageRecords[], billing, impersonations[] |

### Plan
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `plans` | Subscription plan catalogue |
| **PK** | `id` UUID | |
| code | String(30) | Unique: core, pro, enterprise, custom |
| displayName | String | |
| maxUsers | Int | User seat limit |
| maxCompanies | Int | Company limit per tenant |
| monthlyAiTokenAllowance | BigInt | Monthly AI token budget |
| aiHardLimit | Boolean | Default true — blocks AI at 100% |
| enabledModules | Json (JsonB) | String array of module keys |
| apiRateLimit | Int | Default 1000 req/min |
| **Relations** | tenants[] |

### TenantModuleOverride
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tenant_module_overrides` | Per-tenant module on/off |
| **PK** | `id` UUID | |
| tenantId | String | FK to Tenant |
| moduleKey | String(50) | e.g. "manufacturing" |
| enabled | Boolean | |
| reason, changedBy, changedAt | | Audit fields |
| **Unique** | [tenantId, moduleKey] | |

### TenantFeatureFlag
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tenant_feature_flags` | Per-tenant feature toggles |
| **PK** | `id` UUID | |
| tenantId | String | FK to Tenant |
| featureKey | String(100) | |
| enabled | Boolean | |
| changedBy, changedAt | | Audit fields |
| **Unique** | [tenantId, featureKey] | |

### TenantAiUsage
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tenant_ai_usage` | Per-call AI usage records (append-only) |
| **PK** | `id` UUID | |
| tenantId | String | FK to Tenant |
| userId | String(100) | Tenant user ID or "system" |
| featureKey | String(100) | "chat", "document_processing", "forecasting", etc. |
| model | String(100) | LLM model ID |
| promptTokens | Int | |
| completionTokens | Int | |
| totalTokens | Int | |
| costEstimate | Decimal(10,6) | Unit price snapshot at call time |
| requestId | String(100) | Unique trace ID |
| timestamp | DateTime (Timestamptz) | UTC |
| **Indexes** | [tenantId, timestamp], [tenantId, featureKey] | |

### TenantAiQuota
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tenant_ai_quotas` | Rolling quota tracking per tenant |
| **PK** | `id` UUID | |
| tenantId | String | Unique FK to Tenant |
| periodStart, periodEnd | Date | Current billing period |
| tokensUsed | BigInt | Running total, default 0 |
| tokenAllowance | BigInt | From plan or override |
| softLimitPct | Int | Default 80 |
| hardLimitPct | Int | Default 100 |
| burstAllowance | BigInt? | Optional burst buffer |

### TenantBilling
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tenant_billing` | Billing/payment state per tenant |
| **PK** | `id` UUID | |
| tenantId | String | Unique FK to Tenant |
| stripeCustomerId | String? | Stripe integration (Phase 2) |
| subscriptionStatus | String?(30) | |
| currentPeriodEnd | DateTime? | |
| gracePeriodDays | Int | Default 14 |
| lastPaymentAt | DateTime? | |
| dunningLevel | Int | 0-3 |
| enforcementAction | EnforcementAction | NONE, WARNING, READ_ONLY, SUSPENDED |

### PlatformUser
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `platform_users` | Super Admin accounts (vendor staff only) |
| **PK** | `id` UUID | |
| email | String | Unique |
| passwordHash | String | Argon2id |
| displayName | String | |
| role | PlatformRole | PLATFORM_ADMIN, PLATFORM_VIEWER |
| mfaEnabled | Boolean | Default false (must be true for PLATFORM_ADMIN) |
| mfaSecret | String? | TOTP secret |
| isActive | Boolean | |
| **Relations** | auditLogs[], impersonations[] |

### PlatformAuditLog
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `platform_audit_log` | Immutable audit trail for all platform admin actions |
| **PK** | `id` UUID | |
| platformUserId | String | FK to PlatformUser |
| action | String(100) | e.g. "tenant.suspend", "impersonation.start" |
| targetType | String?(50) | "tenant", "plan", "platform_user" |
| targetId | String? | |
| details | Json? (JsonB) | Action-specific payload |
| ipAddress | String(45) | |
| userAgent | String?(500) | |
| timestamp | DateTime (Timestamptz) | UTC |
| **Indexes** | [platformUserId, timestamp], [targetType, targetId] | |

### ImpersonationSession
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `impersonation_sessions` | Time-limited support access sessions |
| **PK** | `id` UUID | |
| platformUserId | String | FK to PlatformUser |
| tenantId | String | FK to Tenant |
| reason | String | Mandatory justification |
| startedAt | DateTime | |
| endedAt | DateTime? | Null while active |
| expiresAt | DateTime | Hard time limit |
| actionsLog | Json? (JsonB) | Array of actions during session |
| **Indexes** | [tenantId, startedAt] | |

### Platform Enums

| Enum | Values | Used By |
|------|--------|---------|
| TenantStatus | PROVISIONING, ACTIVE, SUSPENDED, READ_ONLY, ARCHIVED | Tenant.status |
| BillingStatus | CURRENT, GRACE, OVERDUE, BLOCKED | Tenant.billingStatus |
| EnforcementAction | NONE, WARNING, READ_ONLY, SUSPENDED | TenantBilling.enforcementAction |
| PlatformRole | PLATFORM_ADMIN, PLATFORM_VIEWER | PlatformUser.role |
