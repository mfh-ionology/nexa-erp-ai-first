# 6. Common Patterns

## 6.1 Polymorphic Linking (entityType + entityId)

Used by models that can attach to any entity across the system:

| Model | Pattern | Usage |
|-------|---------|-------|
| **Attachment** | entityType + entityId | File attachments on any record |
| **Note** | entityType + entityId | Notes/comments on any record |
| **RecordLink** | sourceEntityType/Id + targetEntityType/Id | Links between any two records |
| **ApprovalRequest** | entityType + entityId | Approval workflow on any approvable record |
| **Activity** | entityType + entityId | Calendar/task activities linked to any record |

The `entityType` is a string like `"customer"`, `"invoice"`, `"employee"` -- not an enum, allowing any module to use these models without schema changes.

## 6.2 Number Series Integration

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

## 6.3 Soft Delete Pattern

**Reference entities** use `isActive Boolean @default(true)`:
- Customer, Supplier, InventoryItem, Warehouse, ItemGroup, BankAccount, Currency, Country, Department, PaymentTerms, VatCode, Tag, ShippingMethod, all CRM reference entities, etc.
- Query pattern: LOV/dropdown queries filter `isActive = true`; list/search queries include inactive with visual indicator.

**Transactional entities** use status enums instead of soft delete:
- JournalEntry: DRAFT / POSTED / REVERSED
- CustomerInvoice: DRAFT / APPROVED / POSTED / CANCELLED / VOID
- StockMovement: DRAFT / POSTED / REVERSED
- AuditLog: Append-only, never modified or deleted

## 6.4 Self-Referential Hierarchies

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

## 6.5 JSON Custom Fields Pattern

Several models use `Json @db.JsonB` fields for flexible, schema-less data:
- `SavedView.columns / filters / sorting` -- user view configuration
- `InventoryItem.customFields` -- tenant-defined item attributes
- `Customer.customFields` -- tenant-defined customer attributes
- `SystemSetting.value` -- serialised configuration values

## 6.6 Audit Trail Fields

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

## 6.7 Multi-Currency Pattern

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
