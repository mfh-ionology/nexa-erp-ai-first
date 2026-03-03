# Billing — Phase-7

API routes:
- GET  /api/billing/invoices?tenantId&limit → { ok, invoices }
- GET  /api/billing/webhook/status → { ok, configured }
- POST /api/stripe/webhook → Stripe-compatible webhook endpoint (HMAC header)

Auth/RBAC:
- Header `x-role: admin` (billing)

Models:
- `Invoice`, `WebhookEndpoint`, `WebhookEvent`

Notes:
- Webhook status gated by STRIPE_WEBHOOK_SECRET
- Webhook persists received events with masked audit




