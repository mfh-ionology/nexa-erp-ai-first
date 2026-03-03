# Epic E15: Inventory

**Tier:** 3 — Business Modules
**Dependencies:** E14 (Finance / GL)
**FRs:** FR46–FR53
**Module Path:** `api/src/modules/inventory/`

---

## Story E15.S1: Item Management

**User Story:** As an inventory manager, I want to create and manage inventory items with support for different item types and costing methods, so that all products and services are accurately tracked in the system.

**Acceptance Criteria:**
1. GIVEN an inventory manager WHEN they create an InventoryItem with code, name, itemType (STOCK/SERVICE/NON_STOCK/KIT), and costingMethod (FIFO/WEIGHTED_AVERAGE/STANDARD/LAST_PURCHASE) THEN the item is persisted with companyId scoping and a unique code constraint.
2. GIVEN a STOCK-type item WHEN the manager sets serialNumberRequired = true THEN subsequent stock movements for that item must include valid serial numbers per BR-INV-004.
3. GIVEN a STOCK-type item WHEN the manager sets batchTrackingEnabled = true THEN subsequent stock movements must include a batch number per BR-INV-005.
4. GIVEN an item with a barcode value WHEN a user calls GET `/inventory/items/barcode/:code` THEN the item record is returned with current stock levels.
5. GIVEN an item assigned to an ItemGroup WHEN the group has default GL codes (sales, COGS, stock) and VAT codes THEN the item inherits these defaults but can override them individually per BR-INV-011.
6. GIVEN an item with existing stock movements WHEN the manager attempts to change the costingMethod THEN the system either rejects or warns depending on whether posted movements exist.

**Key Tasks:**
- [ ] Create Prisma model for InventoryItem with ~50+ fields (AC: #1)
  - [ ] Fields: id, code (unique per company), barcode, name, description, itemType enum, costingMethod enum, groupId FK, defaultWarehouseId FK, serialNumberRequired, batchTrackingEnabled, sellingPrice1/2/3, costPrice, weight, dimensions, reorderPoint, reorderQuantity, isActive, companyId, createdAt, updatedAt
  - [ ] Add indexes on [companyId, code], [companyId, barcode], [companyId, groupId]
- [ ] Implement CRUD service with companyId scoping and unique code validation (AC: #1)
- [ ] Implement barcode lookup endpoint (AC: #4)
- [ ] Implement GL code inheritance from ItemGroup with per-item override logic (AC: #5)
- [ ] Implement costing method change guard (AC: #6)
- [ ] Register routes: CRUD `/inventory/items`, POST `/batch`, POST `/import`, POST `/:id/barcode-scan`, GET `/barcode/:code` (AC: #1, #4)
- [ ] Write unit tests for item creation, barcode lookup, and GL code inheritance (AC: #1, #4, #5)
- [ ] Add translation keys for all item types, costing methods, and validation messages

**FR/NFR:** FR46; NFR38 (Decimal precision), NFR41 (TypeScript strict), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.14 | InventoryItem model (~50+ fields), item types, costing methods |
| API Contracts | §2.13, §3.7 | CRUD `/inventory/items`, POST `/batch`, POST `/import`, GET `/barcode/:code`, POST `/:id/barcode-scan` (BarcodeScanResult schema) |
| Data Models | §3.3 | InventoryItem: code, barcode, itemType (STOCK/SERVICE/NON_STOCK/KIT), costingMethod (FIFO/WA/STANDARD/LAST_PURCHASE), ~50+ typed fields |
| State Machines | §1 | Reference entity pattern: isActive true/false |
| Event Catalog | §2 | `item.created`, `item.updated` (implicit from stock events) |
| Business Rules | §3 | BR-INV-004 (serial validation), BR-INV-005 (batch validation), BR-INV-008 (4 costing methods), BR-INV-011 (ItemGroup GL defaults) |
| UX Design Spec | §T1, §T2 | T1 Entity List for item list, T2 Record Detail for item detail with stock tab |
| Project Context | §1 | companyId on every table, query scoping |

---

## Story E15.S2: Item Groups & Hierarchy

**User Story:** As an inventory manager, I want to organise items into hierarchical groups with default GL codes and VAT codes, so that item setup is streamlined and group-based reporting is possible.

**Acceptance Criteria:**
1. GIVEN an inventory manager WHEN they create an ItemGroup with code, name, and optional parentGroupId (self-referential) THEN the group is persisted and appears in the hierarchy.
2. GIVEN an ItemGroup with default sales account, COGS account, stock account, and VAT code WHEN a new item is assigned to this group THEN the item automatically inherits these defaults per BR-INV-011.
3. GIVEN a parent group with child groups WHEN the user views the group tree THEN groups are displayed in a nested hierarchy similar to the CoA tree.
4. GIVEN an ItemGroup with active items assigned WHEN the manager attempts to deactivate the group THEN the system warns about the affected items.

**Key Tasks:**
- [ ] Create Prisma model for ItemGroup with self-referential hierarchy (AC: #1)
  - [ ] Fields: id, code (unique per company), name, parentGroupId (self-ref FK), defaultSalesAccountCode, defaultCogsAccountCode, defaultStockAccountCode, defaultVatCodeId, isActive, companyId
- [ ] Implement CRUD service with hierarchy support (AC: #1, #3)
- [ ] Implement GL code inheritance logic for items in groups (AC: #2)
- [ ] Implement deactivation warning for groups with active items (AC: #4)
- [ ] Register routes: CRUD `/inventory/item-groups` (ADMIN) (AC: #1–#4)
- [ ] Write unit tests for hierarchy building and GL inheritance (AC: #2, #3)

**FR/NFR:** FR47; NFR41 (TypeScript strict)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.14 | ItemGroup model, self-referential parentGroupId, GL code defaults |
| API Contracts | §2.13 | CRUD `/inventory/item-groups` |
| Data Models | §3.3 | ItemGroup: code, name, parentGroupId (self-ref), isActive |
| State Machines | §1 | Reference entity pattern: isActive true/false |
| Event Catalog | N/A — group changes do not emit domain events |
| Business Rules | §3 | BR-INV-011 (ItemGroup carries default GL codes; items inherit with override) |
| UX Design Spec | §T1, §T7 | T1 for group list with tree view, T7 for group settings |
| Project Context | §1 | companyId scoping, self-referential hierarchy pattern (§6.4 in Data Models) |

---

## Story E15.S3: Warehouses & Units of Measure

**User Story:** As an inventory manager, I want to manage warehouses and units of measure with conversion factors, so that stock can be tracked by location and measured in appropriate units.

**Acceptance Criteria:**
1. GIVEN an administrator WHEN they create a Warehouse with code, name, and address fields THEN the warehouse is persisted and available for stock movements.
2. GIVEN a warehouse with non-zero stock balances WHEN the administrator attempts to deactivate it THEN the system rejects with a guard error.
3. GIVEN an administrator WHEN they create a UnitOfMeasure with code, name, and optional baseUomId (self-referential) with conversionFactor THEN derived UoMs can be converted to/from the base unit.
4. GIVEN a UoM conversion chain (e.g., Box = 12 x Each) WHEN a stock movement uses a derived UoM THEN quantities are stored in the base unit for consistent stock balance tracking.

**Key Tasks:**
- [ ] Create Prisma model for Warehouse (id, code, name, addressLine1, city, postcode, isActive, companyId) (AC: #1)
- [ ] Implement warehouse deactivation guard checking StockBalance for non-zero quantities (AC: #2)
- [ ] Create Prisma model for UnitOfMeasure with self-referential conversion chain (id, code, name, baseUomId self-ref FK, conversionFactor Decimal, companyId) (AC: #3)
- [ ] Implement UoM conversion service for base unit normalisation (AC: #4)
- [ ] Register routes: CRUD `/inventory/warehouses` (ADMIN), CRUD `/inventory/units-of-measure` (ADMIN) (AC: #1–#4)
- [ ] Write unit tests for deactivation guard and UoM conversion chain (AC: #2, #4)

**FR/NFR:** FR49, FR46; NFR38 (Decimal precision for conversion factors)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.14 | Warehouse model, UnitOfMeasure with self-referential conversion |
| API Contracts | §2.13 | CRUD `/inventory/warehouses`, CRUD `/inventory/units-of-measure` |
| Data Models | §3.3 | Warehouse (code, name, address fields), UnitOfMeasure (baseUomId self-ref, conversionFactor) |
| State Machines | §1 | Reference entity pattern: isActive true/false |
| Event Catalog | N/A — warehouse/UoM changes do not emit events |
| Business Rules | §3 | BR-INV-003 (warehouse must be active for movements) |
| UX Design Spec | §T7 | T7 Settings for warehouse and UoM configuration |
| Project Context | §1 | companyId scoping, §6.4 self-referential hierarchies |

---

## Story E15.S4: Stock Movements

**User Story:** As a warehouse operator, I want to record stock movements of all types with DRAFT-to-POSTED lifecycle and reversal support, so that stock levels are accurately maintained with full audit trail and GL integration.

**Acceptance Criteria:**
1. GIVEN a warehouse operator WHEN they create a StockMovement with itemId, warehouseId, movementType (one of 12 types: GOODS_RECEIPT through SCRAP), and quantity THEN the movement is created in DRAFT status.
2. GIVEN a DRAFT movement WHEN it is posted THEN the status transitions to POSTED, StockBalance is updated atomically (quantityOnHand, costValue), unitCost is calculated based on the item's costingMethod, serial number status is updated (if serial-tracked), and a `stock_movement.posted` event is emitted per BR-INV-001.
3. GIVEN a POSTED movement WHEN it is reversed THEN a new contra-movement is created with opposite quantity and same cost, linked via reversedById, all StockBalance updates are reversed, serial number status is reverted, and a `stock_movement.reversed` event is emitted per BR-INV-002.
4. GIVEN an inter-warehouse transfer WHEN posted THEN two linked movements are created atomically: TRANSFER_OUT (negative, source warehouse) and TRANSFER_IN (positive, destination warehouse).
5. GIVEN a serial-tracked item WHEN a movement is posted without a valid serial number in AVAILABLE status THEN the system rejects per BR-INV-004.
6. GIVEN a posted movement WHEN the GL posting service runs THEN a balanced JournalEntry is created using AccountMapping (STOCK, STOCK_COST, STOCK_VARIANCE accounts depending on movement type) per XM-006.

**Key Tasks:**
- [ ] Create Prisma model for StockMovement (id, itemId FK, warehouseId FK, movementType enum 12 values, status enum, sourceType enum, quantity Decimal, unitCost Decimal, totalCost Decimal, reversedById self-ref FK, companyId) (AC: #1)
- [ ] Create Prisma model for StockBalance (id, itemId FK, warehouseId FK, onHand, reserved, available Decimal, costValue, lastMovementDate, companyId) with unique [companyId, itemId, warehouseId] (AC: #2)
- [ ] Implement posting service with atomic StockBalance update within DB transaction (AC: #2)
  - [ ] Calculate unitCost based on item costingMethod (FIFO, WA, Standard, Last Purchase)
  - [ ] Update serial number status if serial-tracked
  - [ ] Emit `stock_movement.posted` event
- [ ] Implement reversal service creating contra-movement (AC: #3)
- [ ] Implement inter-warehouse transfer as atomic paired movements (AC: #4)
- [ ] Implement serial number validation guard (AC: #5)
- [ ] Integrate with Finance GL posting via createGlPosting() and AccountMapping (AC: #6)
- [ ] Register routes: CRUD `/inventory/stock-movements`, POST `/:id/post`, POST `/:id/reverse`, POST `/batch` (AC: #1–#6)
- [ ] Write unit tests for each costing method, reversal, transfer, and serial validation (AC: #2–#5)

**FR/NFR:** FR48; NFR18 (ACID / zero data loss), NFR36 (double-entry at DB level), NFR38 (Decimal precision)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.14 | StockMovement model (12 types), StockBalance as maintained table, costing methods, GL posting |
| API Contracts | §2.13 | CRUD `/inventory/stock-movements`, POST `/:id/post`, POST `/:id/reverse`, POST `/batch` |
| Data Models | §3.3 | StockMovement (movementType 12-value enum, sourceType, reversedById self-ref), StockBalance (onHand, reserved, available, costValue) |
| State Machines | §6.1 | StockMovement: DRAFT→POSTED→REVERSED; guards, side effects (balance update, cost calc, serial update, GL journal) |
| Event Catalog | §2 | `stock.movement.posted`, `stock.movement.reversed`, `stock.balance.updated`, `stock.reorder.triggered` |
| Business Rules | §3 | BR-INV-001 (atomic ACID posting), BR-INV-002 (reversal), BR-INV-003 (item/warehouse validation), BR-INV-004 (serial validation), BR-INV-006 (StockBalance maintained table) |
| UX Design Spec | §T3 | T3 Header+Lines for stock movement form |
| Project Context | §11 | Every state change emits typed event; XM-006 unified GL posting |

---

## Story E15.S5: Serial & Batch Tracking

**User Story:** As a warehouse operator, I want to track individual serial numbers through their lifecycle and manage batch numbers on stock movements, so that product traceability is maintained for compliance and quality purposes.

**Acceptance Criteria:**
1. GIVEN a serial-tracked item WHEN a GOODS_RECEIPT movement is posted with a new serial number THEN a SerialNumber record is created with status AVAILABLE, linked to the item and warehouse.
2. GIVEN a serial number in AVAILABLE status WHEN a sales order is approved with that serial reserved THEN the status transitions to RESERVED.
3. GIVEN a serial number in RESERVED status WHEN a GOODS_ISSUE dispatch is posted THEN the status transitions to SOLD and warehouseId is cleared.
4. GIVEN a serial number in SOLD status WHEN a customer return is processed THEN the status transitions to RETURNED and can be moved to QUARANTINE for inspection.
5. GIVEN a serial number WHEN it is queried THEN the full movement history is visible, showing each status change with timestamps.
6. GIVEN a batch-tracked item WHEN a stock movement is created without a batch number THEN the system rejects per BR-INV-005.

**Key Tasks:**
- [ ] Create Prisma model for SerialNumber (id, itemId FK, serialNumber, status enum AVAILABLE/RESERVED/SOLD/RETURNED/QUARANTINE, warehouseId FK nullable, batchNumber, companyId) (AC: #1)
  - [ ] Add unique constraint on [companyId, itemId, serialNumber] per BR-INV-007
- [ ] Implement serial number lifecycle transitions driven by stock movement posting (AC: #1–#4)
- [ ] Implement serial number history query from StockMovement records (AC: #5)
- [ ] Implement batch number validation on stock movements for batch-tracked items (AC: #6)
- [ ] Register routes: CRUD `/inventory/serial-numbers` with status filter (AC: #1–#5)
- [ ] Write unit tests for each lifecycle transition and batch validation (AC: #1–#6)

**FR/NFR:** FR51; NFR18 (ACID), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.14 | SerialNumber model, lifecycle driven by stock movements |
| API Contracts | §2.13 | CRUD `/inventory/serial-numbers` |
| Data Models | §3.3 | SerialNumber: serialNumber, status (5-value enum), warehouseId, batchNumber |
| State Machines | §6.2 | SerialNumber: AVAILABLE→RESERVED→SOLD→RETURNED→QUARANTINE; transitions driven by movements/orders |
| Event Catalog | §2 | Serial status changes are side effects of `stock.movement.posted` |
| Business Rules | §3 | BR-INV-004 (serial validation on movements), BR-INV-005 (batch validation), BR-INV-007 (serial uniqueness per item), BR-INV-009 (FIFO per serial) |
| UX Design Spec | §T2 | T2 Record Detail for serial number history view |
| Project Context | §11 | ACID transactions for all stock operations |

---

## Story E15.S6: Stock Valuation

**User Story:** As a finance manager, I want stock to be valued using the correct costing method per item with accurate cost calculations on receipts and issues, so that inventory value on the balance sheet is reliable.

**Acceptance Criteria:**
1. GIVEN a FIFO-costed item with serial tracking WHEN a GOODS_ISSUE is posted THEN cost is determined per serial number's individual purchase cost, scoped per warehouse per BR-INV-009.
2. GIVEN a weighted-average-costed item WHEN a GOODS_RECEIPT is posted THEN the item's weightedAveragePrice is recalculated using the formula: ((existingQty * existingWAC) + (receiptQty * receiptUnitCost)) / (existingQty + receiptQty) per BR-INV-010.
3. GIVEN a standard-cost item WHEN a GOODS_RECEIPT is posted at a different price THEN the variance (actual vs standard) is posted to the STOCK_VARIANCE GL account.
4. GIVEN a last-purchase-price item WHEN a GOODS_RECEIPT is posted THEN the item's lastPurchasePrice is updated to the receipt unit cost.
5. GIVEN the stock valuation report endpoint WHEN a user runs it THEN total stock value is computed per item per warehouse using the item's costing method.

**Key Tasks:**
- [ ] Implement FIFO cost layer tracking per warehouse (AC: #1)
  - [ ] For serial-tracked items, use individual serial purchase cost
  - [ ] For non-serial items, maintain cost layer queue
- [ ] Implement weighted average recalculation on receipt (AC: #2)
- [ ] Implement standard cost variance calculation and GL posting to STOCK_VARIANCE (AC: #3)
- [ ] Implement last purchase price update on receipt (AC: #4)
- [ ] Implement stock valuation report endpoint aggregating value by item and warehouse (AC: #5)
- [ ] Write unit tests for each costing method calculation with edge cases (zero stock, negative movements) (AC: #1–#4)

**FR/NFR:** FR52; NFR38 (Decimal 19,4), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.14 | Four costing methods, cost layer tracking, WAC recalculation formula |
| API Contracts | §2.13 | GET `/inventory/reports/stock-valuation` |
| Data Models | §3.3 | InventoryItem.costingMethod, StockBalance.costValue, StockMovement.unitCost/totalCost |
| State Machines | N/A — valuation is a calculation, not a lifecycle |
| Event Catalog | §2 | `stock.valuation.changed` emitted on cost recalculation |
| Business Rules | §3 | BR-INV-008 (4 costing methods), BR-INV-009 (FIFO per serial/warehouse), BR-INV-010 (WA recalc on receipt) |
| UX Design Spec | §T8 | T8 Report template for stock valuation report |
| Project Context | §11 | Decimal(19,4) for all monetary calculations |

---

## Story E15.S7: Inventory Screens

**User Story:** As an inventory user, I want standardised list views, detail views, and movement entry forms for all inventory entities, so that I can efficiently manage items, stock, and movements using consistent UX patterns.

**Acceptance Criteria:**
1. GIVEN an inventory user WHEN they navigate to Items THEN a T1 Entity List displays items with columns for code, name, type, group, stock on hand, and status, with filters for type, group, and active status.
2. GIVEN an inventory user WHEN they click an item THEN a T2 Record Detail displays the item with tabs: Primary (code, name, type, costing), Details (dimensions, weight, barcode), Stock (per-warehouse balances), Pricing (selling prices, cost), and History (recent movements).
3. GIVEN an inventory user WHEN they navigate to Stock by Warehouse THEN a T1 list shows stock balances grouped by warehouse with item, on-hand, reserved, and available columns.
4. GIVEN a warehouse operator WHEN they create a stock movement THEN a T3 Header+Lines form shows movement type, warehouse, date in the header, and item lines with quantity, serial/batch fields, and cost per line.
5. GIVEN a stock movement in DRAFT status WHEN the ActionBar is rendered THEN the primary action is "Post"; for POSTED status, the primary action is "Reverse".

**Key Tasks:**
- [ ] Build T1 Entity List for Items with type/group/status filters and barcode search (AC: #1)
- [ ] Build T2 Record Detail for Item with tabbed layout (Primary, Details, Stock, Pricing, History) (AC: #2)
- [ ] Build T1 Entity List for Stock by Warehouse with grouping (AC: #3)
- [ ] Build T3 Header+Lines form for Stock Movements with serial/batch fields (AC: #4)
  - [ ] Implement ActionBar with status-driven primary actions (Post, Reverse) (AC: #5)
- [ ] Ensure all text uses translation keys (AC: #1–#5)
- [ ] Integrate Co-Pilot Dock with inventory-contextual preset prompts

**FR/NFR:** FR46–FR53; NFR27 (WCAG 2.1 AA), NFR28 (keyboard navigation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.14 | All inventory entities and relationships |
| API Contracts | §2.13 | All inventory endpoints consumed by frontend |
| Data Models | §3.3 | All inventory models for form field mapping |
| State Machines | §6.1, §6.2 | StockMovement and SerialNumber status for ActionBar visibility |
| Event Catalog | N/A — frontend subscribes via WebSocket for real-time stock updates |
| Business Rules | §3 | All BR-INV rules inform validation displays |
| UX Design Spec | §T1, §T2, §T3, §Action Bar | T1 for item/stock lists, T2 for item detail, T3 for movement form |
| Project Context | §3 | All strings use translation keys |

---

## Story E15.S8: Mobile Adaptation

**User Story:** As a warehouse operator on a mobile device, I want to scan barcodes to look up items, check stock levels, and receive goods using the camera, so that I can perform warehouse tasks without returning to a desktop.

**Acceptance Criteria:**
1. GIVEN a mobile user WHEN they activate the barcode scanner THEN the device camera opens and scans EAN/UPC/Code128 barcodes to look up items.
2. GIVEN a scanned barcode WHEN a matching item is found THEN the item detail and current stock by warehouse are displayed.
3. GIVEN a mobile user WHEN they navigate to stock lookup THEN they can search items by code, name, or barcode and see warehouse-scoped stock levels.
4. GIVEN a mobile user WHEN they start a goods receipt THEN they can scan items, enter received quantities, and post the receipt from mobile.
5. GIVEN all mobile screens WHEN rendered on a phone (375px+) THEN touch targets are minimum 44x44px and the layout is single-column optimised.

**Key Tasks:**
- [ ] Implement barcode scanner component using device camera (Expo Camera API) (AC: #1)
- [ ] Implement item lookup result display with stock levels (AC: #2)
- [ ] Implement stock search/lookup screen for mobile (AC: #3)
- [ ] Implement simplified goods receipt form for mobile (AC: #4)
- [ ] Ensure 44x44px touch targets and single-column layout (AC: #5)

**FR/NFR:** FR46, FR48; NFR27 (WCAG 2.1 AA)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 | Mobile scaffold (Expo/React Native), camera API for barcode |
| API Contracts | §2.13, §3.7 | POST `/inventory/items/:id/barcode-scan`, BarcodeScanResult schema |
| Data Models | N/A — mobile consumes API responses |
| State Machines | N/A — mobile displays status only |
| Event Catalog | N/A — mobile receives push for stock alerts |
| Business Rules | N/A — validation enforced server-side |
| UX Design Spec | §Responsive | 375px+ breakpoint, 44x44px touch targets, camera integration |
| Project Context | §8 | Mobile as end-of-epic story; barcode scanning is a key mobile use case |

---
