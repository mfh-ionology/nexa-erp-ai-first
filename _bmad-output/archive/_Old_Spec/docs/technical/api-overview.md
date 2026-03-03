# API Overview

- Auth: session cookies (web) and OAuth2/Bearer tokens (service). Rate limits per IP/key.
- Conventions: REST+JSON; RFC7807 errors; idempotency header for POST on payment‑like ops.
- Webhooks: payments.settled, bank.transaction.imported, vat.return.submitted.
