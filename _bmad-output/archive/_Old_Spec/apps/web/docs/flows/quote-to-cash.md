# Flow — Quote to Cash

Last updated: 2025-09-04

## Purpose
Show an end-to-end flow from quote to payment.

## Who should read this
Finance and operations teams.

## Steps
1) Quote
2) Order
3) Fulfil
4) Invoice
5) Payment
6) Reconcile

## Test data (redacted)
```
customer=xxx
quote_total=0.00
invoice_id=xxx
payment_ref=***redacted***
```

## Acceptance checks
- Invoice totals match
- Payment applied to correct invoice
- Bank reconciliation shows matched lines



