# Open Banking — Production Setup (Nexa)

Last updated: 2025-09-04

## Purpose
Help you connect Open Banking to Nexa in production.

## Who should read this
Finance admins and engineers who manage bank feeds.

## Notes
- This page covers production setup. VAT sandbox remains unchanged.

## Redirect URI
```
${APP_BASE_URL}/api/connectors/open-banking/callback
```

## Environment variables
Do not paste real secrets here.

```
# Do not paste real secrets here
OPEN_BANKING_ENV=production
OPEN_BANKING_CLIENT_ID=***redacted***
OPEN_BANKING_CLIENT_SECRET=***redacted***
OPEN_BANKING_REDIRECT_URL=${APP_BASE_URL}/api/connectors/open-banking/callback
```

## Post-setup checks
- GET `/api/open-banking/health` should return `{ ok: true }` when variables exist.
- GET `/api/open-banking/test` attempts a masked account list.

### Masking example
```
account_id=xxx
provider_token=***redacted***
```

## Troubleshooting
1) Callback mismatch: ensure the redirect matches exactly.
2) Invalid client: confirm production credentials.
3) Timeouts: try again; check provider status.

## Checklist
- [ ] Production env set
- [ ] Redirect URI added
- [ ] Health and test OK
- [ ] Logs show redaction



