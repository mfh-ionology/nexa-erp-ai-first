# Warehouse Module (WH)

Warehouse management — locations, areas, positions, picking, packing, and dispatch.

---

## Pages

### Warehouses
- Warehouse master list
- **Features:**
  - Warehouse details: name, address, type (main, satellite, bonded, cold storage)
  - Operating hours
  - Manager assignment
  - Link to GL accounts (stock account per warehouse)

### Areas / Zones
- Logical divisions within a warehouse
- **Features:**
  - Area types: Receiving, Storage, Picking, Packing, Shipping, Quarantine, Returns
  - Temperature/environment requirements (ambient, chilled, frozen)
  - Access restrictions (hazardous materials zone)

### Positions / Bins
- Individual storage locations within areas
- **Features:**
  - Position code (e.g., A-01-03-02 = Aisle A, Rack 01, Shelf 03, Bin 02)
  - Position type: shelf, pallet, floor, bulk
  - Capacity (weight, volume, item count)
  - Current contents and fill level
  - Barcode/QR for scanning
  - Position status: Available, Full, Reserved, Blocked

### Put-Away
- Inbound goods placement
- **Features:**
  - Suggested put-away position (based on rules: item category, turnover, size)
  - Scan-based confirmation (scan position barcode)
  - Split put-away (one receipt across multiple positions)
  - Put-away task assignment to warehouse staff

### Picking
- Order fulfillment picking
- **Features:**
  - Pick list generation from sales orders / delivery requests
  - Picking strategies: FIFO, FEFO (first expiry), zone-based, wave picking
  - Batch picking (multiple orders in one walk)
  - Scan-based confirmation
  - Pick task assignment
  - Short pick handling (insufficient stock at position)

### Packing
- Pack picked items for dispatch
- **Features:**
  - Packing station interface
  - Package/carton selection
  - Weight capture
  - Packing slip generation
  - Shipping label generation

### Dispatch
- Outbound shipment management
- **Features:**
  - Dispatch scheduling
  - Carrier assignment
  - Tracking number entry
  - Proof of dispatch
  - Loading dock allocation

### Stock Enquiry (by Position)
- View stock by warehouse → area → position
- **Features:**
  - Drill-down from warehouse to bin level
  - Stock on hand, reserved, available
  - Item movement history per position

---

## Settings

- Warehouse structure configuration
- Position naming conventions
- Put-away rules (by item category, size, velocity)
- Picking strategy per warehouse/zone
- Carrier/shipping provider setup
- Barcode format configuration
- Packing material types
- Number series (put-away, pick, pack, dispatch)

---

## Reports

- Warehouse Utilisation Report (fill level by zone/position)
- Picking Performance Report (picks per hour, accuracy)
- Put-Away Performance Report
- Stock by Position Report
- Movement History Report
- Dispatch Report (by carrier, date, destination)
- Slow-Moving Stock by Position
- Position Empty/Available Report

---

## Maintenances (Batch Jobs)

- **Position Rebalancing** — suggest moves to optimise picking paths
- **Cycle Count Schedule** — generate cycle count tasks by zone rotation
- **FEFO Expiry Check** — flag items approaching expiry in positions

---

## Exports & Imports

- Warehouse structure export/import
- Position master export
- Stock by position export

---

## Forms (Printable Documents)

- Pick List
- Packing Slip
- Shipping Label
- Dispatch Note
- Cycle Count Sheet
- Put-Away Instruction
