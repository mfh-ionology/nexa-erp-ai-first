# 3. Module-by-Module Models

---

## 3.1 System Module (Sections 2.8--2.12)

### CompanyProfile
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

### Currency
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

### ExchangeRate
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

### Country
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `countries` | |
| **PK** | `code` String(2) | Natural key, ISO 3166-1 alpha-2 |
| iso3Code | String(3) | ISO 3166-1 alpha-3 |
| name | String | |
| defaultCurrencyCode | String?(3) | FK to Currency |
| region | String? | EU, EEA, Rest of World |
| isActive | Boolean | |

### Department
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `departments` | |
| **PK** | `id` UUID | |
| code | String | Unique, e.g. "FIN", "SALES" |
| name | String | |
| costCentre | String? | GL cost centre code |
| managerId | String? | FK to User |
| isActive | Boolean | |

### PaymentTerms
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

### VatCode
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

### Tag
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tags` | |
| **PK** | `id` UUID | |
| code | String | e.g. "PREMIUM" |
| tagType | String | "customer", "item", "order", "general" |
| color | String | Hex colour |
| **Unique** | [code, tagType] | |

### BankHoliday
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

### SystemSetting
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `system_settings` | |
| **PK** | `id` UUID | |
| key | String | Unique, e.g. "invoice.autoApproveBelow" |
| value | String | JSON-serialised |
| valueType | String | STRING, NUMBER, BOOLEAN, JSON |
| category | String | "general", "finance", "ar", etc. |

### DataView (List Page Registry)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `data_views` | |
| **PK** | `id` UUID | |
| companyId | UUID | FK → CompanyProfile, tenant scoping |
| viewKey | String(50) | Unique per company, e.g. `INVOICES`, `CUSTOMERS`, `ENQUIRIES` |
| viewName | String(100) | Display name |
| entityTable | String(100) | Prisma model name |
| idField | String(50) | Primary key field name |
| defaultSortField | String(50) | Default sort column |
| defaultSortDir | String(4) | `ASC` / `DESC` |
| isActive | Boolean | Soft delete |
| **Unique** | [companyId, viewKey] | |
| **Relations** | fields → DataViewField[], savedViews → SavedView[] | |

### DataViewField (Master Column & Filter Metadata)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `data_view_fields` | |
| **PK** | `id` UUID | |
| dataViewId | UUID | FK → DataView |
| fieldKey | String(100) | e.g. `invoiceNumber`, `customerName` |
| fieldLabel | String(100) | Display label |
| fieldType | FieldDataType (enum) | `STRING`, `NUMBER`, `DATE`, `BOOLEAN`, `ENUM`, `CURRENCY` |
| defaultVisible | Boolean | Shown by default |
| defaultOrder | Int | Default column position |
| defaultWidth | Int | Default pixel width |
| sortable | Boolean | Can sort by this field |
| filterable | Boolean | Appears in Simple Filter |
| advancedFilterOnly | Boolean | Only in Advanced Filter |
| pinnable | Boolean | Can be pinned L/R |
| lovType | LovType (enum) | `NONE`, `STATIC`, `GLOBAL`, `VIEW_SPECIFIC` |
| lovScope | String?(50) | API endpoint or Zustand store key |
| lovStaticValues | Json? (JSONB) | Inline values for STATIC type, e.g. `[{value, label}]` |
| lovDependsOn | String?(100) | Parent field key for dependent LOVs |
| lovSearchMin | Int | Default 0; character threshold for server-side search |
| isActive | Boolean | Soft delete |
| **Indexes** | `@@index([dataViewId, defaultOrder])` | |
| **Relations** | dataView → DataView, userColumnPreferences → UserColumnPreference[], savedViewConditions → SavedViewCondition[] | |

### DateRangePreset
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `date_range_presets` | |
| **PK** | `id` UUID | |
| companyId | UUID | FK → CompanyProfile |
| presetKey | String(30) | e.g. `today`, `thisweek`, `ytd`, `custom` |
| presetName | String(50) | Display name |
| orderInList | Int | Sort order |
| isActive | Boolean | |
| **Unique** | [companyId, presetKey] | |
| **Seed Data** | 20 presets | CUSTOM RANGE, Today, Yesterday, Tomorrow, Last 3/7/30 days, Next 7/30 days, This/Last/Next Week/Month/Year, MTD, YTD |

### UserColumnPreference
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `user_column_preferences` | |
| **PK** | `id` UUID | |
| userId | UUID | FK → User |
| dataViewFieldId | UUID | FK → DataViewField |
| visible | Boolean | Column visible |
| displayOrder | Int | Column position |
| width | Int | Pixel width (set by drag-resizing on table) |
| pinned | PinPosition (enum) | `NONE`, `LEFT`, `RIGHT` |
| **Unique** | [userId, dataViewFieldId] | |
| **Relations** | user → User, dataViewField → DataViewField | |

### SavedView
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `saved_views` | |
| **PK** | `id` UUID | |
| companyId | UUID | FK → CompanyProfile |
| dataViewId | UUID | FK → DataView |
| name | String(100) | View name |
| groupName | String(100) | Category grouping (e.g. "Invoices", "Sales", "Logistics") |
| scope | ViewScope (enum) | PERSONAL, ROLE, GLOBAL |
| roleId | UUID? | FK → AccessGroup; populated when scope = ROLE |
| createdBy | UUID | FK → User |
| isFavourite | Boolean | Shows in ★ header favourites dropdown |
| favouriteOrder | Int | Default 0; ordering within favourites |
| isDefault | Boolean | Auto-apply on page load |
| filterLogic | String(3) | Top-level `AND` / `OR` |
| sortConfig | Json (JSONB) | `[{field, direction, priority}]` |
| columnConfig | Json (JSONB) | `[{fieldId, visible, order, width, pinned}]` |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| **Unique** | [companyId, dataViewId, createdBy, name] | |
| **Indexes** | `@@index([companyId, dataViewId, scope])`, partial: `WHERE is_favourite = true`, partial: `WHERE is_default = true` | |
| **Relations** | company → CompanyProfile, dataView → DataView, creator → User, role → AccessGroup?, conditions → SavedViewCondition[] | |

### SavedViewCondition
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `saved_view_conditions` | |
| **PK** | `id` UUID | |
| savedViewId | UUID | FK → SavedView |
| dataViewFieldId | UUID | FK → DataViewField |
| operator | FilterOperator (enum) | `EQUALS`, `NOT_EQUALS`, `CONTAINS`, `STARTS_WITH`, `ENDS_WITH`, `GT`, `GTE`, `LT`, `LTE`, `BETWEEN`, `IN`, `NOT_IN`, `IS_EMPTY`, `IS_NOT_EMPTY` |
| value | Text? | Serialised single value |
| valueList | Json? (JSONB) | For multi-value (`IN` operator) |
| datePresetId | UUID? | FK → DateRangePreset (for date fields) |
| groupId | Int | Default 0; bracket group number |
| groupLogic | String(3) | Logic within group (`AND`/`OR`) |
| outerLogic | String(3) | Logic between groups (`AND`/`OR`) |
| conditionOrder | Int | Display order |
| **Indexes** | `@@index([savedViewId, conditionOrder])` | |
| **Relations** | savedView → SavedView, dataViewField → DataViewField, datePreset → DateRangePreset? | |

### Resource
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `resources` | |
| **PK** | `id` UUID | |
| code | String | UNIQUE, dot-notation key (e.g. "sales.orders.list") |
| name | String | Human-readable display name ("Sales Orders") |
| module | String | Module grouping ("sales", "finance", "system") |
| type | ResourceType (enum) | PAGE, REPORT, SETTING, MAINTENANCE |
| parentCode | String? | FK → Resource.code (detail → list relationship) |
| sortOrder | Int | Default 0, display order in admin UI and navigation |
| icon | String? | Icon key for navigation rendering |
| description | String? | Help text for admin UI and AI context |
| isActive | Boolean | Default true, soft-disable without deleting |
| **Indexes** | `@@unique([code])`, `@@index([module, sortOrder])` | |
| **Relations** | parent → Resource (self), children → Resource[] (self), permissions → AccessGroupPermission[], fieldOverrides → AccessGroupFieldOverride[] | |

### AccessGroup
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `access_groups` | |
| **PK** | `id` UUID | |
| companyId | UUID | FK → CompanyProfile.id, company scope |
| code | String | Unique per company (e.g. "SALES_MGR") |
| name | String | Display name ("Sales Manager") |
| description | String? | Description of this group's purpose |
| isSystem | Boolean | Default false; pre-built groups (can't be deleted, can be modified) |
| isActive | Boolean | Default true, soft-delete |
| createdBy | String | Audit |
| updatedBy | String | Audit |
| **Indexes** | `@@unique([companyId, code])` | |
| **Relations** | company → CompanyProfile, permissions → AccessGroupPermission[], fieldOverrides → AccessGroupFieldOverride[], userAccessGroups → UserAccessGroup[] | |

### AccessGroupPermission
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `access_group_permissions` | |
| **PK** | `id` UUID | |
| accessGroupId | UUID | FK → AccessGroup.id |
| resourceCode | String | FK → Resource.code |
| canAccess | Boolean | Default false; can the user see this page/resource? |
| canNew | Boolean | Default false; can create new records |
| canView | Boolean | Default false; can view/open existing records |
| canEdit | Boolean | Default false; can modify existing records |
| canDelete | Boolean | Default false; can delete records |
| **Indexes** | `@@unique([accessGroupId, resourceCode])` | |
| **Relations** | accessGroup → AccessGroup, resource → Resource | |

### AccessGroupFieldOverride
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `access_group_field_overrides` | |
| **PK** | `id` UUID | |
| accessGroupId | UUID | FK → AccessGroup.id |
| resourceCode | String | FK → Resource.code |
| fieldPath | String | Field identifier (e.g. "costPrice") |
| visibility | FieldVisibility (enum) | VISIBLE, READ_ONLY, HIDDEN |
| **Indexes** | `@@unique([accessGroupId, resourceCode, fieldPath])` | |
| **Relations** | accessGroup → AccessGroup, resource → Resource | |

### UserAccessGroup
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `user_access_groups` | |
| **PK** | `id` UUID | |
| userId | UUID | FK → User.id |
| accessGroupId | UUID | FK → AccessGroup.id |
| companyId | UUID | FK → CompanyProfile.id |
| assignedBy | String | Who assigned this (audit) |
| **Indexes** | `@@unique([userId, accessGroupId, companyId])` | |
| **Relations** | user → User, accessGroup → AccessGroup, company → CompanyProfile | |

### DocumentTemplate
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

### DocumentTemplateVersion
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

## 3.2 Finance / GL Module (Section 2.13)

### ChartOfAccount
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

### AccountClassification
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `account_classifications` | |
| **PK** | `id` UUID | |
| code / name | String | Unique classification |
| **Relations** | accounts | ChartOfAccount[] |

### AccountMapping
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `account_mappings` | |
| **PK** | `id` UUID | |
| mappingType | AccountMappingType (enum) | 28 mapping types (AR_CONTROL, AP_CONTROL, STOCK, POS_CLEARING, etc.) |
| accountCode | String | FK to ChartOfAccount |
| departmentId | String? | Optional department scope |

### FinancialPeriod
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `financial_periods` | |
| **PK** | `id` UUID | |
| name / code | String | e.g. "2026-01" |
| startDate / endDate | Date | |
| status | PeriodStatus (enum) | OPEN, CLOSED, LOCKED |
| fiscalYear | Int | |
| **Relations** | journalEntries, budgetLines |

### JournalEntry
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

### JournalLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `journal_lines` | |
| **PK** | `id` UUID | |
| journalEntryId | String | FK to JournalEntry (cascade delete) |
| accountCode | String | FK to ChartOfAccount |
| debitAmount / creditAmount | Decimal | |
| description | String? | |
| **Relations** | journalEntry, account |

### BankAccount
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

### BankTransaction
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

### BankReconciliation
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `bank_reconciliations` | |
| **PK** | `id` UUID | |
| bankAccountId | String | FK to BankAccount |
| status | ReconciliationStatus (enum) | IN_PROGRESS, COMPLETED |
| statementBalance / reconciledBalance | Decimal | |
| **Relations** | bankAccount, lines |

### BankReconciliationLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `bank_reconciliation_lines` | |
| reconciliationId | String | FK to BankReconciliation (cascade) |
| bankTransactionId | String | FK to BankTransaction |
| matchedJournalLineId | String? | FK to JournalLine |
| **Relations** | reconciliation, bankTransaction, matchedJournalLine |

### Budget
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `budgets` | |
| **PK** | `id` UUID | |
| name | String | |
| budgetType | BudgetType (enum) | REVENUE, EXPENSE, CAPITAL, FULL |
| status | BudgetStatus (enum) | DRAFT, APPROVED, LOCKED |
| **Relations** | lines |

### BudgetLine
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

## 3.3 Inventory Module (Section 2.14)

### ItemGroup
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `item_groups` | |
| **PK** | `id` UUID | |
| code / name | String | Unique |
| parentGroupId | String? | Self-referential hierarchy |
| isActive | Boolean | |
| **Relations** | parentGroup/childGroups (self), items |

### Warehouse
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `warehouses` | |
| **PK** | `id` UUID | |
| code / name | String | Unique |
| addressLine1, city, postcode | String? | Location |
| isActive | Boolean | |
| **Relations** | defaultForItems, stockMovements, stockBalances |

### InventoryItem
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

### StockMovement
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

### StockBalance
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `stock_balances` | |
| **PK** | `id` UUID | |
| itemId | String | FK to InventoryItem |
| warehouseId | String | FK to Warehouse |
| onHand / reserved / available | Decimal | Stock quantities |
| **Relations** | item, warehouse |

### SerialNumber
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `serial_numbers` | |
| **PK** | `id` UUID | |
| itemId | String | FK to InventoryItem |
| serialNumber | String | |
| status | SerialNumberStatus (enum) | AVAILABLE, RESERVED, SOLD, RETURNED, QUARANTINE |
| warehouseId | String? | FK to Warehouse |
| **Relations** | item, warehouse |

### UnitOfMeasure
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `units_of_measure` | |
| **PK** | `id` UUID | |
| code / name | String | |
| baseUomId | String? | Self-ref FK for conversion chains |
| conversionFactor | Decimal? | |
| **Relations** | baseUom/derivedUoms (self) |

---

## 3.4 Sales Ledger / AR Module (Section 2.15)

### Customer
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

### CustomerAddress
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `customer_addresses` | |
| customerId | String | FK to Customer |
| addressType | AddressType (enum) | BILLING, SHIPPING, REGISTERED, OTHER |
| **Relations** | customer |

### CustomerContact
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `customer_contacts` | |
| customerId | String | FK to Customer |
| **Relations** | customer |

### CustomerInvoice
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

### CustomerInvoiceLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `customer_invoice_lines` | |
| invoiceId | String | FK to CustomerInvoice (cascade) |
| **Relations** | invoice |

### CustomerPayment
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `customer_payments` | |
| **PK** | `id` UUID | |
| customerId | String | FK to Customer |
| paymentMethod | PaymentMethod (enum) | BANK_TRANSFER, CARD, CASH, CHEQUE, DIRECT_DEBIT |
| status | PaymentStatus (enum) | DRAFT, POSTED, CANCELLED |
| amount | Decimal | |
| **Relations** | customer, allocations |

### PaymentAllocation
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `payment_allocations` | |
| paymentId | String | FK to CustomerPayment |
| invoiceId | String | FK to CustomerInvoice |
| amount | Decimal | |
| **Relations** | payment, invoice |

---

## 3.5 Sales Orders Module (Section 2.16)

### SalesQuote
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `sales_quotes` | |
| **PK** | `id` UUID | |
| quoteNumber | String | Unique |
| status | SalesQuoteStatus (enum) | DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED, CONVERTED, CANCELLED |
| customerId | String | FK to Customer |
| validUntil | Date | |
| **Relations** | lines |

### SalesQuoteLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `sales_quote_lines` | |
| quoteId | String | FK to SalesQuote (cascade) |
| **Relations** | quote |

### SalesOrder
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `sales_orders` | |
| **PK** | `id` UUID | |
| orderNumber | String | Unique |
| status | SalesOrderStatus (enum) | DRAFT through CANCELLED (9 values) |
| customerId | String | FK to Customer |
| subtotal / vatAmount / totalAmount | Decimal | |
| **Relations** | lines, dispatches |

### SalesOrderLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `sales_order_lines` | |
| orderId | String | FK to SalesOrder (cascade) |
| lineStatus | SalesOrderLineStatus (enum) | OPEN, PARTIALLY_FULFILLED, FULFILLED, CANCELLED |
| **Relations** | order |

### Dispatch
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `dispatches` | |
| **PK** | `id` UUID | |
| salesOrderId | String | FK to SalesOrder |
| status | DispatchStatus (enum) | DRAFT, PICKED, PACKED, SHIPPED, DELIVERED, CANCELLED |
| **Relations** | salesOrder, lines |

### DispatchLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `dispatch_lines` | |
| dispatchId | String | FK to Dispatch (cascade) |
| salesOrderLineId | String | FK to SalesOrderLine |
| **Relations** | dispatch, salesOrderLine |

### ShippingMethod
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `shipping_methods` | |
| **PK** | `id` UUID | |
| code / name | String | |
| isActive | Boolean | |

---

## 3.6 Purchasing / AP Module (Section 2.17)

### Supplier
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `suppliers` | |
| **PK** | `id` UUID | |
| supplierNumber | String | Unique |
| supplierType | SupplierType (enum) | COMPANY, INDIVIDUAL |
| status | SupplierStatus (enum) | ACTIVE, ON_HOLD, BLOCKED, TERMINATED |
| isActive | Boolean | |
| **Relations** | purchaseOrders, bills, payments |

### PurchaseOrder
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `purchase_orders` | |
| **PK** | `id` UUID | |
| orderNumber | String | Unique |
| supplierId | String | FK to Supplier |
| status | PurchaseOrderStatus (enum) | DRAFT through CANCELLED (9 values) |
| **Relations** | supplier, lines, goodsReceipts, bills |

### PurchaseOrderLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `purchase_order_lines` | |
| orderId | String | FK to PurchaseOrder |
| lineStatus | PurchaseOrderLineStatus (enum) | OPEN, PARTIALLY_RECEIVED, RECEIVED, CANCELLED |
| **Relations** | order |

### GoodsReceipt
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `goods_receipts` | |
| **PK** | `id` UUID | |
| purchaseOrderId | String? | FK to PurchaseOrder |
| supplierId | String | FK to Supplier |
| status | GoodsReceiptStatus (enum) | DRAFT, POSTED, CANCELLED |
| **Relations** | purchaseOrder, supplier, lines |

### GoodsReceiptLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `goods_receipt_lines` | |
| goodsReceiptId | String | FK to GoodsReceipt |
| purchaseOrderLineId | String? | FK to PurchaseOrderLine |
| **Relations** | goodsReceipt, purchaseOrderLine |

### SupplierBill
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `supplier_bills` | |
| **PK** | `id` UUID | |
| supplierId | String | FK to Supplier |
| purchaseOrderId | String? | FK to PurchaseOrder |
| status | SupplierBillStatus (enum) | DRAFT, APPROVED, POSTED, PARTIALLY_PAID, PAID, CANCELLED |
| matchStatus | MatchStatus (enum) | UNMATCHED, PARTIALLY_MATCHED, FULLY_MATCHED |
| **Relations** | supplier, purchaseOrder, lines, paymentAllocations |

### SupplierBillLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `supplier_bill_lines` | |
| billId | String | FK to SupplierBill |
| purchaseOrderLineId | String? | FK to PurchaseOrderLine |
| **Relations** | bill, purchaseOrderLine |

### SupplierPayment
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `supplier_payments` | |
| **PK** | `id` UUID | |
| supplierId | String | FK to Supplier |
| bacsRunId | String? | FK to BacsRun |
| status | SupplierPaymentStatus (enum) | DRAFT, APPROVED, SENT, COMPLETED, CANCELLED |
| paymentMethod | PaymentMethod (enum) | BACS, BANK_TRANSFER, CHEQUE, DIRECT_DEBIT, CARD |
| **Relations** | supplier, bacsRun, allocations |

### SupplierPaymentAllocation
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `supplier_payment_allocations` | |
| paymentId | String | FK to SupplierPayment |
| billId | String | FK to SupplierBill |
| **Relations** | payment, bill |

### BacsRun
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `bacs_runs` | |
| **PK** | `id` UUID | |
| status | BacsRunStatus (enum) | DRAFT, APPROVED, SUBMITTED, COMPLETED, FAILED |
| **Relations** | payments (SupplierPayment[]) |

---

## 3.7 Fixed Assets Module (Section 2.18)

### DepreciationMethod
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `depreciation_methods` | |
| **PK** | `id` UUID | |
| code / name | String | Unique |
| methodType | DepreciationMethodType (enum) | STRAIGHT_LINE, DECLINING_BALANCE, UNITS_OF_PRODUCTION, SUM_OF_YEARS_DIGITS |
| **Relations** | bookAssets, fiscalAssets (FixedAsset[]) |

### AssetGroup
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `asset_groups` | |
| **PK** | `id` UUID | |
| parentGroupId | String? | Self-referential hierarchy |
| **Relations** | parentGroup/childGroups (self), assets |

### AssetClass
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `asset_classes` | |
| **PK** | `id` UUID | |
| code / name | String | Unique |
| **Relations** | assets (FixedAsset[]) |

### FixedAsset
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

### DepreciationEntry
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `depreciation_entries` | |
| fixedAssetId | String | FK to FixedAsset |
| status | DepreciationEntryStatus (enum) | DRAFT, POSTED |
| **Relations** | fixedAsset |

### AssetDisposal
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `asset_disposals` | |
| fixedAssetId | String | FK to FixedAsset |
| disposalType | DisposalType (enum) | SALE, SCRAP, WRITE_OFF, TRADE_IN |
| status | AssetDisposalStatus (enum) | DRAFT, APPROVED, POSTED, CANCELLED |
| **Relations** | fixedAsset |

### AssetTransfer
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `asset_transfers` | |
| fixedAssetId | String | FK to FixedAsset |
| status | AssetTransferStatus (enum) | DRAFT, APPROVED, POSTED, CANCELLED |
| **Relations** | fixedAsset |

### AssetTransaction
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `asset_transactions` | |
| fixedAssetId | String | FK to FixedAsset |
| transactionType | AssetTransactionType (enum) | ACQUISITION, DEPRECIATION, TRANSFER, REVALUATION, DISPOSAL, ADJUSTMENT |
| **Relations** | fixedAsset |

---

## 3.8 Pricing Module (Section 2.19)

### PriceList
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `price_lists` | |
| **PK** | `id` UUID | |
| code / name | String | |
| replacementPriceListId | String? | Self-ref FK for replacement chain |
| isActive | Boolean | |
| **Relations** | replacementPriceList/replacedByLists (self), entries |

### PriceListEntry
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `price_list_entries` | |
| priceListId | String | FK to PriceList |
| priceType | PriceType (enum) | FIXED, QUANTITY_BREAK, CUSTOMER_SPECIFIC |
| **Relations** | priceList, quantityBreaks |

### QuantityBreak
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `quantity_breaks` | |
| priceListEntryId | String | FK to PriceListEntry (cascade) |
| **Relations** | priceListEntry |

### Rebate
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `rebates` | |
| **PK** | `id` UUID | |
| rebateType | RebateType (enum) | PERCENTAGE, FIXED_AMOUNT, TIERED |
| **Relations** | tiers |

### RebateTier
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `rebate_tiers` | |
| rebateId | String | FK to Rebate (cascade) |
| **Relations** | rebate |

---

## 3.9 Cross-Cutting Module (Section 2.20)

### Attachment (Polymorphic)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `attachments` | |
| **PK** | `id` UUID | |
| entityType | String | e.g. "customer", "invoice", "employee" |
| entityId | String | UUID of the related entity |
| fileName / mimeType / fileSize / storageUrl | String / Int | |

### Note (Polymorphic)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `notes` | |
| **PK** | `id` UUID | |
| entityType | String | Polymorphic entity type |
| entityId | String | |
| noteType | NoteType (enum) | GENERAL, INTERNAL, CUSTOMER_VISIBLE, SYSTEM |

### RecordLink (Polymorphic)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `record_links` | |
| **PK** | `id` UUID | |
| sourceEntityType / sourceEntityId | String | Source entity |
| targetEntityType / targetEntityId | String | Target entity |
| linkType | RecordLinkType (enum) | CREATED_FROM, FULFILLS, PAYMENT_FOR, CREDIT_FOR, RELATES_TO, PARENT_CHILD |

### ApprovalRule
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `approval_rules` | |
| **PK** | `id` UUID | |
| entityType | String | Which entity type requires approval |
| scopeType | ApprovalScopeType (enum) | PER_RECORD, PER_LINE |
| **Relations** | levels (ApprovalRuleLevel[]), requests |

### ApprovalRuleLevel
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `approval_rule_levels` | |
| approvalRuleId | String | FK to ApprovalRule (cascade) |
| approverType | ApproverType (enum) | SPECIFIC_USER, ROLE, DEPARTMENT_MANAGER, CUSTOM |
| **Relations** | approvalRule |

### ApprovalRequest (Polymorphic)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `approval_requests` | |
| **PK** | `id` UUID | |
| entityType / entityId | String | Polymorphic |
| approvalRuleId | String | FK to ApprovalRule |
| approvalRuleLevelId | String | FK to ApprovalRuleLevel |
| status | ApprovalStatus (enum) | PENDING, APPROVED, REJECTED, CANCELLED, ESCALATED, FORWARDED |
| **Relations** | approvalRule, approvalRuleLevel |

### Activity
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

## 3.10 CRM Module (Section 2.21)

**Reference Entities (6):** CrmLeadStatus, CrmLeadSource, CrmIndustry, CrmMediaType, CrmOpportunityClass, CrmActivityType, CrmActivityTypeGroup -- all follow the standard reference entity pattern with `id`, `code`, `name`, `isActive`.

### CrmLead
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

### CrmCampaign
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `crm_campaigns` | |
| **PK** | `id` UUID | |
| mediaTypeId | String? | FK to CrmMediaType |
| status | CrmCampaignStatus (enum) | DRAFT, ACTIVE, COMPLETED, CANCELLED |
| **Relations** | mediaType, recipients, opportunities |

### CrmCampaignRecipient
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `crm_campaign_recipients` | |
| campaignId | String | FK to CrmCampaign (cascade) |
| leadId | String? | FK to CrmLead |
| recipientType | CrmCampaignRecipientType (enum) | LEAD, CUSTOMER |
| **Relations** | campaign, lead |

### CrmOpportunity
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `crm_opportunities` | |
| **PK** | `id` UUID | |
| classId | String? | FK to CrmOpportunityClass |
| leadId | String? | FK to CrmLead |
| campaignId | String? | FK to CrmCampaign |
| status | CrmOpportunityStatus (enum) | OPEN, WON, LOST, CANCELLED |
| **Relations** | class, lead, campaign, stageLogs |

### CrmOpportunityStageLog
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `crm_opportunity_stage_logs` | |
| opportunityId | String | FK to CrmOpportunity (cascade) |
| **Relations** | opportunity |

### CrmPipelineView / CrmPipelineColumn
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `crm_pipeline_views` / `crm_pipeline_columns` | |
| CrmPipelineView.entityType | CrmPipelineEntityType (enum) | LEAD, OPPORTUNITY, ACTIVITY, SALES_QUOTE, SALES_ORDER |
| CrmPipelineColumn.viewId | String | FK to CrmPipelineView (cascade) |

### CrmActivityAutoRule
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `crm_activity_auto_rules` | |
| activityTypeId | String | FK to CrmActivityType |
| trigger | CrmActivityAutoTrigger (enum) | 9 trigger types |
| **Relations** | activityType |

### CrmModuleSetting
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `crm_module_settings` | |
| Singleton config entity for CRM module settings | |

---

## 3.11 HR & Payroll Module (Section 2.22)

**Reference Entities (5):** JobTitle, ContractClass, ContractType, ResidencyType, PaymentType -- standard pattern.

### Employee
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

### EmploymentContract
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `employment_contracts` | |
| employeeId | String | FK to Employee |
| status | ContractStatus (enum) | DRAFT, APPROVED, TERMINATED |
| salaryFrequency | SalaryFrequency (enum) | MONTHLY, YEARLY, WEEKLY, FORTNIGHTLY, HOURLY |
| previousContractId | String? | Self-ref FK for renewal chain |
| **Relations** | employee, previousContract/renewedContracts (self), changes, benefits |

### ContractChange
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `contract_changes` | |
| contractId | String | FK to EmploymentContract |
| reason | ContractChangeReason (enum) | NEW, PROMOTION, TRANSFER, DEMOTION, etc. |
| **Relations** | contract |

### ContractBenefit
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `contract_benefits` | |
| contractId | String | FK to EmploymentContract (cascade) |
| benefitTypeId | String | FK to BenefitType |
| frequency | BenefitFrequency (enum) | ONE_OFF through YEARLY |
| **Relations** | contract, benefitType |

### PerformanceAppraisal
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `performance_appraisals` | |
| employeeId | String | FK to Employee ("AppraisalEmployee") |
| reviewerId | String | FK to Employee ("AppraisalReviewer") |
| status | AppraisalStatus (enum) | DRAFT, APPROVED |
| **Relations** | employee, reviewer, lines |

### SkillsEvaluation
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `skills_evaluations` | |
| employeeId | String | FK to Employee |
| status | SkillsEvalStatus (enum) | DRAFT, APPROVED, TERMINATED |
| **Relations** | employee, lines |

### Checklist
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `checklists` | |
| employeeId | String | FK to Employee |
| checklistType | ChecklistType (enum) | ONBOARDING, OFFBOARDING, OTHER |
| **Relations** | employee, items |

### JobPosition
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `job_positions` | |
| status | JobPositionStatus (enum) | OPENING, VACANT, FILLED, CANCELLED |
| **Relations** | incumbents (PositionIncumbent[]) |

### TrainingPlan
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `training_plans` | |
| employeeId | String | FK to Employee ("TraineeEmployee") |
| trainerId | String? | FK to Employee ("TrainerEmployee") |
| status | TrainingStatus (enum) | SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, CLOSED |
| **Relations** | employee, trainer |

### LeaveEntitlement / LeaveRequest / LeaveBalance
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `leave_entitlements` / `leave_requests` / `leave_balances` | |
| All FK to Employee | |
| LeaveRequest.status | LeaveRequestStatus (enum) | PENDING, APPROVED, REJECTED, CANCELLED, TAKEN |
| LeaveType (enum) | 12 values | ANNUAL through OTHER |

### TaxYearConfig
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tax_year_configs` | |
| **PK** | `id` UUID | |
| UK tax year config: PAYE thresholds, NI thresholds, student loan thresholds, pension rates | |

### PensionEnrolment
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `pension_enrolments` | |
| employeeId | String | FK to Employee |
| status | PensionEnrolmentStatus (enum) | 7 values |
| schemeType | PensionSchemeType (enum) | 5 values |
| contributionMethod | PensionContributionMethod (enum) | RELIEF_AT_SOURCE, NET_PAY |
| **Relations** | employee, taxYearConfig |

### PayrollRun
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `payroll_runs` | |
| **PK** | `id` UUID | |
| taxYearConfigId | String | FK to TaxYearConfig |
| status | PayrollRunStatus (enum) | DRAFT, CALCULATED, REVIEWED, APPROVED, PAID, POSTED, CANCELLED |
| frequency | PayrollFrequency (enum) | WEEKLY, FORTNIGHTLY, FOUR_WEEKLY, MONTHLY |
| **Relations** | taxYearConfig, lines, hmrcSubmissions, payslips |

### PayrollLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `payroll_lines` | |
| payrollRunId | String | FK to PayrollRun (cascade) |
| employeeId | String | FK to Employee |
| lineType | PayrollLineType (enum) | 25 values (GROSS_PAY through NET_PAY) |
| **Relations** | payrollRun, employee |

### StatutoryPayment
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `statutory_payments` | |
| employeeId | String | FK to Employee |
| payType | StatutoryPayType (enum) | SSP, SMP, SPP, ShPP, SAP, SPBP |
| **Relations** | employee |

### HMRCSubmission
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `hmrc_submissions` | |
| payrollRunId | String? | FK to PayrollRun |
| submissionType | HMRCSubmissionType (enum) | FPS, EPS, EARLIER_YEAR_UPDATE, P45, P46 |
| status | HMRCSubmissionStatus (enum) | DRAFT, GENERATED, SUBMITTED, ACCEPTED, REJECTED, ERROR |
| **Relations** | payrollRun |

### PayslipDocument
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `payslip_documents` | |
| payrollRunId | String | FK to PayrollRun |
| employeeId | String | FK to Employee |
| **Relations** | payrollRun, employee |

### HrModuleSetting
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `hr_module_settings` | |
| Singleton config entity for HR module | |

---

## 3.12 Production / MRP Module (Section 2.23)

### Recipe (BOM Template)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `recipes` | |
| **PK** | `id` UUID | |
| code / name | String | Unique |
| defaultRoutingId | String? | FK to Routing |
| **Relations** | defaultRouting, lines, productionOrders, productions |

### RecipeLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `recipe_lines` | |
| recipeId | String | FK to Recipe (cascade) |
| direction | RecipeLineDirection (enum) | INPUT, OUTPUT |
| **Relations** | recipe |

### Routing / RoutingStep
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `routings` / `routing_steps` | |
| RoutingStep FK to Routing (cascade), optional FK to StandardOperation, Machine, MachineGroup |

### StandardOperation / StandardOperationMaterial
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `standard_operations` / `standard_operation_materials` | |
| StandardOperation has defaultMachine, defaultMachineGroup FKs |

### Machine / MachineGroup / MachineShift / MachineSwitchTime / MachineItemDefault
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `machines` / `machine_groups` / `machine_shifts` / `machine_switch_times` / `machine_item_defaults` | |
| Machine references MachineGroup; MachineShift, MachineSwitchTime cascade from Machine |

### ProductionClass / AutoProductionRule
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `production_classes` / `auto_production_rules` | |
| AutoProductionRule has defaultMachine, defaultRecipe FKs |

### ProductionOrder
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

### ProductionOrderLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `production_order_lines` | |
| orderId | String | FK to ProductionOrder (cascade) |

### Production
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `productions` | |
| **PK** | `id` UUID | |
| status | ProductionStatus (enum) | CREATED, STARTED, FINISHED, CANCELLED, FINISHED_DISCARDED |
| productionOrderId | String? | FK to ProductionOrder |
| glMode | ProductionGlMode (enum) | FROM_PRODUCTION, FROM_OPERATIONS |
| **Relations** | productionOrder, recipe, routing, machine, productionClass, lines, operations |

### ProductionLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `production_lines` | |
| productionId | String | FK to Production (cascade) |

### ProductionOperation
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `production_operations` | |
| productionId | String | FK to Production |
| status | ProductionOperationStatus (enum) | CREATED, STARTED, FINISHED, CANCELLED, FINISHED_DISCARDED |
| parentOperationId | String? | Self-ref FK for partial completion |
| **Relations** | production, standardOperation, machine, machineGroup, parentOperation/childOperations (self), lines |

### ProductionOperationLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `production_operation_lines` | |
| operationId | String | FK to ProductionOperation (cascade) |

### ProductionPlan / ProductionPlanLine / ProductionPlanComponent
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `production_plans` / `production_plan_lines` / `production_plan_components` | |
| ProductionPlan.status | ProductionPlanStatus (enum) | DRAFT, APPROVED, CLOSED |
| Lines and components cascade from plan |

### ProductionSetting
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `production_settings` | |
| Singleton config for production module | |

---

## 3.13 POS Module (Section 2.24)

### POSTerminal
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `pos_terminals` | |
| **PK** | `id` UUID | |
| status | POSTerminalStatus (enum) | ACTIVE, INACTIVE, MAINTENANCE |
| defaultDrawerId | String? | FK to CashDrawer |
| **Relations** | defaultDrawer, sessions, sales, cashMovements, journalEntries |

### CashDrawer
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `cash_drawers` | |
| **Relations** | defaultForTerminals, sessions, cashMovements, cashups |

### POSSession
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `pos_sessions` | |
| terminalId | String | FK to POSTerminal |
| drawerId | String | FK to CashDrawer |
| status | POSSessionStatus (enum) | OPEN, CLOSED |
| **Relations** | terminal, drawer, sales, cashMovements, cashups |

### POSPaymentMethod
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `pos_payment_methods` | |
| methodType | POSPaymentMethodType (enum) | 10 values (CASH through OTHER) |

### POSSale
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

### POSSaleLine / POSPayment
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `pos_sale_lines` / `pos_payments` | |
| Both FK to POSSale (cascade) |
| POSSaleLine.lineStatus | POSSaleLineStatus (enum) | ACTIVE, VOIDED |
| POSPayment.paymentMethodId | FK to POSPaymentMethod |

### POSCashMovement
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `pos_cash_movements` | |
| terminalId, drawerId, sessionId | FKs | |
| movementType | POSCashMovementType (enum) | CASH_IN, CASH_OUT, WRITE_OFF |

### POSCashup / POSCashupLine
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `pos_cashups` / `pos_cashup_lines` | |
| POSCashup.status | POSCashupStatus (enum) | DRAFT, COMPLETED, POSTED |
| POSCashupLine FK to POSCashup (cascade) + POSPaymentMethod |

### POSJournalEntry
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `pos_journal_entries` | |
| terminalId | String | FK to POSTerminal |
| action | POSJournalAction (enum) | 30 values (ADD_ITEM through SHUTDOWN) |

### POSButtonLayout / POSButton
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `pos_button_layouts` / `pos_buttons` | |
| POSButton.actionType | POSButtonActionType (enum) | 40+ values |
| POSButton FK to POSButtonLayout (cascade) |

### POSSerialBlock
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `pos_serial_blocks` | |
| Serial number blocks for POS receipts | |

---

## 3.14 Projects & Job Costing Module (Section 2.25)

### Project
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `projects` | |
| **PK** | `id` UUID | |
| status | ProjectStatus (enum) | DRAFT, ACTIVE, ON_HOLD, COMPLETED, CANCELLED, ARCHIVED |
| billingMethod | ProjectBillingMethod (enum) | TIME_AND_MATERIALS, FIXED_PRICE, NON_BILLABLE |
| **Relations** | tasks, timesheets, expenses, transactions, budgets, rateCards, invoiceSchedules |

### ProjectTask
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `project_tasks` | |
| projectId | String | FK to Project (cascade) |
| parentTaskId | String? | Self-ref FK for task hierarchy |
| taskStatus | ProjectTaskStatus (enum) | NOT_STARTED, IN_PROGRESS, COMPLETED, CANCELLED |
| **Relations** | project, parentTask/childTasks (self), timesheetEntries, transactions |

### Timesheet / TimesheetEntry
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `timesheets` / `timesheet_entries` | |
| Timesheet.status | TimesheetStatus (enum) | DRAFT, SUBMITTED, APPROVED, REJECTED |
| TimesheetEntry FK to Timesheet (cascade) + optional FK to ProjectTask |

### ProjectExpense
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `project_expenses` | |
| status | ProjectExpenseStatus (enum) | DRAFT, SUBMITTED, APPROVED, REJECTED, INVOICED |

### ProjectTransaction
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `project_transactions` | |
| projectId | String | FK to Project |
| taskId | String? | FK to ProjectTask |
| sourceType | ProjectTransactionSourceType (enum) | TIMESHEET, VENDOR_INVOICE, EXPENSE, GOODS_RECEIPT, ACTIVITY, PURCHASE_ORDER, MANUAL |
| status | ProjectTransactionStatus (enum) | PENDING, APPROVED, INVOICED, WRITTEN_OFF |

### ProjectBudget / ProjectBudgetLine
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `project_budgets` / `project_budget_lines` | |
| ProjectBudget FK to Project (cascade); line FK to budget (cascade) |

### ProjectRateCard / ProjectRateCardEntry
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `project_rate_cards` / `project_rate_card_entries` | |
| ProjectRateCardEntry.rateType | ProjectRateType (enum) | ROLE, EMPLOYEE, ITEM, TASK |

### ProjectInvoiceSchedule
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `project_invoice_schedules` | |
| projectId | String | FK to Project (cascade) |
| status | ProjectInvoiceScheduleStatus (enum) | PENDING, INVOICED, CANCELLED |

---

## 3.15 Contracts & Agreements Module (Section 2.26)

**Three sub-domains:** Agreements (Rentals), Contracts (Service/Maintenance), Loan Agreements.

### AgreementType
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `agreement_types` | |
| Template/config entity for rental agreements |

### Agreement
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

### AgreementLine / AgreementCharge
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `agreement_lines` / `agreement_charges` | |
| AgreementCharge.chargePeriodType | ChargePeriodType (enum) | DAYS, MONTHS, FIXED |
| AgreementCharge.category | AgreementChargeCategory (enum) | RENTAL, CONSUMABLE |
| AgreementCharge.chargeStatus | AgreementChargeStatus (enum) | UNINVOICED, INVOICED |

### OffHire / OffHireLine
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `off_hires` / `off_hire_lines` | |
| OffHire.status | OffHireStatus (enum) | DRAFT, CONFIRMED, CANCELLED |

### ContractClass (Agreements module)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `contract_classes` | |
| Note: name collision with HR ContractClass, different table |

### Contract (Service/Maintenance)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `contracts` | |
| contractClassId | String? | FK to ContractClass |
| status | ContractStatus (enum) | DRAFT, ACTIVE, RENEWED, CANCELLED, EXPIRED |
| periodType | ContractPeriodType (enum) | DAYS, MONTHS |
| **Relations** | contractClass, lines |

### ContractLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `contract_lines` | |
| FK to Contract (cascade) |

### LoanAgreementType
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `loan_agreement_types` | |
| Config entity with default scheduleType, interestRateMethod, dayCountConvention |

### LoanAgreement
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

### LoanAgreementItem / LoanScheduleRow
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `loan_agreement_items` / `loan_schedule_rows` | |
| Both FK to LoanAgreement (cascade) |
| LoanScheduleRow.rowType | LoanScheduleRowType (enum) | INVOICE, CREDIT_INVOICE, BUYOUT, DISBURSEMENT |

---

## 3.16 Warehouse Management Module (Section 2.27)

### WarehouseGroup
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `warehouse_groups` | |
| Reporting groups of warehouses |

### WarehouseZone
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `warehouse_zones` | |
| **Relations** | wmsConfigsPalletZone, wmsConfigsPickZone, wmsConfigsDeliveryZone |

### WarehouseWmsConfig
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `warehouse_wms_configs` | |
| warehouseGroupId | String? | FK to WarehouseGroup |
| palletZoneId / pickZoneId / deliveryZoneId | String? | FKs to WarehouseZone (3 named relations) |
| forkliftSystemMode | ForkliftSystemMode (enum) | NONE, SEMI_AUTOMATED, FULL_CONFIRMATION |
| **Relations** | warehouseGroup, palletZone, pickZone, deliveryZone, binPositions, positionStocks, pickingLists, forklifts, forkliftTasks |

### BinPosition
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `bin_positions` | |
| warehouseWmsConfigId | String | FK to WarehouseWmsConfig |
| zoneId | String? | FK to WarehouseZone |
| status | BinPositionStatus (enum) | FREE, OCCUPIED, RESERVED, ERROR |
| **Relations** | warehouseWmsConfig, zone, positionStocks, forkliftTasksFrom, forkliftTasksTo |

### PositionStock
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `position_stock` | |
| binPositionId | String | FK to BinPosition |
| warehouseWmsConfigId | String | FK to WarehouseWmsConfig |
| zoneId | String? | FK to WarehouseZone |

### PickingList / PickingLine
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `picking_lists` / `picking_lines` | |
| PickingList.status | PickingListStatus (enum) | DRAFT, IN_PROGRESS, COMPLETED, CANCELLED |
| PickingLine.lineStatus | PickingLineStatus (enum) | PENDING, PICKED, SHORT_PICKED, CANCELLED |

### Forklift
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `forklifts` | |
| warehouseWmsConfigId | String | FK to WarehouseWmsConfig |

### ForkliftTask
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

## 3.17 Intercompany & Consolidation Module (Section 2.28)

**Note:** Some models are [PLATFORM] (stored in platform DB), others are [TENANT] (stored in tenant DB).

### IntercompanyRule [TENANT]
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `intercompany_rules` | |
| sourceAccountCode | String | Account to match |
| direction | IntercompanyRuleDirection (enum) | DEBIT, CREDIT |

### IntercompanyTransaction [PLATFORM]
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `intercompany_transactions` | |
| transactionType | IntercompanyTransactionType (enum) | NL_MIRROR, PO_TO_SO, INVOICE_MIRROR |
| status | IntercompanyTransactionStatus (enum) | INITIATED, TARGET_PENDING, TARGET_POSTED, COMPLETED, FAILED, COMPENSATED, CANCELLED |

### ConsolidationGroup [PLATFORM]
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `consolidation_groups` | |
| **Relations** | members, accountMaps, exchangeRates, runs |

### ConsolidationMember [PLATFORM]
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `consolidation_members` | |
| groupId | String | FK to ConsolidationGroup (cascade) |
| parentMemberId | String? | Self-ref FK for hierarchy |
| status | ConsolidationMemberStatus (enum) | ACTIVE, SUSPENDED, REMOVED |
| **Relations** | group, parentMember/childMembers (self), ownershipPercentages |

### OwnershipPercentage / ConsolidationAccountMap / ConsolidationExchangeRate [PLATFORM]
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `ownership_percentages` / `consolidation_account_maps` / `consolidation_exchange_rates` | |
| All FK to ConsolidationMember or ConsolidationGroup |

### EliminationTemplate / EliminationEntry [TENANT]
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `elimination_templates` / `elimination_entries` | |
| EliminationEntry.outputType | EliminationOutputType (enum) | JOURNAL, SIMULATION |

### ConsolidationRun [PLATFORM]
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `consolidation_runs` | |
| groupId | String | FK to ConsolidationGroup |
| status | ConsolidationRunStatus (enum) | IN_PROGRESS, COMPLETED, FAILED |

### SharedRegisterConfig [PLATFORM]
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `shared_register_configs` | |
| groupId | String | FK to ConsolidationGroup (cascade) |
| registerType | SharedRegisterType (enum) | CUSTOMER, SUPPLIER, ITEM, CHART_OF_ACCOUNT |

### IntercompanySupplierMode (P2 Extension)
| Field | Type | Notes |
|-------|------|-------|
| Enum added to Supplier model | NONE, DEFAULT, INTERNAL |

---

## 3.18 Communications Module (Section 2.29)

### ChatChannel / ChatParticipant / ChatMessage
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `chat_channels` / `chat_participants` / `chat_messages` | |
| ChatChannel.channelType | ChatChannelType (enum) | DIRECT, GROUP, AI_ASSISTANT |
| ChatMessage.parentMessageId | String? | Self-ref FK for threading |
| **Relations** | ChatParticipant FK to ChatChannel (cascade); ChatMessage FK to ChatChannel (cascade), parentMessage/replies (self) |

### EmailMessage / EmailRecipient / EmailQueue
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `email_messages` / `email_recipients` / `email_queue` | |
| EmailMessage.status | EmailMessageStatus (enum) | DRAFT, SENT, QUEUED, FAILED, BOUNCED |
| EmailMessage.direction | EmailDirection (enum) | INBOUND, OUTBOUND |
| EmailRecipient.recipientType | EmailRecipientType (enum) | FROM, TO, CC, BCC |
| EmailRecipient.status | EmailRecipientStatus (enum) | UNREAD, READ, DELETED, ARCHIVED |
| EmailQueue.queueStatus | EmailQueueStatus (enum) | PENDING, PROCESSING, SENT, FAILED, RETRYING |

### EmailTemplate / EmailAlias / EmailSignature
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `email_templates` / `email_aliases` / `email_signatures` | |
| Reference/configuration entities |

### ConferenceRoom / ConferenceAccess
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `conference_rooms` / `conference_access` | |
| ConferenceRoom.roomType | ConferenceRoomType (enum) | DISCUSSION, ANNOUNCEMENTS, KNOWLEDGE_BASE |
| ConferenceRoom.parentRoomId | String? | Self-ref FK for hierarchy |
| ConferenceAccess.accessLevel | ConferenceAccessLevel (enum) | FULL, READ_WRITE, READ_ONLY, NONE |

### NotificationTemplate / NotificationPreference / Notification
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `notification_templates` / `notification_preferences` / `notifications` | |
| Notification.channel | NotificationChannel (enum) | IN_APP, EMAIL, PUSH |
| Notification.priority | NotificationPriority (enum) | LOW, NORMAL, HIGH, URGENT |
| Notification.status | NotificationStatus (enum) | PENDING, DELIVERED, READ, DISMISSED, FAILED |

### MassMailCampaign
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `mass_mail_campaigns` | |
| Bulk email campaign management |

---

## 3.19 Service Orders & Timekeeper Module (Section 2.30)

### ServiceOrder
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `service_orders` | |
| **PK** | `id` UUID | |
| status | ServiceOrderStatus (enum) | DRAFT, OPEN, IN_PROGRESS, ON_HOLD, COMPLETED, INVOICED, CANCELLED |
| **Relations** | lines, workOrders, workSheets |

### ServiceOrderLine
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `service_order_lines` | |
| serviceOrderId | String | FK to ServiceOrder (cascade) |
| lineItemType | ServiceLineItemType (enum) | PLAIN, INVOICEABLE, WARRANTY, CONTRACT |
| lineItemKind | ServiceLineItemKind (enum) | MAIN_ITEM, SUB_ITEM |

### WorkOrder / WorkOrderLine
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `work_orders` / `work_order_lines` | |
| WorkOrder FK to ServiceOrder |
| WorkOrder.status | WorkOrderStatus (enum) | OPEN, IN_PROGRESS, CLOSED |
| WorkOrderLine FK to WorkOrder (cascade) |

### WorkSheet / WorkSheetLine
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `work_sheets` / `work_sheet_lines` | |
| WorkSheet FK to ServiceOrder + optional FK to WorkOrder |
| WorkSheet.status | WorkSheetStatus (enum) | DRAFT, SUBMITTED, APPROVED, INVOICED, REJECTED |
| WorkSheetLine FK to WorkSheet (cascade) |

### KnownSerialNumber
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `known_serial_numbers` | |
| Tracks known serial numbers for service items |
| warrantyStatus | WarrantyStatus (enum) | UNKNOWN, UNDER_WARRANTY, OUT_OF_WARRANTY, EXPIRED, CONTRACT_COVERED |

### FaultCode / FaultCodeModifier
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `fault_codes` / `fault_code_modifiers` | |
| Reference entities for fault classification |

### TargetTime / TargetTimeLine
| Field | Type | Notes |
|-------|------|-------|
| **Tables** | `target_times` / `target_time_lines` | |
| Standard time targets for service operations |
| TargetTimeLine FK to TargetTime (cascade) |

---

## 3.20 AI Infrastructure Models (E5, E5b, E5c, E5d)

> The 10 AI models from E5 (AiModel, AiPrompt, AiPromptVersion, AiAgent, AiSkill, AiConversation, AiMessage, AiFeedback, AiUsage, AiEval) are implemented in the Prisma schema. See `packages/db/prisma/schema.prisma` lines 706-954 for the full definitions.

### AiModuleKnowledge (E5b — Planned)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `ai_module_knowledge` | System-wide (NO companyId) |
| **PK** | `id` UUID | |
| moduleKey | String | 'ar', 'finance', 'inventory', 'views' |
| knowledgeType | String | OVERVIEW, ENTITIES, WORKFLOWS, BUSINESS_RULES, FAQ, TERMINOLOGY |
| title | String(500) | Knowledge article title |
| content | Text | Markdown content — structured domain knowledge |
| priority | Int | Default 100, higher = injected first within token budget |
| isActive | Boolean | Default true |
| **Indexes** | `[moduleKey, knowledgeType, isActive]` | |
| **Note** | | Seeded per-module alongside skill packs. Every business module epic adds knowledge rows |

### AiSkill Enhancement (E5b — Planned)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `ai_skills` (existing, enhanced) | System-wide (NO companyId). Tenant overrides via `ai_skill_overrides` |
| + moduleKey | String | Module this skill belongs to |
| + packKey | String? | Skill pack group (e.g., 'ar-core') |
| + triggerPhrases | String[] | Phrases that activate this skill. **Migration:** renamed from E5's `keywords` |
| + negativeTriggers | String[] | Phrases that must NOT activate this skill |
| + contextRequired | String[] | Conditions: `["screen:entity-list", "module:ar"]` |
| + orchestrationPattern | String | SEQUENTIAL, PARALLEL, ITERATIVE, CONTEXT_AWARE, DOMAIN_INTELLIGENCE |
| + skillContent | Text | Full skill instructions (loaded at L2). **Migration:** renamed from E5's `instructions` |
| + parameters | Json? | Parameter definitions |
| + examples | Json? | Example input/output pairs |
| + priority | Int | Higher wins when multiple skills match |
| + version | String | Default "1.0.0" |
| **Note** | | `companyId` is NOT on this table. Use `ai_skill_overrides` for tenant-level enable/disable/customisation |

### AiSkillOverride (E5b — Planned)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `ai_skill_overrides` | Per-tenant skill customisation |
| **PK** | `id` UUID | |
| skillId | String | FK → AiSkill |
| companyId | String | FK → CompanyProfile |
| isActive | Boolean? | null = inherit from skill, true/false = tenant override |
| triggerPhrasesOverride | String[] | Empty = inherit, non-empty = replace skill's trigger phrases |
| priorityOverride | Int? | null = inherit, non-null = override priority for this tenant |
| **Unique** | `[skillId, companyId]` | One override per skill per tenant (sparse — most tenants have zero rows) |

### AiSkillContext (E5b — Planned)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `ai_skill_contexts` | |
| **PK** | `id` UUID | |
| skillId | String | FK → AiSkill |
| contextKey | String | Identifier for this context piece |
| contextQuery | Text | SQL or service call to fetch context data |
| tokenBudget | Int | Max tokens for this context piece |
| cacheTtlSeconds | Int | How long to cache the result |
| isRequired | Boolean | Must this context be present for the skill to work? |

### AiEntityTrigger (E5b — Planned)
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `ai_entity_triggers` | System-wide (NO companyId). Maps chat keywords to entity search |
| **PK** | `id` UUID | |
| moduleKey | String | Module this entity belongs to ('ar', 'sales', 'hr') |
| triggerWord | String | Natural language keyword ('contact', 'invoice', 'customer') |
| entityType | String | Prisma model name ('Contact', 'CustomerInvoice', 'Customer') |
| searchEndpoint | String | API endpoint for search ('/contacts/search', '/ar/invoices/search') |
| displayField | String | Field shown in autocomplete ('fullName', 'reference', 'name') |
| subtitleField | String? | Secondary field shown ('email', 'customerName') |
| scopeBy | String? | Context scoping field ('customerId' — if message mentions customer, scope contacts to that customer) |
| icon | String? | Lucide icon name ('user', 'file-text', 'building') |
| priority | Int | Default 100 |
| isActive | Boolean | Default true |
| **Unique** | `[moduleKey, triggerWord]` | No duplicate trigger words per module |
| **Note** | | Seeded per-module. If Sales and Purchasing both need "order", use distinct triggers ("sales order" vs "purchase order") |

---

## 3.21 Reporting Infrastructure (E25 — Planned)

> Based on analysis of the previous system's `db_reports` and `db_report_columns` tables. Separate from E7's data_view_fields because reports have aggregation, grouping, computed columns, and cross-entity joins that views don't need.

### ReportDefinition
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `report_definitions` | |
| **PK** | `id` UUID | |
| companyId | String | FK — tenant scoping |
| reportKey | String | Unique identifier, e.g., 'AR_AGING' |
| reportName | String | Display name (i18n key) |
| reportType | Enum | FINANCIAL, OPERATIONAL, STATUTORY, CUSTOM |
| description | String? | What this report shows |
| sourceQuery | Text | Base query, view key, or service reference |
| permissionCode | String | Required permission to access |
| isActive | Boolean | Default true |
| sortOrder | Int | Display ordering in report list |
| **Unique** | `[companyId, reportKey]` | |

### ReportColumn
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `report_columns` | |
| **PK** | `id` UUID | |
| reportId | String | FK → ReportDefinition (cascade) |
| colField | String | Database field name or computed expression |
| colName | String | Display header (i18n key) |
| colType | Enum | STRING, NUMBER, DATE, CURRENCY, BOOLEAN, PERCENTAGE |
| colWidth | Int | Default width in pixels |
| displayOrder | Int | Column position |
| canSort | Boolean | Default true — user can sort by this column |
| canGroup | Boolean | Default false — user can group by this column |
| canShow | Boolean | Default true — visible by default |
| applyCount | Boolean | Default false — show count in group footer |
| applySum | Boolean | Default false — show sum in group footer |
| applyAvg | Boolean | Default false — show average in group footer |
| filterType | Enum? | DROPDOWN, AUTOCOMPLETE, DATE_RANGE, TEXT, NONE |
| filterEndpoint | String? | LOV fetch endpoint for DROPDOWN/AUTOCOMPLETE |
| groupHeader | String? | Custom header text when grouped by this column |
| formatPattern | String? | Number/date format pattern (e.g., '#,##0.00', 'DD MMM YYYY') |
| **Unique** | `[reportId, colField]` | |
| **Index** | `[reportId, displayOrder]` | |

---
