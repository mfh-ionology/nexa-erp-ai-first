# HansaWorld Inter-Company & Consolidation -- Deep-Dive Findings

> **Extraction date:** 2026-02-15
> **Source:** HansaWorld HAL codebase (`legacy-src/c8520240417/`) + HansaManuals online documentation
> **Analyst:** Claude Opus 4.6

---

## 1. Inter-Company Module

### 1.1 Overview

The Inter-Company module facilitates automatic mirroring of transactions between multiple companies within a single HansaWorld database. When a record is created in one company, a corresponding record is automatically generated in the target company. Three primary transaction types are supported:

1. **Purchase Orders to Sales Orders** -- Creating a PO in Company A auto-creates an SO in Company B
2. **Invoices** -- Invoice mirroring between companies
3. **Nominal Ledger Transactions** -- Creating an NL Transaction in one company auto-creates a mirrored NL Transaction in another

### 1.2 Module Activation

The Inter-Company module is enabled via a flag in the `ModuleBlock` setting:

```
Modb.InterCompany   // Boolean flag -- 0 = disabled, nonzero = enabled
```

**Source:** `hal/Tools/InterCompanyTools.hal` line 181, `hal/Tools/InterCompanyTool.hal` line 349

### 1.3 Inter-Company Transaction Rules Register (ICTRuleVc)

This is the core register that defines how NL transactions flow between companies.

#### Fields (extracted from HAL source):

| Field | Type | Description |
|-------|------|-------------|
| `SerNr` | LongInt | Auto-generated serial number |
| `IntYc` | Integer | Internal year code (fiscal year link) |
| `AccNumber` | String | Source account number (in originating company) |
| `AccName` | String | Source account name (auto-filled on paste) |
| `DC` | Integer | Debit/Credit indicator: 0 = Debit, 1 = Credit |
| `Objects` | String | Source object/dimension filter (normalised) |
| `ToCompany` | Integer | Target company number (mandatory, must be > 0) |
| `ToAccNumber` | String | Target account in destination company |
| `ToAccName` | String | Target account name (auto-filled on paste) |
| `ToObjects` | String | Target objects in destination company |
| `CorAccNumber` | String | Corresponding (contra) account in destination company (mandatory) |
| `CorAccName` | String | Corresponding account name (auto-filled on paste) |
| `CorObjects` | String | Corresponding account objects |
| `Comment` | String | Transaction comment to use on mirrored transaction |

**Index key:** `AccNumberDC` -- Used to match transactions by account number and debit/credit direction

**Source files:**
- `hal/RActions/ICTRVRuleVcRAction.hal` -- Record defaults, duplicate, check
- `hal/WActions/ICTRuleVcWAction.hal` -- Window field actions (auto-fill account names)
- `hal/Tools/InterCompanyTool.hal` -- Transaction creation logic

#### Validation Rules:
- `ToCompany` must be > 0 (error 1058 if blank)
- `CorAccNumber` must not be blank (error 1058 if blank)
- Objects strings are normalised on save via `NormalizeObjstr()`
- SerNr is auto-assigned if <= 0

### 1.4 Inter-Company PO-to-SO Flow (Orders and Invoices)

When a Purchase Order is approved (OKFlag set), the system automatically creates a corresponding Sales Order in the target company.

#### Trigger Points:

The procedure `POCreateInterCompanyOR()` is called from `POVcRAction.hal` in two scenarios:
1. When a PO is first saved with OKFlag set (line 597)
2. When a PO is updated and OKFlag transitions from 0 to non-zero (line 617)

#### Vendor Configuration:

The flow depends on the Vendor (CUVc) record having:

| Field | Value | Meaning |
|-------|-------|---------|
| `ePORcvPref` | `kPORcvPreferenceInternal` (= 2) | Vendor is an internal company |
| `ePORcvToCompanyCode` | String (company code) | Target company for the SO |

**Enum `kPORcvPreference`:**
- `kPORcvPreferenceNone` = 0
- `kPORcvPreferenceDefault` = 1
- `kPORcvPreferenceInternal` = 2

#### PO-to-SO Copy Logic (from `InterCompanyTools.hal`):

**Header mapping (`CopyPOHeadertoORHeader`):**

| PO Field | SO Field | Notes |
|----------|----------|-------|
| `SerNr` | `PONr` | PO number stored on SO |
| `CurrentCompany` | `CompNr` | Originating company stored on SO |
| Customer looked up by VAT number | `CustCode` | VAT number of originating company used to find Customer in target company |
| `TransDate` | `OrdDate` | |
| `Addr0..Addr3` | `Addr0..Addr3` | Address copied |
| `VEContact` | `OurContact` | Vendor contact becomes "our contact" |
| `OurContact` | `CustContact` | Our contact becomes customer contact |
| `PayDeal` | `PayDeal` | Payment terms |
| `Objects` | `Objects` | Dimension objects |
| `ShipMode` | `ShipMode` | Shipping method |
| `PlanShip` | `PlanShip` | Planned shipping |
| `ShipDeal` | `ShipDeal` | Shipping terms |
| `ShipAddr0..3` | `ShipAddr0..3` | Shipping address |
| `CurncyCode` | `CurncyCode` | Currency |
| `LangCode` | `LangCode` | Language |
| Exchange rates | Exchange rates | `FrRate`, `ToRateB1`, `ToRateB2`, `BaseRate1`, `BaseRate2` |
| `Comment` | `Comment` | |
| `SerNr` | `CustOrdNr` | PO number becomes customer order number |
| `InclVAT` | `InclVAT` | VAT inclusion flag |
| `Sum0..Sum4` | `Sum0..Sum4` | Summary amounts |
| Various address/VAT fields | Corresponding fields | |

**Row mapping (`CopyPORowstoORRows`):**

| PO Row Field | SO Row Field | Notes |
|--------------|--------------|-------|
| `VEArtCode` | `ArtCode` | Vendor article code becomes the item code |
| `Quant` | `Quant` | Quantity |
| `Price` | `Price` | Price |
| `Sum` | `Sum` | Line total |
| `vRebate` | `vRebate` | Discount |
| `Spec` | `Spec` | Description |

After row paste, `ORVc_PasteArtCode()` is called to fill in item details.

**Additional behaviours:**
- The PO is printed to PDF and attached to the SO via `RecordLinkFile()`
- PDF is saved to `tmp/[PO label] [SerNr].pdf` then deleted after linking
- Probability on the SO is set to 100%
- Freight item is looked up and applied from `FreightBlock` setting

#### Price Warning (`ICPOItemPriceWarning`):

When editing a PO for an internal vendor, the system checks if the item price on the PO matches the sales price in the target company. If prices differ, a warning message is displayed (strings 21448/21449).

### 1.5 Inter-Company NL Transaction Flow

When a Nominal Ledger Transaction is saved, the system automatically creates mirrored transactions in target companies based on ICTRuleVc rules.

#### Core Procedure: `CreateIntercompanyTransactionsFromTR()`

**Source:** `hal/Tools/InterCompanyTool.hal` lines 29-333

**Algorithm:**

1. For each row in the source transaction:
   a. Look up matching ICTRuleVc rules by `AccNumberDC` index (matching account, debit/credit direction, fiscal year, and objects)
   b. First pass: Match rules WITH objects specified
   c. Second pass (if no match found): Match rules with BLANK objects (catch-all rules)

2. For each matching rule where `ToCompany > 0`:
   a. Switch to the target company context
   b. Create or append to a new transaction for that target company
   c. Create TWO rows in the target transaction:
      - **Row 1 (Mirror row):** Uses `ToAccNumber`, `ToAccName`, `ToObjects` -- amounts are REVERSED (debit becomes credit, credit becomes debit)
      - **Row 2 (Contra row):** Uses `CorAccNumber`, `CorAccName`, `CorObjects` -- amounts maintain original direction (balancing entry)

3. Currency handling:
   - If source and target share the same Base Currency 1, amounts are directly reversed
   - If source Base Currency 1 = target Base Currency 2 (or vice versa), cross-currency mapping occurs
   - Foreign currency amounts (neither Base 1 nor Base 2) are reversed directly
   - Missing base currency values are calculated using `Base1ToBase2()` / `Base2ToBase1()`
   - Exchange rates are fetched via `GetFullCurncyRate()` for the transaction date

4. Target transactions are saved with:
   - Auto-generated serial number via `NextSerNr("TRVc",...)`
   - Internal year code via `GetIntYc()`
   - Transaction date from source
   - Comment from the ICTRuleVc rule (not from the source transaction)
   - Only saved if transaction date > `DBLockBlock.TRLock` (transaction lock date)

5. Multiple target companies: The system uses arrays (`anTRr[]`, `atocompany[]`) to batch rows for the same target company into a single transaction.

### 1.6 Inter-Company Account Comparison Report

Referenced in documentation but not found as a separate HAL file -- likely generated through the standard reporting framework using the Inter-Company module's data.

---

## 2. Consolidation Module

### 2.1 Overview

The Consolidation module produces consolidated financial statements for corporate groups. It aggregates parent (Mother) and subsidiary (Daughter) company balances into unified reports, handling:

- Multi-level consolidation (daughters, grand-daughters)
- Partial ownership percentages
- Currency conversion for multi-currency groups
- Intra-group elimination entries
- Balance sheet and P&L consolidation with separate exchange rates

### 2.2 Daughter Companies Setting (DaughterCompBlock)

A block-level setting in the Mother company (and any Daughter company with its own subsidiaries) that lists all subsidiary companies.

#### Fields (row structure):

| Field | Type | Description |
|-------|------|-------------|
| `CompCode` | String | Company code of the daughter company |
| `CompName` | String | Display name of the daughter company |
| `StartDate` | Date | Date from which the daughter is included in consolidation |
| `EndDate` | Date | Date until which the daughter is included (optional) |

**Source:** `hal/Reports/DaugterTool.hal`, `hal/RActions/DaughterCompBlockActions.hal`

#### Validation Rules (from `DaughterCompBlockCheck`):

1. A company cannot list itself as its own daughter (error 2246)
2. Circular references are prevented: if Company A lists Company B as a daughter, Company B cannot list Company A as a daughter (checked via `CorrectSettingInCompany()`)
3. The function switches to each daughter company's context to verify the relationship

### 2.3 Consolidation Settings Block (ConsolidationBlock)

A block-level setting that controls consolidation reporting behaviour.

#### Fields:

| Field | Type | Description |
|-------|------|-------------|
| `ConsCrncy` | Integer | Consolidation currency: 0 = Base Currency 1, 1 = Base Currency 2 |
| `MotherCode` | String | Company code of the Mother (parent) company |

**Source:** `hal/Reports/ConsRn.hal`, `hal/Exports/ConsEn.hal`, `hal/Exports/ConsTrialEn.hal`

### 2.4 Main Owner Percentage Register (OwnerPrcVc)

Records the ownership percentage over time, supporting changes in ownership stake.

#### Fields:

| Field | Type | Description |
|-------|------|-------------|
| `Date` | Date | Effective date of this ownership percentage |
| `Prc` | Val | Ownership percentage (e.g. 75.00 for 75%) |

**Lookup logic (`GetOwnerPrc`):** Reads the last record by date that is on or before the requested date. If no record exists, defaults to 100%.

**Source:** `hal/Reports/DaugterTool.hal` lines 30-45

### 2.5 Account Consolidation Mapping (on AccVc)

Individual accounts carry consolidation-specific fields:

| Field | Type | Description |
|-------|------|-------------|
| `ConsAccNumber` | String | Consolidation account number (maps daughter account to mother account) |
| `Conspr` | Integer | Consolidation percentage flag: if nonzero, ownership percentage is applied |
| `AccType` | Integer | Account type: 0=Asset, 1=Liability, 2=Equity, 3=Income, 4=Expense |

**Source:** `hal/Reports/AcConsRn.hal` (Account Consolidation Report), `hal/Reports/ConsRn.hal`

### 2.6 Account Consolidation Report (AcConsRn)

Lists the mapping between local accounts and consolidation accounts.

**Columns:**
- Account Number
- Account Name (Comment)
- Consolidation Account Number

**Source:** `hal/Reports/AcConsRn.hal`

### 2.7 Base Exchange Rate Register (BaseERVc)

Used for cross-currency consolidation. Stores base-to-base exchange rates by date.

#### Fields:

| Field | Type | Description |
|-------|------|-------------|
| `Date` | Date | Effective date |
| `Rate1` | Val | First rate |
| `Rate2` | Val | Second rate |

**Lookup:** Reads backwards from the requested date to find the most recent rate (`GetBC2Rate` in `ConsTrialEn.hal`).

### 2.8 Consolidation Exchange Rates

The system supports separate exchange rates for Balance Sheet vs. Profit & Loss consolidation:

| Function | Purpose |
|----------|---------|
| `GetFullCurncyPLConsolidationRate()` | Gets P&L consolidation exchange rate |
| `GetFullCurncyBalConsolidationRate()` | Gets Balance Sheet consolidation exchange rate |
| `GetConsolidationRate()` | Gets consolidation rate for a specific account and currency |

These are referenced extensively in:
- `hal/Reports/MainRn.hal` -- Main NL report with consolidation rate option
- `hal/Exports/ConsTrialEn.hal` -- Consolidated Trial Balance export

### 2.9 Shared Registers (ShareVcSetBlock)

Allows registers to be shared between companies, so data entered in one company is visible in others.

#### Fields (row structure):

| Field | Type | Description |
|-------|------|-------------|
| `VcName` | String | Register name (e.g., "CUVc" for Customers, "INVc" for Items) |
| `InCompany` | String | Company code where the master data resides |
| `ForCompanies` | String | Comma-separated list of company codes that share this register |

**Source:** `hal/RActions/CUVcRAction.hal` lines 322-381, `hal/RActions/ShareVcSetBlockAction.hal`, `hal/WActions/ShareVcSetBlock.hal`

**Helper functions:**
- `RegisterSharedInCompanies(filename)` -- Returns `ForCompanies` for a given register
- `RegisterSharedFromCompany(filename)` -- Returns `InCompany` for a given register
- `RegisterInSharedSetting(filename)` -- Returns combined list of `InCompany` + `ForCompanies`

#### Validation (ShareVcSetBlockCheck):
- If `InCompany` is specified, `ForCompanies` must also be specified (error 2246)
- `InCompany` must be a valid company code (> 0)
- Empty rows are skipped

---

## 3. Settings

### 3.1 Module-Level Settings

| Setting | Block/Record | Field | Values | Description |
|---------|-------------|-------|--------|-------------|
| Inter-Company Enabled | `ModuleBlock` | `InterCompany` | 0/1 | Master switch for inter-company functionality |
| Consolidation Currency | `ConsolidationBlock` | `ConsCrncy` | 0=BC1, 1=BC2 | Which base currency is the group reporting currency |
| Mother Company | `ConsolidationBlock` | `MotherCode` | Company code | Identifies the parent company |
| Daughter Companies | `DaughterCompBlock` | Matrix rows | See 2.2 | Lists all subsidiaries |
| Shared Registers | `ShareVcSetBlock` | Matrix rows | See 2.9 | Defines which registers are shared across companies |
| Transaction Lock Date | `DBLockBlock` | `TRLock` | Date | Prevents inter-company transactions before this date |

### 3.2 Vendor-Level Settings (for Inter-Company Orders)

| Field | Record | Values | Description |
|-------|--------|--------|-------------|
| `ePORcvPref` | `CUVc` (Vendor) | 0=None, 1=Default, 2=Internal | Purchase order receipt preference |
| `ePORcvToCompanyCode` | `CUVc` (Vendor) | Company code string | Target company for inter-company SO creation |

### 3.3 Account-Level Settings (for Consolidation)

| Field | Record | Description |
|-------|--------|-------------|
| `ConsAccNumber` | `AccVc` | Maps to a consolidation account in mother company |
| `Conspr` | `AccVc` | If nonzero, ownership percentage is applied to this account's balances |
| `AccType` | `AccVc` | Account type determines Balance Sheet vs. P&L treatment |

---

## 4. Reports

### 4.1 Consolidation Report (ConsRn)

**Source:** `hal/Reports/ConsRn.hal`

**Purpose:** Produces a consolidated report combining mother and daughter company account balances.

**Parameters (via RcVc RepSpec):**
- Account range (`AccStr`)
- Object range (`ObjStr`)
- Date range (`sStartDate`, `sEndDate`)
- Include daughters flag (`IncDaughter`)
- Base currency selection
- Simulation version (`SimVerf`)
- Account specification mode (`AccSpec`): 0 = End balance, 1 = Period change, 2 = End balance

**Columns:** Account Number, Account Name, Consolidation Object, Debit, Credit

**Logic:**
1. Loads consolidation currency from `ConsolidationBlock`
2. Iterates all accounts, skipping blocked and group accounts
3. For each account, maps to consolidation account if `ConsAccNumber` is set
4. For Balance Sheet accounts (types 0-2): Gets start and end balance
5. For P&L accounts (types 3-4): Gets turnover for the period
6. Applies ownership percentage via `AddRatenCons()` if `Conspr` flag is set
7. Prints debit or credit based on sign

### 4.2 Account Consolidation Report (AcConsRn)

**Source:** `hal/Reports/AcConsRn.hal`

**Purpose:** Lists the account-to-consolidation-account mappings.

**Columns:** Account Number, Account Name, Consolidation Account Number

### 4.3 Consolidated Trial Balance Export (ConsTrialEn)

**Source:** `hal/Exports/ConsTrialEn.hal`

**Purpose:** Exports a consolidated trial balance showing all companies side by side.

**Two modes (`ArtMode`):**
- Mode 0: Base Currency 2 conversion using `BaseERVc` rates
- Mode 1: Base Currency 1 with separate P&L and Balance Sheet consolidation rates

**Features:**
- Prints header with company codes and names for mother and all daughters
- Shows exchange rates used (P&L rate and Balance Sheet rate separately)
- Iterates all accounts across all companies
- Applies debit/credit presentation based on account type
- Calculates totals per company and grand totals
- Supports consolidation currency conversion via `GetFullCurncyPLConsolidationRate()` and `GetFullCurncyBalConsolidationRate()`

### 4.4 Consolidation Export (ConsEn / ConsMn)

**Source:** `hal/Exports/ConsEn.hal`

**Purpose:** Creates consolidation transactions/simulations and optionally exports them or saves to the mother company.

**Two output modes:**
- `ArtMode = 0`: Creates NL Transaction (`TRVc`)
- `ArtMode = 1`: Creates Simulation (`SMVc`)

**Core function `ConsolidationFunc()`:**
1. Loads consolidation settings and base currency
2. For each account (filtered by range):
   - Maps to consolidation account if `ConsAccNumber` is set
   - Calculates balances/turnover based on account type
   - Applies ownership percentage via `AddRatenCons2()`
   - For multi-currency (BC2): uses `AddEuroCurncyTrRow()` with proper exchange rates
   - For single currency: uses `AddEuroTrRow()` for NL or `AddSMRow()` for simulation
3. The result is a single NL Transaction or Simulation containing all consolidation entries

**ConsMn (Maintenance function):** Executes `ConsolidationFunc()` and saves the resulting transaction/simulation directly into the Mother company's database (identified by `RepSpec.f3`).

### 4.5 Main NL Report with Daughter Companies (MainRn)

**Source:** `hal/Reports/MainRn.hal`

The standard NL account listing report supports:
- `IncDaughter` flag to include daughter company balances
- `kReportBCOneConsolidationRate` (= 100) flag in `flags[12]` to use consolidation exchange rates
- Recursive daughter company processing via `RunMainRnForDaughterCompany()`
- Separate consolidation rates for different account types
- Grand-daughter support (recursive call)

### 4.6 Consolidated Balance Sheet (SpecBalRn / ConsBalRn)

**Source:** `hal/Reports/SpecBalRn.hal`

The user-defined Balance Sheet report supports consolidation via `ConsBalRn` procedure, which:
- Iterates all daughter companies
- Loads consolidation currency for each
- Applies `StartDate`/`EndDate` filtering per daughter
- Handles grand-daughters recursively

### 4.7 Consolidated P&L (SpecResRn / ConsResRn)

**Source:** `hal/Reports/SpecResRn.hal`

Same pattern as consolidated Balance Sheet but for Profit & Loss accounts, using the `ConsResRn` procedure.

---

## 5. Business Logic and Workflows

### 5.1 Inter-Company Purchase Order Workflow

```
PO Created in Company A
  |
  v
PO Approved (OKFlag = 1)
  |
  v
POCreateInterCompanyOR() triggered
  |
  +-- Check: ModuleBlock.InterCompany enabled?
  +-- Check: Vendor.ePORcvPref == kPORcvPreferenceInternal?
  +-- Check: Vendor.ePORcvToCompanyCode non-blank?
  |
  v
Print PO to PDF (tmp/[label] [SerNr].pdf)
  |
  v
Switch to Target Company (SetServerCompany)
  |
  v
Create Sales Order:
  - Look up Customer by VAT Number of originating company
  - Copy header fields (address, payment terms, shipping, currency, etc.)
  - Copy rows (map VEArtCode -> ArtCode, paste to fill item details)
  - Calculate order totals (ORSumup)
  - Attach PDF of PO to SO
  |
  v
Return to originating company
```

### 5.2 Inter-Company NL Transaction Workflow

```
NL Transaction saved in Company A
  |
  v
CreateIntercompanyTransactionsFromTR() triggered
  |
  v
For each row in the transaction:
  |
  +-- Look up ICTRuleVc rules matching:
  |     - Account Number
  |     - Debit/Credit direction
  |     - Fiscal Year
  |     - Objects (first with objects, then without)
  |
  +-- For each matching rule:
        |
        v
      Switch to Target Company
        |
        v
      Create/append to target transaction:
        Row 1: ToAccNumber (reversed amounts)
        Row 2: CorAccNumber (balancing entry)
        |
        v
      Handle currency conversion:
        - Same BC1: direct reversal
        - Cross-currency: map BC1<->BC2
        - Foreign currency: reverse + recalculate base amounts
        |
        v
      Return to originating company
  |
  v
Save all target transactions (one per target company)
  - Auto-number, set fiscal year
  - Check transaction lock date
```

### 5.3 Consolidation Report Generation Workflow

```
User requests Consolidated Report
  |
  v
Load ConsolidationBlock (currency, mother code)
Load DaughterCompBlock (subsidiary list)
  |
  v
For each account in Mother Company:
  |
  +-- Map to Consolidation Account (if ConsAccNumber set)
  +-- Get balance/turnover
  +-- Apply ownership percentage (if Conspr flag set)
  +-- Add to report
  |
  v
For each Daughter Company:
  |
  +-- Check StartDate/EndDate eligibility
  +-- Switch company context
  +-- For each account:
  |     +-- Look up by ConsAccNumber index
  |     +-- Get balance/turnover
  |     +-- Apply ownership percentage
  |     +-- Add to totals
  |
  +-- Recursively process Grand-Daughters
  |
  v
Apply exchange rates:
  - Balance Sheet accounts: GetFullCurncyBalConsolidationRate()
  - P&L accounts: GetFullCurncyPLConsolidationRate()
  |
  v
Output consolidated totals
```

### 5.4 Account Auto Elimination Workflow

```
User runs Account Auto Elimination (AccElimMn)
  |
  v
Parameters:
  - Elimination Code (f1) -> Looks up AccElimVc record
  - Date range (must be full months: start = 1st, end = last day)
  - Optional: Company code for multi-company mode (FirstAcc)
  - Transaction date override (d2)
  |
  v
Load AccElimVc record (elimination template)
  |
  v
For each row in AccElimVc:
  |
  +-- Row defines: Acc1, Acc1Object, Acc2, Acc2Object, ToAcc
  |
  +-- Get turnover for Acc1 and Acc2 (debit and credit)
  |
  +-- If multi-company mode:
  |     For each Daughter Company:
  |       Switch company, get turnover using consolidation currency
  |       Accumulate to dv1/cv1 and dv2/cv2
  |
  +-- Calculate elimination amount: dv = dv1 - dv2, cv = cv1 - cv2
  |
  +-- If amounts are non-zero:
  |     Create 3 rows in output transaction:
  |       Row 1: Acc1 with Acc1 amount
  |       Row 2: Acc2 with Acc2 amount
  |       Row 3: ToAcc with balancing amount (sum of Acc1 + Acc2)
  |
  v
Output mode (from AccElimVc.Register):
  - 0: NL Transaction (TRVc) -- saved with number series from AccElimVc.NrSeries
  - 1: Simulation (SMVc) -- saved as a simulation record
  |
  v
If date range spans multiple months and no d2 override:
  Execute separately for each month
  |
  v
If multi-company mode:
  Save the resulting transaction in the specified company
```

### 5.5 Daughter Company Balance Calculation

The `GetAccDaughtersDCBalance2()` procedure (in `DaugterTool.hal`) is the core function for calculating consolidated balances:

1. Loads `DaughterCompBlock` from current company
2. For each daughter:
   - Optionally filters by specific daughter company code
   - Checks `StartDate` eligibility (skips if report date < start date)
   - Applies `EndDate` cap (uses end date instead of report date if earlier)
   - Switches to daughter company context
   - Calls `GetAcc1DaughterDCBalance()` which:
     a. Looks up accounts by `ConsAccNumber` index
     b. Gets debit/credit balances
     c. Applies ownership percentage if `Conspr > 0`
     d. Accumulates results
3. Returns combined debit and credit values

---

## 6. Enums and Constants

### 6.1 Company Type (kCompanyType)

```c
enum kCompanyType {
    kCompanyTypeUnknown = -1,
    kCompanyTypeNonConsolidated = 0,
    kCompanyTypeConsolidated = 1,
    kCompanyTypeSingleUser = 2,
    kCompanyTypeSingleUserLedgerOnly = 3,
    kCompanyTypePerson = 4
};
```

**Source:** `amaster/haldefs.h` line 4374

### 6.2 Consolidation Rate Constant

```c
kReportBCOneConsolidationRate = 100
```

Used in report `flags[12]` to indicate that consolidation exchange rates should be used instead of standard rates.

**Source:** `amaster/haldefs.h` line 6655

### 6.3 PO Receipt Preference (kPORcvPreference)

```c
enum kPORcvPreference {
    kPORcvPreferenceNone = 0,
    kPORcvPreferenceDefault = 1,
    kPORcvPreferenceInternal = 2
};
```

**Source:** `amaster/haldefs.h` line 7980

### 6.4 Account Types (used in consolidation logic)

```
kAccTypeAsset = 0      // Balance Sheet
kAccTypeLiability = 1  // Balance Sheet
kAccTypeEquity = 2     // Balance Sheet
kAccTypeIncome = 3     // P&L
kAccTypeExpense = 4    // P&L
```

These determine whether Balance Sheet or P&L consolidation rates are applied.

### 6.5 Error Codes

| Code | Context | Meaning |
|------|---------|---------|
| 2246 | DaughterCompBlock | Invalid company code or circular reference |
| 1058 | ICTRuleVc | Required field is blank |
| 1163 | AccElimMn | Date range must be full months |

---

## 7. Cross-Module Integration

### 7.1 Integration with Finance/NL Module

- **Account Register (AccVc):** Extended with `ConsAccNumber` and `Conspr` fields for consolidation mapping
- **NL Transactions (TRVc):** Inter-company mirroring creates new transactions in target companies
- **Simulations (SMVc):** Consolidation can output to simulation records instead of actual transactions
- **Fiscal Years:** ICTRuleVc rules are filtered by `IntYc` (internal year code)
- **Transaction Lock Date:** Inter-company transactions respect `DBLockBlock.TRLock`
- **Object Balances (ObjBalVc):** Used for dimension-level consolidation balances

### 7.2 Integration with Purchasing Module

- **Purchase Orders (POVc):** Trigger inter-company SO creation on approval
- **Vendor Records (CUVc):** Extended with `ePORcvPref` and `ePORcvToCompanyCode` for inter-company configuration

### 7.3 Integration with Sales Module

- **Sales Orders (ORVc):** Auto-created from inter-company POs
- **Order header:** Carries `PONr` (source PO number) and `CompNr` (source company number)
- **Customer lookup:** Uses VAT number matching between companies

### 7.4 Integration with Currency Module

- **Base Currency Block (BaseCurBlock):** `BaseCur1`, `BaseCur2` -- consolidation compares these across companies
- **Exchange Rates:** Separate P&L and Balance Sheet consolidation rates
- **Base Exchange Rates (BaseERVc):** Base-to-base rates for multi-currency consolidation
- **Rate conversion:** `Base1ToBase2()` / `Base2ToBase1()` for cross-currency calculations

### 7.5 Integration with System Module

- **Company Register (CompaniesBlock):** Provides company codes, names, and TCPIP addresses
- **Company switching:** `SetCompany()`, `SetCompanyCode()`, `SetServerCompany()`, `ResetCompany()` -- context switching between companies
- **Number series:** Auto-numbering for transactions in target companies uses `NextSerNr()`

### 7.6 Integration with Reporting Module

- **Balance Sheet (SpecBalRn):** `ConsBalRn` extends for consolidation
- **P&L (SpecResRn):** `ConsResRn` extends for consolidation
- **Main NL Report (MainRn):** `RunMainRnForDaughterCompany()` adds daughter company data
- **Trial Balance (TrialRn):** References `GetOwnerPrc()` for ownership percentage
- **User-Defined Reports:** Support consolidation through `IncDaughter` and consolidation rate flags

### 7.7 Integration with Document Templates

- **PO Form:** Printed to PDF during inter-company SO creation
- **Document linking:** PDF attached to auto-created SO via `RecordLinkFile()`

---

## 8. Nexa ERP Implications

### 8.1 Database-Per-Tenant Impact

HansaWorld uses a **single database, multiple companies** model where company switching is done via `SetCompany()` / `SetCompanyCode()`. Nexa ERP uses **database-per-tenant**.

**Key implications:**
1. **Inter-company transactions** cannot simply "switch company context" -- they require cross-database communication via APIs or message queues
2. **Shared registers** (ShareVcSetBlock) have no direct equivalent -- would need a shared/central service or data replication
3. **Consolidation reporting** cannot directly query daughter company databases -- requires an aggregation service or data warehouse approach
4. **Transaction atomicity** across companies is harder with separate databases

### 8.2 Recommended Nexa ERP Architecture

#### Inter-Company Transaction Service

| HansaWorld | Nexa ERP Equivalent |
|------------|-------------------|
| `SetCompany()` / `ResetCompany()` | Cross-tenant API calls |
| `ICTRuleVc` register | Inter-company rule configuration per tenant |
| `CreateIntercompanyTransactionsFromTR()` | Event-driven inter-company transaction handler (pub/sub or webhook) |
| `POCreateInterCompanyOR()` | Purchase Order approval event triggers SO creation in target tenant |
| Same-database atomicity | Saga pattern with compensating transactions |

#### Consolidation Service

| HansaWorld | Nexa ERP Equivalent |
|------------|-------------------|
| `DaughterCompBlock` | Group/subsidiary configuration (metadata service) |
| `ConsolidationBlock` | Group consolidation settings |
| Direct DB queries across companies | Data aggregation service that pulls from child tenant databases |
| `OwnerPrcVc` | Ownership percentage register with date-based history |
| `ConsAccNumber` on accounts | Account mapping table in consolidation service |
| `AccElimMn` maintenance | Automated elimination entry generation service |

### 8.3 Key Features to Implement

#### P0 (MVP -- If Multi-Company is in Scope)

1. **Company Group Configuration** -- Mother/daughter relationships with date ranges
2. **Consolidation Account Mapping** -- Map subsidiary accounts to group accounts
3. **Ownership Percentage Register** -- Date-based ownership history
4. **Basic Consolidated Balance Sheet/P&L** -- Aggregate across group companies
5. **Inter-Company NL Transaction Rules** -- Rule-based mirroring with account/object/DC matching
6. **Inter-Company PO-to-SO** -- Auto-create sales orders from approved purchase orders

#### P1 (Post-MVP Enhancements)

7. **Shared Register Service** -- Centralized master data (customers, items) shared across tenants
8. **Account Auto Elimination** -- Template-based elimination entry generation
9. **Consolidated Trial Balance Export** -- Side-by-side company comparison with exchange rates
10. **Multi-Currency Consolidation** -- Separate P&L and Balance Sheet consolidation rates
11. **Grand-Daughter Support** -- Recursive multi-level consolidation
12. **Consolidation Export/Import** -- For companies in different databases/instances

### 8.4 Business Rules to Preserve

1. **Circular reference prevention** -- A company cannot be both parent and child of another company
2. **Ownership percentage time-series** -- Percentage can change over time, report uses most recent as of report date
3. **Daughter date range** -- Daughters have start/end dates controlling when they are included in consolidation
4. **Account type determines rate** -- Balance Sheet accounts use balance sheet consolidation rate; P&L accounts use P&L consolidation rate
5. **Elimination must be full months** -- Date range for elimination must start on the 1st and end on the last day of a month
6. **Transaction lock date respected** -- Inter-company transactions cannot be created before the lock date
7. **Debit/Credit reversal** -- Inter-company NL transactions reverse debit/credit direction in the target company
8. **Double-entry in target** -- Each inter-company NL rule creates two rows: mirror + contra
9. **Object matching hierarchy** -- Rules with specific objects match first; blank-object rules serve as catch-all
10. **VAT number matching** -- Inter-company SO creation uses VAT number to find the Customer record in the target company

### 8.5 Data Model Entities Required

| Entity | Description | Key Fields |
|--------|-------------|------------|
| `CompanyGroup` | Defines a corporate group | `id`, `name`, `motherCompanyId` |
| `GroupMembership` | Links companies to groups | `groupId`, `companyId`, `startDate`, `endDate` |
| `OwnershipPercentage` | Time-series ownership | `groupMembershipId`, `effectiveDate`, `percentage` |
| `ConsolidationAccountMap` | Account mapping | `subsidiaryAccountId`, `consolidationAccountCode`, `applyOwnershipPct` |
| `ConsolidationSettings` | Group-level settings | `groupId`, `consolidationCurrency`, `motherCompanyId` |
| `InterCompanyRule` | NL transaction mirroring | `sourceAccountId`, `debitCredit`, `objects`, `targetCompanyId`, `targetAccountCode`, `contraAccountCode`, `targetObjects`, `contraObjects`, `comment` |
| `InterCompanyVendorConfig` | Vendor IC settings | `vendorId`, `receiptPreference`, `targetCompanyCode` |
| `EliminationTemplate` | Elimination definitions | `id`, `code`, `comment`, `numberSeries`, `outputType` |
| `EliminationTemplateRow` | Elimination row pairs | `templateId`, `account1`, `object1`, `account2`, `object2`, `targetAccount` |
| `ConsolidationExchangeRate` | Consolidation rates | `currencyPair`, `effectiveDate`, `plRate`, `bsRate` |
| `SharedRegisterConfig` | Shared data config | `registerType`, `sourceCompanyId`, `targetCompanyIds` |

---

## Appendix A: Source File Index

| File | Purpose |
|------|---------|
| `hal/RActions/DaughterCompBlockActions.hal` | Daughter company block validation (circular reference check) |
| `hal/RActions/ShareVcSetBlockAction.hal` | Shared register block validation |
| `hal/RActions/ICTRVRuleVcRAction.hal` | ICT Rule record defaults, duplicate, check |
| `hal/WActions/ShareVcSetBlock.hal` | Shared register block window action |
| `hal/WActions/ICTRuleVcWAction.hal` | ICT Rule window field actions (auto-fill names) |
| `hal/Reports/AcConsRn.hal` | Account Consolidation mapping report |
| `hal/Reports/ConsRn.hal` | Consolidation report (mother + daughters) |
| `hal/Reports/DaugterTool.hal` | Daughter balance calculation tools, ownership percentage lookup |
| `hal/Reports/MainRn.hal` | Main NL report with daughter company support |
| `hal/Reports/SpecBalRn.hal` | Consolidated Balance Sheet report |
| `hal/Reports/SpecResRn.hal` | Consolidated P&L report |
| `hal/Reports/TrialRn.hal` | Trial Balance with ownership percentage |
| `hal/Maint/AccElimMn.hal` | Account Auto Elimination maintenance |
| `hal/Exports/ConsEn.hal` | Consolidation export/maintenance (creates TRVc or SMVc) |
| `hal/Exports/ConsTrialEn.hal` | Consolidated Trial Balance export |
| `hal/Tools/InterCompanyTool.hal` | Core IC NL transaction creation logic |
| `hal/Tools/InterCompanyTools.hal` | IC PO-to-SO flow, price warning |
| `hal/RActions/CUVcRAction.hal` | Customer/Vendor shared register helper functions |
| `hal/RActions/POVcRAction.hal` | PO save triggers IC SO creation |
| `amaster/haldefs.h` | Enum definitions (kCompanyType, kPORcvPreference, etc.) |

## Appendix B: String References

| String ID | Context | Probable Text |
|-----------|---------|---------------|
| 2246 | Error | Invalid company code / circular reference |
| 1058 | Error | Required field is blank |
| 1163 | Error | Date range must be full months |
| 2062 | Label | Purchase Order label (for PDF filename) |
| 21448-21449 | Warning | Price mismatch warning for inter-company items |
| 3262 | Header | Account Number |
| 3263 | Header | Account Name |
| 3275 | Report | Account Consolidation report title |
| 3276 | Header | Consolidation Account |
| 3277 | Header | Consolidation Percentage |
| 7320 | Report | Consolidation report title |
| 7321-7325 | Headers | Consolidation report column headers |
| 32020-32029 | Headers | Consolidated Trial Balance headers |
| 40763 | Message | Shared register OK message |
