# POS Module

Point of Sale for retail and counter sales.

---

## Pages

### POS Invoice (Touch Screen)
- Dedicated full-screen POS interface optimised for touch
- **Features:**
  - Item search by code, barcode scan, name search
  - Quick-add buttons for frequent items (configurable grid)
  - Quantity adjustment, line discount
  - Customer lookup and assignment (optional — walk-in default)
  - Multiple payment methods per transaction (split payment: cash + card)
  - Payment types: Cash, Card, Gift Card, Account (charge to customer)
  - Change calculation for cash
  - Receipt printing (thermal printer)
  - Hold/park transaction and resume later
  - Void line / void transaction (with reason and supervisor override)
  - Returns and refunds at POS
  - Discount application (% or fixed, line or total, requires permission)
  - Price override (requires supervisor approval)
  - Tax/VAT display per line and total
  - End-of-day summary on screen

### Tills
- Till/register management
- **Features:**
  - Till setup: name, location, default payment methods
  - Till opening (enter opening float)
  - Till closing (count cash, reconcile with system)
  - Cash in/out (petty cash, float adjustments)
  - Till assignment to user/shift
  - Till variance report (expected vs counted)

### Loyalty (Optional)
- Customer loyalty programme
- **Features:**
  - Points accrual per transaction (rules-based)
  - Points redemption at POS
  - Loyalty tiers (bronze, silver, gold)
  - Customer loyalty balance lookup
  - Loyalty card / member number

---

## Settings

- POS terminal setup (linked to location, till, receipt printer)
- Quick-add item grid configuration
- Payment methods available per terminal
- Receipt template (header, footer, logo)
- Discount permissions (who can give discounts, max %)
- Void/refund permissions
- Loyalty programme rules (points per pound, redemption rate)
- Number series (POS invoices, receipts)
- Tax rounding rules
- Shift schedule settings

---

## Reports

- Daily Sales Summary (by terminal, by user)
- Till Reconciliation Report
- POS Sales by Item Report
- POS Sales by Payment Method
- Void/Refund Report
- Discount Report (discount given, by whom, reason)
- Hourly Sales Report (peak hours analysis)
- Loyalty Points Report (issued, redeemed, balance)
- Cashier Performance Report

---

## Maintenances (Batch Jobs)

- **End of Day Close** — close all tills, generate daily summary, post to GL
- **Loyalty Points Expiry** — expire points older than configurable period

---

## Exports & Imports

- Daily sales export (for accounting)
- Item quick-add grid import
- Loyalty member import

---

## Forms (Printable Documents)

- POS Receipt (thermal printer format)
- POS Invoice (A4 format, if requested)
- Gift Receipt
- Refund Receipt
- Till Summary / Z-Report
- X-Report (mid-shift reading)
