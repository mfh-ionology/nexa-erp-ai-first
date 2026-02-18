# MIGRATION_MAP — Legacy HansaWorld HAL → Target Nexa ERP (PostgreSQL)

> **Generated:** 2026-02-15
> **Purpose:** Map legacy HAL entities/fields to target Nexa ERP PostgreSQL schema with field-level detail
> **Prior work references:**
> - `DATA_MODEL.md` — 54 core HAL registers, 3,170 fields extracted
> - `CODE_REQUIREMENTS.md` — 300+ business rules from 14 RAction files
> - `DIFF_AND_GAPS.md` — Gap analysis (legacy vs target)
> - `_bmad-output/planning-artifacts/nexa-erp-business-rules-requirements.md` — 10,789-line target extraction
> - `_bmad-output/planning-artifacts/erp-module-status-summary.md` — Target module status (24 modules)
> **Status:** COMPLETE

---

## 1. Architecture Mapping

| Aspect | Legacy (HansaWorld HAL) | Target (Nexa ERP) |
|--------|------------------------|-------------------|
| **Language** | HAL (proprietary compiled) | TypeScript/Node.js |
| **Database** | Custom integrated DB engine | PostgreSQL (per-tenant databases) |
| **ORM** | N/A (native RecordField) | Prisma ORM |
| **Schema definition** | datadef*.hal (RecordBegin/RecordField) | Prisma schema.prisma |
| **Business logic** | RActions + WActions + Tools (.hal) | Service layer (TypeScript) |
| **API** | Client-server protocol + Web/WebNG | REST API (Express/Fastify) |
| **UI** | Desktop thick client + window definitions | React (web), conversational AI primary |
| **Reports** | 743 compiled report files (.hal) | Custom report service + AI-generated |
| **Multi-tenant** | Single DB, multi-company | Database-per-tenant (PostgreSQL) |
| **Auth** | Access Groups (HAL) | RBAC (5 roles) + module toggles |
| **Currency** | Multi-currency with dual base | Multi-currency with single base + FX |

---

## 2. HAL Type → PostgreSQL/Prisma Type Mapping

| HAL Type | Prisma Type | PostgreSQL Type | Notes |
|----------|------------|-----------------|-------|
| M4Str | String | VARCHAR | Size from HAL definition |
| M4UStr | String | VARCHAR | Unicode — same as M4Str in PostgreSQL |
| M4Code | String | VARCHAR | Indexed; used for FK lookups |
| M4Int | Int | INTEGER | |
| M4Long | BigInt / Int | BIGINT / INTEGER | Use Int if range permits |
| M4Val | Decimal | DECIMAL(18,2) | Monetary — always 2dp |
| M4UVal | Decimal | DECIMAL(18,2) | Unsigned monetary |
| M41Val | Decimal | DECIMAL(18,1) | 1-decimal precision |
| M45Val | Decimal | DECIMAL(18,5) | 5-decimal precision (costs, rates) |
| M423Val | Decimal | DECIMAL(23,6) | High-precision (unit prices) |
| M4Date | DateTime | DATE | |
| M4DateTime | DateTime | TIMESTAMP | |
| M4Time | String | TIME | |
| M4Bool | Boolean | BOOLEAN | |
| M4Mark | Boolean | BOOLEAN | Checkbox variant |
| M4Rate | Decimal | DECIMAL(18,8) | Exchange rates need high precision |
| M4Qty | Decimal | DECIMAL(18,4) | Quantities — 4dp for fractions |
| M4Set | Int / Enum | INTEGER / ENUM | Map to Prisma enum where possible |
| M4Matrix | Relation | Child table | HAL arrays → separate Prisma models |
| M4PackedMatrix | Json | JSONB | Compressed matrices → JSON |
| M4Pict | Bytes | BYTEA | Or external storage (S3) |
| M4Blob | Bytes | BYTEA | Or external storage |
| M4TextField | String | TEXT | Long text |
| M4PhoneNo | String | VARCHAR(20) | |
| M4PrcStr | String | VARCHAR(10) | Percentage as string |
| M4List | String | VARCHAR | Comma-separated codes |
| M4StrSet | Int / Enum | INTEGER / ENUM | |

### Key Conversion Rules

1. **All M4Code FK fields** → Prisma `@relation` with explicit foreign key
2. **All M4Matrix arrays** → Separate child table with parent FK (e.g., `IVVc.Math[]` → `CustomerInvoiceLine`)
3. **M4PackedMatrix** → JSONB column (acceptable for tax matrices)
4. **M4Set enums** → Prisma `enum` type where values are known; `Int` where haldefs.h parsing is incomplete
5. **Self-referencing M4Code** → Self-relation in Prisma (e.g., `CUVc.InvoiceToCode` → `Customer.billToId`)

---

## 3. Core Entity Mapping — Detailed Field-Level

### 3.1 Finance Module

#### AccVc → GlAccount / CoaTemplate

| HAL Field | HAL Type | Target Field | Target Model | Strategy | Notes |
|-----------|----------|-------------|-------------|----------|-------|
| AccNumber | M4Code(10) | code | GlAccount | DIRECT | PK in legacy; unique key in target |
| Comment | M4Str(60) | name | GlAccount | DIRECT | |
| AccType | M4Int | type | GlAccount | TRANSFORM | Map to enum: ASSET, LIABILITY, INCOME, EXPENSE, EQUITY |
| NVD / NVC | M4Int | — | — | DROP | Normal balance inferred from type in target |
| AutCode | M4Code(10) | — | — | DROP | Authorization → RBAC in target |
| blockedFlag | M4Int | isActive | GlAccount | INVERT | blockedFlag=1 → isActive=false |
| VATCode | M4Code(10) | defaultVatCodeId | GlAccount | FK | |
| ControlType | M4Int | controlType | GlAccount | TRANSFORM | Map: 0=None, 1=AR, 2=AP, 3=Bank |
| Curncy | M4Code(5) | currencyCode | GlAccount | FK | |
| ConsAccNumber | M4Code(10) | — | — | DROP | Consolidation module not in v1 scope |
| Objects | M4UStr(60) | — | — | MISSING | No cost centre/dimension support in target |
| SRUCode | M4UStr(10) | — | — | DROP | Swedish reporting code — UK only |
| ExclFrRep | M4Int | — | — | JSON | Store in metadata JSON |
| PeriodCode | M4Code(10) | — | — | DROP | Period management different in target |
| GroupAcc | M4Int | isGroup | GlAccount | DIRECT | |
| TransAutCode | M4Code(10) | — | — | DROP | → RBAC |
| TaxTemplateCode | M4Code(10) | taxTemplateId | GlAccount | FK | |
| AccClass | M4List(100) | — | — | JSON | Classification list → metadata |
| NotBalSheet | M4Int | — | — | JSON | Store in metadata |

**Field Coverage:** 22 legacy → 8 direct + 3 FK + 3 JSON + 8 dropped = **50% carried forward**

---

#### AccTransVc → JournalEntry + JournalLine

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| SerNr | M4Long | id | JournalEntry | DIRECT (auto-increment) |
| TransDate | M4Date | transactionDate | JournalEntry | DIRECT |
| Comment | M4Str | description | JournalEntry | DIRECT |
| OKFlag | M4Mark | status | JournalEntry | TRANSFORM → enum (DRAFT/POSTED) |
| Sign | M4Code(10) | createdBy | JournalEntry | FK → User |
| **Array: Math** | | | **JournalLine** | |
| AccNumber | M4Code(10) | accountId | JournalLine | FK → GlAccount |
| Sum | M4Val | amount | JournalLine | DIRECT |
| Objects | M4UStr(60) | — | — | MISSING (dimensions) |
| CurncyCode | M4Code(5) | currencyCode | JournalLine | FK |

**Architecture Change:** Legacy single record with arrays → Target splits header (JournalEntry) + lines (JournalLine). This is a structural improvement.

---

#### BankVc → BankAccount

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| Code | M4Code | id | BankAccount | DIRECT |
| Comment | M4Str(60) | name | BankAccount | DIRECT |
| AccNr | M4Code(10) | glAccountId | BankAccount | FK → GlAccount |
| BankAccNum | M4Str(60) | accountNumber | BankAccount | DIRECT |
| SortCode | M4Str(20) | sortCode | BankAccount | DIRECT |
| IBANCode | M4UStr(60) | iban | BankAccount | DIRECT |
| SWIFT | M4Str(60) | bic | BankAccount | DIRECT |
| CurncyCode | M4Code(5) | currencyCode | BankAccount | FK |
| Bank | M4Str(20) | bankName | BankAccount | DIRECT |
| BankAddr0-4 | M4Str(60) | — | — | JSON | Bank address → metadata |

**Field Coverage:** 35 legacy → ~10 direct + 3 JSON + 22 dropped = **37% carried forward**

---

#### VATDeclVc → VatReturn

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| SerNr | M4Long | id | VatReturn | DIRECT |
| TransDate | M4Date | periodEnd | VatReturn | DIRECT |
| OKFlag | M4Mark | status | VatReturn | TRANSFORM → enum |
| VATVal | M4Val | vatDue | VatReturn | DIRECT |
| PurchVAT | M4Val | vatReclaimedOnInputs | VatReturn | DIRECT |
| TotSum | M4Val | totalValueOfSales | VatReturn | DIRECT |
| Array: boxes | M4Matrix | boxes | VatReturn | JSON → HMRC MTD box format |

---

### 3.2 Accounts Receivable

#### CUVc → Customer (313 legacy fields → ~15 target fields)

**This is the highest-gap entity.** CUVc is a unified record serving as Customer, Supplier, Contact, Guest, Employee, and Lead. The target splits these into separate models.

##### Core Identification Fields

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| Code | M4Code(20) | code | Customer | DIRECT |
| Name | M4Str(200) | name | Customer | DIRECT |
| FirstName | M4Str(255) | — | — | JSON | Not on Customer model |
| Person | M4Str(60) | contactName | Customer | DIRECT |
| eMail | M4Str(100) | email | Customer | DIRECT |
| Phone | M4PhoneNo(20) | phone | Customer | DIRECT |
| Mobile | M4PhoneNo(20) | — | — | JSON |
| wwwAddr | M4Str(60) | — | — | JSON |

##### Address Fields (SCHEMA-GAP: target has no structured address)

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| InvAddr0-4 | M4Str(60) x5 | billingAddress | Customer | **SCHEMA-GAP** → JSON or new Address model |
| DelAddr0-4 | M4Str(60) x5 | shippingAddress | Customer | **SCHEMA-GAP** → JSON or new Address model |
| CountryCode | M4Code(5) | — | — | MISSING → include in address JSON |

##### Financial Fields

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| PayDeal | M4Code(3) | termsDays | Customer | TRANSFORM → integer days |
| CreditLimit | M4Val | creditLimit | Customer | **SCHEMA-GAP** → add to model |
| CreditLimitDays | M4Long | — | — | JSON |
| CurncyCode | M4Code(5) | currencyCode | Customer | FK |
| VATNr | M4Str(20) | vatNumber | Customer | **SCHEMA-GAP** → add to model |
| VATCode | M4Code(10) | defaultVatCodeId | Customer | FK |

##### Classification Fields

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| CustCat | M4Code(5) | category | Customer | JSON / Custom Field |
| CustType | M4Int | — | — | DROP (unified type) |
| Classification | M4List(200) | tags | Customer | JSON |
| Region | M4Code(20) | — | — | JSON |
| SalesGroup | M4Code(5) | — | — | JSON |
| SalesMan | M4Code(10) | — | — | JSON |

##### Status & Control Fields

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| blockedFlag | M4Int | isActive | Customer | INVERT |
| OnHoldFlag | M4Int | — | — | JSON |
| Closed | M4Mark | — | — | JSON |
| DateCreated | M4Date | createdAt | Customer | DIRECT |
| DateChanged | M4Date | updatedAt | Customer | DIRECT |

##### Supplier-Role Fields (CUVc dual-purpose)

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| CUType (Customer/Supplier/Both) | M4Int | — | — | SPLIT → Customer + Supplier |
| VEType | M4Int | — | Supplier | Type on separate model |
| VEPayDeal | M4Code(3) | termsDays | Supplier | DIRECT |
| VECurncyCode | M4Code(5) | currencyCode | Supplier | FK |
| VECreditLimit | M4Val | creditLimit | Supplier | SCHEMA-GAP |
| VEVATCode | M4Code(10) | defaultVatCodeId | Supplier | FK |
| VECat | M4Code(5) | category | Supplier | JSON |

##### Guest/Hotel Fields → DROP (out of scope)
##### Employee/HR Fields → Employee model
##### Lead/CRM Fields → CrmLead / CrmAccount

**Recommended SCHEMA-GAPs to resolve:**
1. **Add `vatNumber`** to Customer and Supplier (UK legal requirement)
2. **Add `creditLimit`** to Customer (core credit management)
3. **Add structured address** (billingAddress + shippingAddress as embedded JSON or separate Address model)
4. **Add `contactName`** to Customer (Person field equivalent)
5. **Add `paymentTermsCode`** to Customer (richer than flat `termsDays`)

**Field Coverage:** 313 legacy → 15 direct + 7 SCHEMA-GAPs needing resolution + ~20 JSON + ~270 dropped = **~13% carried forward in typed fields**

---

#### IVVc → CustomerInvoice + CustomerInvoiceLine

##### Header Fields (IVVc → CustomerInvoice)

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| SerNr | M4Long | invoiceNumber | CustomerInvoice | DIRECT |
| InvDate | M4Date | invoiceDate | CustomerInvoice | DIRECT |
| CustCode | M4Code(20) | customerId | CustomerInvoice | FK → Customer |
| PayDate | M4Date | dueDate | CustomerInvoice | DIRECT |
| Addr0 | M4Str(200) | — | — | JSON (customer name snapshot) |
| Addr1-3 | M4Str(60) | — | — | JSON (address snapshot) |
| OurContact | M4Str(20) | — | — | JSON |
| ClientContact | M4Str(60) | — | — | JSON |
| ExportFlag | M4Int | — | — | DROP (UK only) |
| PayDeal | M4Code(3) | termsDays | CustomerInvoice | TRANSFORM |
| OrderNr | M4Long | salesOrderId | CustomerInvoice | FK → SalesOrder |
| OKFlag | M4Mark | status | CustomerInvoice | TRANSFORM → enum(DRAFT,APPROVED,PAID,VOIDED) |
| InvType | M4Int | invoiceType | CustomerInvoice | TRANSFORM → enum(STANDARD,CREDIT_NOTE) |
| PriceList | M4Code(20) | — | — | JSON |
| Objects | M4UStr(60) | — | — | MISSING (dimensions) |
| InclVAT | M4Int | taxInclusive | CustomerInvoice | DIRECT → Boolean |
| ARAcc | M4Code(10) | — | — | DROP (derived from config) |
| InvComment | M4Str(200) | notes | CustomerInvoice | DIRECT |
| CredInv | M4Long | creditNoteRef | CustomerInvoice | FK self-ref |
| SalesMan | M4UStr(60) | — | — | JSON |
| CustCat | M4Code(5) | — | — | DROP (on Customer) |
| pdvrebt | M4Qty | earlyPaymentDiscount | CustomerInvoice | **SCHEMA-GAP** |
| pdrdays | M4Long | earlyPaymentDays | CustomerInvoice | **SCHEMA-GAP** |

##### Line Item Fields (IVVc.Math[] → CustomerInvoiceLine)

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| stp | M4Int | lineType | CustomerInvoiceLine | TRANSFORM → enum(ITEM,COMMENT,SUBTOTAL) |
| ArtCode | M4Code(20) | itemId | CustomerInvoiceLine | FK → InventoryItem |
| Quant | M4UVal | quantity | CustomerInvoiceLine | DIRECT |
| Price | M423Val | unitPrice | CustomerInvoiceLine | DIRECT |
| Sum | M4Val | lineTotal | CustomerInvoiceLine | DIRECT |
| vRebate | M41Val | discountPercent | CustomerInvoiceLine | DIRECT |
| SalesAcc | M4Code(10) | revenueAccountId | CustomerInvoiceLine | FK → GlAccount |
| Objects | M4UStr(60) | — | — | MISSING (dimensions) |
| BasePrice | M4Val | — | — | DROP (calculated) |
| rowGP | M4Val | — | — | DROP (calculated) |
| FIFO | M45Val | — | — | DROP (internal costing) |
| Spec | M4Str(100) | description | CustomerInvoiceLine | DIRECT |
| VATCode | M4Code(10) | vatCodeId | CustomerInvoiceLine | FK |
| SerialNr | M4Str(60) | serialNumber | CustomerInvoiceLine | **SCHEMA-GAP** |
| VARList | M4UStr(30) | — | — | MISSING (variants) |
| UnitCode | M4Code(5) | unitOfMeasure | CustomerInvoiceLine | **SCHEMA-GAP** |
| Location | M4Code(10) | warehouseId | CustomerInvoiceLine | FK |
| Comment | M4Str(100) | — | — | JSON |
| CurncyCode | M4Code(5) | currencyCode | CustomerInvoiceLine | FK |
| TaxMatrix | M4PackedMatrix | taxDetails | CustomerInvoiceLine | JSON |
| TaxTemplateCode | M4UStr(60) | taxTemplateId | CustomerInvoiceLine | FK |

**Field Coverage:** ~280 legacy (header+lines) → ~30 target = **~11% carried forward in typed fields**

---

#### ARPayVc → CustomerPayment

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| SerNr | M4Long | id | CustomerPayment | DIRECT |
| TransDate | M4Date | paymentDate | CustomerPayment | DIRECT |
| CustCode | M4Code(20) | customerId | CustomerPayment | FK |
| IVNr | M4Long | invoiceId | CustomerPayment | FK |
| Val | M4Val | amount | CustomerPayment | DIRECT |
| PayMode | M4Code(5) | paymentMethod | CustomerPayment | TRANSFORM → enum |
| BankAccCode | M4Code(12) | bankAccountId | CustomerPayment | FK |
| CurncyCode | M4Code(5) | currencyCode | CustomerPayment | FK |
| OKFlag | M4Mark | status | CustomerPayment | TRANSFORM → enum |

---

### 3.3 Accounts Payable

#### VEVc → Supplier (50 legacy fields → ~10 target fields)

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| Code | M4Code(20) | code | Supplier | DIRECT |
| Name | M4Str(60) | name | Supplier | DIRECT |
| Person | M4Str(60) | contactName | Supplier | **SCHEMA-GAP** |
| Addr0-4 | M4Str(60) x5 | address | Supplier | **SCHEMA-GAP** → JSON |
| Phone | M4PhoneNo(20) | phone | Supplier | **SCHEMA-GAP** |
| eMail | M4Str(200) | email | Supplier | **SCHEMA-GAP** |
| PayDeal | M4Code(3) | termsDays | Supplier | TRANSFORM |
| BankAcc | M4Str(60) | bankAccount | Supplier | **SCHEMA-GAP** |
| IBANCode | M4UStr(60) | iban | Supplier | **SCHEMA-GAP** |
| SWIFT | M4Str(60) | bic | Supplier | **SCHEMA-GAP** |
| AccAP | M4Code(10) | — | — | DROP (derived) |
| CurncyCode | M4Code(5) | currencyCode | Supplier | FK |
| VATNr | M4Str(20) | vatNumber | Supplier | **SCHEMA-GAP** |
| VATCode | M4Code(10) | defaultVatCodeId | Supplier | FK |
| CreditLimit | M4Val | creditLimit | Supplier | **SCHEMA-GAP** |
| BlockedFlag | M4Int | isActive | Supplier | INVERT |
| CountryCode | M4Code(5) | — | — | JSON |

**8 SCHEMA-GAPs already identified.** Target Supplier model is extremely thin.

---

#### PUVc → SupplierBill + SupplierBillLine

##### Header (PUVc → SupplierBill)

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| SerNr | M4Long | id | SupplierBill | DIRECT |
| RegDate | M4Date | receivedDate | SupplierBill | DIRECT |
| TransDate | M4Date | billDate | SupplierBill | DIRECT |
| VECode | M4Code(20) | supplierId | SupplierBill | FK |
| PONr | M4Long | purchaseOrderId | SupplierBill | FK |
| Location | M4Code(10) | warehouseId | SupplierBill | FK |
| OKFlag | M4Mark | status | SupplierBill | TRANSFORM → enum |
| CurncyCode | M4Code(5) | currencyCode | SupplierBill | FK |
| InclVAT | M4Int | taxInclusive | SupplierBill | Boolean |
| Objects | M4UStr(60) | — | — | MISSING |
| VEVATCode | M4Code(10) | vatCodeId | SupplierBill | FK |
| ShipCost | M4UVal | shippingCost | SupplierBill | DIRECT |
| SubTotal | M4Val | subtotal | SupplierBill | DIRECT |
| VATVal | M4Val | vatTotal | SupplierBill | DIRECT |
| PayVal | M4Val | totalAmount | SupplierBill | DIRECT |
| Invalid | M4Int | — | — | Map to status=VOIDED |

##### Lines (PUVc.Math[] → SupplierBillLine)

Same pattern as Invoice lines. Key fields: ArtCode→itemId, Quant→quantity, UPrice→unitPrice, Sum→lineTotal, VATCode→vatCodeId, CostAcc→costAccountId.

---

### 3.4 Sales

#### ORVc → SalesOrder + SalesOrderLine (CRITICAL: target is SKELETON)

##### Header (ORVc → SalesOrder)

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| SerNr | M4Long | orderNumber | SalesOrder | DIRECT |
| OrdDate | M4Date | orderDate | SalesOrder | DIRECT |
| CustCode | M4Code(20) | customerId | SalesOrder | FK |
| InvoiceToCode | M4Code(20) | billToCustomerId | SalesOrder | FK self |
| Addr0-3 | M4Str(60) | — | — | JSON snapshot |
| ShipAddr0-3 | M4Str(60) | shippingAddress | SalesOrder | **SCHEMA-GAP** → JSON |
| CustOrdNr | M4Str(60) | customerReference | SalesOrder | **SCHEMA-GAP** |
| SalesMan | M4UStr(60) | — | — | JSON |
| PayDeal | M4Code(3) | termsDays | SalesOrder | TRANSFORM |
| ShipMode | M4Code(5) | shippingMethod | SalesOrder | **SCHEMA-GAP** |
| ShipDeal | M4Code(5) | — | — | JSON |
| CurncyCode | M4Code(5) | currencyCode | SalesOrder | FK |
| PriceList | M4Code(20) | priceBookId | SalesOrder | FK |
| InclVAT | M4Int | taxInclusive | SalesOrder | Boolean |
| Objects | M4UStr(60) | — | — | MISSING |
| Location | M4Code(10) | warehouseId | SalesOrder | FK |
| PRCode | M4Code(20) | projectId | SalesOrder | FK |
| OrderStatus | M4Int | status | SalesOrder | TRANSFORM → enum |
| Closed | M4Mark | — | — | Map to status=CLOSED |
| OKFlag | M4Mark | — | — | Map to status=APPROVED |
| InvFlag | M4Int | — | — | Map to status=INVOICED |
| ShipFlag | M4Int | — | — | Map to status=SHIPPED |
| DiscPerc | M4Qty | discountPercent | SalesOrder | DIRECT |
| DespatchDate | M4Date | expectedShipDate | SalesOrder | **SCHEMA-GAP** |
| PlanShipDate | M4Date | — | — | JSON |
| AcceptanceStatus | M4Int | approvalStatus | SalesOrder | TRANSFORM → enum |

##### Status Machine Mapping (ORVc → SalesOrder.status)

| Legacy State | HAL Fields | Target Status | Notes |
|-------------|-----------|---------------|-------|
| Draft | OKFlag=0, Closed=0 | DRAFT | Editable |
| Approved | OKFlag=1 | APPROVED | Locked for editing |
| Partially Shipped | ShipFlag=1, InvFlag=0 | PARTIALLY_SHIPPED | **NEW** — target needs this |
| Shipped | ShipFlag=2 | SHIPPED | |
| Invoiced | InvFlag=1 | INVOICED | |
| Closed | Closed=1 | CLOSED | |
| Cancelled | (delete or cancel flag) | CANCELLED | **NEW** — target needs this |

##### Lines (ORVc.Math[] → SalesOrderLine)

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| ArtCode | M4Code(20) | itemId | SalesOrderLine | FK |
| Quant | M4UVal | quantity | SalesOrderLine | DIRECT |
| Price | M423Val | unitPrice | SalesOrderLine | DIRECT |
| Sum | M4Val | lineTotal | SalesOrderLine | DIRECT |
| vRebate | M41Val | discountPercent | SalesOrderLine | DIRECT |
| SalesAcc | M4Code(10) | revenueAccountId | SalesOrderLine | FK |
| Shipd1 + Shipd2 | M4UVal | shippedQuantity | SalesOrderLine | SUM(Shipd1+Shipd2) |
| Invd | M4UVal | invoicedQuantity | SalesOrderLine | DIRECT |
| Spec | M4Str(100) | description | SalesOrderLine | DIRECT |
| VATCode | M4Code(10) | vatCodeId | SalesOrderLine | FK |
| SerialNr | M4Str(60) | serialNumber | SalesOrderLine | **SCHEMA-GAP** |
| Location | M4Code(10) | warehouseId | SalesOrderLine | FK |

**CRITICAL NOTE:** Target SalesOrder only has `create` endpoint. Needs full CRUD + lifecycle (approve, ship, invoice, cancel, close).

---

#### QTVc → SalesQuote + SalesQuoteLine

Same pattern as Sales Order. Key differences:
- QTVc has `Probability` field → SalesQuote.winProbability (via CrmOpportunity link)
- QTVc has `ValidUntil` → SalesQuote.expiryDate
- Conversion path: QTVc → ORVc maps to SalesQuote → SalesOrder conversion

---

### 3.5 Purchasing

#### POVc → PurchaseOrder + PurchaseOrderLine

##### Header (POVc → PurchaseOrder)

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| SerNr | M4Long | orderNumber | PurchaseOrder | DIRECT |
| VECode | M4Code(20) | supplierId | PurchaseOrder | FK |
| TransDate | M4Date | orderDate | PurchaseOrder | DIRECT |
| PayDeal | M4Code(3) | termsDays | PurchaseOrder | TRANSFORM |
| OKFlag | M4Mark | status | PurchaseOrder | TRANSFORM → enum |
| ShipMode | M4Code(5) | shippingMethod | PurchaseOrder | DIRECT |
| CurncyCode | M4Code(5) | currencyCode | PurchaseOrder | FK |
| Sign | M4Code(10) | createdBy | PurchaseOrder | FK → User |
| Location | M4Code(10) | warehouseId | PurchaseOrder | FK |
| Objects | M4UStr(60) | — | — | MISSING |
| InclVAT | M4Int | taxInclusive | PurchaseOrder | Boolean |
| AcceptanceStatus | M4Int | approvalStatus | PurchaseOrder | TRANSFORM → enum |
| PRCode | M4Code(20) | projectId | PurchaseOrder | FK |

##### Lines (POVc.Math[] → PurchaseOrderLine)

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| ArtCode | M4Code(20) | itemId | PurchaseOrderLine | FK |
| VEArtCode | M4Str(20) | supplierItemCode | PurchaseOrderLine | **SCHEMA-GAP** |
| Quant | M4UVal | quantity | PurchaseOrderLine | DIRECT |
| Price | M45Val | unitPrice | PurchaseOrderLine | DIRECT |
| Sum | M45Val | lineTotal | PurchaseOrderLine | DIRECT |
| vRebate | M41Val | discountPercent | PurchaseOrderLine | DIRECT |
| VATCode | M4Code(10) | vatCodeId | PurchaseOrderLine | FK |
| Shipd1 + Shipd2 | M4UVal | receivedQuantity | PurchaseOrderLine | SUM |
| Invd | M4UVal | invoicedQuantity | PurchaseOrderLine | DIRECT |
| CostAcc | M4UStr(10) | costAccountId | PurchaseOrderLine | FK |

---

### 3.6 Inventory

#### INVc → InventoryItem (CRITICAL GAP: 211 legacy fields → 4 typed + JSON)

##### Core Fields (must be typed columns, not JSON)

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| Code | M4Code(20) | sku | InventoryItem | DIRECT |
| Name | M4Str(100) | name | InventoryItem | DIRECT |
| Unittext | M4Str(10) | unitOfMeasure | InventoryItem | DIRECT |
| ItemType | M4Int | type | InventoryItem | TRANSFORM → enum(STOCK,NON_STOCK,SERVICE) |
| Group | M4Code(5) | categoryId | InventoryItem | FK → Category |
| BarCode | M4Code(20) | barcode | InventoryItem | **SCHEMA-GAP** → add column |
| InPrice | M45Val | costPrice | InventoryItem | **SCHEMA-GAP** → add column |
| UPrice1 | M423Val | salesPrice | InventoryItem | **SCHEMA-GAP** → add column |
| WeighedAvPrice | M45Val | — | — | Calculated (WAC) |
| VATCode | M4Code(10) | defaultVatCodeId | InventoryItem | FK |

##### Fields that MUST move from JSON to typed columns

| HAL Field | HAL Type | Recommended Target | Reason |
|-----------|----------|-------------------|--------|
| MinLevel | M4Qty | reorderLevel | Reorder point automation |
| Weight | M45Val | weight | Shipping, manufacturing |
| DefLocation | M4Code(10) | defaultWarehouseId | Stock operations |
| SerNrf | M4Int | trackSerial | Serial number enforcement |
| Terminated | M4Int | isDiscontinued | Item lifecycle |
| PrimaryCostModel | M4Int | costingMethod | Inventory valuation |
| SalesAcc | M4Code(10) | salesAccountId | GL posting |
| CostAcc | M4Code(10) | costAccountId | GL posting |

##### Fields acceptable as JSON metadata

| HAL Fields | Category | JSON Key |
|-----------|----------|----------|
| Brand, BrandType, SortCode, Reference | Identification | `identification` |
| Width, Height, Depth, Volume, NetWeight | Dimensions | `dimensions` |
| AlternativeCode, GTINNumber | Barcodes | `alternateCodes` |
| HSCode | Compliance | `customs` |
| Unittext2, UnitCoefficient | Secondary UoM | `alternateUom` |
| VARList, VARMask | Variants | `variants` |
| Markup, CostPerc, PriceFactor | Pricing rules | `pricingRules` |

**Recommendation:** Promote at least 8 fields from JSON to typed columns (barcode, costPrice, salesPrice, reorderLevel, weight, defaultWarehouseId, trackSerial, costingMethod).

---

#### ITVc → Category (with GL account defaults) — SCHEMA-GAP

ITVc is the **GL account mapping hub** with 30 AccVc references and 7 VAT code references. The target Category model has no GL account defaults.

**Recommendation:** Either:
- (A) Add GL account default columns to Category model (13 account fields)
- (B) Create a new `ItemGroupGlDefaults` model linked to Category
- (C) Store GL defaults in JSON on Category (acceptable for v1)

---

#### StockMovVc → StockMovement

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| SerNr | M4Long | id | StockMovement | DIRECT |
| TransDate | M4Date | movementDate | StockMovement | DIRECT |
| FrLocation | M4Code(10) | fromWarehouseId | StockMovement | FK |
| ToLocation | M4Code(10) | toWarehouseId | StockMovement | FK |
| OKFlag | M4Mark | status | StockMovement | TRANSFORM → enum |
| StockMovType | M4Set(564) | movementType | StockMovement | TRANSFORM → enum (13 types) |
| Sign | M4Code(10) | createdBy | StockMovement | FK |
| **Array: Math** | | | **StockMovementLine** | |
| ArtCode | M4Code(20) | itemId | StockMovementLine | FK |
| Quant | M4UVal | quantity | StockMovementLine | DIRECT |
| SerialNr | M4Str(60) | serialNumber | StockMovementLine | DIRECT |
| NewPrice | M45Val | newCostPrice | StockMovementLine | DIRECT |
| OldPrice | M45Val | previousCostPrice | StockMovementLine | DIRECT |

**Legacy movement types (M4Set 564) → Target enum:**

| Legacy Value | Legacy Meaning | Target Enum |
|-------------|---------------|-------------|
| 0 | Normal Transfer | TRANSFER |
| 1 | Sale (via Invoice) | SALE |
| 2 | Purchase (via Bill) | PURCHASE |
| 3 | Production Output | PRODUCTION_OUTPUT |
| 4 | Production Consumption | PRODUCTION_CONSUMPTION |
| 5 | Adjustment (+) | ADJUSTMENT_IN |
| 6 | Adjustment (-) | ADJUSTMENT_OUT |
| 7 | Opening Balance | OPENING_BALANCE |
| 8 | Return (from Customer) | CUSTOMER_RETURN |
| 9 | Return (to Supplier) | SUPPLIER_RETURN |
| 10 | Internal Consumption | INTERNAL_CONSUMPTION |
| 11 | Quality Hold | QUALITY_HOLD |
| 12 | Scrap/Write-off | SCRAP |

---

### 3.7 CRM

#### ContactVc → CrmContact + CrmAccount

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| Code | M4Code | id | CrmContact | DIRECT |
| FirstName + Name | M4Str | firstName, lastName | CrmContact | SPLIT |
| Company | M4Str | accountId | CrmContact | FK → CrmAccount |
| Phone | M4PhoneNo | phone | CrmContact | DIRECT |
| eMail | M4Str | email | CrmContact | DIRECT |
| Comment | M4Str | notes | CrmContact | DIRECT |

#### LeadVc → CrmLead

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| Code | M4Code | id | CrmLead | DIRECT |
| Name | M4Str | name | CrmLead | DIRECT |
| Value | M4Val | estimatedValue | CrmLead | DIRECT |
| Rating | M4Int | score | CrmLead | DIRECT |
| Source | M4Code(10) | source | CrmLead | TRANSFORM → enum |
| Status | M4Code(10) | status | CrmLead | TRANSFORM → enum |

#### ActVc → CrmActivity

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| SerNr | M4Long | id | CrmActivity | DIRECT |
| ActDate | M4Date | activityDate | CrmActivity | DIRECT |
| ActType | M4Int | type | CrmActivity | TRANSFORM → enum(CALL,MEETING,EMAIL,TASK,NOTE) |
| Comment | M4Str | description | CrmActivity | DIRECT |
| ContactCode | M4Code | contactId | CrmActivity | FK |
| OKFlag | M4Mark | isCompleted | CrmActivity | Boolean |
| Sign | M4Code(10) | assignedTo | CrmActivity | FK → User |

#### CampaignVc → NOT IMPLEMENTED (MISSING in target)

---

### 3.8 HR / Payroll

#### HRMPAVc + StaffVc + CUVc(Employee) → Employee (CRITICAL GAP)

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| Employee (CUVc.Code) | M4Code(20) | employeeCode | Employee | DIRECT |
| Name (CUVc.Name) | M4Str | name | Employee | DIRECT |
| eMail (CUVc.eMail) | M4Str | email | Employee | DIRECT |
| Phone (CUVc.Phone) | M4PhoneNo | phone | Employee | JSON |
| Department (HRMCOVc.DepCode) | M4Code | departmentId | Employee | FK |
| JobTitle (HRMCOVc.JobTitle) | M4Str | jobTitle | Employee | **SCHEMA-GAP** → add |
| StartDate (HRMCOVc.StartDate) | M4Date | startDate | Employee | **SCHEMA-GAP** → add |
| GrossSalary (HRMCOVc.GrossSalary) | M4Val | — | — | SENSITIVE — JSON encrypted |
| SocialSecurityNr (CUVc) | M4Str | nationalInsuranceNo | Employee | **SCHEMA-GAP** → add |
| BirthDate (CUVc) | M4Date | dateOfBirth | Employee | JSON |
| Gender (CUVc) | M4Int | — | — | JSON |

**Target Employee has only 6 typed fields.** Recommend adding: jobTitle, startDate, departmentId, nationalInsuranceNo, managerId.

#### HRMCOVc → EmploymentContract (MISSING in target)

This is a critical gap. Legacy has a full contract register with:
- Contract period (start/end/trial)
- Job type (full-time/part-time)
- Salary details
- Benefits array (9 fields per benefit line)
- Leave scheme

**Recommendation:** Create `EmploymentContract` model linked to Employee.

#### HRMPayrollVc → PayrollRun

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| SerNr | M4Long | id | PayrollRun | DIRECT |
| TransDate | M4Date | payDate | PayrollRun | DIRECT |
| OKFlag | M4Mark | status | PayrollRun | TRANSFORM → enum |
| **Array** | | | **PayrollLine** | |
| Employee | M4Code | employeeId | PayrollLine | FK |
| GrossVal | M4Val | grossPay | PayrollLine | DIRECT |
| TaxVal | M4Val | taxDeducted | PayrollLine | DIRECT |
| NIVal | M4Val | niDeducted | PayrollLine | DIRECT |
| NetVal | M4Val | netPay | PayrollLine | DIRECT |

---

### 3.9 Fixed Assets

#### AT2Vc → FixedAsset

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| Code | M4Code | assetCode | FixedAsset | DIRECT |
| Comment | M4Str | name | FixedAsset | DIRECT |
| AcquDate | M4Date | acquisitionDate | FixedAsset | DIRECT |
| AcquCost | M4Val | acquisitionCost | FixedAsset | DIRECT |
| DepMethod | M4Int | depreciationMethod | FixedAsset | TRANSFORM → enum |
| DepRate | M4Rate | depreciationRate | FixedAsset | DIRECT |
| AccumDepr | M4Val | accumulatedDepreciation | FixedAsset | DIRECT |
| AssetAcc | M4Code(10) | assetAccountId | FixedAsset | FK |
| DeprAcc | M4Code(10) | depreciationAccountId | FixedAsset | FK |
| Status | M4Int | status | FixedAsset | TRANSFORM → enum(ACTIVE,DISPOSED,WRITTEN_OFF) |
| Location | M4Code(10) | locationId | FixedAsset | FK |
| Employee | M4Code(20) | assignedTo | FixedAsset | FK → Employee |

---

### 3.10 POS

#### POSSalesVc → PosSale + PosSaleLine

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| SerNr | M4Long | id | PosSale | DIRECT |
| TransDate | M4Date | saleDate | PosSale | DIRECT |
| CashVc | M4Code | registerId | PosSale | FK → PosRegister |
| CustCode | M4Code(20) | customerId | PosSale | FK (optional) |
| OKFlag | M4Mark | status | PosSale | TRANSFORM → enum |
| PayMode | M4Int | paymentMethod | PosSale | TRANSFORM → enum(CASH,CARD,MIXED) |
| TotVal | M4Val | totalAmount | PosSale | DIRECT |
| VATVal | M4Val | vatAmount | PosSale | DIRECT |
| **Array** | | | **PosSaleLine** | |
| ArtCode | M4Code(20) | itemId | PosSaleLine | FK |
| Quant | M4UVal | quantity | PosSaleLine | DIRECT |
| Price | M423Val | unitPrice | PosSaleLine | DIRECT |
| Sum | M4Val | lineTotal | PosSaleLine | DIRECT |

---

### 3.11 Manufacturing

#### ProdVc → Bom (Bill of Materials)

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| Code | M4Code | id | Bom | DIRECT |
| ArtCode | M4Code(20) | outputItemId | Bom | FK → InventoryItem |
| Quant | M4Qty | outputQuantity | Bom | DIRECT |
| Comment | M4Str | name | Bom | DIRECT |
| **Array** | | | **BomItem** | |
| CompArtCode | M4Code(20) | itemId | BomItem | FK |
| CompQuant | M4Qty | quantity | BomItem | DIRECT |
| Waste | M4Qty | scrapPercent | BomItem | DIRECT |

#### ProdOrderVc → WorkOrder

| HAL Field | HAL Type | Target Field | Target Model | Strategy |
|-----------|----------|-------------|-------------|----------|
| SerNr | M4Long | id | WorkOrder | DIRECT |
| BOMCode | M4Code | bomId | WorkOrder | FK → Bom |
| Quant | M4Qty | plannedQuantity | WorkOrder | DIRECT |
| StartDate | M4Date | startDate | WorkOrder | DIRECT |
| EndDate | M4Date | dueDate | WorkOrder | DIRECT |
| Status | M4Int | status | WorkOrder | TRANSFORM → enum |

---

### 3.12 Service/Contracts

#### SVOVc → OUT OF SCOPE (v1)
#### AgreementVc → SupplierContract (SKELETON in target)

---

## 4. OKFlag → Status Enum Universal Mapping

The OKFlag state machine is the most critical business pattern to migrate (REQ-UNI-001 through REQ-UNI-006).

| Entity | Legacy OKFlag States | Target Status Enum | Cross-Entity Effects on Approve |
|--------|---------------------|-------------------|-------------------------------|
| IVVc → CustomerInvoice | 0=Draft, 1=Approved, 6=Special | DRAFT, APPROVED, PAID, VOIDED, WRITTEN_OFF | GL posting (Debit AR, Credit Revenue per line), Stock reduction, AR balance update |
| PUVc → SupplierBill | 0=Draft, 1=Approved | DRAFT, APPROVED, PAID, VOIDED | GL posting (Debit Cost/Stock, Credit AP), Stock increase, AP balance update |
| ORVc → SalesOrder | 0=Draft, 1=Approved | DRAFT, APPROVED, PARTIALLY_SHIPPED, SHIPPED, INVOICED, CLOSED, CANCELLED | Stock reservation, credit limit check |
| POVc → PurchaseOrder | 0=Draft, 1=Approved | DRAFT, PENDING_APPROVAL, APPROVED, PARTIALLY_RECEIVED, RECEIVED, CLOSED, CANCELLED | Approval workflow check |
| StockMovVc → StockMovement | 0=Draft, 1=Approved | DRAFT, APPROVED | Stock quantity updates (from/to locations), FIFO cost adjustments |
| AccTransVc → JournalEntry | 0=Draft, 1=Posted | DRAFT, POSTED, REVERSED | GL balance updates |
| VATDeclVc → VatReturn | 0=Draft, 1=Filed | DRAFT, CALCULATED, FILED, SUBMITTED | HMRC MTD submission |
| HRMPayrollVc → PayrollRun | 0=Draft, 1=Processed | DRAFT, CALCULATED, APPROVED, PROCESSED, PAID | Payslip generation, GL postings, BACS file |

---

## 5. Field Richness Summary & Migration Strategy

| Entity | Legacy Fields | Target Typed Fields | JSON Fields | Dropped | Carry-Forward % | Strategy |
|--------|-------------|-------------------|------------|---------|-----------------|----------|
| Customer (CUVc) | 313 | ~15 (+7 gaps) | ~20 | ~270 | 13% | Add 7 schema-gap columns; rest in JSON or drop |
| Invoice (IVVc) | ~280 | ~30 | ~15 | ~235 | 16% | Acceptable — most legacy fields are edge-case |
| Item (INVc) | 211 | 4 (+8 promoted) | ~30 | ~170 | 20% | **Promote 8 fields from JSON to typed columns** |
| Sales Order (ORVc) | 231 | SKELETON (+20) | ~15 | ~196 | 15% | **Build out full model — current is skeleton** |
| Purchase Order (POVc) | 146 | ~20 | ~10 | ~116 | 21% | Acceptable for v1 |
| Supplier (VEVc) | 50 | ~10 (+8 gaps) | ~5 | ~27 | 56% | Add 8 schema-gap columns |
| Employee (HRMPAVc+) | ~80 | 6 (+5 promoted) | ~20 | ~50 | 39% | **Promote 5 fields; add Contract model** |
| Stock Movement | 136 | ~15 | ~5 | ~116 | 15% | Acceptable for v1 |
| GL Account (AccVc) | 22 | ~10 | ~3 | ~9 | 59% | Good coverage |
| Fixed Asset (AT2Vc) | 17 | ~12 | ~2 | ~3 | 82% | Best coverage ratio |

---

## 6. Migration Sequence (FK Dependency Order)

Entities must be migrated in dependency order to satisfy foreign key constraints.

### Phase 1: Reference Data (no FK dependencies)

| Order | Entity | Target Model | Notes |
|-------|--------|-------------|-------|
| 1.1 | CurncyCodeVc | FxRate + config | Currency codes |
| 1.2 | VATCodeBlock | VatCode | VAT codes |
| 1.3 | TaxTemplateVc | TaxTemplate | Tax templates |
| 1.4 | AccClassVc | (config) | Account classifications |
| 1.5 | ObjVc | (MISSING) | Cost centres — NOT IN TARGET |
| 1.6 | UserVc | User | User accounts |
| 1.7 | LocationVc | Warehouse | Warehouses/locations |

### Phase 2: Master Data (depends on Phase 1)

| Order | Entity | Target Model | Depends On |
|-------|--------|-------------|------------|
| 2.1 | AccVc | GlAccount | CurncyCodeVc, VATCodeBlock |
| 2.2 | BankVc | BankAccount | AccVc |
| 2.3 | ITVc | Category | AccVc, VATCodeBlock |
| 2.4 | INVc | InventoryItem | ITVc, AccVc, LocationVc |
| 2.5 | CUVc (Customer) | Customer | CurncyCodeVc, VATCodeBlock |
| 2.6 | VEVc | Supplier | CurncyCodeVc, VATCodeBlock |
| 2.7 | CUVc (Employee) | Employee | — |
| 2.8 | ContactVc | CrmContact + CrmAccount | CUVc |

### Phase 3: Transactional Data (depends on Phase 2)

| Order | Entity | Target Model | Depends On |
|-------|--------|-------------|------------|
| 3.1 | AccTransVc | JournalEntry + JournalLine | AccVc |
| 3.2 | ORVc | SalesOrder + Lines | CUVc, INVc, LocationVc |
| 3.3 | POVc | PurchaseOrder + Lines | VEVc, INVc, LocationVc |
| 3.4 | IVVc | CustomerInvoice + Lines | CUVc, INVc, AccVc, ORVc |
| 3.5 | PUVc | SupplierBill + Lines | VEVc, INVc, AccVc, POVc |
| 3.6 | StockMovVc | StockMovement + Lines | INVc, LocationVc |
| 3.7 | ARPayVc | CustomerPayment | CUVc, IVVc, BankVc |
| 3.8 | APPayVc | SupplierPayment | VEVc, PUVc, BankVc |
| 3.9 | QTVc | SalesQuote + Lines | CUVc, INVc |

### Phase 4: Operational Data (depends on Phase 3)

| Order | Entity | Target Model | Depends On |
|-------|--------|-------------|------------|
| 4.1 | HRMCOVc | EmploymentContract | Employee |
| 4.2 | HRMPayrollVc | PayrollRun + Lines | Employee |
| 4.3 | AT2Vc | FixedAsset | AccVc |
| 4.4 | ProdVc | Bom | INVc |
| 4.5 | ProdOrderVc | WorkOrder | ProdVc, INVc |
| 4.6 | VATDeclVc | VatReturn | AccVc |
| 4.7 | POSSalesVc | PosSale | INVc, CashVc |
| 4.8 | ActVc | CrmActivity | ContactVc |
| 4.9 | LeadVc | CrmLead | ContactVc |
| 4.10 | BankRecVc | BankReconciliation | BankVc |

---

## 7. Key Migration Decisions

### 7.1 Already Decided

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database-per-tenant | Yes | tenantId columns removed from per-tenant tables |
| Fresh codebase | Yes | Not a fork; extract business logic, not code |
| AI-first interaction | Yes | Conversational primary, forms secondary |
| UK payroll via API | Yes | Staffology/PayRun.io integration vs building PAYE/NI |
| 5 core modules | Yes | Invoicing & Accounts, Inventory/Stock, CRM, HR/Payroll, Reporting |
| Single base currency | Yes | Not dual-base like legacy |
| UK-only localization | Yes | Legacy supports 20+ countries |

### 7.2 Decisions Needed

| # | Decision | Options | Impact | Recommendation |
|---|----------|---------|--------|----------------|
| D-1 | How many legacy IVVc fields to carry forward? | (A) Minimal ~30 (B) Moderate ~50 (C) Full ~80 | Invoice richness | **(A) Minimal** — add fields as needed |
| D-2 | Should Item metadata move from JSON to relational? | (A) Yes — 8 key fields (B) No — keep JSON | Item queryability | **(A) Yes** — promote 8 fields |
| D-3 | Should ITVc GL defaults map to categories? | (A) JSON on Category (B) Separate GlDefaults model (C) Skip | Account mapping | **(A) JSON** — simplest for v1 |
| D-4 | Carry forward multi-address? | (A) JSON (B) Address model (C) Single address | Customer/Invoice | **(A) JSON** — billingAddress + shippingAddress as JSON |
| D-5 | Create EmploymentContract model? | (A) Yes (B) Extend Employee JSON (C) Skip | HR data integrity | **(A) Yes** — contracts are a legal requirement |
| D-6 | Which legacy reports are needed first? | Core financial ~20 vs Extended ~50 | Report scope | **Core 20** — P&L, BS, TB, AR/AP aging, VAT, cashflow |
| D-7 | Dual storage consolidation strategy? | (A) Prisma-only (B) JSON-only (C) Keep hybrid | Data consistency | **(A) Prisma-only** — single source of truth |

---

## 8. Risk Assessment

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| **Data loss from JSON storage** | HIGH | HIGH | Promote critical fields to typed columns before migration |
| **Business rule gaps** | HIGH | HIGH | Only 20% of 300+ rules implemented — prioritize OKFlag lifecycle |
| **SalesOrder skeleton** | CRITICAL | CERTAIN | Must build full CRUD + lifecycle before production |
| **Transactional integrity** | HIGH | MEDIUM | Wrap stock movement operations in PostgreSQL transactions |
| **Credit limit not enforced** | MEDIUM | HIGH | Implement at least basic mode on invoice creation |
| **Serial number not enforced** | MEDIUM | MEDIUM | Enforce trackSerial flag in stock operations |
| **No cost centre/dimensions** | MEDIUM | HIGH | Defer to v2 or implement as JSON tags |
| **Report coverage 2%** | HIGH | CERTAIN | Prioritize core financial reports using target report service |
| **Employee model too thin** | HIGH | HIGH | Promote 5 fields + create Contract model |

---

## 9. OPEN QUESTIONS (Migration)

| # | Question | Priority | Status | Resolution |
|---|----------|----------|--------|------------|
| OQ-MG1 | What is the exact CUVc (Customer) field list? | P0 | **ANSWERED** | 313 fields — see DATA_MODEL.md Section 3.1 |
| OQ-MG2 | What is the exact INVc (Item) field list? | P0 | **ANSWERED** | 211 fields — see DATA_MODEL.md Section 3.2 |
| OQ-MG3 | What business rules in RActions must be replicated? | P0 | **ANSWERED** | 300+ rules — see CODE_REQUIREMENTS.md |
| OQ-MG4 | What are the legacy report parameters? | P1 | OPEN | hal/Reports/ — 743 files |
| OQ-MG5 | What export/import formats are needed for UK? | P1 | OPEN | BACS (payments), MT940 (bank statements), MTD (HMRC) |
| OQ-MG6 | What VAT/Tax rules are UK-specific? | P0 | PARTIAL | Standard/Reduced/Zero rated + reverse charge + MTD |
| OQ-MG7 | What HAL enum values map to which Set numbers? | P1 | OPEN | Requires haldefs.h parsing (228K file) |
| OQ-MG8 | Which of 1,055 entities are used by StandardERP only? | P2 | OPEN | english/StandardERP/sku.hal defines product scope |
| OQ-MG9 | How to handle CUVc dual-purpose (Customer+Supplier)? | P0 | **DECIDED** | Split into separate Customer + Supplier models |
| OQ-MG10 | Should historical data be migrated or fresh start? | P0 | OPEN | Stakeholder decision — affects migration complexity |

---

## 10. Cross-References

| Document | Relevance |
|----------|-----------|
| [DATA_MODEL.md](DATA_MODEL.md) | Source schema — all 54 registers with 3,170 fields |
| [CODE_REQUIREMENTS.md](CODE_REQUIREMENTS.md) | Business rules — 300+ rules from 14 RAction files |
| [DIFF_AND_GAPS.md](DIFF_AND_GAPS.md) | Gap analysis — legacy vs target per module |
| [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) | Consolidated open questions |
| [REPO_MAP.md](REPO_MAP.md) | Legacy codebase structure |
| [MANUAL_EXTRACT.md](MANUAL_EXTRACT.md) | HansaWorld manual extraction |
| [erp-module-status-summary.md](../_bmad-output/planning-artifacts/erp-module-status-summary.md) | Target module completion status |

---

*This document provides the field-level migration map from HansaWorld HAL to Nexa ERP PostgreSQL. It should be used alongside DATA_MODEL.md (source truth) and the target Prisma schema (once generated) to guide implementation.*
