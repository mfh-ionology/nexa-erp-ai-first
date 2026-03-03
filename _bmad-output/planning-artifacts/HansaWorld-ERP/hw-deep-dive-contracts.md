# HansaWorld Deep-Dive: Contracts / Agreements / Loan Agreements Module

> **Generated**: 2026-02-15
> **Source files analysed**: 25+ HAL source files across RActions, WActions, Documents, Maint, Reports, Tools, StandardContracts directories
> **Scope**: Three distinct sub-modules -- Agreements (Rentals), Standard Contracts, and Loan Agreements

---

## Table of Contents

1. [Module Overview](#1-module-overview)
2. [Registers (Record Types)](#2-registers-record-types)
3. [Fields -- Every Field Per Register](#3-fields--every-field-per-register)
4. [Settings / Configuration Blocks](#4-settings--configuration-blocks)
5. [Enumerations and Constants](#5-enumerations-and-constants)
6. [Reports](#6-reports)
7. [Maintenances (Batch Operations)](#7-maintenances-batch-operations)
8. [Documents (Printable Forms)](#8-documents-printable-forms)
9. [Business Logic, Workflows, and Rules](#9-business-logic-workflows-and-rules)

---

## 1. Module Overview

HansaWorld implements three distinct but related contract sub-modules:

### 1.1 Agreements (Rental Agreements) -- Module `typStdRentals` (53)

Manages **recurring rental** and **hire** agreements. An Agreement is the parent record, which owns multiple Rental Reservations (line items), each of which can be dispatched, charged, invoiced, and off-hired independently. Supports advanced pricing, bank holiday exclusions, consumable items, and multiple invoice grouping modes.

**Key lifecycle**: Create Agreement -> Add Rental Reservations -> OK (approve) -> Dispatch -> Charge (periodic) -> Invoice -> Off-Hire / Collection -> Close

### 1.2 Standard Contracts -- Module `typStdContracts` (48)

Manages **subscription, maintenance, and recurring-invoice contracts**. A Contract record contains line items (products/services) with configurable period length and invoice frequency. Contracts can be renewed, changed, updated, or cancelled in batch.

**Key lifecycle**: Create Contract -> OK (approve) -> Create Invoices (periodic batch) -> Renew / Cancel

### 1.3 Loan Agreements -- Part of Loan Management

Manages **loan disbursement and repayment** agreements. Supports four repayment schedule types (Annuity, Linear, Linear Equal, Bullet). Generates GL transactions on activation and creates invoices per schedule row.

**Key lifecycle**: Create (New) -> Approve -> Sign (generates schedule) -> Active (creates GL transaction) -> Disburse (Purchase Invoice) -> Invoice (per schedule) -> Finished

### 1.4 HansaWorld Contracts (Service Contracts)

A specialised variant using `COCUServiceVc` for HansaWorld's own support/maintenance contracts. Links to `CUServiceVc` customer service records with package items and support items.

---

## 2. Registers (Record Types)

### 2.1 Primary Registers

| Register | HAL Type | Sub-Module | Description |
|----------|----------|------------|-------------|
| Agreement | `AgreementVc` | Rentals | Parent rental/hire agreement record |
| Rental Reservation | `RentResVc` | Rentals | Line items within an agreement (items to rent) |
| Rental Charge | `RentChrgVc` | Rentals | Computed charges for rental periods |
| Rental Quotation | `RentQTVc` | Rentals | Quotation linked to agreement (pricing source) |
| Dispatch | `DispatchVc` | Rentals | Outbound delivery of rented items |
| Off-Hire | `OffHireVc` | Rentals | Return/end of rental for items |
| Collection | `CollectionVc` | Rentals | Physical collection of rented items |
| Rental Item | `RentINVc` | Rentals | Rental-specific item configuration |
| Contract | `COVc` | Contracts | Standard contract record |
| HW Contract | `COCUServiceVc` | HW Contracts | HansaWorld service contract |
| Customer Service | `CUServiceVc` | HW Contracts | Customer service record linked to HW contract |
| Loan Agreement | `LoanAgreementVc` | Loan Mgmt | Loan agreement record |
| Loan Agreement Type | `LoanAgreementTypeVc` | Loan Mgmt | Template/type for loan agreements |
| Loan Agreement Schedule | `LoanAgreementSchedVc` | Loan Mgmt | Computed repayment schedule rows |
| Agreement Type | `AgreeTypeVc` | Rentals | Configuration template for rental agreements |
| Advanced Pricing Record | `AdvPriceRecVc` | Rentals | Date-based advanced pricing for rentals |
| Authorized Customer | `AuthCustVc` | Rentals | Customer/contact authorization for rentals |
| Customer Rental Statistics | `CustRentStatVc` | Rentals | Running statistics of customer rental activity |

### 2.2 Supporting Registers (Referenced)

| Register | HAL Type | Usage |
|----------|----------|-------|
| Invoice | `IVVc` | Generated invoices from agreements/contracts/loans |
| Purchase Invoice | `VIVc` | Disbursement invoices for loans |
| Payment | `OPVc` | Disbursement payments for loans |
| Transaction | `TRVc` | GL transactions for loan activation |
| Customer | `CUVc` | Customer master data |
| Item | `INVc` | Item/product master data |
| Supplier | `SUVc` | Created for customer when disbursing loans |
| Document | `DocVc` | Form/document templates |

---

## 3. Fields -- Every Field Per Register

### 3.1 AgreementVc (Rental Agreement)

#### Header Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `SerNr` | LongInt | Unique agreement serial number (auto-assigned from number series) | RAction, WAction |
| `TransDate` | Date | Transaction/creation date | RAction |
| `CustCode` | String | Customer code (link to CUVc) | RAction, WAction |
| `Addr0` | String | Customer name (line 1) | WAction |
| `Addr1` | String | Address line 1 | WAction |
| `Addr2` | String | Address line 2 | WAction |
| `Addr3` | String | Address line 3 | WAction |
| `InvAddr3` | String | Invoice address line 3 | WAction |
| `InvAddr4` | String | Invoice address line 4 | WAction |
| `OurContact` | String | Internal contact person | RAction |
| `ClientContact` | String | Customer contact person (editable when OKed) | WAction |
| `Location` | String | Location/warehouse code | RAction |
| `Objects` | String | Tracking objects (cost centres) | RAction |
| `SalesMan` | String | Salesperson code (editable when OKed) | WAction |
| `Department` | String | Department code | RAction |
| `CurncyCode` | String | Currency code | RAction |
| `FrRate` | Val | Exchange rate (from) | RAction |
| `ToRateB1` | Val | Exchange rate to Base 1 | RAction |
| `ToRateB2` | Val | Exchange rate to Base 2 | RAction |
| `BaseRate1` | Val | Base rate 1 | RAction |
| `BaseRate2` | Val | Base rate 2 | RAction |
| `AgreeStatus` | Integer | Agreement status: 0=Active, 1=unknown, 2=Closed/Terminated | RAction |
| `OKFlag` | Integer | Approval flag (0=Draft, 1=OK/Approved) | RAction |
| `Prntdf` | Integer | Printed flag (preserved on edit) | RActionClient |
| `AgreeType` | String | Agreement type code (link to AgreeTypeVc) | RAction |
| `startDate` | Date | Agreement start date (editable when OKed) | WAction |
| `endDate` | Date | Agreement end date (editable when OKed) | WAction |
| `CancelDate` | Date | Cancellation date (editable when OKed) | WAction |
| `lastInvDate` | Date | Last invoice date | RAction |
| `AgreementDate` | Date | Agreement formal date | Form |
| `Site` | String | Site code | WAction |
| `LangCode` | String | Language code | WAction |
| `InvComment` | String | Invoice comment (editable when OKed) | WAction |

#### Invoice Control Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `InvoiceBase` | Integer | Invoice detail level: 0=Per charge detail, 1=Per rental reservation, 2=Per agreement | AgreeInvMn |
| `IncludeOriginalItem` | Boolean | Include original item code on invoice | AgreeInvMn |
| `IncludePeriod` | Boolean | Include period dates on invoice | AgreeInvMn |
| `AddEmptyLine` | Boolean | Add empty line between groups on invoice | AgreeInvMn |
| `UseAsQty` | Integer | What to use as quantity on invoice | AgreeInvMn |
| `GroupInvoice` | Integer | Invoice grouping mode: 0=Per agreement, 1=Group by customer, 2=Split by site | AgreeInvMn |
| `IncludeSite` | Boolean | Include site on invoice | AgreeInvMn |
| `InclRentResNo` | Boolean | Include rental reservation number on invoice | AgreeInvMn |
| `InclCustOrdNr` | Boolean | Include customer order number on invoice | AgreeInvMn |

#### Shipping / Delivery Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `ShipAddr0` | String | Shipping address line 0 | RAction |
| `ShipAddr1` | String | Shipping address line 1 | RAction |
| `ShipAddr2` | String | Shipping address line 2 | RAction |
| `ShipAddr3` | String | Shipping address line 3 | RAction |
| `DelAddr3` | String | Delivery address line 3 | RAction |
| `DelAddr4` | String | Delivery address line 4 | RAction |
| `ShipMode` | String | Shipping mode | RAction |
| `ShipDeal` | String | Shipping terms | RAction |
| `PayDeal` | String | Payment terms | RAction |
| `DelAddrCode` | String | Delivery address code (pastes from customer addresses) | WAction |

#### Pricing / Classification Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `PriceList` | String | Price list code | RAction |
| `RebCode` | String | Rebate/discount code | RAction |
| `Sorting` | String | Sort code | RAction |
| `Phone` | String | Phone number | RAction |
| `Fax` | String | Fax number | RAction |
| `eMail` | String | Email address | RAction |
| `CustCat` | String | Customer category (from customer) | WAction |
| `CustVATCode` | String | Customer VAT code | WAction |
| `VATNr` | String | VAT registration number | WAction |
| `ExportFlag` | Integer | Export type: 0=Domestic, 1=Inside EU, 2=Outside EU | WAction |
| `InclVAT` | Boolean | Prices include VAT | WAction |
| `LTxtCode` | String | Legal text code | WAction |
| `SalesGroup` | String | Sales group | RAction |

### 3.2 RentResVc (Rental Reservation)

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `SerNr` | LongInt | Unique serial number | WAction |
| `AgreementNr` | LongInt | Parent agreement number | WAction |
| `Code` | String | Item code (the rental item) | WAction |
| `InvItem` | String | Invoice item code (may differ from rental item) | ChargeAgreeMn |
| `InvItemName` | String | Invoice item name | ChargeAgreeMn |
| `SerialNr` | String | Serial number of rented item | ChargeAgreeMn |
| `RentQuant` | Val | Rental quantity | ChargeAgreeMn |
| `RentResDel` | Val | Dispatched quantity | ChargeAgreeMn |
| `InvQuant` | Val | Invoice quantity multiplier | ChargeAgreeMn |
| `vRebate` | Val | Discount percentage | ChargeAgreeMn |
| `Site` | String | Site/location | ChargeAgreeMn |
| `Objects` | String | Tracking objects | ChargeAgreeMn |
| `CustOrdNr` | String | Customer order number | ChargeAgreeMn |
| `StartInvoicing` | Date | Charge start date | ChargeAgreeMn |
| `EndInvoicing` | Date | Charge end date | ChargeAgreeMn |
| `LastChargeDate` | Date | Last date charges were computed | ChargeAgreeMn |
| `AdvPrActive` | Integer | Advanced pricing active flag (0=standard, >0=advanced) | ChargeAgreeMn |
| `RecepyItem` | Integer | Recipe/BOM flag (0=normal, non-0=recipe -- components dispatched instead) | ChargeAgreeMn |
| `Type` | Integer | Row type on matrix: 2=Chargeable/consumable item | ChargeAgreeMn |
| `Quant` | Val | Quantity (on matrix rows) | ChargeAgreeMn |
| `Inv` | Val | Already-invoiced quantity (on matrix rows) | ChargeAgreeMn |
| `ArtCode` | String | Item code (on matrix rows) | ChargeAgreeMn |
| `Spec` | String | Specification/description (on matrix rows) | ChargeAgreeMn |

### 3.3 RentChrgVc (Rental Charge)

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `SerNr` | LongInt | Unique serial number (set to -1 for auto-assign) | ChargeAgreeMn |
| `SubSerNr` | Integer | Sub-serial number | ChargeAgreeMn |
| `TransDate` | Date | Transaction date | ChargeAgreeMn |
| `FrDate` | Date | Charge period from date | ChargeAgreeMn |
| `ToDate` | Date | Charge period to date | ChargeAgreeMn |
| `TransNr` | LongInt | Rental reservation serial number (link) | ChargeAgreeMn |
| `AgreementNr` | LongInt | Parent agreement number | ChargeAgreeMn |
| `FileName` | Integer | Charge type: -1=Actual rental charges, 5=Chargeable items | ChargeAgreeMn |
| `OrigItem` | String | Original rental item code | ChargeAgreeMn |
| `OrigSerialNr` | String | Original item serial number | ChargeAgreeMn |
| `Objects` | String | Tracking objects | ChargeAgreeMn |
| `CustOrdNr` | String | Customer order number | ChargeAgreeMn |
| `Item` | String | Invoice item code | ChargeAgreeMn |
| `Spec` | String | Item specification/description | ChargeAgreeMn |
| `ItemQuant` | Val | Item quantity multiplier | ChargeAgreeMn |
| `Quant` | Val | Charge quantity (days/months/units) | ChargeAgreeMn |
| `Price` | Val | Unit price | ChargeAgreeMn |
| `vRebate` | Val | Discount percentage | ChargeAgreeMn |
| `Sum` | Val | Calculated sum (Quant * ItemQuant * Price - Rebate) | ChargeAgreeMn |
| `InvNr` | LongInt | Invoice number (-1=uninvoiced, >0=invoiced) | AgreeInvMn |
| `RowNr` | Integer | Invoice row number (-1=not yet assigned) | AgreeInvMn |
| `CurncyCode` | String | Currency code | ChargeAgreeMn |
| `Site` | String | Site code | ChargeAgreeMn |

### 3.4 COVc (Standard Contract)

#### Header Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `SerNr` | LongInt | Unique contract serial number | Contract.hal |
| `ChildSerNr` | LongInt | Child/linked contract number | Contract.hal |
| `CODate` | Date | Contract date | Contract.hal |
| `CustCode` | String | Customer code | Contract.hal |
| `Addr0` | String | Customer name | Contract.hal |
| `Addr1` | String | Address line 1 | Contract.hal |
| `Addr2` | String | Address line 2 | Contract.hal |
| `Addr3` | String | Address line 3 | Contract.hal |
| `InvAddr3` | String | Invoice address line 3 | Contract.hal |
| `InvAddr4` | String | Invoice address line 4 | Contract.hal |
| `OurContact` | String | Internal contact | Contract.hal |
| `ClientContact` | String | Customer contact | Contract.hal |
| `SalesMan` | String | Salesperson code | Contract.hal |
| `Department` | String | Department code | Contract.hal |
| `startDate` | Date | Contract start date | Contract.hal |
| `endDate` | Date | Contract end date | Contract.hal |
| `lastInvDate` | Date | Last invoiced date | Contract.hal |
| `CurncyCode` | String | Currency code | Contract.hal |
| `FrRate` | Val | Exchange rate (from) | Contract.hal |
| `ToRateB1` | Val | Exchange rate to Base 1 | Contract.hal |
| `ToRateB2` | Val | Exchange rate to Base 2 | Contract.hal |
| `BaseRate1` | Val | Base rate 1 | Contract.hal |
| `BaseRate2` | Val | Base rate 2 | Contract.hal |

#### Totals Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `Sum0` | Val | Rounding amount | Contract.hal |
| `Sum1` | Val | Subtotal (excl. VAT) | Contract.hal |
| `Sum2` | Val | VAT-free amount | Contract.hal |
| `Sum3` | Val | VAT amount | Contract.hal |
| `Sum4` | Val | Total (incl. VAT) | Contract.hal |

#### Control Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `OKFlag` | Integer | Approval flag | Contract.hal |
| `Accepted` | Integer | Acceptance flag | Contract.hal |
| `ExportFlag` | Integer | Export type (Domestic/EU/Export) | Contract.hal |
| `InclVAT` | Boolean | Prices include VAT | Contract.hal |
| `ContractClass` | String | Contract class code | Contract.hal |
| `perLength` | Integer | Period length (number of days/months) | ContractForm.hal |
| `perType` | Integer | Period type: 0=Days, 1=Months | ContractForm.hal |
| `invDays` | Integer | Invoice days (how many days before to invoice) | ContractForm.hal |
| `invDtype` | Integer | Invoice days type | ContractForm.hal |
| `normalFactor` | Val | Pricing normal factor | HWContractForm.hal |
| `VECode` | String | Version/edition code | Contract.hal |

#### Shipping / Delivery Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `ShipAddr0` | String | Shipping address line 0 | Contract.hal |
| `ShipAddr1` | String | Shipping address line 1 | Contract.hal |
| `ShipAddr2` | String | Shipping address line 2 | Contract.hal |
| `ShipAddr3` | String | Shipping address line 3 | Contract.hal |
| `DelAddr3` | String | Delivery address line 3 | Contract.hal |
| `DelAddr4` | String | Delivery address line 4 | Contract.hal |
| `ShipMode` | String | Shipping mode | Contract.hal |
| `ShipDeal` | String | Shipping terms | Contract.hal |
| `PayDeal` | String | Payment terms | Contract.hal |
| `LangCode` | String | Language code | Contract.hal |
| `Location` | String | Location/warehouse | Contract.hal |
| `InvComment` | String | Invoice comment | Contract.hal |
| `PriceList` | String | Price list code | Contract.hal |

#### Freight Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `FrPrice` | Val | Freight price | Contract.hal |
| `FrItem` | String | Freight item code | Contract.hal |
| `FrVATCode` | String | Freight VAT code | Contract.hal |

### 3.5 COVc Matrix Rows (Contract Line Items)

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `ArtCode` | String | Item code | ContractForm.hal |
| `Quant` | Val | Quantity | ContractForm.hal |
| `Spec` | String | Specification/description | ContractForm.hal |
| `Price` | Val | Unit price | ContractForm.hal |
| `vRebate` | Val | Discount percentage | ContractForm.hal |
| `Sum` | Val | Row sum | ContractForm.hal |
| `BasePrice` | Val | Base price (before adjustments) | ContractForm.hal |
| `VATCode` | String | VAT code | ContractForm.hal |
| `PriceFactor` | Val | Price factor/multiplier | ContractForm.hal |
| `InvoiceAfter` | Date | Invoice after date | ContractForm.hal |
| `InvoiceNo` | LongInt | Invoice number (when invoiced) | ContractForm.hal |
| `Type` | Integer | Row type | ContractForm.hal |
| `RowType` | Integer | Sub-row type | ContractForm.hal |

### 3.6 LoanAgreementVc (Loan Agreement)

#### Header Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `SerNr` | LongInt | Unique serial number | RAction |
| `TransDate` | Date | Transaction/creation date | RAction, WAction |
| `CustCode` | String | Customer code | RAction, WAction |
| `Addr0` | String | Customer name | WAction |
| `SalesMan` | String | Salesperson code | RAction |
| `OurContact` | String | Internal contact | RAction |
| `ClientContact` | String | Customer contact | RAction |
| `Type` | String | Loan agreement type code (link to LoanAgreementTypeVc) | WAction |
| `Status` | Integer | Status: 0=New, 1=Approved, 2=Signed, 3=Active, 4=Disbursed, 5=Cancelled, 6=Paused, 7=Finished | RAction |
| `startDate` | Date | Loan start date | WAction |
| `endDate` | Date | Loan end date | RAction |
| `AgreedDate` | Date | Formal agreement date | RAction |
| `FirstIntDate` | Date | First interest accrual date | RAction |
| `FirstInvDate` | Date | First invoice date | WAction |
| `MonthlyPaymentDay` | Integer | Day of month for payments | WAction |

#### Financial Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `CurncyCode` | String | Currency code | WAction |
| `FrRate` | Val | Exchange rate (from) | WAction |
| `ToRateB1` | Val | Exchange rate to Base 1 | WAction |
| `ToRateB2` | Val | Exchange rate to Base 2 | WAction |
| `BaseRate1` | Val | Base rate 1 | WAction |
| `BaseRate2` | Val | Base rate 2 | WAction |
| `InvSum4` | Val | Loan principal amount (total) | WAction |
| `DepositSum` | Val | Deposit amount | WAction |
| `DepositPrc` | Val | Deposit percentage (auto-calculates DepositSum) | WAction |
| `IntRate` | Val | Interest rate | WAction |
| `IntRateMethod` | Integer | Interest rate method: 0=Monthly rate, 1=Annual rate | SchedTools |
| `RateType` | Integer | Rate type | RAction |
| `OverdueRate` | Val | Overdue interest rate | LoanTools |
| `Months` | Integer | Number of instalment months | WAction |
| `MaxMonthlyPayment` | Val | Maximum monthly payment cap (for annuity) | SchedTools |
| `ChargeMethod` | Integer | Charge method | RAction |
| `LateFeeDays` | Integer | Late fee grace period in days | LoanTools |

#### Schedule Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `ScheduleType` | Integer | Schedule type: 0=Annuity, 1=Linear, 2=LinearEqual, 3=Bullet | WAction |

#### Account Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `LoanAgreementAcc` | String | Loan agreement GL account (debit on activation) | RAction |
| `ARAcc` | String | AR account (credit on activation) | RAction |
| `ARAccObject` | String | AR account object | RAction |

#### Classification Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `PayDeal` | String | Payment terms | WAction |
| `RebCode` | String | Rebate/discount code | WAction |
| `CustCat` | String | Customer category | WAction |
| `ExportFlag` | Integer | Export type | WAction |
| `LangCode` | String | Language code | WAction |
| `Objects` | String | Tracking objects | RAction |
| `BaseTotalSum` | Val | Base total sum | RAction |
| `TotalSum` | Val | Total sum | RAction |
| `InvoiceToCode` | String | Invoice-to customer code | WAction |

### 3.7 LoanAgreementVc Matrix Rows

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `ArtCode` | String | Item code | WAction |
| `Quant` | Val | Quantity | WAction |
| `Price` | Val | Unit price | WAction |
| `vRebate` | Val | Discount percentage | WAction |
| `Sum` | Val | Row sum | WAction |
| `PriceFactor` | Val | Price factor | WAction |
| `Comment` | String | Comment/description | WAction |
| `ChargeType` | Integer | Charge type | WAction |
| `InvoicedOn` | Date | Date invoiced | LoanTools |
| `InvoicedSum` | Val | Amount invoiced | LoanTools |

### 3.8 LoanAgreementSchedVc (Loan Schedule Row)

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `Type` | Integer | Row type: 0=Invoice, 1=Credit Invoice, 2=BuyOut, 3=Disbursement | SchedTools |
| `InvDate` | Date | Invoice date | LoanAgreementInfoRn |
| `PeriodFrom` | Date | Period start date | SchedTools |
| `PeriodTo` | Date | Period end date | SchedTools |
| `Interest` | Val | Interest amount for period | SchedTools |
| `Fees` | Val | Fees amount for period | SchedTools |
| `Principal` | Val | Principal repayment for period | SchedTools |
| `Total` | Val | Total payment for period | SchedTools |
| `Balance` | Val | Remaining balance after payment | SchedTools |
| `IVNr` | LongInt | Generated invoice number | LoanAgreementInfoRn |

### 3.9 LoanAgreementTypeVc (Loan Agreement Type)

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `Code` | String | Type code (primary key) | LoanTools |
| `ScheduleType` | Integer | Default schedule type | LoanTools |
| `Months` | Integer | Default number of months | LoanTools |
| `PayDeal` | String | Default payment terms | LoanTools |
| `DepositSum` | Val | Default deposit amount | LoanTools |
| `DepositPrc` | Val | Default deposit percentage | LoanTools |
| `IntRate` | Val | Default interest rate | LoanTools |
| `IntRateMethod` | Integer | Default interest rate method | LoanTools |
| `RateType` | Integer | Default rate type | LoanTools |
| `OverdueRate` | Val | Default overdue rate | LoanTools |
| `ChargeMethod` | Integer | Default charge method | LoanTools |
| `LateFeeDays` | Integer | Default late fee days | LoanTools |
| `MaxMonthlyPayment` | Val | Default max monthly payment | LoanTools |
| `DaysInYear` | Integer | Days-in-year convention: 0=360, 1=Actual | LoanTypeRAction, SchedTools |
| `DaysInMnth` | Integer | Days-in-month convention: 0=30, 1=Actual | LoanTypeRAction, SchedTools |

### 3.10 AgreeTypeVc (Agreement Type)

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `perType` | Integer | Period type: 0=Days, 1=Months, 3=Fixed price | ChargeAgreeMn |
| `perLength` | Integer | Period length (in days or months depending on perType) | ChargeAgreeMn |
| `ChargeBankHol` | Integer | Bank holiday handling: 0=Ignore, 1=Exclude (global), 2=Exclude (per customer country) | ChargeAgreeMn |
| `MinChrgQty` | Val | Minimum charge quantity | ChargeAgreeMn |

### 3.11 AuthCustVc (Authorized Customer)

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `CustCode` | String | Customer code | RAction |
| `Contact` | String | Contact person name | RAction |
| `MaxUnits` | Val | Maximum rental units allowed | RAction |
| `MaxSales` | Val | Maximum sales value allowed | RAction |
| `MaxCost` | Val | Maximum cost value allowed | RAction |
| `startDate` | Date | Authorization start date | RAction |
| `endDate` | Date | Authorization end date | RAction |

### 3.12 CustRentStatVc (Customer Rental Statistics)

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `CustCode` | String | Customer code | RAction |
| `RentStockSum` | Val | Current rental stock value (sales) | RAction |
| `RentStockCost` | Val | Current rental stock cost value | RAction |
| `RentalUnits` | Val | Current number of rental units | RAction |

### 3.13 COCUServiceVc (HansaWorld Service Contract)

In addition to standard COVc fields, this register has:

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `TotalCOWorth` | Val | Total contract worth | HWContractForm |
| `SupportItemCode` | String | Support item code per row | HWContractForm |
| `normalFactor` | Val | Normal pricing factor | HWContractForm |

---

## 4. Settings / Configuration Blocks

### 4.1 RentControlBlock (Rental Control Settings)

| Setting | Type | Description | Source |
|---------|------|-------------|--------|
| `AutoItemsOut` | Boolean | Auto-dispatch items when agreement is OKed | RAction, RActionTools |
| `CheckLanguage` | Boolean | Check language code on agreement | RAction |
| `ChargeForFirstDay` | Boolean | Charge for first day of rental | ChargeAgreeMn |
| `PrintQTOnAgr` | Boolean | Print Rental Quotation on Agreement document | AgreementForm |

### 4.2 RentInvoiceBlock (Rental Invoice Settings)

| Setting | Type | Description | Source |
|---------|------|-------------|--------|
| Invoice base account | String | Default sales account for rental invoices | AgreeInvMn |
| VAT code defaults | String | Default VAT code for rental invoices | AgreeInvMn |
| Domestic/EU/Export accounts | String | Sales accounts per export flag type | AgreeInvMn |
| Domestic/EU/Export VAT codes | String | VAT codes per export flag type | AgreeInvMn |

### 4.3 RentDepBlock (Rental Department Block)

| Setting | Type | Description | Source |
|---------|------|-------------|--------|
| Department-level overrides | Various | Per-department rental invoice account/VAT settings | AgreeInvMn |

### 4.4 LoanManSettingsBlock (Loan Management Settings)

| Setting | Type | Description | Source |
|---------|------|-------------|--------|
| `DaysInYear` | Integer | Default days-in-year convention (360 or actual) | LoanTypeRAction |
| `DaysInMnth` | Integer | Default days-in-month convention (30 or actual) | LoanTypeRAction |
| `DefaultType` | String | Default loan agreement type code | LoanTypeRAction |
| `MonthlyPaymentDay` | Integer | Default day of month for payments | LoanTools |
| `InterestInclFirstDay` | Boolean | Include first day in interest calculation | SchedTools |

### 4.5 LoanAgreementAccUsageBlock (Loan Account Usage)

| Setting | Type | Description | Source |
|---------|------|-------------|--------|
| `LoanAgreementAcc` | String | Default loan agreement GL account | RAction |
| `ARAcc` | String | Default AR account | RAction |
| `InterestRoundOff` | Integer | Interest rounding mode (decimal places) | SchedTools |
| `PrincipalRoundOff` | Integer | Principal rounding mode (decimal places) | SchedTools |

### 4.6 LoanManIVSettingsBlock (Loan Invoice Settings)

| Setting | Type | Description | Source |
|---------|------|-------------|--------|
| `PayDeal` | String | Default payment terms for loan invoices | LoanTools |
| `AccNumber` | String | Default sales account | LoanTools |
| `VATCode` | String | Default VAT code | LoanTools |
| `PayMode` | String | Default payment mode | LoanTools |
| `PrincipalItem` | String | Item code for principal line on invoice | LoanTools |
| `InterestItem` | String | Item code for interest line on invoice | LoanTools |
| `Objects` | String | Default tracking objects | LoanTools |
| `InsertAgreementInPISuppIVNr` | Boolean | Insert agreement number in Purchase Invoice supplier ref | LoanTools |

### 4.7 ContractClassTClass (Contract Classes)

Setting for defining contract classification categories. Used by COVc.ContractClass field.

### 4.8 CODefValTClass (Contract Defaults)

Default values for new contract records. Applied when creating new COVc records.

### 4.9 Standard Contracts Module Settings (from saengm.hal)

| Setting | Module | Description |
|---------|--------|-------------|
| Company Info | modCO | Company-level settings |
| Contract Classes | modCO | Contract classification categories |
| Contract Defaults | modCO | Default values for new contracts |
| Invoice Settings | modCO | Account and VAT defaults for invoices |
| Payment Modes | modCO | Payment method definitions |
| Payment Terms | modCO | Payment term definitions |
| Reporting Periods | modCO | Fiscal period definitions |
| Units | modCO | Unit of measure definitions |
| VAT Codes | modCO | VAT/tax code definitions |
| Item Classifications | modCO | Item classification categories (conditional) |
| Item Groups | modCO | Item group definitions (conditional) |
| Legal Invoice Numbers | modCO | Legal invoice number series (conditional) |

---

## 5. Enumerations and Constants

### 5.1 Module Type Constants (haldefs.h)

```
typStdContracts  = 48   // Standard Contracts module
typStdRentals    = 53   // Rentals/Agreements module
```

### 5.2 kLoanAgreementStatus (haldefs.h line 9623)

| Value | Constant | Description |
|-------|----------|-------------|
| 0 | `kLoanAgreementStatusNew` | Newly created, not yet approved |
| 1 | `kLoanAgreementStatusApproved` | Approved by authoriser |
| 2 | `kLoanAgreementStatusSigned` | Signed -- triggers schedule generation |
| 3 | `kLoanAgreementStatusActive` | Active -- triggers GL transaction creation |
| 4 | `kLoanAgreementStatusDisbursed` | Funds disbursed |
| 5 | `kLoanAgreementStatusCanceled` | Cancelled |
| 6 | `kLoanAgreementStatusPaused` | Paused (payments suspended) |
| 7 | `kLoanAgreementStatusFinished` | Completed/paid off |

### 5.3 kLoanAgreementScheduleType (haldefs.h line 9634)

| Value | Constant | Description |
|-------|----------|-------------|
| 0 | `kLoanAgreementScheduleTypeAnnuity` | Equal monthly payments (PMT formula) |
| 1 | `kLoanAgreementScheduleTypeLinear` | Equal principal, declining interest |
| 2 | `kLoanAgreementScheduleTypeLinearEqual` | Equal principal, equally spread interest |
| 3 | `kLoanAgreementScheduleTypeBullet` | Interest-only, full principal at end |

### 5.4 kLoanAgreementScheduleRowType (haldefs.h line 9641)

| Value | Constant | Description |
|-------|----------|-------------|
| 0 | `kLoanAgreementScheduleRowTypeIV` | Normal invoice row |
| 1 | `kLoanAgreementScheduleRowTypeCredIV` | Credit invoice row |
| 2 | `kLoanAgreementScheduleRowTypeBuyOut` | Buy-out/early settlement row |
| 3 | `kLoanAgreementScheduleRowTypeDisbursement` | Disbursement row |

### 5.5 kCOCUServiceEnablerType (haldefs.h line 8054)

| Value | Constant | Description |
|-------|----------|-------------|
| 0 | `kCOCUServiceEnablerRegular` | Regular/standard |
| 1 | `kCOCUServiceEnablerDisabled` | Disabled |
| 2 | `kCOCUServiceEnablerEnabled` | Explicitly enabled |

### 5.6 kExportFlagType (haldefs.h line 6644)

| Value | Constant | Description |
|-------|----------|-------------|
| 0 | `kExportFlagDomestic` | Domestic sale |
| 1 | `kExportFlagInsideEU` | Sale inside EU |
| 2 | `kExportFlagOutsideEU` | Sale outside EU |
| 3 | `kExportFlagInsideEUPostVAT` | Inside EU, post-VAT |
| 4 | `kExportFlagOutsideEUPostVAT` | Outside EU, post-VAT |

### 5.7 Agreement Status (from code analysis, not in haldefs.h as named enum)

| Value | Description |
|-------|-------------|
| 0 | Active/Open |
| 2 | Closed/Terminated |

### 5.8 Agreement InvoiceBase Modes

| Value | Description |
|-------|-------------|
| 0 | Per charge detail (each charge becomes an invoice row) |
| 1 | Per rental reservation (charges grouped per reservation) |
| 2 | Per agreement (all charges grouped into one row) |

### 5.9 Agreement GroupInvoice Modes

| Value | Description |
|-------|-------------|
| 0 | One invoice per agreement |
| 1 | Group invoices by customer (multiple agreements, one invoice) |
| 2 | Split invoices by site |

### 5.10 AgreeType perType (Period Type)

| Value | Description |
|-------|-------------|
| 0 | Days (charge per day) |
| 1 | Months (charge per month) |
| 3 | Fixed price (flat charge per period) |

### 5.11 AgreeType ChargeBankHol (Bank Holiday Handling)

| Value | Description |
|-------|-------------|
| 0 | Ignore bank holidays (charge all days) |
| 1 | Exclude bank holidays (global calendar) |
| 2 | Exclude bank holidays (per customer country) |

### 5.12 RentChrgVc FileName (Charge Category)

| Value | Description |
|-------|-------------|
| -1 | Actual rental charges (time-based) |
| 5 | Chargeable/consumable items |

### 5.13 Interest Rate Method (LoanAgreement)

| Value | Description |
|-------|-------------|
| 0 | Monthly interest rate (rate is already monthly, multiply by 12 for annual) |
| 1 | Annual interest rate (divide by 12 for monthly) |

### 5.14 Days in Year / Days in Month Conventions

| DaysInYear Value | Description |
|------------------|-------------|
| 0 | 360 days (30/360 convention) |
| 1 | Actual days in year |

| DaysInMnth Value | Description |
|------------------|-------------|
| 0 | 30 days per month |
| 1 | Actual days in month |

### 5.15 Contract Period Type (COVc)

| Value | Description |
|-------|-------------|
| 0 | Days |
| 1 | Months |

### 5.16 Resource Type Constants

```
kRentResVc = 3           // Rental Reservation resource type
kResourceRentResVc = 2   // Resource calendar type for rental reservations
kResourceMonthRentalItem = 8  // Monthly rental item resource type
```

---

## 6. Reports

### 6.1 Agreement Invoice Info Report (`AgreeInvRn`)

**Source**: `/legacy-src/c8520240417/hal/Reports/AgreeInvRn.hal`

**Purpose**: Displays comprehensive agreement information including all reservations, charges, dispatches, and off-hires.

**Filters/Parameters**:
- Agreement serial number range (from/to)
- Customer code range (from/to)
- Objects filter
- Salesman filter
- Site filter
- Customer category filter
- Customer classification filter

**Output Sections**:
1. **Agreement Header**: SerNr, CustCode, TransDate, startDate, endDate, OKFlag
2. **Rental Reservations (Active)**: Item code, serial number, quantities, dates, status
3. **Rental Reservations (Done/Completed)**: Same as above for completed reservations
4. **Charges (Invoiced)**: Charge details with invoice numbers
5. **Charges (Uninvoiced)**: Pending charges not yet invoiced
6. **Dispatches**: Outbound delivery records
7. **Off-Hires**: Return/end-of-rental records

### 6.2 Contract List Report (`CORn`)

**Source**: `/legacy-src/c8520240417/hal/Reports/Contract.hal`

**Purpose**: Lists contracts with filtering and detail options.

**Filters/Parameters**:
- Contract serial number range (from/to)
- Customer code range (from/to)
- Contract date range (from/to)
- OK flag filter (all/OK only/not OK only)
- Accepted filter (all/accepted/not accepted)
- Include items toggle
- Item code range (from/to)
- Contract class filter
- Currency filter
- Price list filter
- Customer category filter
- Customer classification filter
- Include/exclude items option

**Output Modes**:
1. **List view**: Summary line per contract (SerNr, CustCode, dates, totals)
2. **Detailed view**: Full contract with all line items

**Totals**: Accumulates Sum4 (total), Base1 and Base2 currency totals. Supports consolidation across daughter companies.

### 6.3 Loan Agreement Info Report (`LoanAgreementInfoRn`)

**Source**: `/legacy-src/c8520240417/hal/Reports/LoanAgreementInfoRn.hal`

**Purpose**: Displays loan agreement details with complete repayment schedule.

**Filters/Parameters**:
- Loan agreement serial number range (from/to)

**Output**:
1. **Header**: Agreement title, original loan amount (InvSum4)
2. **Schedule Table** with columns:
   - Invoice Date (with link to invoice if generated)
   - Period (From - To)
   - Interest amount
   - Principal amount
   - Fees amount
   - Total payment
   - Remaining Balance
3. **Totals Row**: Sum of Principal, Interest, Fees, Total

### 6.4 Contract Contacts Report (`Contra2Rn`)

**Source**: Referenced in `saengm.hal`

**Purpose**: Lists contact persons associated with contracts.

### 6.5 Contract History Report (`COHistRn`)

**Source**: Referenced in `saengm.hal`

**Purpose**: Shows modification/change history for contracts.

### 6.6 Contract Worth Report (`COworthRn`)

**Source**: Referenced in `saengm.hal`

**Purpose**: Calculates and displays the total value/worth of contracts.

### 6.7 Invoiceable Contracts Report (`COInvRn`)

**Source**: Referenced in `saengm.hal`

**Purpose**: Lists contracts that are due for invoicing.

### 6.8 Additional Reports (from module definition)

- **Invoice Journal** (`InvoiceRn`) -- Journal of generated invoices
- **Customer List** (`CustRn`) -- Customer listing
- **Item List** (`ArtRn`) -- Item/product listing
- **Company Info** (`CompInfoRn`) -- Company information report

### 6.9 Commented-Out Credit Manager Reports (from LoanAgreementInfoRn.hal)

The source contains extensive commented-out code for a Credit Manager reporting function (`PrintCredManTop`) that calculated:
- Planned vs actual instalments, interest, fees, deposits
- Current balance and next instalment amount
- Amount now due and arrears analysis
- Missed payment tracking (current, total, worst period)
- Settlement sum calculation
- Contract age calculation

This suggests a previous or planned credit management/collections module.

---

## 7. Maintenances (Batch Operations)

### 7.1 Generate Agreement Invoices (`GenAgreeInvMn`)

**Source**: `/legacy-src/c8520240417/hal/Maint/AgreeInvMn.hal` (1034 lines)

**Purpose**: Batch-generates invoices from uninvoiced rental charges across agreements.

**Parameters**:
- Agreement serial number range (from/to)
- Customer code range (from/to)
- Invoice date
- Objects filter
- Site filter

**Process**:
1. Iterates all agreements in range
2. For each agreement, finds all uninvoiced charges (`RentChrgVc` where `InvNr == -1`)
3. Groups charges according to `InvoiceBase` setting (per charge, per reservation, per agreement)
4. Creates or extends existing invoice (`IVVc`) based on `GroupInvoice` setting
5. Applies VAT code resolution cascade: Item -> Rent Group/Item Group -> Account block defaults
6. Applies sales account resolution cascade: Item -> Rent Group/Item Group -> Account block defaults
7. Handles export flag (Domestic/EU/Export) for appropriate VAT and sales accounts
8. Optionally splits invoices by site when `GroupInvoice == 2`
9. Adds prepayment offset rows if applicable
10. Marks charges as invoiced (sets `InvNr` and `RowNr`)
11. Updates agreement `lastInvDate`

**Key Sub-procedures**:
- `BuildIVFromAgreement` -- Assembles invoice rows from charges
- `SetupIVFromAgreement` -- Creates or finds existing invoice record
- `CleanupAndSplitBySite` -- Splits invoice by site for GroupInvoice mode 2
- `UpdateCharges` -- Updates charge records with invoice reference
- `AddPrepaymentRow` -- Adds prepayment offset to invoice
- `GetVATCodeFromAccount` -- Resolves VAT code from account settings
- `GetSalesAccountFromItem` -- Resolves sales account from item/group hierarchy

### 7.2 Charge Agreements (`ChargeAgreementMn`)

**Source**: `/legacy-src/c8520240417/hal/Maint/ChargeAgreeMn.hal`

**Purpose**: Batch-computes rental charges for agreement periods.

**Parameters**:
- Agreement serial number range (from/to)
- Charge date (to date)
- Write flag (preview vs commit)

**Process**:
1. Iterates agreements and their rental reservations
2. For each reservation, determines the charge period based on `LastChargeDate`, `StartInvoicing`, `EndInvoicing`
3. Calculates charge quantity based on period type:
   - **Days (perType=0)**: Counts days, optionally excluding bank holidays
   - **Months (perType=1)**: Calculates months as DateDiff/30
   - **Fixed (perType=3)**: Fixed quantity regardless of period
4. Applies minimum charge quantity (`MinChrgQty`)
5. Applies advanced pricing if active (`AdvPriceRecVc` with date ranges)
6. Creates `RentChrgVc` records for each charge
7. Handles partial periods (pro-rating)
8. Processes chargeable/consumable items (matrix rows with `Type==2`)
9. Supports charge consolidation (fills up existing uninvoiced charges)

**Key Sub-procedures**:
- `CreateAgreementCharge` -- Creates a single rental charge record
- `AddChargebleItems` -- Charges consumable items from reservation matrix rows
- `FindAdvPriceRow` -- Finds applicable advanced pricing row for date
- `FindChargeFromRentQT` -- Looks up price from linked Rental Quotation
- `ChargeRentRes` -- Main per-reservation charging logic

### 7.3 Timed Charge Agreement (`TimedChargeAgree`)

**Source**: `/legacy-src/c8520240417/hal/Maint/ChargeAgreeMn.hal`

**Purpose**: Scheduled/automatic version of charging. Called by system timer to charge agreements automatically.

### 7.4 Dispatch from Agreement (`DispatchAgreement1Mn`)

**Source**: `/legacy-src/c8520240417/hal/Maint/AgreementMn.hal`

**Purpose**: Creates Dispatch records from agreement rental reservations.

**Process**:
1. Finds or creates a Dispatch record for the agreement
2. Copies customer details, addresses, location from agreement
3. Creates dispatch rows from rental reservation items
4. Handles location matching for multi-location setups

### 7.5 Collection from Agreement (`CollectionAgreementMn`)

**Source**: `/legacy-src/c8520240417/hal/Maint/AgreementMn.hal`

**Purpose**: Creates Collection records for physically collecting rented items.

**Process**:
1. Finds or creates a Collection record for the agreement
2. Copies relevant details from agreement
3. Creates collection rows from rental reservation items

### 7.6 Off-Hire from Agreement (`OffHireAgreement1Mn`)

**Source**: `/legacy-src/c8520240417/hal/Maint/AgreementMn.hal`

**Purpose**: Creates Off-Hire records to formally end the rental of items.

**Process**:
1. Finds or creates an Off-Hire record for the agreement
2. Copies relevant details from agreement
3. Creates off-hire rows from rental reservation items
4. Triggers end-of-rental processing

### 7.7 Create Contract Invoices (`CreateCOInvMn`)

**Source**: Referenced in `saengm.hal`

**Purpose**: Batch-generates invoices from contracts that are due for invoicing.

### 7.8 Renew Contracts (`RenewCOMn`)

**Source**: Referenced in `saengm.hal`

**Purpose**: Batch-renews contracts (extends end dates, creates new periods).

### 7.9 Update Contracts (`UpdateCOMn`)

**Source**: Referenced in `saengm.hal`

**Purpose**: Batch-updates contract fields (e.g., price changes across multiple contracts).

### 7.10 Change Contracts (`ChangeCOMn`)

**Source**: Referenced in `saengm.hal`

**Purpose**: Batch-modifies contract parameters.

### 7.11 Cancel Unpaid Contracts (`CancelDueCOMn`)

**Source**: Referenced in `saengm.hal`

**Purpose**: Batch-cancels contracts where invoices remain unpaid past a threshold.

---

## 8. Documents (Printable Forms)

### 8.1 Agreement Form (`AgreementForm` / `DoAgreementForm`)

**Source**: `/legacy-src/c8520240417/hal/Documents/AgreementForm.hal`, `DoAgreementForm.hal`

**Purpose**: Prints the rental agreement document.

**Form Fields** (F_ prefix constants):

| Field Code | Description |
|------------|-------------|
| `F_NUMMER` | Agreement serial number |
| `F_KUNDNR` | Customer code |
| `F_KUNDNAMN` | Customer name |
| `F_ADDR1` - `F_ADDR5` | Customer address lines |
| `F_IVADDR1` - `F_IVADDR5` | Invoice address lines |
| `F_STARTDATUM` | Start date |
| `F_ENDDATE` | End date |
| `F_CHARGESCODE` | Charges code |
| `F_RATE` | Rate/price |
| `F_COMMENT` | Comment |
| `F_OURCONT` | Our contact |
| `F_CUSTTCONT` | Customer contact |
| `F_SELLER` | Salesperson |
| `F_DEPT` | Department |
| `F_EXPAVTAL` | Agreement reference |
| `F_AVDATE` | Agreement date |
| `F_SITE` | Site |
| `F_PHONE` | Phone |
| `F_FAX` | Fax |
| `F_EMAIL` | Email |

**Row Fields**:

| Field | Description |
|-------|-------------|
| Item code | Rental item code |
| Serial number | Item serial number |
| Description | Item specification |
| Quantity | Rental quantity |
| Price | Unit price |
| Discount | Discount percentage |
| Sum | Row total |
| Start/End dates | Reservation period |

**Features**:
- Supports multiple copies (Original, Copy, etc.)
- Language-specific forms
- Watermark support
- Optional Rental Quotation printing (when `RentControlBlock.PrintQTOnAgr` is set)
- Prints both active and completed reservations

### 8.2 Agreement Detail Form (`AgreementDetForm`)

**Source**: Referenced in `AgreementForm.hal`

**Purpose**: Detailed version of the agreement document with additional fields.

### 8.3 Contract Form (`ContractForm` / `DoContractForm`)

**Source**: `/legacy-src/c8520240417/hal/Documents/ContractForm.hal`, `DoContractForm.hal`

**Purpose**: Prints the standard contract document.

**Form Fields**:

| Field Code | Description |
|------------|-------------|
| `F_NUMMER` | Contract serial number |
| `F_KUNDNR` | Customer code |
| `F_KUNDNAMN` | Customer name |
| `F_ADDR1` - `F_ADDR5` | Customer address lines |
| `F_IVADDR1` - `F_IVADDR5` | Invoice address lines |
| `F_DATUM` | Contract date |
| `F_STARTDATUM` | Start date |
| `F_ENDDATE` | End date |
| `F_PERIODLENGTH` | Period length |
| `F_PERIODTYPE` | Period type (Days/Months) |
| `F_FAKTURADAGAR` | Invoice days |
| `F_FAKTURAPERIOD` | Invoice period type |
| `F_OURCONT` | Our contact |
| `F_CUSTTCONT` | Customer contact |
| `F_SELLER` | Salesperson |
| `F_DEPT` | Department |
| `F_BETVILLK` | Payment terms |
| `F_PRICELIST` | Price list |
| `F_CONTCLASS` | Contract class |
| `F_LASTINVDATE` | Last invoice date |
| `F_CURNCY` | Currency code |
| `F_LOCATION` | Location |
| `F_SHIPMODE` | Shipping mode |
| `F_COMMENT` | Comment |

**Row Fields**:

| Field | Description |
|-------|-------------|
| `ArtCode` | Item code |
| `Quant` | Quantity |
| `Spec` | Description/specification |
| `Price` | Unit price |
| `vRebate` | Discount percentage |
| `Sum` | Row total |
| `VATCode` | VAT code |
| `PriceFactor` | Price factor |
| `InvoiceAfter` | Invoice-after date |
| `BasePrice` | Base price |
| `Type` | Row type |

**Features**:
- Subtotal, VAT, Rounding, and Grand Total sections
- Contract class text printing
- Hijri calendar date conversion support
- Freight line item support
- Multiple copy support

### 8.4 HansaWorld Contract Form (`HWContractForm` / `DoHWContractForm`)

**Source**: `/legacy-src/c8520240417/hal/Documents/HWContractForm.hal`, `DoHWContractForm.hal`

**Purpose**: Prints service contract documents specific to HansaWorld's own contracts.

**Features**:
- Iterates `CUServiceVc` records linked to the contract
- Distinguishes package items from support items
- Shows `TotalCOWorth` field
- Uses `normalFactor` for pricing
- Prints `SupportItemCode` for support line items

### 8.5 Standard Contracts Module Documents (from saengm.hal)

| Document | Form Class | Description |
|----------|------------|-------------|
| Cash Notes | `CashInvForm` | Cash sale invoices |
| Contracts | `ContractForm` | Contract document |
| Credit Notes | `CredInvForm` | Credit note/refund |
| Invoices | `InvForm` | Standard invoice |
| Periodic Customer Statement | `CuPerForm` | Recurring customer statement |
| Receipt Forms | `IPDForm` | Payment receipt |

---

## 9. Business Logic, Workflows, and Rules

### 9.1 Agreement (Rental) Lifecycle

```
[Create Agreement]
      |
      v
[Add Rental Reservations] -- Each reservation is a line item (item to rent)
      |
      v
[Set OK Flag] -----> [Auto-Dispatch] (if RentControlBlock.AutoItemsOut is set)
      |                     |
      v                     v
[Manual Dispatch] <--- [Dispatch Window]
      |
      v
[Charge Agreement] -- Periodic: creates RentChrgVc records
      |
      v
[Generate Invoices] -- Batch: creates IVVc from charges
      |
      v
[Off-Hire] -- Returns items, ends rental
      |
      v
[Collection] -- Physical pickup of items
      |
      v
[Close Agreement] -- Set AgreeStatus = 2
```

### 9.2 Agreement -- Customer Paste Logic

When a customer code is entered on an agreement (`PasteCustInAgreement`):

1. Reads customer record (`CUVc`)
2. Copies: Name, Address (Addr0-3), Invoice Address (InvAddr3-4)
3. Copies: Shipping Address (ShipAddr0-3), Delivery Address (DelAddr3-4)
4. Copies: Phone, Fax, Email
5. Copies: PayDeal, ShipMode, ShipDeal, PriceList, RebCode
6. Copies: CustCat, CustVATCode, VATNr, ExportFlag, InclVAT
7. Copies: LangCode, SalesGroup
8. Sets currency from customer if multi-currency enabled
9. Sets salesperson from customer record

### 9.3 Agreement -- Credit Limit Checking

**Function**: `CheckRentCustCreditLimit`

1. Reads customer record for credit limit (`CUVc.CreditLimit`)
2. If customer has an authorized customer record (`AuthCustVc`):
   - Checks `MaxUnits` against current `CustRentStatVc.RentalUnits`
   - Checks `MaxSales` against current `CustRentStatVc.RentStockSum`
   - Checks `MaxCost` against current `CustRentStatVc.RentStockCost`
3. Validates date range on `AuthCustVc` (startDate/endDate)
4. Blocks agreement approval if limits exceeded

### 9.4 Agreement -- Authorized Customer Validation

**Functions**: `CustIsAuth`, `FoundProperAuthCust`

1. When agreement is OKed, validates that the customer+contact combination is authorized
2. Searches `AuthCustVc` for matching customer code and contact
3. Checks authorization date range (must be current)
4. Rejects if no valid authorization found

### 9.5 Agreement -- Customer Rental Statistics

**Function**: `UpdateCustRentStat`

1. Called on agreement save/update
2. Recalculates running totals for customer:
   - `RentStockSum`: Total sales value of items currently on rent
   - `RentStockCost`: Total cost value of items currently on rent
   - `RentalUnits`: Total number of items currently on rent
3. Used by credit limit checking

### 9.6 Agreement -- Auto-Dispatch on OK

**Function**: `AgreementAutoDispatch`

1. Triggered when `RentControlBlock.AutoItemsOut` is set AND agreement is OKed
2. Checks: customer is not on hold, agreement status is not closed
3. Opens Dispatch window automatically (calls `AgreementDispatchDsm`)

### 9.7 Agreement -- Charging Logic (Detailed)

**Function**: `ChargeRentRes` and `CreateAgreementCharge`

**Step 1: Determine charge period**
- Start: `max(LastChargeDate, StartInvoicing, Agreement.startDate)`
- End: `min(ChargeDate parameter, EndInvoicing, Agreement.endDate)`

**Step 2: Calculate quantity by period type**
- **Days (perType=0)**: `InvQuant * number_of_days`
  - If `ChargeBankHol > 0`: excludes bank holidays using `CountWorkingDays`
  - If `ChargeBankHol == 2`: uses customer's country for holiday calendar
- **Months (perType=1)**: `Round(DateDiff(todat, frdate) / 30, 0)`
- **Fixed (perType=3)**: `InvQuant` (flat per period)

**Step 3: Apply partial period pro-rating**
- If charge period is shorter than full period: `Quant = Quant * (actual_days / period_days)`

**Step 4: Apply pricing**
- Standard: Uses `FindRentalPrice(RentRes, date)` to get price
- Advanced pricing: Uses `AdvPriceRecVc` date-range-based pricing
  - Fixed pricing: quantity = InvQuant
  - Running pricing: quantity = InvQuant * days

**Step 5: Apply minimum charge**
- If `AgreeType.MinChrgQty > 0` and calculated quantity < minimum, use minimum

**Step 6: Create charge record**
- Creates `RentChrgVc` with all calculated values
- Sets `InvNr = -1` (uninvoiced) and `RowNr = -1`
- If an existing uninvoiced charge exists for same item/period, consolidates (adds quantities)

**Step 7: Charge consumable items**
- For reservation matrix rows with `Type == 2` (chargeable items)
- Charges quantity = `Quant - Inv` (total minus already invoiced)
- Gets pricing from item price lists or Rental Quotation

### 9.8 Agreement -- Invoice Generation Logic (Detailed)

**Function**: `GenAgreeInvMn` and sub-procedures

**Step 1: Find uninvoiced charges**
- Iterates `RentChrgVc` where `AgreementNr` matches AND `InvNr == -1`

**Step 2: Determine invoice grouping**
- `GroupInvoice == 0`: One invoice per agreement
- `GroupInvoice == 1`: One invoice per customer (multiple agreements on one invoice)
- `GroupInvoice == 2`: Split by site (after initial grouping)

**Step 3: Build invoice rows by InvoiceBase**
- `InvoiceBase == 0` (Per charge): Each `RentChrgVc` becomes one invoice row
- `InvoiceBase == 1` (Per reservation): Charges grouped by `TransNr` (reservation), one row per reservation
- `InvoiceBase == 2` (Per agreement): All charges summed into one invoice row

**Step 4: Resolve VAT code** (cascade)
1. Item's VAT code (direct)
2. Rent Group's VAT code
3. Item Group's VAT code
4. Account block default VAT code
5. Adjusted per `ExportFlag` (Domestic/EU/Export variants)

**Step 5: Resolve sales account** (cascade)
1. Item's sales account
2. Rent Group's sales account
3. Item Group's sales account
4. Account block default sales account
5. Adjusted per `ExportFlag` (Domestic/EU/Export variants)

**Step 6: Create/extend invoice**
- Copies customer details from agreement to invoice
- Adds rows with resolved accounts and VAT codes
- Optionally includes: original item code, period dates, site, reservation number, customer order number

**Step 7: Post-processing**
- Adds prepayment offset rows if applicable
- Marks all charges as invoiced (`InvNr = invoice serial number`)
- Updates agreement `lastInvDate`

### 9.9 Loan Agreement Lifecycle

```
[Create (Status=New)]
      |
      v
[Approve (Status=Approved)]
      |
      v
[Sign (Status=Signed)] -----> [Generate Repayment Schedule]
      |                              |
      |                              v
      |                        [LoanAgreementSchedVc rows created]
      |                        [Schedule persisted to database]
      v
[Activate (Status=Active)] --> [Create GL Transaction]
      |                              |
      |                              v
      |                        [Debit: LoanAgreementAcc (loan asset)]
      |                        [Credit: ARAcc (accounts receivable)]
      |                        [Amount: InvSum4 (principal)]
      v
[Disburse (Status=Disbursed)]
      |     |
      |     +--> [Create Purchase Invoice (VIVc)] -- pays money to customer
      |     |       Customer becomes Supplier in SUVc
      |     |       Optionally: InsertAgreementInPISuppIVNr
      |     |
      |     +--> [Create Payment (OPVc)] -- alternative disbursement
      |     |
      |     +--> [Reconcile Disbursement] -- creates both PI and Sales Invoice
      v
[Invoice per Schedule Row]
      |     |
      |     +--> [Create Sales Invoice (IVVc)]
      |             Row 1: PrincipalItem (principal amount)
      |             Row 2: InterestItem (interest amount)
      |             Row 3: Fees (if any)
      |             Uses LoanManIVSettingsBlock for accounts/items
      v
[Finished (Status=Finished)] -- all schedule rows invoiced
```

### 9.10 Loan Agreement -- Schedule Generation Algorithms

**Triggered**: When status changes to `kLoanAgreementStatusSigned`

#### 9.10.1 Annuity Schedule (`BuildAnnuitySchedule`)

**Formula**: `PMT = P * (r + r / ((1+r)^n - 1))`

Where: P = principal, r = monthly interest rate, n = months

1. Calculate equal monthly payment (PMT)
2. If first period is partial (startDate to FirstInvDate differs from monthly):
   - Calculate partial month interest: `(monthly_interest / month_days) * days_diff`
   - Spread partial interest across all months: `PMT = PMT + (partial_interest / months)`
3. If `MaxMonthlyPayment > 0` and PMT > MaxMonthlyPayment: cap at MaxMonthlyPayment
4. For each month:
   - Interest = balance * monthlyRate + (partial_interest / months)
   - Principal = PMT - Interest
   - Balance = Balance - Principal
5. Last month: adjust principal to zero out balance exactly
6. Apply rounding per `LoanAgreementAccUsageb` settings

#### 9.10.2 Linear Schedule (`BuildLinearSchedule`)

1. Monthly principal = Total / Months (constant)
2. For each month:
   - Interest = remaining_balance * monthlyRate
   - Total = principal + interest
   - Balance decreases by constant principal
3. First period partial month: pro-rated additional interest
4. Last month: round-off adjustment to ensure exact totals
5. Apply rounding per settings

#### 9.10.3 Linear Equal Schedule (`BuildLinearEqualSchedule`)

1. **Two-pass algorithm**:
   - Pass 1: Calculate total interest by iterating months with declining balance (like Linear)
   - Pass 2: Spread total interest equally across all months
2. Monthly principal = Total / Months (constant, same as Linear)
3. Monthly interest = Total_precalculated_interest / Months (constant)
4. Last month: round-off adjustment
5. Apply rounding per settings

#### 9.10.4 Bullet Schedule (`BuildBulletSchedule`)

1. For months 1 to (n-1):
   - Interest = principal * monthlyRate (constant since principal unchanged)
   - Principal payment = 0
   - Balance = full principal (unchanged)
2. Last month:
   - Interest = principal * monthlyRate
   - Principal payment = full principal
   - Balance = 0
3. First period partial month handling same as other schedules
4. Apply rounding per settings

### 9.11 Loan Agreement -- Interest Rate Calculation

**Function**: `GetMonthlyInterestRate`

- If `IntRateMethod == 0` (monthly): monthly_rate = IntRate / 100
- If `IntRateMethod == 1` (annual): monthly_rate = (IntRate / 100) / 12

**Days-in-year handling** (`LoanAgreementDaysInYear`):
- If `DaysInMnth == 0`: 360 days (30/360 convention)
- If `DaysInMnth == 1`: actual days in year

**Daily interest** (`CalculateDailyInterest`):
- If `IntRateMethod == 0`: annual = monthly * 12, daily = annual / daysInYear
- If `IntRateMethod == 1`: annual = principal * rate, daily = annual / daysInYear

### 9.12 Loan Agreement -- Rounding

**Function**: `RoundPayments`

- Interest: rounded to `InterestRoundOff` decimal places
- Fees: rounded to `InterestRoundOff` decimal places (same as interest)
- Principal: rounded to `PrincipalRoundOff` decimal places
- Round-off differences accumulated and adjusted in final month

### 9.13 Loan Agreement -- Disbursement

**Function**: `CreateVIFromLoanAgreement` (Purchase Invoice method)

1. If customer is not already a supplier, creates `SUVc` record (makes customer a supplier)
2. Creates Purchase Invoice (`VIVc`) with:
   - `VendCode` = customer code
   - `InvSum4` = loan principal amount
   - Optionally sets `SuppIVNr` = agreement serial number
3. Uses loan agreement type matrix rows for PI line items

**Function**: `CreateOPFromLoanAgreement` (Payment method)

1. Creates direct payment (`OPVc`) for disbursement

**Function**: `ReconcDisbursementReqLoanAgrDsm` (Reconciled method)

1. Creates both Purchase Invoice AND Sales Invoice
2. Used for loan-against-purchase scenarios

### 9.14 Loan Agreement -- Invoice Creation

**Function**: `CreateIVFromLoanAgreement`

1. Reads next uninvoiced schedule row from `LoanAgreementSchedVc`
2. Creates Sales Invoice (`IVVc`) with:
   - Row 1: `PrincipalItem` with principal amount (from `LoanManIVSettingsBlock`)
   - Row 2: `InterestItem` with interest amount (from `LoanManIVSettingsBlock`)
   - Row 3: Fees if applicable
3. Sets invoice payment terms from `LoanManIVSettingsBlock.PayDeal`
4. Sets sales account from `LoanManIVSettingsBlock.AccNumber`
5. Sets VAT code from `LoanManIVSettingsBlock.VATCode`
6. Marks schedule row as invoiced (`InvoicedOn`, `InvoicedSum`)

### 9.15 Loan Agreement -- GL Transaction on Activation

**Triggered**: Status change to `kLoanAgreementStatusActive`

**Function**: `MakeTransFromLoanAgreement`

1. Creates GL Transaction (`TRVc`)
2. **Debit**: `LoanAgreementAcc` (loan asset account) for `InvSum4`
3. **Credit**: `ARAcc` (AR account) for `InvSum4`
4. Uses `ARAccObject` for object tracking
5. Transaction is deleted if status is changed back from Active

### 9.16 Loan Agreement -- Type Paste

**Function**: `LoanAgreementVc_PasteType`

When a type code is entered, copies ALL settings from `LoanAgreementTypeVc`:
- `ScheduleType`, `Months`, `PayDeal`
- `DepositSum`, `DepositPrc`, `IntRate`, `IntRateMethod`
- `RateType`, `OverdueRate`, `ChargeMethod`, `LateFeeDays`, `MaxMonthlyPayment`
- Copies all matrix rows (items) from type template to agreement

### 9.17 Loan Agreement -- Deposit Calculation

**Bi-directional**:
- Changing `DepositPrc` recalculates `DepositSum` = `InvSum4 * DepositPrc / 100`
- Changing `DepositSum` recalculates `DepositPrc` = `DepositSum / InvSum4 * 100`
- Changing `InvSum4` recalculates `DepositSum` based on current `DepositPrc`

### 9.18 Standard Contract -- Invoice Creation

**Maintenance**: `CreateCOInvMn`

Referenced in `saengm.hal`. Creates invoices from contracts based on:
- Contract period length and type (days/months)
- Invoice days setting (how far in advance)
- `InvoiceAfter` date per row (allows staggered invoicing)
- Tracks `InvoiceNo` per row (prevents double-invoicing)

### 9.19 Standard Contract -- Renewal

**Maintenance**: `RenewCOMn`

Referenced in `saengm.hal`. Extends contract end dates and creates new invoicing periods.

### 9.20 Standard Contract -- Cancellation

**Maintenance**: `CancelDueCOMn`

Referenced in `saengm.hal`. Cancels contracts where associated invoices remain unpaid.

### 9.21 Agreement -- Active Field Editing

Even when an agreement is OKed (approved), certain fields remain editable:
- `endDate` -- Can extend or shorten the agreement
- `CancelDate` -- Can set cancellation
- `SalesMan` -- Can reassign salesperson
- `ClientContact` -- Can change customer contact
- `InvComment` -- Can modify invoice comment
- `startDate` -- Can adjust start date

All other fields are protected when OKed.

### 9.22 Agreement -- Field Protection

**Source**: `AgreementVcRActionClient.hal`

The `Prntdf` (printed) flag is preserved during record edits, preventing it from being reset when other fields are modified.

### 9.23 Multi-Currency Support

All three sub-modules support multi-currency:
- `CurncyCode` -- Transaction currency
- `FrRate` -- Exchange rate from transaction currency
- `ToRateB1`, `ToRateB2` -- Exchange rates to Base Currency 1 and 2
- `BaseRate1`, `BaseRate2` -- Stored base rates
- Currency conversion applied on invoice generation
- Contract List report shows dual-base-currency totals

### 9.24 VAT / Tax Handling

**Export flag cascade** determines VAT treatment:
- Domestic: Standard VAT codes and accounts
- Inside EU: EU-specific VAT codes and accounts
- Outside EU: Export VAT codes (typically zero-rated) and accounts
- Per-item, per-group, and per-account-block fallback hierarchy

### 9.25 Access Rights (from saengm.hal)

The Standard Contracts module defines access rights for:
- `COToInv` -- Contract to Invoice conversion
- `InvToCO` -- Invoice to Contract linking
- Various register-level access controls

---

## Appendix A: Source Files Analysed

| File Path | Lines | Description |
|-----------|-------|-------------|
| `hal/RActions/AgreementVcRAction.hal` | ~400 | Agreement record lifecycle |
| `hal/RActions/AgreementVcRActionClient.hal` | ~20 | Agreement field protection |
| `hal/RActions/AgreementVcRActionTools.hal` | ~80 | Agreement helper functions |
| `hal/RActions/LoanAgreementTypeRAction.hal` | ~30 | Loan type defaults |
| `hal/RActions/LoanAgreementVcRAction.hal` | ~200 | Loan agreement lifecycle |
| `hal/WActions/AgreementVcWAction.hal` | ~500 | Agreement UI actions |
| `hal/WActions/LoanAgreementVcWAction.hal` | ~400 | Loan agreement UI actions |
| `hal/Documents/AgreementForm.hal` | ~50 | Agreement form field definitions |
| `hal/Documents/DoAgreementForm.hal` | ~300 | Agreement form printing logic |
| `hal/Documents/ContractForm.hal` | ~80 | Contract form field definitions |
| `hal/Documents/DoContractForm.hal` | ~400 | Contract form printing logic |
| `hal/Documents/HWContractForm.hal` | ~50 | HW Contract form field definitions |
| `hal/Documents/DoHWContractForm.hal` | ~200 | HW Contract form printing logic |
| `hal/Maint/AgreeInvMn.hal` | ~1034 | Agreement invoice generation |
| `hal/Maint/AgreementMn.hal` | ~300 | Dispatch/Collection/OffHire |
| `hal/Maint/ChargeAgreeMn.hal` | ~600 | Agreement charging |
| `hal/Reports/AgreeInvRn.hal` | ~400 | Agreement invoice info report |
| `hal/Reports/Contract.hal` | ~500 | Contract list report |
| `hal/Reports/LoanAgreementInfoRn.hal` | ~246 | Loan agreement info report |
| `hal/Tools/LoanAgreementSchedTools.hal` | ~400 | Schedule calculation algorithms |
| `hal/Tools/LoanAgreementTools.hal` | ~500 | Loan agreement tools |
| `english/StandardContracts/saengm.hal` | ~200 | Module definition |
| `english/StandardContracts/caengdb.hal` | ~50 | Database definitions |
| `amaster/haldefs.h` | (searched) | Constants and enumerations |

## Appendix B: HansaManuals Web Documentation

**URL**: `https://www.hansamanuals.com/main/english/none/theconf___72/manuals/version___85/hwconvindex.htm`

The web documentation confirms the Contracts module is designed for companies supplying products or services invoiced at regular intervals. The documentation covers:
- Settings, Contracts register, Contract Quotations, Contract Status
- Service Agreements, Maintenance functions, Forms/Documents, Reports
- Export functions

Deeper documentation pages were not accessible at time of analysis.

## Appendix C: Nexa ERP Requirements Implications

Based on this deep-dive, the following capabilities should be considered for Nexa ERP:

### From Agreements (Rentals):
1. **Recurring rental management** with item-level tracking
2. **Flexible charging** (by day, month, or fixed price)
3. **Bank holiday awareness** in charge calculations
4. **Advanced date-based pricing** tiers
5. **Consumable/chargeable items** alongside rental items
6. **Dispatch/Collection/Off-Hire** workflow (physical item movement)
7. **Customer authorization** with credit limits (units, value, cost)
8. **Three invoice grouping modes** (per charge, per reservation, per agreement)
9. **Invoice splitting by site**
10. **Prepayment offset** on invoices
11. **Auto-dispatch** on agreement approval
12. **Customer rental statistics** tracking

### From Standard Contracts:
1. **Subscription/recurring billing** with configurable periods (days/months)
2. **Contract classes** for categorisation
3. **Batch operations**: Create invoices, Renew, Update, Change, Cancel
4. **Contract-to-invoice** workflow
5. **Contract worth** tracking
6. **Invoice-after dates** per line item (staggered billing)

### From Loan Agreements:
1. **Four repayment schedule types** (Annuity, Linear, Linear Equal, Bullet)
2. **Interest rate methods** (monthly vs annual, with day-count conventions)
3. **GL transaction** on activation (debit loan asset, credit AR)
4. **Disbursement** via Purchase Invoice or Payment
5. **Schedule-based invoicing** (principal + interest as separate line items)
6. **Deposit** calculation (amount or percentage)
7. **Maximum payment cap** for annuity schedules
8. **Multi-status lifecycle** (New -> Approved -> Signed -> Active -> Disbursed -> Finished)
9. **Rounding controls** for interest and principal separately

### Cross-Cutting:
1. **Multi-currency** with dual base currency conversion
2. **VAT/tax handling** with export flag cascade (Domestic/EU/Export)
3. **Objects/cost centres** tracking on all transactions
4. **Language-specific** documents and forms
5. **Number series** for all serial numbers
6. **Department and location** awareness
