Last updated: 2025-09-05

## Purpose
Cashier-friendly POS for in-store sales with cash/card, X/Z, and receipts.

## Who should read this
Store managers and cashiers setting up and using POS.

## Features
- Sales: open sale, add lines, pay cash/card (stubbed card present for now)
- Shifts: open/close, X/Z reports
- Receipts: printable HTML (PDF next)
- Audit: events logged (best-effort)

## Routes
- /pos — cashier view
- /pos/admin — manager view

## Roles
- pos_cashier: add lines, pay
- pos_manager: open/close shifts, Z report, refunds

## Notes
- Card-present via Stripe Terminal is stubbed until live keys are added.


