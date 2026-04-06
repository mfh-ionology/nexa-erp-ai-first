# Inventory & Stock Module (INV)

Items, stock locations, goods movements, and stock control.

---

## Pages

### Items
- Item master list with filters (category, type, status, supplier)
- **Features:**
  - Item types: Stock, Non-Stock, Service, Kit/BOM
  - Item details: code, description, UOM, weight, dimensions
  - Multiple barcodes per item (EAN, UPC, internal)
  - Item categories and sub-categories
  - Reorder point and reorder quantity
  - Min/max stock levels
  - Multiple suppliers per item (with preferred supplier)
  - Item pricing (cost price, selling price, price lists)
  - Item images
  - GL account mapping (stock, COGS, revenue)
  - Dimension tagging
  - Serial number tracking (optional per item)
  - Batch/lot tracking (optional per item)

### Locations
- Stock location master (warehouses, stores, virtual locations)
- **Features:**
  - Location hierarchy (warehouse → zone → bin)
  - Default location per item
  - Location-specific stock levels
  - Transit locations (for inter-location transfers)
  - Quarantine/inspection locations

### Goods Receipts
- Receive stock into a location (from purchase order or manual)
- **Features:**
  - Link to purchase order (auto-populate lines)
  - Quality inspection hold
  - Partial receipt
  - Generate goods receipt note (printable)
  - Update stock levels and GL on posting

### Returns (Goods Return)
- Return stock to supplier
- **Features:**
  - Link to original goods receipt or purchase order
  - Return reason codes
  - Credit note generation trigger
  - Stock level adjustment

### Stock In / Stock Out
- Manual stock adjustments (positive and negative)
- **Features:**
  - Adjustment reason codes (damaged, expired, found, sample, etc.)
  - Adjustment approval workflow
  - GL posting (adjustment account)

### Stock Transfers
- Move stock between locations
- **Features:**
  - Transfer request → in-transit → received
  - Inter-warehouse transfers
  - Transfer cost tracking

### Delivery
- Record delivery of goods to customer
- **Features:**
  - Link to sales order
  - Partial delivery
  - Delivery note generation
  - Picking list generation
  - Ship-to address (can differ from customer address)

### Stock Take / Physical Count
- Physical inventory count process
- **Features:**
  - Generate count sheets (by location, category)
  - Enter counted quantities
  - Variance report (system vs counted)
  - Post adjustments from count

---

## Settings

- Item categories and sub-categories
- Units of measure (with conversion factors)
- Location types
- Adjustment reason codes
- Return reason codes
- Costing method per item/category (FIFO, Weighted Average, Standard Cost)
- Stock valuation method
- Reorder calculation settings
- Number series (goods receipt, delivery, transfer, adjustment)

---

## Reports

- Stock Valuation Report — value by item, location, category
- Stock Movement Report — ins/outs/transfers by period
- Reorder Report — items below reorder point
- Stock Aging Report — items by age since last movement
- Dead Stock Report — items with no movement in X months
- Stock Take Variance Report
- Goods Receipt Report
- Delivery Report
- Item Price List Report

---

## Maintenances (Batch Jobs)

- **Stock Revaluation** — update standard costs, recalculate valuation
- **ABC Classification** — auto-classify items by value/movement
- **Expiry Check** — flag items approaching expiry (batch-tracked)

---

## Exports & Imports

- Item master export/import (CSV/Excel)
- Stock levels export
- Price list export/import
- Opening stock import
- Barcode label batch print

---

## Forms (Printable Documents)

- Goods Receipt Note (GRN)
- Delivery Note
- Stock Transfer Note
- Picking List
- Packing Slip
- Item Label (barcode)
