# Production / Manufacturing Module (PRD)

Production planning, BOMs, work orders, operations, and shop floor control.

---

## Pages

### Bill of Materials (BOM)
- Define product structure (what goes into making a finished good)
- **Features:**
  - Multi-level BOM (sub-assemblies)
  - Component list: item, quantity per unit, UOM, scrap %
  - BOM versioning (engineering changes)
  - BOM status: Draft, Active, Obsolete
  - Where-used enquiry (which BOMs use this component)
  - Cost roll-up (calculate product cost from components)
  - Phantom BOM support (sub-assembly that doesn't get stocked)

### Routings
- Define the manufacturing process steps
- **Features:**
  - Routing steps: operation sequence, work centre/machine, setup time, run time per unit
  - Routing versioning
  - Alternative routings per product
  - Outsourced operations (send to subcontractor)

### Machines / Work Centres
- Shop floor resource management
- **Features:**
  - Machine details: name, type, capacity, cost rate (per hour)
  - Work centre: group of machines, capacity planning unit
  - Availability calendar (shifts, maintenance windows)
  - Machine status: Available, Running, Maintenance, Down
  - OEE tracking (Overall Equipment Effectiveness)

### Production Plan
- Aggregate production planning
- **Features:**
  - Plan by period (weekly, monthly)
  - Demand sources: sales forecast, sales orders, reorder points, manual
  - Capacity check against available machine/labour hours
  - MRP (Materials Requirements Planning) — explode demand through BOMs
  - Generate production orders from plan
  - What-if scenarios

### Production Orders
- Individual manufacturing orders
- **Features:**
  - Production order: product, quantity, BOM version, routing, planned start/end dates
  - Order status: Planned, Released, In Progress, Completed, Cancelled
  - Material reservation (reserve components from stock)
  - Material issue to production (consume from stock)
  - Partial completion (report output quantity incrementally)
  - Scrap/waste recording
  - By-product recording
  - Co-product support

### Operations
- Track progress of each routing step within a production order
- **Features:**
  - Operation status: Pending, Setup, Running, Complete, On Hold
  - Time recording: actual setup time, actual run time
  - Operator assignment
  - Quality checkpoints at operation level
  - Operation-level scrap recording

### Batches / Lots
- Batch tracking for process manufacturing
- **Features:**
  - Batch number assignment (auto or manual)
  - Batch attributes (potency, grade, colour, etc.)
  - Batch splitting and merging
  - Full batch traceability (forward and backward)
  - Batch expiry management

### Materials
- Material management for production
- **Features:**
  - Material requirements list per production order (from BOM explosion)
  - Material availability check
  - Material substitution (alternative components)
  - Material issue and return from shop floor

### Quality Control
- Quality inspection during/after production
- **Features:**
  - Inspection plans (what to check, tolerances)
  - Inspection results recording
  - Pass/fail/conditional release
  - Non-conformance reporting
  - Corrective action tracking

---

## Settings

- BOM types and categories
- Operation types
- Work centre types
- Scrap reason codes
- Production order number series
- Batch number series and format
- MRP parameters (lead times, safety stock, lot sizing rules)
- Shift patterns for capacity planning
- Quality inspection templates
- Cost allocation methods (standard cost, actual cost)

---

## Reports

- Production Order Status Report
- Work in Progress (WIP) Report
- Material Usage Report (planned vs actual)
- Scrap/Waste Report
- Machine Utilisation Report
- OEE Report (Availability x Performance x Quality)
- Production Cost Report (standard vs actual)
- BOM Cost Roll-Up Report
- MRP Exception Report (shortages, excess)
- Batch Traceability Report (forward/backward)
- Quality Inspection Report
- Capacity Planning Report (load vs capacity)
- Production Schedule (Gantt view)

---

## Maintenances (Batch Jobs)

- **MRP Run** — explode demand through BOMs, generate planned orders
- **Cost Roll-Up** — recalculate product costs from current component costs
- **WIP Valuation** — value work in progress at period end
- **Batch Expiry Check** — flag batches approaching expiry

---

## Exports & Imports

- BOM export/import (CSV/Excel)
- Routing export/import
- Machine/work centre master export/import
- Production order export
- Batch data export

---

## Forms (Printable Documents)

- Production Order (shop floor traveller)
- Material Issue Slip
- Material Return Slip
- Quality Inspection Certificate
- Batch Certificate / Certificate of Analysis
- Pick List for Production (component picking)
- Production Completion Report
