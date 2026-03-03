# Data Model & Integrations

## Core entities
- Party (customer/supplier); Product; Location; Order (sales/purchase)
- Shipment/Receipt; Invoice (AR/AP); Payment; Journal/Ledger; VAT Return

## Posting & reconciliation
- Documents post to journals via rules; journals summarise to ledgers.
- Bank reconciliation matches statement lines to payments with tolerances.

## Connectors
- Stripe payments; TrueLayer banking; HMRC VAT (MTD). All inbound webhooks are authenticated and idempotent.
