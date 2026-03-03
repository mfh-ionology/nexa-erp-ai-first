# Epic E18: Purchase Orders

**Tier:** 3 — Business Modules
**Dependencies:** E14 (Finance / GL), E15 (Inventory)
**FRs:** FR41–FR45
**Module Path:** `api/src/modules/purchasing/` (PO and GRN sub-modules)

---

## Story E18.S1: Purchase Orders

**User Story:** As a purchasing officer, I want to create multi-line purchase orders with an approval workflow and the ability to send them to suppliers, so that procurement is formally controlled and auditable.

**Acceptance Criteria:**
1. GIVEN a purchasing officer WHEN they create a PurchaseOrder with supplierId, order lines (item, quantity, unit price), and delivery date THEN the PO is persisted in DRAFT status with auto-generated orderNumber from NumberSeries.
2. GIVEN a DRAFT PO WHEN the manager approves it THEN the supplier is validated (exists, not BLOCKED/TERMINATED), at least one line exists, amounts are valid, status transitions to APPROVED, approvedBy/approvedAt are set, and `purchase.order.approved` event is emitted.
3. GIVEN an APPROVED PO WHEN the officer sends it to the supplier THEN the status transitions to SENT, the PO is emailed as PDF via communications, and `purchase.order.sent` event is emitted.
4. GIVEN a DRAFT or APPROVED PO with no GRNs received WHEN the manager cancels it THEN the status transitions to CANCELLED.
5. GIVEN a PO with GRNs partially received WHEN any user attempts to cancel THEN the system rejects (cannot cancel after receipts).
6. GIVEN a PO WHEN multiple order lines are added THEN each line supports items and services with quantity, unit price, VAT code, and delivery date per line.

**Key Tasks:**
- [ ] Create Prisma models for PurchaseOrder and PurchaseOrderLine (AC: #1, #6)
  - [ ] PurchaseOrder: id, orderNumber (unique, NumberSeries), supplierId FK, status PurchaseOrderStatus enum (9 values), deliveryDate, subtotal, vatAmount, totalAmount, currencyCode, approvedBy, approvedAt, companyId
  - [ ] PurchaseOrderLine: id, orderId FK (cascade), lineNumber, itemId, description, quantity, unitPrice, vatCodeId, lineTotal, quantityReceived, quantityInvoiced, lineStatus PurchaseOrderLineStatus enum (4 values)
- [ ] Implement PO approval with supplier validation and line existence check (AC: #2)
- [ ] Implement PO send with PDF generation and email via communications module (AC: #3)
- [ ] Implement cancellation guard (no GRNs received) (AC: #4, #5)
- [ ] Emit events: `purchase.order.approved`, `purchase.order.sent` (AC: #2, #3)
- [ ] Register routes: CRUD `/ap/purchase-orders`, GET `/:id/lines`, POST `/:id/approve`, POST `/:id/send`, POST `/:id/close`, POST `/:id/cancel` (AC: #1–#6)
- [ ] Write unit tests for approval validation, cancellation guard, and event emission (AC: #2, #4, #5)

**FR/NFR:** FR41, FR42, FR45; NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | PurchaseOrder/Line models, approval workflow, send to supplier |
| API Contracts | §2.10, §2.12 | CRUD `/ap/purchase-orders`, POST `/:id/approve`, POST `/:id/send`, POST `/:id/close`, POST `/:id/cancel` |
| Data Models | §3.6 | PurchaseOrder (status 9-value enum), PurchaseOrderLine (quantityReceived, quantityInvoiced, lineStatus 4-value enum) |
| State Machines | §4.1, §4.2 | PurchaseOrder: DRAFT→APPROVED→SENT→...→CLOSED/CANCELLED; PurchaseOrderLine: OPEN→PARTIALLY_RECEIVED→RECEIVED |
| Event Catalog | §5 | `purchase.order.approved`, `purchase.order.sent` — subscribers: Notifications, Communications, Audit |
| Business Rules | §5 | BR-PUR-001 (PO→multiple GRNs), BR-PUR-002 (GRN→one PO) |
| UX Design Spec | §T1, §T3 | T1 for PO list, T3 for PO form with header+lines |
| Project Context | §11 | NumberSeries integration, email send via communications module |

---

## Story E18.S2: Goods Receipt Notes

**User Story:** As a warehouse operator, I want to create goods receipt notes from purchase orders with partial and full receipt support, so that received goods are accurately recorded in stock and the PO is tracked to completion.

**Acceptance Criteria:**
1. GIVEN an APPROVED or SENT purchase order WHEN the operator creates a GoodsReceipt THEN a GRN is created in DRAFT status with GoodsReceiptLines pre-populated from PO lines showing ordered quantity and received-to-date.
2. GIVEN a DRAFT GRN WHEN lines are received (partial or full quantities) and the operator posts it THEN the status transitions to POSTED, GOODS_RECEIPT stock movements are created per line, PurchaseOrderLine.quantityReceived is incremented, StockBalance is updated, GL journal entry is created (DR Stock, CR GRN Accrual), and `goods.receipt.posted` event is emitted.
3. GIVEN over-receipt is disabled (ap.allowOverReceipt = false) WHEN the received quantity exceeds the ordered quantity THEN the system rejects per BR-PUR-003.
4. GIVEN over-receipt is enabled WHEN the received quantity exceeds the ordered quantity THEN the system allows with a warning.
5. GIVEN a POSTED GRN WHEN cancelled THEN reversal stock movements are created, PurchaseOrderLine.quantityReceived is decremented, StockBalance is reversed, reversal GL journal entry is created, and `grn.cancelled` event is emitted.
6. GIVEN a PO with all lines fully received WHEN the last GRN is posted THEN the PO status transitions to FULLY_RECEIVED.

**Key Tasks:**
- [ ] Create Prisma models for GoodsReceipt and GoodsReceiptLine (AC: #1)
  - [ ] GoodsReceipt: id, receiptNumber (NumberSeries), purchaseOrderId FK (nullable), supplierId FK, status GoodsReceiptStatus enum (3 values), receiptDate, companyId
  - [ ] GoodsReceiptLine: id, goodsReceiptId FK (cascade), purchaseOrderLineId FK (nullable), itemId, quantity Decimal, unitCost Decimal, warehouseId FK
- [ ] Implement GRN pre-population from PO lines (AC: #1)
- [ ] Implement GRN posting with atomic stock movement creation, PO line update, StockBalance update, and GL posting (AC: #2)
- [ ] Implement over-receipt configurable guard (AC: #3, #4)
- [ ] Implement GRN cancellation with full reversal chain (AC: #5)
- [ ] Implement PO status progression to FULLY_RECEIVED when all lines complete (AC: #6)
- [ ] Emit events: `goods.receipt.posted`, `grn.cancelled` (AC: #2, #5)
- [ ] Register routes: CRUD `/ap/goods-receipts`, GET `/:id/lines`, POST `/:id/post`, POST `/:id/cancel` (AC: #1–#6)
- [ ] Write unit tests for partial receipt, over-receipt guard, and full reversal (AC: #2–#5)

**FR/NFR:** FR43; NFR18 (ACID for stock + GL), NFR38 (Decimal 19,4)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | GoodsReceipt/Line models, stock movement creation, GL posting (DR Stock, CR GRN Accrual) |
| API Contracts | §2.10 | CRUD `/ap/goods-receipts`, GET `/:id/lines`, POST `/:id/post`, POST `/:id/cancel` |
| Data Models | §3.6 | GoodsReceipt (purchaseOrderId, status 3-value enum), GoodsReceiptLine (purchaseOrderLineId, quantity, unitCost, warehouseId) |
| State Machines | §4.3 | GoodsReceipt: DRAFT→POSTED→CANCELLED; side effects (stock movements, GL journal, PO line update) |
| Event Catalog | §5 | `goods.receipt.posted` — subscribers: Inventory (stock movements), Finance (GL), Purchasing (PO update) |
| Business Rules | §5 | BR-PUR-001 (PO→multiple GRNs), BR-PUR-002 (GRN→one PO), BR-PUR-003 (over-receipt configurable) |
| UX Design Spec | §T3 | T3 Header+Lines for GRN form with PO reference and line quantities |
| Project Context | §15 | XM-004 (3-way matching PO→GRN→Bill) |

---

## Story E18.S3: PO Lifecycle & Status

**User Story:** As a purchasing manager, I want to track purchase orders through their full lifecycle from draft to close with partial receipt and invoice tracking, so that procurement status is always visible.

**Acceptance Criteria:**
1. GIVEN a PO in SENT/APPROVED status WHEN a GRN is posted against it THEN the PO transitions to PARTIALLY_RECEIVED if some lines are partially received.
2. GIVEN a PO with all lines having quantityReceived >= quantity WHEN the last GRN posts THEN the PO transitions to FULLY_RECEIVED.
3. GIVEN a received PO WHEN supplier bills are posted against it THEN the PO transitions through PARTIALLY_INVOICED to FULLY_INVOICED as line quantities are invoiced.
4. GIVEN a FULLY_INVOICED PO WHEN the manager closes it THEN the PO transitions to CLOSED (terminal, immutable).
5. GIVEN any PO WHEN viewing its detail THEN the line-level status shows OPEN/PARTIALLY_RECEIVED/RECEIVED/CANCELLED per line.

**Key Tasks:**
- [ ] Implement automatic PO status progression based on line-level receipt quantities (AC: #1, #2)
- [ ] Implement automatic PO status progression based on line-level invoice quantities (AC: #3)
- [ ] Implement manual close action for FULLY_INVOICED POs (AC: #4)
- [ ] Implement PurchaseOrderLine computed status based on quantityReceived vs quantity (AC: #5)
- [ ] Write unit tests for each status transition trigger (AC: #1–#4)

**FR/NFR:** FR45; NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | PO lifecycle, automatic status progression from GRN and bill events |
| API Contracts | §2.10 | POST `/ap/purchase-orders/:id/close` |
| Data Models | §3.6 | PurchaseOrder.status (9-value enum), PurchaseOrderLine.quantityReceived/quantityInvoiced/lineStatus |
| State Machines | §4.1, §4.2 | PurchaseOrder full lifecycle: DRAFT→...→CLOSED/CANCELLED; PurchaseOrderLine: OPEN→PARTIALLY_RECEIVED→RECEIVED |
| Event Catalog | §5 | Subscribes to `goods.receipt.posted` and `bill.posted` for status progression |
| Business Rules | §5 | BR-PUR-001 (multiple GRNs per PO drive partial receipt tracking) |
| UX Design Spec | §T2 | T2 Record Detail for PO with receipt/invoice progress indicators |
| Project Context | §11 | Status changes emit typed events |

---

## Story E18.S4: PO Screens

**User Story:** As a purchasing user, I want standardised list and form screens for purchase orders and goods receipts with status-driven action bars, so that I can manage procurement using consistent UX patterns.

**Acceptance Criteria:**
1. GIVEN a purchasing user WHEN they navigate to Purchase Orders THEN a T1 Entity List displays POs with columns for number, supplier, date, total, status, and receipt progress, with filters for status and supplier.
2. GIVEN a purchasing user WHEN they open a PO THEN a T3 Header+Lines form displays supplier, dates, delivery info in the header and item lines with quantity/price/received in the lines, with ActionBar showing Approve (DRAFT), Send (APPROVED), Receive (SENT).
3. GIVEN a purchasing user WHEN they navigate to Goods Receipts THEN a T1 list shows GRNs with PO reference, supplier, date, and status.
4. GIVEN a purchasing user WHEN they open a GRN THEN a T3 form shows the receipt with line quantities and ActionBar showing Post (DRAFT).
5. GIVEN the ActionBar on PO forms WHEN the PO is in various states THEN only valid transitions are offered: Approve (DRAFT), Send (APPROVED), Close (FULLY_INVOICED), Cancel (DRAFT/APPROVED).

**Key Tasks:**
- [ ] Build T1 Entity List for Purchase Orders with receipt progress column (AC: #1)
- [ ] Build T3 Header+Lines form for PO with supplier lookup and line editor (AC: #2)
- [ ] Build T1 Entity List for Goods Receipts (AC: #3)
- [ ] Build T3 Header+Lines form for GRN with PO pre-population (AC: #4)
- [ ] Implement status-driven ActionBar for PO and GRN forms (AC: #5)
- [ ] Ensure all text uses translation keys and Co-Pilot Dock integration (AC: #1–#5)

**FR/NFR:** FR41–FR45; NFR27 (WCAG 2.1 AA), NFR28 (keyboard navigation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.17 | All purchasing entities and relationships |
| API Contracts | §2.10 | All PO and GRN endpoints consumed by frontend |
| Data Models | §3.6 | All purchasing models for form field mapping |
| State Machines | §4.1–§4.3 | PO and GRN status for ActionBar visibility |
| Event Catalog | N/A — frontend subscribes via WebSocket |
| Business Rules | §5 | BR-PUR rules inform validation displays and ActionBar visibility |
| UX Design Spec | §T1, §T3, §Action Bar | T1 for lists, T3 for forms, ActionBar with Approve/Send/Receive/Post actions |
| Project Context | §3 | All strings use translation keys |

---

## Story E18.S5: Mobile Adaptation

**User Story:** As a warehouse operator on mobile, I want to receive goods by scanning items and checking PO status from my device, so that goods receipt can happen on the warehouse floor.

**Acceptance Criteria:**
1. GIVEN a mobile user WHEN they scan a barcode on received goods THEN the system looks up the item and shows pending PO lines for that item.
2. GIVEN a mobile user WHEN they view the PO list THEN a simplified list shows open POs with supplier, date, total, and receipt status.
3. GIVEN a mobile user WHEN they tap a PO THEN they see a read-only detail with line items and received quantities.
4. GIVEN a mobile user WHEN they start a goods receipt from a PO THEN they can enter received quantities per line (with barcode scan) and save as DRAFT for desktop posting.
5. GIVEN all mobile purchasing screens WHEN rendered THEN touch targets are minimum 44x44px and layouts are single-column optimised.

**Key Tasks:**
- [ ] Implement barcode scan integration for item lookup on received goods (AC: #1)
- [ ] Build mobile PO list with receipt progress indicators (AC: #2)
- [ ] Build mobile PO detail view (read-only) (AC: #3)
- [ ] Build simplified mobile goods receipt form with barcode scanning (AC: #4)
- [ ] Ensure 44x44px touch targets and single-column layout (AC: #5)

**FR/NFR:** FR43, FR46; NFR27 (WCAG 2.1 AA)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 | Mobile scaffold (Expo/React Native), camera for barcode |
| API Contracts | §2.10, §2.13 | PO and inventory endpoints consumed by mobile |
| Data Models | N/A — mobile consumes API responses |
| State Machines | N/A — mobile displays status only; GRN saved as DRAFT for desktop posting |
| Event Catalog | N/A — mobile receives push for PO events |
| Business Rules | N/A — validation enforced server-side |
| UX Design Spec | §Responsive | 375px+ breakpoint, 44x44px touch targets, barcode scanning |
| Project Context | §8 | Mobile as end-of-epic story; goods receipt scanning is key mobile use case |

---
