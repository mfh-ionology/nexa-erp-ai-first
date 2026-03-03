# Billing & Metering (Stripe)

- What it does: Plans, subscriptions, invoicing, and usage capture. Demo flows use mocks unless Stripe keys are present.
- Key endpoints: `/api/stripe/health`, `/api/stripe/customers/[id]`, `/api/stripe/subscriptions/[id]`, `/api/stripe/webhook` (Phase C).
- Roles & permissions: superadmin/admin for changes; users read-only.
- Data model: `BillingPlan`, `Subscription`, `Invoice`, `UsageEvent`, `WebhookEvent`.
- Jobs: `billing:reconcile` keeps demo subscriptions active if configured.
- Common tasks: create or change plan, verify webhook health, view invoices.
- Troubleshooting: ensure `STRIPE_SECRET_KEY` (and `STRIPE_WEBHOOK_SECRET` for webhooks) set; check `/api/stripe/health`.
