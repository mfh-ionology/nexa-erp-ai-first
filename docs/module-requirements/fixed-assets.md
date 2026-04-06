# Fixed Assets Module (FA)

Asset register, depreciation, disposals, and revaluation.

---

## Pages

### Assets Register
- List of all fixed assets with filters (category, location, status, acquisition date)
- **Features:**
  - Asset creation (description, category, location, acquisition date, cost, useful life)
  - Asset card/detail view with full history (depreciation, revaluation, transfers)
  - Asset photo/document attachments
  - Barcode/QR code for physical asset tracking
  - Asset status: Active, Fully Depreciated, Disposed, Written Off
  - GL account mapping per asset category
  - Dimension tagging (department, cost centre)

### Depreciation Schedule
- View depreciation schedule per asset or across all assets
- **Features:**
  - Depreciation methods: Straight Line, Reducing Balance, Sum of Years' Digits, Units of Production
  - Depreciation preview before posting
  - Partial year depreciation (pro-rata on acquisition/disposal date)

### Disposals
- Record asset disposal (sale, write-off, scrapping)
- **Features:**
  - Disposal proceeds entry
  - Gain/loss on disposal calculation
  - Generate disposal journal (remove asset cost, accumulated depreciation, record proceeds and gain/loss)

### Revaluation
- Revalue asset carrying amount to fair value
- **Features:**
  - Revaluation surplus/deficit calculation
  - Generate revaluation journal entries
  - Revaluation reserve tracking

---

## Settings

- Asset categories (with default useful life, depreciation method, GL accounts)
- Depreciation frequencies (monthly, quarterly, annually)
- Disposal reason codes
- Asset locations

---

## Reports

- Asset Register Report — full listing with cost, accumulated depreciation, net book value
- Depreciation Schedule Report — projected depreciation by period
- Disposal Report — disposed assets with gain/loss
- Asset Movement Report — additions, disposals, transfers in period
- Asset Valuation Report — NBV by category, location, department

---

## Maintenances (Batch Jobs)

- **Run Depreciation** — calculate and post depreciation for all assets for a period
- **Asset Count / Verification** — generate physical count sheet, record findings

---

## Exports & Imports

- Asset register export (CSV/Excel)
- Asset register import (bulk asset creation from spreadsheet)
- Depreciation schedule export

---

## Forms (Printable Documents)

- Asset Label (barcode/QR)
- Asset Transfer Form
- Disposal Certificate
