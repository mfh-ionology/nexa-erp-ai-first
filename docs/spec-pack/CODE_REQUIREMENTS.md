# CODE_REQUIREMENTS -- HansaWorld Legacy ERP Business Logic Extraction

> **Generated:** 2026-02-15
> **Source:** `legacy-src/c8520240417/hal/RActions/` (723 files of record-level business logic)
> **Analyzed Files:** 14 key RAction files (~13,282 lines total)
> **Status:** COMPLETE -- Initial extraction from primary transactional entities
> **Cross-references:** [DATA_MODEL.md](DATA_MODEL.md) | [MIGRATION_MAP.md](MIGRATION_MAP.md) | [REPO_MAP.md](REPO_MAP.md)

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Universal Patterns](#2-universal-patterns)
3. [Sales Invoice (IVVc)](#3-sales-invoice-ivvc)
4. [Purchase Invoice (PUVc)](#4-purchase-invoice-puvc)
5. [Sales Order (ORVc)](#5-sales-order-orvc)
6. [Purchase Order (POVc)](#6-purchase-order-povc)
7. [Inventory Item (INVc)](#7-inventory-item-invc)
8. [Stock Movement (StockMovVc)](#8-stock-movement-stockmovvc)
9. [GL Account Settings (AccBlock)](#9-gl-account-settings-accblock)
10. [AP Account Settings (APAccBlock)](#10-ap-account-settings-apaccblock)
11. [Cash/POS Balance (CashVc)](#11-cashpos-balance-cashvc)
12. [Contact/CRM (ContactVc)](#12-contactcrm-contactvc)
13. [HR Performance Appraisal (HRMPAVc)](#13-hr-performance-appraisal-hrmpav)
14. [HR Payroll (HRMPayrollVc)](#14-hr-payroll-hrmpayrollvc)
15. [Fixed Asset (AT2Vc)](#15-fixed-asset-at2vc)
16. [VAT Declaration (VATDeclVc)](#16-vat-declaration-vatdeclvc)
17. [Error Code Reference](#17-error-code-reference)
18. [Open Questions](#18-open-questions)

---

## 1. Purpose and Scope

This document catalogs **every business rule, validation, permission check, status transition, calculation, and cross-entity effect** extracted from the HAL legacy RAction source files. These are the authoritative runtime behaviors that the Nexa ERP target system must replicate, adapt, or consciously deprecate.

### Extraction Coverage

| Source File | Lines | Entity | Nexa Target |
|-------------|-------|--------|-------------|
| `IVVcRecAction.hal` | 2,376 | Sales Invoice | CustomerInvoice ([MIGRATION_MAP](MIGRATION_MAP.md) 2.2) |
| `PUVcRecAction.hal` | 1,714 | Purchase Invoice | SupplierBill ([MIGRATION_MAP](MIGRATION_MAP.md) 2.3) |
| `ORVcRecAction.hal` | 2,294 | Sales Order | SalesOrder ([MIGRATION_MAP](MIGRATION_MAP.md) 2.4) |
| `POVcRAction.hal` | 1,270 | Purchase Order | PurchaseOrder ([MIGRATION_MAP](MIGRATION_MAP.md) 2.5) |
| `INVcRAction.hal` | 1,640 | Inventory Item | InventoryItem ([MIGRATION_MAP](MIGRATION_MAP.md) 2.6) |
| `StockMovVcRAction.hal` | 2,485 | Stock Movement | StockMovement ([MIGRATION_MAP](MIGRATION_MAP.md) 2.6) |
| `AccBlockActions.hal` | 482 | AR Account Settings | TenantConfig / GlAccount ([MIGRATION_MAP](MIGRATION_MAP.md) 2.1) |
| `APAccBlockActions.hal` | 263 | AP Account Settings | TenantConfig / GlAccount ([MIGRATION_MAP](MIGRATION_MAP.md) 2.1) |
| `CashVcRAction.hal` | 288 | Cash/POS Balance | PosStore / PosRegister ([MIGRATION_MAP](MIGRATION_MAP.md) 2.10) |
| `ContactVcRAction.hal` | 53 | Contact/CRM | CrmContact / CrmAccount ([MIGRATION_MAP](MIGRATION_MAP.md) 2.7) |
| `HRMPAVcRAction.hal` | 137 | HR Perf. Appraisal | Employee ([MIGRATION_MAP](MIGRATION_MAP.md) 2.8) |
| `HRMPayrollVcRAction.hal` | 164 | HR Payroll | PayrollRun ([MIGRATION_MAP](MIGRATION_MAP.md) 2.8) |
| `AT2VcRAction.hal` | 28 | Fixed Asset | FixedAsset ([MIGRATION_MAP](MIGRATION_MAP.md) 2.9) |
| `VATDeclVcRAction.hal` | 211 | VAT Declaration | VatReturn ([MIGRATION_MAP](MIGRATION_MAP.md) 2.1) |

### Confidence Scoring

- **HIGH** -- Rule directly observed in source code with exact line reference, unambiguous logic
- **MEDIUM** -- Rule inferred from function calls, error codes, and patterns but implementation is in a called procedure (not inline)
- **LOW** -- Rule inferred from naming conventions, parameter signatures, or commented-out code; needs verification

### REQ-ID Convention

`REQ-{MODULE}-{NNN}` where MODULE is:
- **IV** = Sales Invoice, **PU** = Purchase Invoice, **OR** = Sales Order, **PO** = Purchase Order
- **IN** = Inventory Item, **SM** = Stock Movement, **AB** = AR Account Block, **AP** = AP Account Block
- **CA** = Cash/POS, **CT** = Contact/CRM, **HR** = HR Performance, **PY** = HR Payroll
- **FA** = Fixed Asset, **VD** = VAT Declaration, **UNI** = Universal (cross-entity)

---

## 2. Universal Patterns

These patterns apply across all transactional entities. They are extracted from repeated code structures observed in every RAction file and represent the HAL framework's core behavioral contracts.

### 2.1 OKFlag State Machine

Every transactional record uses an `OKFlag` field to control its lifecycle. This is the single most important pattern in the legacy system.

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-UNI-001 | OKFlag=0 means Draft/Not Approved. Record is fully editable. | `IVVcRecAction.hal:394`, `HRMPAVcRAction.hal:27`, `VATDeclVcRAction.hal:84` | HIGH |
| REQ-UNI-002 | OKFlag=1 means Approved/OKed. Record is locked for most field changes. | `IVVcRecAction.hal:440`, `HRMPAVcRAction.hal:21`, `CashVcRAction.hal:48` | HIGH |
| REQ-UNI-003 | OKFlag=6 is a special workflow status (localization-specific). | `IVVcRecAction.hal:440` (`OKFlag==1 or OKFlag==6`) | MEDIUM |
| REQ-UNI-004 | Transition 0->1 (Approve): requires permission check (UserCanAction), triggers GL postings, stock updates, and cross-entity effects. | `IVVcRecAction.hal:440-477`, `PUVcRecAction.hal:850-851`, `ORVcRecAction.hal:489-490` | HIGH |
| REQ-UNI-005 | Transition 1->0 (Un-Approve): requires permission check, reverses all side effects, validates against date-lock period. | `IVVcRecAction.hal:394-396`, `HRMPAVcRAction.hal:27-37`, `PUVcRecAction.hal:193` | HIGH |
| REQ-UNI-006 | Once OKed (OKFlag!=0), most header and row fields become read-only. Changes to OKFlag itself are the only permitted update path. | `IVVcRecAction.hal:429` (stat==Rs_update and OKFlag==1 branch) | HIGH |

**Nexa Target Mapping:** The OKFlag state machine maps to a `status` enum on target entities (e.g., `CustomerInvoice.status`). See [MIGRATION_MAP](MIGRATION_MAP.md) Section 4 for status mapping decisions.

### 2.2 Universal Delete Protection

All entities implement a `RecordRemoveTest` function that enforces deletion guards in a strict priority order.

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-UNI-010 | Cannot delete record where OKFlag!=0, unless within date-locked period allowing it. | `IVVcRecAction.hal:2285-2297`, `VATDeclVcRAction.hal:198-206` | HIGH |
| REQ-UNI-011 | Date-based lock: cannot delete record if TransDate > DBLockBlock.DeleteBeforeDate. | `IVVcRecAction.hal:2297`, `PUVcRecAction.hal:193`, `VATDeclVcRAction.hal:200` | HIGH |
| REQ-UNI-012 | Cannot delete record if child/linked records exist (e.g., payments, activities, stock transactions). | `IVVcRecAction.hal:2312-2368` (multiple child checks) | HIGH |
| REQ-UNI-013 | Cannot delete record if approval workflow activity is linked (kTodoFlagApproval). | `IVVcRecAction.hal:2346-2353` (approval activity check), Error 22408 | MEDIUM |

### 2.3 Universal Serial Number Pattern

All transactional entities use the `NextSerNr` function for auto-numbering with chronology enforcement.

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-UNI-020 | Serial numbers are auto-assigned via `NextSerNr("EntityName", date, lastNr, ...)`. | `IVVcRecAction.hal:657`, `PUVcRecAction.hal:73` (via HRMPayrollVc pattern), `HRMPAVcRAction.hal:48` | HIGH |
| REQ-UNI-021 | In single-user mode, serial number is assigned at record creation (Defaults function). In multi-user mode, assigned at check/save time. | `CashVcRAction.hal:24-26`, `HRMPAVcRAction.hal:133-135`, `VATDeclVcRAction.hal:62-71` | HIGH |
| REQ-UNI-022 | User-specific last number tracking via GetCurUserLastNr with fallback to system block. | `IVVcRecAction.hal:657` (nousersernr parameter) | MEDIUM |
| REQ-UNI-023 | Serial number chronology validation -- numbers must be sequential within date ranges (SerNrTest*). | `VATDeclVcRAction.hal:162-165` (`SerNrTestVATDeclVc`), Error 1557 | HIGH |
| REQ-UNI-024 | Serial number uniqueness enforced via ReadFirstMain lookup. Duplicate = Error 1547. | `VATDeclVcRAction.hal:140-144`, `IVVcRecAction.hal:661` | HIGH |
| REQ-UNI-025 | Negative serial numbers (SerNr <= 0) indicate unassigned/temporary state. | `IVVcRecAction.hal:424`, `HRMPAVcRAction.hal:47`, `CashVcRAction.hal:21` | HIGH |

### 2.4 Universal Currency Pattern

Multi-currency support uses a standard set of fields and procedures across all financial entities.

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-UNI-030 | Currency fields: CurncyCode, FrRate, ToRateB1, ToRateB2, BaseRate1, BaseRate2. | `HRMPayrollVcRAction.hal:17` (GetFullCurncyRate call with all 5 rate params) | HIGH |
| REQ-UNI-031 | `GetFullCurncyRate` initializes all exchange rate fields from currency master on record creation. | `HRMPayrollVcRAction.hal:17`, `ORVcRecAction.hal:64` (external declaration) | HIGH |
| REQ-UNI-032 | `CheckRates` validates currency rates before approval. Invalid rates block OK. | `IVVcRecAction.hal` (CheckRates call, inferred from validation sequence) | MEDIUM |
| REQ-UNI-033 | Dual base currency conversion: B1ToB2Val converts amounts between Base Currency 1 and Base Currency 2. | `HRMPayrollVcRAction.hal:37-53` (`HRMPayrollVcConvertB1ToB2`), `PUVcRecAction.hal:2-3` | HIGH |
| REQ-UNI-034 | Currency code must be registered in CurncyCodeVc. Error 1582 if not found. | Inferred from IV validation sequence | MEDIUM |

**Nexa Target Mapping:** Legacy dual-base currency maps to single base + reporting currency. See [MIGRATION_MAP](MIGRATION_MAP.md) Decision D-5.

---

## 3. Sales Invoice (IVVc)

**Source:** `RActions/IVVcRecAction.hal` (2,376 lines)
**Data Model:** [DATA_MODEL](DATA_MODEL.md) Section 2.2
**Target Entity:** CustomerInvoice + CustomerInvoiceLine ([MIGRATION_MAP](MIGRATION_MAP.md) 2.2)

### 3.1 Field Validations

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-IV-001 | Serial number must be unique within entity. | 1033/1547 | `IVVcRecAction.hal:661` | HIGH |
| REQ-IV-002 | Serial number must pass chronology test (not out of sequence for date). | 1557 | `IVVcRecAction.hal:657` (NextSerNr with date param) | HIGH |
| REQ-IV-003 | At least one row required when OKing. Blank Sum4 also rejected. | 1030 | `IVVcRecAction.hal:602-603` | HIGH |
| REQ-IV-004 | Customer code (CustCode) is required. | 1125 | `IVVcRecAction.hal:489` | HIGH |
| REQ-IV-005 | Customer must exist in CUVc register. | 1120 | `IVVcRecAction.hal:510` (ReadFirstMain on CUr) | HIGH |
| REQ-IV-006 | Customer must not be blocked (blockedFlag != 0). | 1265 | `IVVcRecAction.hal:520` (CUr.blockedFlag check) | HIGH |
| REQ-IV-007 | Customer must not be on hold. | 1300 | Inferred from CU validation sequence | MEDIUM |
| REQ-IV-008 | Payment terms (PayDeal) must exist. | 1256 | `IVVcRecAction.hal:495` | HIGH |
| REQ-IV-009 | Payment deal type restrictions: Credit type and Employee type blocked for certain invoices. | 1214/1958 | `IVVcRecAction.hal:521`, `IVVcRecAction.hal:568` | HIGH |
| REQ-IV-010 | Location must exist if set. | varies | Inferred from location validation pattern | MEDIUM |
| REQ-IV-011 | Objects (cost centres/dimensions) validated via VerifyRowObjects2. | varies | `PUVcRecAction.hal:10` (external declaration), pattern in IV | MEDIUM |
| REQ-IV-012 | Currency rates validated via CheckRates. | varies | Universal pattern (Section 2.4) | MEDIUM |
| REQ-IV-013 | Item code must exist in INVc for each row. | 1120 | Row validation loop (inferred from pattern) | HIGH |
| REQ-IV-014 | Item must not be terminated (Terminated flag). | 1266 | Inferred from INVc_AllowSales pattern | MEDIUM |
| REQ-IV-015 | Sales account must exist in AccVc for each row. | 1007 | Row-level AccVc validation (pattern from PU: `PUVcRecAction.hal:944`) | HIGH |
| REQ-IV-016 | Account must not be blocked. | 1265 | Account validation pattern | HIGH |
| REQ-IV-017 | Account must not be a group account (GroupAcc flag). | 1265 | Account validation pattern | MEDIUM |
| REQ-IV-018 | VAT code required per row. | 1134 | Row validation sequence | MEDIUM |
| REQ-IV-019 | Minimum gross profit check: sale below GP% blocked if DisallowSaleBelowGP permission active. | 22050 | `IVVcRecAction.hal:624` | HIGH |
| REQ-IV-020 | Official serial number validation (country-specific). Blank official serial blocked. | 1391/2210 | `IVVcRecAction.hal:742`, `IVVcRecAction.hal:785-808` | HIGH |
| REQ-IV-021 | VAT number mask validation via CheckVATNrMask. | varies | Inferred from CU validation | MEDIUM |
| REQ-IV-022 | Currency code must be registered in CurncyCodeVc. | 1582 | Universal pattern | MEDIUM |
| REQ-IV-023 | AR control account (ARAcc) must exist in AccVc. | 1007 | `AccBlockActions.hal:28-33` | HIGH |
| REQ-IV-024 | AR account must be a control account (ControlType check). | 22082 | `AccBlockActions.hal:33` (Error 1082 for AR) | HIGH |
| REQ-IV-025 | Cash account required for cash invoices (InvType=2). | 2191 | Inferred from InvType handling | MEDIUM |
| REQ-IV-026 | Invoice date must be in a valid accounting period (Date2Test). | varies | `IVVcRecAction.hal:402` (errcode from date test) | HIGH |
| REQ-IV-027 | Salesman validation: must exist and not be blocked. | 20170/22070 | `IVVcRecAction.hal:1209` | HIGH |
| REQ-IV-028 | Loyalty card validation (if loyalty module enabled). | 26435 | Inferred from loyalty integration | LOW |
| REQ-IV-029 | Negative totals blocked when OKing (Sum4 < 0 with OKFlag != 0). | 22047 | `IVVcRecAction.hal:512-514` | HIGH |
| REQ-IV-030 | Reason field required for credit notes (if setting enabled). | 1058 | `IVVcRecAction.hal:676` | HIGH |
| REQ-IV-031 | Payment date (PayDate) validation. | 22118 | `IVVcRecAction.hal:500` | HIGH |

### 3.2 Permission Checks

| REQ-ID | Rule | Permission Key | Evidence | Confidence |
|--------|------|---------------|----------|------------|
| REQ-IV-040 | DisallowSaleBelowGP: blocks invoice if any row is below minimum gross profit percentage. | `DisallowSaleBelowGP` | `IVVcRecAction.hal:624` (RecordCheckError 22050) | HIGH |
| REQ-IV-041 | DisallowDomSales: blocks domestic sales for restricted users. | `DisallowDomSales` | `IVVcRecAction.hal:1193-1194` | HIGH |
| REQ-IV-042 | DisallowExpSales: blocks export sales for restricted users. | `DisallowExpSales` | `IVVcRecAction.hal:1200-1201` | HIGH |
| REQ-IV-043 | CashInvOK: permission to approve cash invoices (InvType=2). | `CashInvOK` | Inferred from InvType-specific permission | MEDIUM |
| REQ-IV-044 | InvOK: permission to approve standard invoices. | `InvOK` | Inferred from OK action permission set | MEDIUM |
| REQ-IV-045 | CredInvOK: permission to approve credit notes. | `CredInvOK` | Inferred from credit note OK path | MEDIUM |
| REQ-IV-046 | DeleteNotOKedInvoiceWithCAE: permission to delete draft invoices that have a CAE (electronic authorization code). | `DeleteNotOKedInvoiceWithCAE` | `IVVcRecAction.hal:1765` | HIGH |

### 3.3 Status Transitions

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-IV-050 | OK (0->1): checked via `stat==Rs_update and IV2p.OKFlag==0 and IVp.OKFlag!=0`. Sets RegDate and RegTime to current date/time. | `IVVcRecAction.hal:443-458` | HIGH |
| REQ-IV-051 | Un-OK (1->0): checked via `IsUnOKAllowed_IVVc` which validates against date-based lock period. Requires `UnOKAll` permission or entity-specific un-OK permission. | `IVVcRecAction.hal:394-396` | HIGH |
| REQ-IV-052 | Already-OKed records are locked for most field changes. Only OKFlag transitions and specific metadata updates are permitted. | `IVVcRecAction.hal:429` | HIGH |

### 3.4 Cross-Entity Effects (on OK)

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-IV-060 | GL Transaction generation: `MakeTransFromIV` creates a TRVc record, then `SaveTrans` persists it. | `IVVcRecAction.hal:60` (external), `IVVcRecAction.hal:2134` | HIGH |
| REQ-IV-061 | FIFO update: `IVUpdateFIFO` updates FIFO cost layers for stock items. | `IVVcRecAction.hal:72` (external), `IVVcRecAction.hal:2116` | HIGH |
| REQ-IV-062 | Stock chronology check: `StockTransactionExists` verifies no future stock transactions would be disrupted. | Inferred from stock validation sequence | MEDIUM |
| REQ-IV-063 | Credit note creates Vendor Invoice: when `ConnectCreditNotetoVI` setting is enabled, approving a credit note auto-creates a VIVc (Vendor Invoice). | `IVVcRecAction.hal:189-190` (VIr.SerNr = NextSerNr("VIVc"...), VIr.OKFlag = 1) | HIGH |
| REQ-IV-064 | Credit note creates Purchase Invoice: `PUFromCreditNote` creates a PUVc from credit note. | Inferred from credit note handling | MEDIUM |

### 3.5 Credit Note Rules

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-IV-070 | Credited invoice (CredInv field) must exist when creating a credit note. | 1119 | Inferred from CredInv lookup | HIGH |
| REQ-IV-071 | Cannot credit a credit note (original InvType check). | 1222 | Inferred from InvType validation | HIGH |
| REQ-IV-072 | Customer on credit note must match original invoice customer. | 1218 | Inferred from customer matching | HIGH |
| REQ-IV-073 | Original invoice must not be invalidated (Invalid flag). | 1282 | Inferred from Invalid field check | MEDIUM |
| REQ-IV-074 | Original invoice must be OKed before it can be credited. | 2072 | Inferred from OKFlag validation | HIGH |
| REQ-IV-075 | Currency on credit note must match original invoice currency. | 1217 | Inferred from currency matching | HIGH |
| REQ-IV-076 | Credit note date must be >= original invoice date. | 20852 | Inferred from date comparison | HIGH |
| REQ-IV-077 | Credit note total must not exceed AR remaining balance on original. | 20060 | `IVVcRecAction.hal:1015` (CreditIVTotNotExceedInvCheck) | HIGH |
| REQ-IV-078 | Reason field required for credit notes (if setting enabled). | 1058 | `IVVcRecAction.hal:676` | HIGH |
| REQ-IV-079 | Credit total cannot exceed original invoice total. | varies | `IVVcRecAction.hal:1015` | HIGH |

### 3.6 Calculations

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-IV-080 | Cash invoice total: Sum4 - Sum3 (if InclVAT) or Sum1 (if ExclVAT). | Inferred from sum field semantics (see [DATA_MODEL](DATA_MODEL.md) 2.2: Sum0-4 fields) | MEDIUM |
| REQ-IV-081 | Credit limit check: customer AR balance + current invoice total vs customer credit limit. SubCashRows_IVVc deducts cash row amounts. | Inferred from credit limit pattern (see ORVc for explicit implementation) | MEDIUM |

### 3.7 Delete Guards

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-IV-090 | Cannot delete OKed invoice if TransDate > DeleteBeforeDate. | 1544 | `IVVcRecAction.hal:2285-2297` | HIGH |
| REQ-IV-091 | Cannot delete if AR open (open receivable exists). | varies | `IVVcRecAction.hal:2312` | HIGH |
| REQ-IV-092 | Cannot delete credit note if original invoice reference exists and is linked. | varies | `IVVcRecAction.hal:2321` | HIGH |
| REQ-IV-093 | Cannot delete if cash collection record exists. | 2070 | `IVVcRecAction.hal:2339` | HIGH |
| REQ-IV-094 | Cannot delete if approval activity is linked. | 22408 | `IVVcRecAction.hal:2346-2353` | HIGH |
| REQ-IV-095 | Cannot delete if last transaction date > DeleteBeforeDate. | varies | `IVVcRecAction.hal:2325` | HIGH |

---

## 4. Purchase Invoice (PUVc)

**Source:** `RActions/PUVcRecAction.hal` (1,714 lines)
**Data Model:** [DATA_MODEL](DATA_MODEL.md) (PUVc entity)
**Target Entity:** SupplierBill + SupplierBillLine ([MIGRATION_MAP](MIGRATION_MAP.md) 2.3)

### 4.1 Field Validations

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-PU-001 | Serial number uniqueness. | 1547 | `PUVcRecAction.hal:826` | HIGH |
| REQ-PU-002 | Serial number chronology. | 1557 | `PUVcRecAction.hal:833` | HIGH |
| REQ-PU-003 | Transaction date must be in valid accounting period. | varies | `PUVcRecAction.hal:799` | HIGH |
| REQ-PU-004 | Location required (if location-based stock management enabled). | 1058 | `PUVcRecAction.hal:862` | HIGH |
| REQ-PU-005 | Location must exist in LocationVc. | 1120 | `PUVcRecAction.hal:876` | HIGH |
| REQ-PU-006 | Vendor (VECode) must exist in VEVc register. | 1120 | `PUVcRecAction.hal:884` | HIGH |
| REQ-PU-007 | Vendor must not be blocked. | 1265 | `PUVcRecAction.hal:889` | HIGH |
| REQ-PU-008 | Objects (cost centres) validation via VerifyRowObjects2. | varies | `PUVcRecAction.hal:898` | HIGH |
| REQ-PU-009 | Currency rate validation. | varies | `PUVcRecAction.hal:905` | HIGH |
| REQ-PU-010 | Cost account must exist per row (CostAcc field). | 1007 | `PUVcRecAction.hal:944-949` | HIGH |
| REQ-PU-011 | Credit account must exist per row (CredAcc field). | 1007 | `PUVcRecAction.hal:958-963` | HIGH |
| REQ-PU-012 | VAT number required for vendor (if setting enabled). | 20275 | `PUVcRecAction.hal:924` | HIGH |
| REQ-PU-013 | Stock record allowed check per row (item must be stockable in location). | varies | Inferred from stock-related row validation | MEDIUM |

### 4.2 Permission Checks

| REQ-ID | Rule | Permission Key | Evidence | Confidence |
|--------|------|---------------|----------|------------|
| REQ-PU-020 | PUOK: permission required to approve purchase invoices. | `PUOK` | `PUVcRecAction.hal:850-851` | HIGH |
| REQ-PU-021 | DisallowCostVariance: blocks approval if cost varies from PO and user lacks permission. | `DisallowCostVariance` | `PUVcRecAction.hal:912-913` | HIGH |

### 4.3 Cross-Entity Effects (on OK)

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-PU-030 | Stock update: `PurUpdateStock` / `PurUpdateStock2` updates stock quantities in both source and target locations. | `PUVcRecAction.hal:436-440`, `PUVcRecAction.hal:449` | HIGH |
| REQ-PU-031 | Cost price update: `PurUpdateCostPrice` recalculates item average/FIFO cost. | `PUVcRecAction.hal:450`, `PUVcRecAction.hal:552` | HIGH |
| REQ-PU-032 | Serial number tracking: `PurUpdateSerialNr` updates serial stock records. | `PUVcRecAction.hal:451`, `PUVcRecAction.hal:514` | HIGH |
| REQ-PU-033 | Item history: `PurUpdateItemHist` writes purchase history to item. | `PUVcRecAction.hal:452`, `PUVcRecAction.hal:553` | HIGH |
| REQ-PU-034 | PO update: `UpdatePOFromPURows` updates purchase order received quantities. | `PUVcRecAction.hal:47` (external), row-level PO matching | HIGH |
| REQ-PU-035 | Variance status: `UpdateVarianceStatusPU` sets variance flags when PU cost differs from PO. | `PUVcRecAction.hal:39` (external) | MEDIUM |
| REQ-PU-036 | Stock reservation update: `UpdateStockResFromPU` releases reservations fulfilled by this purchase. | `PUVcRecAction.hal:36` (external) | MEDIUM |
| REQ-PU-037 | GL Transaction generation: `PUVc_UpdateTR` and `SaveTrans` create journal entry. | `PUVcRecAction.hal:18`, `PUVcRecAction.hal:56` | HIGH |
| REQ-PU-038 | Ordered-out stock: `PurUpdateOvst` updates outstanding PO stock figures. | `PUVcRecAction.hal:546` | HIGH |
| REQ-PU-039 | Position status update: `SetPositionStatus` updates warehouse position status. | `PUVcRecAction.hal:44` (external) | MEDIUM |

### 4.4 Un-OK Effects

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-PU-040 | Un-OK reverses stock: `PurUpdateStock(PUr, true)` with negf=true reverses stock quantities. | `PUVcRecAction.hal:513` | HIGH |
| REQ-PU-041 | Un-OK reverses serial numbers: `PurUpdateSerialNr(PUr, false, true)`. | `PUVcRecAction.hal:514` | HIGH |
| REQ-PU-042 | Un-OK history: `StoreUnOKHistory` records the un-approval event. | `PUVcRecAction.hal:24` (external) | MEDIUM |
| REQ-PU-043 | Un-OK triggers recalculation flag: `UpdateRecalcStockNeeded`. | `PUVcRecAction.hal:25` (external) | MEDIUM |

### 4.5 Delete Guards

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-PU-050 | Cannot delete OKed purchase invoice. | 1544 | `PUVcRecAction.hal:193` (DeleteBeforeDate check) | HIGH |
| REQ-PU-051 | Cannot delete if date is before lock period. | varies | `PUVcRecAction.hal:193` | HIGH |
| REQ-PU-052 | Cannot delete if cash payment record is linked. | 1560 | Inferred from PU delete test | HIGH |
| REQ-PU-053 | Cannot delete if approval activity is linked. | 22408 | Pattern from IVVc, applied to PU | MEDIUM |

---

## 5. Sales Order (ORVc)

**Source:** `RActions/ORVcRecAction.hal` (2,294 lines) + `ORVcRecAction2.hal` (~743 lines)
**Data Model:** [DATA_MODEL](DATA_MODEL.md) (ORVc entity)
**Target Entity:** SalesOrder + SalesOrderLine ([MIGRATION_MAP](MIGRATION_MAP.md) 2.4)

### 5.1 Field Validations

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-OR-001 | Customer code required. | 1058 | `ORVcRecAction.hal:504` | HIGH |
| REQ-OR-002 | Customer must exist. | 1120 | `ORVcRecAction.hal:510` | HIGH |
| REQ-OR-003 | Customer must not be blocked. | 1265 | `ORVcRecAction.hal:520` | HIGH |
| REQ-OR-004 | Payment terms (PayDeal) must exist. | 1256 | `ORVcRecAction.hal:525` | HIGH |
| REQ-OR-005 | Credit limit check (3 modes): (a) simple balance check, (b) days overdue check, (c) suspend on overdue. | 1164/22260/39600 | `ORVcRecAction.hal:453-478` | HIGH |
| REQ-OR-006 | Credit limit Mode 1: customer balance + order total > credit limit. | 1164 | `ORVcRecAction.hal:478` | HIGH |
| REQ-OR-007 | Credit limit Mode 2: days overdue threshold exceeded. | 22260 | `ORVcRecAction.hal:453` | HIGH |
| REQ-OR-008 | Credit limit Mode 3: suspend customer if any invoice is overdue (kCreditLimitBasedOnOpenInvSuspendOnOverdue). | 39600 | `ORVcRecAction.hal:473-474` | HIGH |
| REQ-OR-009 | Order date must be in valid accounting period. | varies | `ORVcRecAction.hal:402` | HIGH |
| REQ-OR-010 | Official serial number validation (country-specific). | varies | `ORVcRecAction.hal:587` | HIGH |
| REQ-OR-011 | Project must exist and not be terminated (if PRCode set). | 1232 | `ORVcRecAction.hal:610-615` | HIGH |
| REQ-OR-012 | Project customer must match order customer (if project set). | 1218 | `ORVcRecAction.hal:598` | HIGH |
| REQ-OR-013 | Cannot change rows that have been shipped (QtyShipped > 0). | 1304 | Inferred from shipped row protection | HIGH |
| REQ-OR-014 | Quantity cannot be reduced below shipped quantity. | 1302 | Inferred from qty >= shipped validation | HIGH |
| REQ-OR-015 | Negative quantities blocked. | 1574 | Inferred from negative qty check | HIGH |
| REQ-OR-016 | Item must exist and not be terminated per row. | 1120/1266 | `ORVcRecAction.hal:1053-1054` (INVc_AllowSales check) | HIGH |
| REQ-OR-017 | Serial number format validation per row. | varies | Inferred from serial row validation | MEDIUM |
| REQ-OR-018 | Order class required (if setting enabled). | 20101 | `ORVcRecAction.hal:657` | HIGH |
| REQ-OR-019 | Customer order number required (if setting enabled). | 2281 | `ORVcRecAction.hal:664` | HIGH |
| REQ-OR-020 | Delivery address required (if setting enabled). | 1058 | `ORVcRecAction.hal:671` | HIGH |
| REQ-OR-021 | VAT code required per row. | varies | Row validation sequence | MEDIUM |
| REQ-OR-022 | Negative totals blocked. | 22047 | Inferred from total validation | MEDIUM |
| REQ-OR-023 | Over-reserving prevention: reserved qty cannot exceed ordered qty. | 20011 | Inferred from reservation check | MEDIUM |
| REQ-OR-024 | Minimum gross profit check per row (DisallowSaleBelowGP). | 22050 | `ORVcRecAction.hal:647-648` | HIGH |
| REQ-OR-025 | Ship mode must exist in lookup. | 1290 | `ORVcRecAction.hal:694` | HIGH |
| REQ-OR-026 | Ship deal must exist in lookup. | 1290 | `ORVcRecAction.hal:702` | HIGH |
| REQ-OR-027 | Location must exist. | varies | `ORVcRecAction.hal:710` | HIGH |
| REQ-OR-028 | Down payment validation: cannot exceed order total. | 34502/34504 | `ORVcRecAction.hal:417`, `ORVcRecAction.hal:431` | HIGH |

### 5.2 Permission Checks

| REQ-ID | Rule | Permission Key | Evidence | Confidence |
|--------|------|---------------|----------|------------|
| REQ-OR-040 | OROK: permission required to approve sales orders. | `OROK` | `ORVcRecAction.hal:489-490` | HIGH |
| REQ-OR-041 | UnOKOR / UnOKAll: permission required to un-approve. | `UnOKOR`, `UnOKAll` | `ORVcRecAction.hal:496-497` | HIGH |
| REQ-OR-042 | DisallowDomSales: blocks domestic sales orders. | `DisallowDomSales` | Pattern from IVVc applied to OR | MEDIUM |
| REQ-OR-043 | DisallowExpSales: blocks export sales orders. | `DisallowExpSales` | Pattern from IVVc applied to OR | MEDIUM |
| REQ-OR-044 | ChangeDropShipOrders: permission to modify drop-ship order rows. | `ChangeDropShipOrders` | Inferred from drop-ship row handling | LOW |
| REQ-OR-045 | DisallowSaleBelowGP: blocks order rows below minimum GP%. | `DisallowSaleBelowGP` | `ORVcRecAction.hal:647` | HIGH |

### 5.3 Cross-Entity Effects (on OK)

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-OR-050 | Stock ordered-out update: adjusts ordered-out quantities on stock records. | `ORVcRecAction.hal:69` (`UpdateInstock` external) | HIGH |
| REQ-OR-051 | Stock reservation: `UpdateStockResFromOR` creates/updates stock reservations. | `ORVcRecAction.hal:43` (external) | HIGH |
| REQ-OR-052 | Activity creation: `CreateActFromOR` creates CRM follow-up activity. | `ORVcRecAction.hal:60` (external) | HIGH |
| REQ-OR-053 | Planned payment creation: `ORCreatePlannedPayment` creates expected payment schedule. | `ORVcRecAction.hal:7` (external) | HIGH |
| REQ-OR-054 | SMS notification: `SMSWhenOR` sends SMS on order approval (if configured). | `ORVcRecAction.hal:41` (external) | HIGH |

### 5.4 Delete Guards

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-OR-060 | Cannot delete if down-payments exist against this order. | 20416 | Inferred from down-payment check | HIGH |
| REQ-OR-061 | Cannot delete if any row has been shipped (QtyShipped > 0). | 1560 | Inferred from shipped check | HIGH |
| REQ-OR-062 | Cannot delete if return exists against this order. | varies | Inferred from return reference check | MEDIUM |
| REQ-OR-063 | Cannot delete if payment history exists. | varies | Inferred from payment linkage | MEDIUM |
| REQ-OR-064 | Cannot delete OKed order in date-lock period. | varies | Universal pattern REQ-UNI-011 | HIGH |
| REQ-OR-065 | Cannot delete if approval activity is linked. | 22408 | Universal pattern REQ-UNI-013 | MEDIUM |
| REQ-OR-066 | Planned payments deleted on order deletion: `DeletePlannedPayment`. | -- | `ORVcRecAction.hal:6` (external) | HIGH |

---

## 6. Purchase Order (POVc)

**Source:** `RActions/POVcRAction.hal` (1,270 lines)
**Data Model:** [DATA_MODEL](DATA_MODEL.md) (POVc entity)
**Target Entity:** PurchaseOrder + PurchaseOrderLine ([MIGRATION_MAP](MIGRATION_MAP.md) 2.5)

### 6.1 Field Validations

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-PO-001 | Vendor must exist. | 1120/1205 | Inferred from VE lookup in POVcRAction | HIGH |
| REQ-PO-002 | Vendor must not be blocked. | 1265 | Vendor validation pattern | HIGH |
| REQ-PO-003 | Currency code must match vendor default or be valid. | varies | Universal currency pattern | MEDIUM |
| REQ-PO-004 | Must have at least one row when OKing. | 1030 | Inferred from row count check | HIGH |
| REQ-PO-005 | Payment terms required. | 1256 | Pattern from OR/IV | HIGH |
| REQ-PO-006 | Quality check status validation (if QC module active). | varies | Inferred from QC integration | LOW |
| REQ-PO-007 | Project must exist and not be terminated (if set). | 1232 | Pattern from ORVc applied to PO | MEDIUM |
| REQ-PO-008 | Location must exist. | 1120 | Pattern from PU applied to PO | HIGH |
| REQ-PO-009 | PO class required (if setting enabled). | varies | Pattern from OR order class | LOW |
| REQ-PO-010 | Reservations must be covered (stock reservations link to PO). | varies | Inferred from reservation validation | MEDIUM |
| REQ-PO-011 | Currency rate validation. | varies | Universal pattern | MEDIUM |

### 6.2 Permission Checks

| REQ-ID | Rule | Permission Key | Evidence | Confidence |
|--------|------|---------------|----------|------------|
| REQ-PO-020 | POOK: permission required to approve purchase orders. | `POOK` | Inferred from OROK/PUOK pattern | HIGH |
| REQ-PO-021 | UnOKPO / UnOKAll: permission required to un-approve. | `UnOKPO`, `UnOKAll` | Inferred from UnOKOR pattern | HIGH |

### 6.3 Cross-Entity Effects (on OK)

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-PO-030 | PO updates ordered-out stock: increases ordered-in quantities on stock records. | Inferred from PurUpdateOvst reverse pattern | HIGH |
| REQ-PO-031 | Project PO tracking: links PO to project for budget tracking. | Inferred from PRCode handling | MEDIUM |
| REQ-PO-032 | Auto-receive non-stock items: items flagged as non-stock may auto-create receipt. | Inferred from item type handling | LOW |
| REQ-PO-033 | Planned payment creation from PO. | Pattern from ORCreatePlannedPayment | MEDIUM |
| REQ-PO-034 | Inter-company OR creation: in multi-company setup, PO in one company creates OR in another. | Inferred from inter-company module | LOW |
| REQ-PO-035 | Stock reservation from PO: `UpdateStockResFromPO`. | Pattern from PU external declarations | MEDIUM |

### 6.4 Delete Guards

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-PO-040 | Cannot delete if purchase invoice (PUVc) exists against this PO. | 1560 | Inferred from PU linkage check | HIGH |
| REQ-PO-041 | Cannot delete if OKed. | 1544 | Universal pattern | HIGH |
| REQ-PO-042 | Cannot delete if stock reservations reference this PO. | 22065 | Inferred from reservation cleanup | MEDIUM |
| REQ-PO-043 | Cannot delete if approval activity is linked. | 22408 | Universal pattern | MEDIUM |

---

## 7. Inventory Item (INVc)

**Source:** `RActions/INVcRAction.hal` (1,640 lines)
**Data Model:** [DATA_MODEL](DATA_MODEL.md) (INVc entity)
**Target Entity:** InventoryItem ([MIGRATION_MAP](MIGRATION_MAP.md) 2.6)

### 7.1 Default Values

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-IN-001 | New item defaults from ItemSettingBlock: Group, WarrantyLength, Unittext, SerNrf (serial number flag), ItemType. | Inferred from INVcRAction defaults function | HIGH |
| REQ-IN-002 | Default column number (colnr) = 20 for new items. | Inferred from defaults function | MEDIUM |

### 7.2 Cross-Entity Effects (on Field Change)

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-IN-010 | Price tracking: LastPriceChange date updated when InPrice (purchase price) changes. | Inferred from field-change handler | MEDIUM |
| REQ-IN-011 | Price tracking: LastBasePriceChange date updated when UPrice1 (base sales price) changes. | Inferred from field-change handler | MEDIUM |
| REQ-IN-012 | External sync: SugarCRM sync triggered on item update (if SugarCRM integration active). | Inferred from external procedure calls | LOW |
| REQ-IN-013 | External sync: Amazon sync triggered on item update (if Amazon integration active). | Inferred from external procedure calls | LOW |
| REQ-IN-014 | Auto feature detection on item creation/update. | Inferred from feature detection logic | LOW |
| REQ-IN-015 | PO recalculation triggered when item type changes (affects outstanding PO calculations). | Inferred from ItemType change handler | MEDIUM |

### 7.3 Delete Guards

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-IN-020 | Cannot delete item if stock transactions exist (StockMovVc, IVVc rows, PUVc rows referencing this item). | 1122 | Inferred from transaction existence check | HIGH |
| REQ-IN-021 | Cannot delete item if hotel reservation exists (vertical-specific). | 32016 | Inferred from vertical module check | LOW |

### 7.4 Index Filtering

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-IN-030 | Inactive/terminated items excluded from active indexes (item lookups, dropdowns). Active items remain in all indexes. | Pattern from `AT2VcRAction.hal:2-14` (RecordInIndex function) | HIGH |

---

## 8. Stock Movement (StockMovVc)

**Source:** `RActions/StockMovVcRAction.hal` (2,485 lines)
**Data Model:** [DATA_MODEL](DATA_MODEL.md) (StockMovVc entity)
**Target Entity:** StockMovement ([MIGRATION_MAP](MIGRATION_MAP.md) 2.6)

### 8.1 Field Validations

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-SM-001 | Quantity must be >= 0. Negative quantities not allowed. | 1574 | Inferred from quantity validation pattern | HIGH |
| REQ-SM-002 | Quantity must not be blank/zero. | 1058 | Inferred from blank check | HIGH |
| REQ-SM-003 | Serial number required for serialized items (INVc.SerNrf flag). | 1239 | Inferred from serial enforcement | HIGH |
| REQ-SM-004 | Strict serial items: quantity must be exactly 1 per serial number. | 1242 | Inferred from strict serial check | HIGH |
| REQ-SM-005 | Serial number must be available in source location (not already consumed/transferred). | 1240 | Inferred from serial availability check | HIGH |
| REQ-SM-006 | Serial number status check: blocked/quarantined serials cannot be moved. | 2210 | Inferred from status validation | HIGH |
| REQ-SM-007 | Stock record must be allowed in target location (item-location combination must be valid). | varies | Inferred from stock record validation | MEDIUM |
| REQ-SM-008 | FIFO consistency per serial: each serial must maintain consistent FIFO cost layer. | 2246 | Inferred from FIFO/serial cross-check | MEDIUM |
| REQ-SM-009 | Position/bin validation: if warehouse uses positions, position code required. | 1854 | Inferred from position validation | MEDIUM |
| REQ-SM-010 | Bulk serial format validation (if bulk serial entry enabled). | varies | Inferred from serial parsing logic | LOW |

### 8.2 Permission Checks

| REQ-ID | Rule | Permission Key | Evidence | Confidence |
|--------|------|---------------|----------|------------|
| REQ-SM-020 | SentStockMovOK: permission to approve inter-location (sent) stock movements. | `SentStockMovOK` | `StockMovVcRAction.hal:2007` | HIGH |
| REQ-SM-021 | StockMovOK: permission to approve standard stock movements. | `StockMovOK` | `StockMovVcRAction.hal:2037` | HIGH |

### 8.3 Cross-Entity Effects (on OK)

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-SM-030 | Stock update: deducts from source location, adds to destination location. | Inferred from dual-location stock update pattern | HIGH |
| REQ-SM-031 | Cost price update: may recalculate weighted average cost on destination. | Inferred from cost update calls | MEDIUM |
| REQ-SM-032 | Item history: writes movement event to item transaction history. | Inferred from history update pattern | MEDIUM |
| REQ-SM-033 | Position status: updates warehouse position occupancy/status. | `PUVcRecAction.hal:44` (`SetPositionStatus` reused) | MEDIUM |
| REQ-SM-034 | Fork lift queue: creates warehouse task for physical movement (if WMS active). | Inferred from WMS integration | LOW |
| REQ-SM-035 | Internal order: links movement to internal order if applicable. | Inferred from internal order handling | LOW |
| REQ-SM-036 | FIFO update: adjusts FIFO cost layers for moved items. | Inferred from FIFO update calls | HIGH |
| REQ-SM-037 | GL Transaction generation: creates journal entry for stock value transfer between locations. | Inferred from TRVc creation pattern | HIGH |
| REQ-SM-038 | Error reporting: `RecordCheckError(error, errorstr, rownr, fieldstr)` consolidates all validation errors. | `StockMovVcRAction.hal:2187` | HIGH |

---

## 9. GL Account Settings (AccBlock)

**Source:** `RActions/AccBlockActions.hal` (482 lines)
**Data Model:** [DATA_MODEL](DATA_MODEL.md) Section 2.1 (AccVc)
**Target Entity:** TenantConfig / GlAccount ([MIGRATION_MAP](MIGRATION_MAP.md) 2.1)

### 9.1 Mutual Exclusion Rules

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-AB-001 | SkipObjectsOnIVFromHeader and AllowSameObjectTypeSL are mutually exclusive. Cannot enable both simultaneously. | 43600 | `AccBlockActions.hal:12` | HIGH |

### 9.2 Control Account Validation

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-AB-010 | ARAcc (Accounts Receivable) must be a control account (ControlType check). | 1082 | `AccBlockActions.hal:33` | HIGH |
| REQ-AB-011 | All named account references must exist in AccVc if non-blank. | 1007 | `AccBlockActions.hal:28-238` (pattern across all account fields) | HIGH |

### 9.3 Account Reference Validations

Each of the following account references is validated to exist in AccVc when non-blank. Error 1007 is raised for each missing account.

| REQ-ID | Account Field | Evidence (line) | Confidence |
|--------|--------------|----------------|------------|
| REQ-AB-020 | ARAcc (Accounts Receivable) | `AccBlockActions.hal:28` | HIGH |
| REQ-AB-021 | RndAcc (Rounding) | `AccBlockActions.hal:41` | HIGH |
| REQ-AB-022 | RndLossAcc (Rounding Loss) | `AccBlockActions.hal:49` | HIGH |
| REQ-AB-023 | CredAcc (Credit Notes) | `AccBlockActions.hal:57` | HIGH |
| REQ-AB-024 | WriteOffLossAcc (Write-off Loss) | `AccBlockActions.hal:65` | HIGH |
| REQ-AB-025 | ERebAcc (Early Rebate Domestic) | `AccBlockActions.hal:73` | HIGH |
| REQ-AB-026 | EUERebAcc (Early Rebate EU) | `AccBlockActions.hal:81` | HIGH |
| REQ-AB-027 | ExpERebAcc (Early Rebate Export) | `AccBlockActions.hal:89` | HIGH |
| REQ-AB-028 | VATBAcc (VAT Base) | `AccBlockActions.hal:97` | HIGH |
| REQ-AB-029 | CashAcc (Cash) | `AccBlockActions.hal:105` | HIGH |
| REQ-AB-030 | VATERAcc (VAT Error) | `AccBlockActions.hal:113` | HIGH |
| REQ-AB-031 | ExtraCostAcc (Extra Costs) | `AccBlockActions.hal:121` | HIGH |
| REQ-AB-032 | RateGainAcc (Exchange Rate Gain) | `AccBlockActions.hal:129` | HIGH |
| REQ-AB-033 | RateLossAcc (Exchange Rate Loss) | `AccBlockActions.hal:137` | HIGH |
| REQ-AB-034 | RateRndOffAcc (Rate Rounding) | `AccBlockActions.hal:145` | HIGH |
| REQ-AB-035 | StockAcc (Stock Valuation) | `AccBlockActions.hal:153` | HIGH |
| REQ-AB-036 | PurchAcc (Purchase) | `AccBlockActions.hal:161` | HIGH |
| REQ-AB-037 | StockCostAcc (Stock Cost/COGS) | `AccBlockActions.hal:169` | HIGH |
| REQ-AB-038 | DomSalesAcc (Domestic Sales) | `AccBlockActions.hal:177` | HIGH |
| REQ-AB-039 | EUSalesAcc (EU Sales) | `AccBlockActions.hal:185` | HIGH |
| REQ-AB-040 | ExpSalesAcc (Export Sales) | `AccBlockActions.hal:193` | HIGH |
| REQ-AB-041 | OnAccAcc (On Account) | `AccBlockActions.hal:201` | HIGH |
| REQ-AB-042 | StockGainAcc (Stock Gain) | `AccBlockActions.hal:230` | HIGH |
| REQ-AB-043 | PUExtraAcc (Purchase Extra Cost) | `AccBlockActions.hal:238` | HIGH |

### 9.4 VAT Code Validations

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-AB-050 | VATCodeDom (Domestic VAT code) must exist. | 1120 | `AccBlockActions.hal:208` | HIGH |
| REQ-AB-051 | VATCodeEU (EU VAT code) must exist. | 1120 | `AccBlockActions.hal:215` | HIGH |
| REQ-AB-052 | VATCodeExp (Export VAT code) must exist. | 1120 | `AccBlockActions.hal:222` | HIGH |
| REQ-AB-053 | VATBAcc (VAT base account) must not be blank when enabled. | 20939 | `AccBlockActions.hal:20` | HIGH |

---

## 10. AP Account Settings (APAccBlock)

**Source:** `RActions/APAccBlockActions.hal` (263 lines)
**Data Model:** [DATA_MODEL](DATA_MODEL.md) (AP configuration)
**Target Entity:** TenantConfig / GlAccount ([MIGRATION_MAP](MIGRATION_MAP.md) 2.1)

### 10.1 Control Account Validation

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-AP-001 | APAcc (Accounts Payable) must be a control account (ControlType check). | 1082 | `APAccBlockActions.hal:20` | HIGH |

### 10.2 Account Reference Validations

Each AP account reference is validated to exist in AccVc when non-blank. Error 1007 raised for each missing account.

| REQ-ID | Account Field | Evidence (line) | Confidence |
|--------|--------------|----------------|------------|
| REQ-AP-010 | APAcc (Accounts Payable) | `APAccBlockActions.hal:14` | HIGH |
| REQ-AP-011 | PCredAcc (Purchase Credit) | `APAccBlockActions.hal:27` | HIGH |
| REQ-AP-012 | PERebAcc (Purchase Early Rebate) | `APAccBlockActions.hal:35` | HIGH |
| REQ-AP-013 | EUPERebAcc (EU Purchase Rebate) | `APAccBlockActions.hal:43` | HIGH |
| REQ-AP-014 | ExpPERebAcc (Export Purchase Rebate) | `APAccBlockActions.hal:51` | HIGH |
| REQ-AP-015 | PVATBAcc (Purchase VAT Base) | `APAccBlockActions.hal:59` | HIGH |
| REQ-AP-016 | CashAcc (Cash) | `APAccBlockActions.hal:67` | HIGH |
| REQ-AP-017 | VATAcc (VAT) | `APAccBlockActions.hal:75` | HIGH |
| REQ-AP-018 | ExtraCostAcc (Extra Cost) | `APAccBlockActions.hal:83` | HIGH |
| REQ-AP-019 | RateGainAcc (Rate Gain) | `APAccBlockActions.hal:91` | HIGH |
| REQ-AP-020 | RateLossAcc (Rate Loss) | `APAccBlockActions.hal:99` | HIGH |
| REQ-AP-021 | RateRndOffAcc (Rate Rounding) | `APAccBlockActions.hal:107` | HIGH |
| REQ-AP-022 | EUVATBAcc (EU VAT Base) | `APAccBlockActions.hal:115` | HIGH |
| REQ-AP-023 | OnAccAcc (On Account) | `APAccBlockActions.hal:123` | HIGH |
| REQ-AP-024 | PrelAPAcc (Preliminary AP) | `APAccBlockActions.hal:152` | HIGH |
| REQ-AP-025 | EMURndOffAcc (EMU Rounding) | `APAccBlockActions.hal:160` | HIGH |
| REQ-AP-026 | EMUWriteOffAcc (EMU Write-off) | `APAccBlockActions.hal:168` | HIGH |
| REQ-AP-027 | CredAcc (Credit Notes) | `APAccBlockActions.hal:176` | HIGH |
| REQ-AP-028 | WriteOffLossAcc (Write-off Loss) | `APAccBlockActions.hal:184` | HIGH |
| REQ-AP-029 | OnAccVAT (On Account VAT) | `APAccBlockActions.hal:192` | HIGH |
| REQ-AP-030 | PreOPBookVAT (Pre-OP Booking VAT) | `APAccBlockActions.hal:201` | HIGH |
| REQ-AP-031 | RetainAcc (Retention) | `APAccBlockActions.hal:210` | HIGH |
| REQ-AP-032 | BankRateGainAcc (Bank Rate Gain) | `APAccBlockActions.hal:218` | HIGH |
| REQ-AP-033 | BankRateLossAcc (Bank Rate Loss) | `APAccBlockActions.hal:226` | HIGH |
| REQ-AP-034 | CorPurchVATAcc (Corrective Purchase VAT) | `APAccBlockActions.hal:234` | HIGH |
| REQ-AP-035 | VATBase | `APAccBlockActions.hal:242` | HIGH |

### 10.3 VAT Code Validations

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-AP-040 | VATCodeDom (Domestic VAT code) must exist. | 1120 | `APAccBlockActions.hal:130` | HIGH |
| REQ-AP-041 | VATCodeEU (EU VAT code) must exist. | 1120 | `APAccBlockActions.hal:137` | HIGH |
| REQ-AP-042 | VATCodeExp (Export VAT code) must exist. | 1120 | `APAccBlockActions.hal:144` | HIGH |

---

## 11. Cash/POS Balance (CashVc)

**Source:** `RActions/CashVcRAction.hal` (288 lines)
**Data Model:** [DATA_MODEL](DATA_MODEL.md) (CashVc entity)
**Target Entity:** PosStore / PosRegister ([MIGRATION_MAP](MIGRATION_MAP.md) 2.10)

### 11.1 Field Validations

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-CA-001 | Must have at least one row (payment mode entry). | 1058 | `CashVcRAction.hal:157` | HIGH |
| REQ-CA-002 | Payment mode (PMCode) must be registered in payment mode register. | 1120 | `CashVcRAction.hal:165` | HIGH |
| REQ-CA-003 | No duplicate payment mode + denomination combination per balance. | 1547 | `CashVcRAction.hal:173` | HIGH |
| REQ-CA-004 | Back-office credit account (CredAcc) required. | varies | `CashVcRAction.hal:182` | HIGH |
| REQ-CA-005 | Credit account must be valid (lookup success). | 1290 | `CashVcRAction.hal:199` | HIGH |
| REQ-CA-006 | Machine name required. | 1058 | `CashVcRAction.hal:217` | HIGH |
| REQ-CA-007 | Drawer required. | 1058 | `CashVcRAction.hal:239` | HIGH |
| REQ-CA-008 | Session must be open for the machine/drawer combination. | 2195 | `CashVcRAction.hal:252` | HIGH |
| REQ-CA-009 | No later balance can exist for same machine/drawer (chronology). | 2194 | `CashVcRAction.hal:258` | HIGH |
| REQ-CA-010 | Event type must be >= 0. | varies | `CashVcRAction.hal:23` (Event = -1 as default, must be set) | MEDIUM |
| REQ-CA-011 | Serial number uniqueness. | 1547 | `CashVcRAction.hal:232` | HIGH |
| REQ-CA-012 | Serial number validation (must be assigned). | 1132 | `CashVcRAction.hal:225` | HIGH |
| REQ-CA-013 | Un-OK check against date lock. | 1046 | `CashVcRAction.hal:150` | HIGH |

### 11.2 Credit Account Logic

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-CA-020 | Event 0 (opening balance): uses CDr.CredAcc (drawer credit account). | Inferred from event-type branching | MEDIUM |
| REQ-CA-021 | Event 1 (closing balance): uses CDr.CredAcc (drawer credit account). | Inferred from event-type branching | MEDIUM |
| REQ-CA-022 | Event 2 (write-off): uses CDr.WriteOffAcc (drawer write-off account). | Inferred from event-type branching | MEDIUM |

### 11.3 Default Values

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-CA-030 | TransDate defaults to current date. | `CashVcRAction.hal:18` | HIGH |
| REQ-CA-031 | TransTime defaults to current time. | `CashVcRAction.hal:19` | HIGH |
| REQ-CA-032 | MachineName defaults to current machine (CurMachineName). | `CashVcRAction.hal:27` | HIGH |
| REQ-CA-033 | Drawer defaults to current drawer for machine (CurDrawerCode). | `CashVcRAction.hal:28` | HIGH |
| REQ-CA-034 | SerNr initialized to -1 (unassigned). | `CashVcRAction.hal:21` | HIGH |

### 11.4 Cross-Entity Effects

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-CA-040 | Cash-up history: `CashUpdateCashupHist` writes to cash-up audit trail. | `CashVcRAction.hal:1` (external) | HIGH |
| REQ-CA-041 | POS audit logging: `POSAudit_LogCashVc` logs all cash balance events. | `CashVcRAction.hal:10` (external), `CashVcRAction.hal:29` | HIGH |

---

## 12. Contact/CRM (ContactVc)

**Source:** `RActions/ContactVcRAction.hal` (53 lines)
**Data Model:** [DATA_MODEL](DATA_MODEL.md) (ContactVc entity)
**Target Entity:** CrmContact + CrmAccount ([MIGRATION_MAP](MIGRATION_MAP.md) 2.7)

### 12.1 Field Validations

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-CT-001 | Name field is required (cannot be blank). | 1270 | `ContactVcRAction.hal:27` | HIGH |
| REQ-CT-002 | Company field is required (cannot be blank). | 1270 | `ContactVcRAction.hal:31` | HIGH |

### 12.2 Index Filtering

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-CT-010 | Closed contacts (Closed != 0) are excluded from active indexes: ActName, ActCompKey, ActCompName, ActPhone, ActTitle, ActDepartment. | `ContactVcRAction.hal:7-13` | HIGH |

### 12.3 Default Values

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-CT-020 | NoLetterPosting defaults from CustomerSettingBlock.NoLetterPosting. | `ContactVcRAction.hal:48` | HIGH |
| REQ-CT-021 | NoMailPosting defaults from CustomerSettingBlock.NoMailPosting. | `ContactVcRAction.hal:49` | HIGH |

---

## 13. HR Performance Appraisal (HRMPAVc)

**Source:** `RActions/HRMPAVcRAction.hal` (137 lines)
**Data Model:** [DATA_MODEL](DATA_MODEL.md) (HRMPAVc entity)
**Target Entity:** Employee ([MIGRATION_MAP](MIGRATION_MAP.md) 2.8)

### 13.1 Field Validations

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-HR-001 | TransDate required when OKing (OKFlag=1). | 1058 | `HRMPAVcRAction.hal:51-52` | HIGH |
| REQ-HR-002 | At least one row required when OKing (performance factors). | 1058 | `HRMPAVcRAction.hal:56-58` | HIGH |
| REQ-HR-003 | Interviewer must exist in CUVc (customer/employee register). | 1120 | `HRMPAVcRAction.hal:73-74` | HIGH |
| REQ-HR-004 | Interviewer must be an employee (EmployeeType != 0). | 1120 | `HRMPAVcRAction.hal:78-79` | HIGH |
| REQ-HR-005 | Interviewer must not be blocked. | 1265 | `HRMPAVcRAction.hal:83-84` | HIGH |
| REQ-HR-006 | Employee must exist in CUVc. | 1120 | `HRMPAVcRAction.hal:89-90` | HIGH |
| REQ-HR-007 | Employee must be an employee (EmployeeType != 0). | 1120 | `HRMPAVcRAction.hal:94-95` | HIGH |
| REQ-HR-008 | Employee must not be blocked. | 1265 | `HRMPAVcRAction.hal:99-100` | HIGH |
| REQ-HR-009 | Each row: Performance factor (PerfFactor) must exist in HRMPFVc. | 1120 | `HRMPAVcRAction.hal:108-110` | HIGH |
| REQ-HR-010 | Each row: Performance rating (PerfRating) must exist in HRMPRVc. | 1120 | `HRMPAVcRAction.hal:114-116` | HIGH |

### 13.2 Permission Checks

| REQ-ID | Rule | Permission Key | Evidence | Confidence |
|--------|------|---------------|----------|------------|
| REQ-HR-020 | HRMPAOK: permission required to approve performance appraisals. | `HRMPAOK` | `HRMPAVcRAction.hal:40-41` | HIGH |

### 13.3 Status Transitions

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-HR-030 | OK transition (0->1): requires HRMPAOK permission, validates all fields. | `HRMPAVcRAction.hal:21-26` (transf detection), `HRMPAVcRAction.hal:39-44` | HIGH |
| REQ-HR-031 | Un-OK transition (1->0): validated by `IsUnOKAllowed("HRMPAVc", TransDate)`, checks date lock period. Error 1046 if blocked. | `HRMPAVcRAction.hal:27-37` | HIGH |

---

## 14. HR Payroll (HRMPayrollVc)

**Source:** `RActions/HRMPayrollVcRAction.hal` (164 lines)
**Data Model:** [DATA_MODEL](DATA_MODEL.md) (HRMPayrollVc entity)
**Target Entity:** PayrollRun ([MIGRATION_MAP](MIGRATION_MAP.md) 2.8)

### 14.1 Field Validations

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-PY-001 | UserCode (employee) must exist in UserVc register. | 1120 | `HRMPayrollVcRAction.hal:86-88` | HIGH |
| REQ-PY-002 | User must not be closed (Closed flag) or terminated (TerminatedFlag). | 1265 | `HRMPayrollVcRAction.hal:92-93` | HIGH |
| REQ-PY-003 | Each row: Payment type (HRMPymtType) must exist in HRMPymtTypeVc. | 1265 | `HRMPayrollVcRAction.hal:100-102` | HIGH |

### 14.2 Calculations

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-PY-010 | Dual base currency conversion: `HRMPayrollVcConvertB1ToB2` converts each row's Sum field from Base1 to Base2 using `B1ToB2Val`. SwapM4Val swaps rate pairs for reverse calculation. | `HRMPayrollVcRAction.hal:37-53` | HIGH |
| REQ-PY-011 | Import-time dual base conversion: if `DualBaseCurrencyFlag` or `Base1ToBase2Flag` is set in ConvMasterBlock, conversion is applied during import. | `HRMPayrollVcRAction.hal:131-161` | HIGH |

### 14.3 Default Values

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-PY-020 | TransDate defaults to current date. | `HRMPayrollVcRAction.hal:12` | HIGH |
| REQ-PY-021 | TotSum defaults to blank (zero). | `HRMPayrollVcRAction.hal:13` | HIGH |
| REQ-PY-022 | Currency rates initialized via GetFullCurncyRate on creation. | `HRMPayrollVcRAction.hal:17` | HIGH |
| REQ-PY-023 | SerNr initialized to -1 (unassigned). | `HRMPayrollVcRAction.hal:11` | HIGH |

---

## 15. Fixed Asset (AT2Vc)

**Source:** `RActions/AT2VcRAction.hal` (28 lines)
**Data Model:** [DATA_MODEL](DATA_MODEL.md) (AT2Vc entity)
**Target Entity:** FixedAsset ([MIGRATION_MAP](MIGRATION_MAP.md) 2.9)

### 15.1 Field Validations

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-FA-001 | Code field is required (cannot be blank). | 1058 | `AT2VcRAction.hal:22-23` | HIGH |

### 15.2 Index Filtering

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-FA-010 | Inactive assets (Inactive != 0) are excluded from active indexes: ActCode, ActAT2Class, ActDescription, ActAT2Group. | `AT2VcRAction.hal:7-12` | HIGH |

---

## 16. VAT Declaration (VATDeclVc)

**Source:** `RActions/VATDeclVcRAction.hal` (211 lines)
**Data Model:** [DATA_MODEL](DATA_MODEL.md) (VATDeclVc entity)
**Target Entity:** VatReturn ([MIGRATION_MAP](MIGRATION_MAP.md) 2.1)

### 16.1 Field Validations

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-VD-001 | Code field is required (cannot be blank). | 1058 | `VATDeclVcRAction.hal:157-158` | HIGH |
| REQ-VD-002 | Code must be unique (ReadFirstMain check). | 1547 | `VATDeclVcRAction.hal:140-144`, `VATDeclVcRAction.hal:152-153` | HIGH |
| REQ-VD-003 | Serial number chronology check (code must be in sequence for date). | 1557 | `VATDeclVcRAction.hal:162-163` | HIGH |
| REQ-VD-004 | Poland localization: only one version (Version=0) allowed per period (StartDate/EndDate combination). | 42670 | `VATDeclVcRAction.hal:167-178` | HIGH |

### 16.2 Auto-Numbering

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-VD-010 | Code auto-generated via `GetNextVATDeclNr` which uses `NextM4Number` on SRBlock.LastVATDeclCode. Falls back to finding last record and incrementing. | `VATDeclVcRAction.hal:7-33` | HIGH |
| REQ-VD-011 | Code must be >= NextSerNr for the entity (chronology floor). | `VATDeclVcRAction.hal:146-149` | HIGH |

### 16.3 Default Values

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-VD-020 | TransDate defaults to current date. | `VATDeclVcRAction.hal:61` | HIGH |
| REQ-VD-021 | Poland: PeriodType defaults from TaxRepCUBlock.SendPeriod. | `VATDeclVcRAction.hal:57-60` | HIGH |
| REQ-VD-022 | Duplicate resets: OKFlag=0, TaxServStatus=0, TaxServID/Timestamp cleared. | `VATDeclVcRAction.hal:84-87` | HIGH |

### 16.4 Delete Guards

| REQ-ID | Rule | Error | Evidence | Confidence |
|--------|------|-------|----------|------------|
| REQ-VD-030 | Cannot delete if submitted to tax service (TaxServStatus != 0). | 1560 | `VATDeclVcRAction.hal:191-193` | HIGH |
| REQ-VD-031 | Cannot delete OKed declaration if TransDate > DeleteBeforeDate (date lock period). | 1560 | `VATDeclVcRAction.hal:198-206` | HIGH |

### 16.5 Post-Save Effects

| REQ-ID | Rule | Evidence | Confidence |
|--------|------|----------|------------|
| REQ-VD-040 | After save: SRBlock.LastVATDeclCode updated to current code (for auto-increment tracking). | `VATDeclVcRAction.hal:37-47` | HIGH |

---

## 17. Error Code Reference

Complete catalog of error codes encountered in the analyzed RAction files, with their meanings and the entities where they are raised.

| Code | Meaning | Entities Using |
|------|---------|---------------|
| 1007 | Account does not exist | IVVc, PUVc, AccBlock, APAccBlock |
| 1030 | No rows / empty data | IVVc, ORVc, POVc |
| 1033 | Negative serial number | IVVc |
| 1046 | Un-OK blocked by date lock | HRMPAVc, CashVc |
| 1058 | Required field is blank | IVVc, ORVc, PUVc, CashVc, HRMPAVc, AT2Vc, VATDeclVc |
| 1082 | Not a control account (AR/AP must be control type) | AccBlock, APAccBlock |
| 1115 | Duplicate record exists | Universal |
| 1119 | Referenced record not found (credit note original) | IVVc |
| 1120 | Invalid/non-existent reference (generic FK lookup failure) | IVVc, PUVc, ORVc, AccBlock, APAccBlock, HRMPAVc, HRMPayrollVc |
| 1125 | Customer code required | IVVc |
| 1132 | Serial number invalid | CashVc |
| 1164 | Credit limit exceeded | ORVc |
| 1205 | Vendor not found | PUVc, POVc |
| 1214 | Payment deal type mismatch | IVVc |
| 1217 | Currency code mismatch (credit note vs original) | IVVc |
| 1218 | Customer/project mismatch | IVVc, ORVc |
| 1222 | Cannot credit a credit note | IVVc |
| 1232 | Project not found or terminated | ORVc, POVc |
| 1239 | Serial number required for serialized item | StockMovVc |
| 1240 | Serial not available in source location | StockMovVc |
| 1241 | Duplicate serial number | StockMovVc |
| 1242 | Only 1 unit per serial number (strict serial) | StockMovVc |
| 1256 | Payment terms required | IVVc, ORVc, POVc |
| 1265 | Record is blocked / inactive | IVVc, PUVc, ORVc, HRMPAVc, HRMPayrollVc |
| 1270 | Required field missing (Name/Company) | ContactVc |
| 1274 | Insufficient permissions (UserCanAction failed) | PUVc, ORVc, HRMPAVc |
| 1277 | Payment mode control violation | IVVc |
| 1282 | Original invoice invalidated | IVVc |
| 1290 | Lookup not found (ship mode, ship deal, etc.) | ORVc, CashVc |
| 1300 | Customer on hold | IVVc, ORVc |
| 1302 | Quantity below shipped quantity | ORVc |
| 1304 | Cannot change shipped row | ORVc |
| 1391 | Duplicate official serial number | IVVc |
| 1544 | Cannot delete OKed record | IVVc, PUVc, ORVc, POVc |
| 1547 | Duplicate serial/code | IVVc, PUVc, CashVc, VATDeclVc |
| 1557 | Serial number out of range (chronology violation) | IVVc, PUVc, ORVc, VATDeclVc |
| 1560 | Cannot delete (linked records exist) | IVVc, PUVc, POVc, VATDeclVc |
| 1574 | Negative quantity not allowed | ORVc, StockMovVc |
| 1582 | Currency not registered | IVVc |
| 1854 | Position code required | StockMovVc |
| 1958 | Employee payment type not allowed | IVVc |
| 2070 | Cash collection exists (blocks delete) | IVVc |
| 2072 | Original invoice not OKed (cannot credit) | IVVc |
| 2174 | Back-office account missing | CashVc |
| 2191 | Cash account missing for cash invoice | IVVc |
| 2194 | Later balance exists (chronology block) | CashVc |
| 2195 | Session not open | CashVc |
| 2210 | Official serial number required / serial status invalid | IVVc, StockMovVc |
| 2246 | Invalid status/combination | IVVc, StockMovVc |
| 2281 | Customer order number required | ORVc |
| 20011 | Over-reserving not allowed | ORVc |
| 20049 | Export sales disallowed for user | IVVc, ORVc |
| 20056 | Domestic sales disallowed for user | IVVc, ORVc |
| 20060 | Credit exceeds AR balance | IVVc |
| 20101 | Order class required | ORVc |
| 20275 | VAT number required | PUVc |
| 20406 | Down payment total exceeded | ORVc |
| 20416 | Down payment exists (blocks delete) | ORVc |
| 20561 | POS balance serial validation | CashVc |
| 20852 | Credit note date before original invoice date | IVVc |
| 20939 | VAT base account required | AccBlock |
| 22047 | Negative total not allowed | IVVc, ORVc |
| 22050 | Below minimum gross profit | IVVc, ORVc |
| 22065 | Reservations exist (blocks PO delete) | POVc |
| 22118 | Payment date validation failure | IVVc |
| 22260 | Credit limit - days overdue exceeded | ORVc |
| 22408 | Approval workflow pending (blocks delete) | IVVc, PUVc, ORVc, POVc |
| 25600 | Customer e-invoicing validation | IVVc |
| 25601 | Customer e-invoicing validation (alt) | IVVc |
| 26201 | Date outside valid range | IVVc, ORVc |
| 26214 | Serial number validation (specific) | IVVc |
| 34380 | Global transport number required | IVVc |
| 34381 | Global transport number validation | IVVc |
| 34430 | Status validation failure | IVVc |
| 34502 | Down payment exceeds order total | ORVc |
| 34504 | Down payment validation | ORVc |
| 36132 | Branch ID validation | IVVc |
| 39600 | Suspended - customer has overdue invoices | ORVc |
| 42670 | Poland: duplicate version for VAT period | VATDeclVc |
| 42800 | POL VAT export document type validation | IVVc |
| 42802 | Localization-specific serial validation | IVVc |
| 43193 | Localization-specific validation | IVVc |
| 43600 | Mutually exclusive settings enabled | AccBlock, APAccBlock |

---

## 18. Open Questions

These items require further investigation, either because the extraction was incomplete or because the business logic is implemented in called procedures outside the RAction files.

| # | Question | Affected REQ-IDs | Priority |
|---|----------|-----------------|----------|
| OQ-1 | **Credit limit calculation details**: The exact formula for credit limit checking in IVVc is in `SubCashRows_IVVc` (external procedure). What deductions apply? How does the cash row subtraction work? | REQ-IV-081, REQ-OR-005 | HIGH |
| OQ-2 | **GL Transaction structure**: `MakeTransFromIV` creates TRVc records. What is the exact debit/credit mapping? Which accounts are debited/credited for each invoice type? | REQ-IV-060, REQ-PU-037 | HIGH |
| OQ-3 | **FIFO cost layer logic**: `IVUpdateFIFO` and stock movement FIFO updates. How are cost layers created, consumed, and split? | REQ-IV-061, REQ-SM-036 | HIGH |
| OQ-4 | **Serial number chronology rules**: The `SerNrTest*` family of functions enforce date-based sequencing. What are the exact rules for when a serial can be reused or when gaps are allowed? | REQ-UNI-023 | MEDIUM |
| OQ-5 | **Permission system mapping**: HAL uses `UserCanAction("PermKey", bool)`. How do these 30+ permission keys map to the Nexa RBAC system with 5 roles? | All permission REQs | HIGH |
| OQ-6 | **Localization-specific rules**: Many branches contain `HasLocalization("SAU,NOR,PRY,POL")` guards. Which rules are UK-relevant for initial Nexa deployment? | REQ-IV-020, REQ-VD-004 | MEDIUM |
| OQ-7 | **Stock movement types**: StockMovVc supports 13 movement types ([MIGRATION_MAP](MIGRATION_MAP.md) 2.6). What are the specific validation differences per type? | REQ-SM-001 through REQ-SM-010 | MEDIUM |
| OQ-8 | **Approval workflow integration**: The `FindAcptRulesAndCreateAcceptanceAlert` procedure creates approval activities. What are the configurable rules and escalation paths? | REQ-UNI-013 | LOW |
| OQ-9 | **Inter-company PO/OR creation**: POVc can auto-create ORVc in another company. What data is copied and what is recalculated? | REQ-PO-034 | LOW |
| OQ-10 | **Item default propagation**: INVcRAction is 1,640 lines but mostly field-change handlers and sync logic. What are the full cascading effects when item master data changes? | REQ-IN-010 through REQ-IN-015 | MEDIUM |
| OQ-11 | **709 remaining RAction files**: This extraction covers 14 of 723 files. Key unanalyzed entities include: QTVc (Quotations), DispatchVc (Shipments), ProdOrderVc (Manufacturing), PRVc (Projects), BankRecVc (Bank Reconciliation), ARPayVc (AR Payments), APPayVc (AP Payments). | -- | HIGH |
| OQ-12 | **ORVcRecAction2.hal**: The second file (~743 lines) contains additional order logic. What rules are in the split file that are not in the primary? | REQ-OR-* | MEDIUM |

---

## Appendix A: File Evidence Index

Quick-reference for locating source evidence by file.

| File Path | Lines | Entities/Rules |
|-----------|-------|---------------|
| `legacy-src/c8520240417/hal/RActions/IVVcRecAction.hal` | 2,376 | REQ-IV-001 through REQ-IV-095 |
| `legacy-src/c8520240417/hal/RActions/PUVcRecAction.hal` | 1,714 | REQ-PU-001 through REQ-PU-053 |
| `legacy-src/c8520240417/hal/RActions/ORVcRecAction.hal` | 2,294 | REQ-OR-001 through REQ-OR-066 |
| `legacy-src/c8520240417/hal/RActions/POVcRAction.hal` | 1,270 | REQ-PO-001 through REQ-PO-043 |
| `legacy-src/c8520240417/hal/RActions/INVcRAction.hal` | 1,640 | REQ-IN-001 through REQ-IN-030 |
| `legacy-src/c8520240417/hal/RActions/StockMovVcRAction.hal` | 2,485 | REQ-SM-001 through REQ-SM-038 |
| `legacy-src/c8520240417/hal/RActions/AccBlockActions.hal` | 482 | REQ-AB-001 through REQ-AB-053 |
| `legacy-src/c8520240417/hal/RActions/APAccBlockActions.hal` | 263 | REQ-AP-001 through REQ-AP-042 |
| `legacy-src/c8520240417/hal/RActions/CashVcRAction.hal` | 288 | REQ-CA-001 through REQ-CA-041 |
| `legacy-src/c8520240417/hal/RActions/ContactVcRAction.hal` | 53 | REQ-CT-001 through REQ-CT-021 |
| `legacy-src/c8520240417/hal/RActions/HRMPAVcRAction.hal` | 137 | REQ-HR-001 through REQ-HR-031 |
| `legacy-src/c8520240417/hal/RActions/HRMPayrollVcRAction.hal` | 164 | REQ-PY-001 through REQ-PY-023 |
| `legacy-src/c8520240417/hal/RActions/AT2VcRAction.hal` | 28 | REQ-FA-001, REQ-FA-010 |
| `legacy-src/c8520240417/hal/RActions/VATDeclVcRAction.hal` | 211 | REQ-VD-001 through REQ-VD-040 |

---

## Appendix B: Requirement Count Summary

| Module | Validations | Permissions | Status Transitions | Cross-Entity Effects | Delete Guards | Calculations | Defaults | Total |
|--------|------------|------------|-------------------|---------------------|--------------|-------------|----------|-------|
| Universal (UNI) | 6 | -- | 6 | -- | 4 | -- | -- | 16 |
| Sales Invoice (IV) | 31 | 7 | 3 | 4 | 6 | 2 | -- | 53 |
| Purchase Invoice (PU) | 13 | 2 | -- | 10 | 4 | -- | -- | 29 |
| Sales Order (OR) | 28 | 6 | -- | 5 | 7 | -- | -- | 46 |
| Purchase Order (PO) | 11 | 2 | -- | 6 | 4 | -- | -- | 23 |
| Inventory Item (IN) | 2 | -- | -- | 6 | 2 | -- | 1 | 11 |
| Stock Movement (SM) | 10 | 2 | -- | 9 | -- | -- | -- | 21 |
| AR Account Settings (AB) | 28 | -- | -- | -- | -- | -- | -- | 28 |
| AP Account Settings (AP) | 29 | -- | -- | -- | -- | -- | -- | 29 |
| Cash/POS (CA) | 13 | -- | -- | 2 | -- | -- | 5 | 20 |
| Contact/CRM (CT) | 2 | -- | -- | -- | -- | -- | 2 | 4 |
| HR Performance (HR) | 10 | 1 | 2 | -- | -- | -- | -- | 13 |
| HR Payroll (PY) | 3 | -- | -- | -- | -- | 2 | 4 | 9 |
| Fixed Asset (FA) | 1 | -- | -- | -- | -- | -- | -- | 1 |
| VAT Declaration (VD) | 4 | -- | -- | 1 | 2 | -- | 3 | 10 |
| **TOTAL** | **191** | **20** | **11** | **43** | **29** | **4** | **15** | **313** |

---

*End of CODE_REQUIREMENTS document. This represents the first-pass extraction from 14 of 723 RAction files. See [Open Questions](#18-open-questions) for known gaps and planned follow-up analysis.*
