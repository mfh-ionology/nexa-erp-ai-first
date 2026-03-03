# HubSpot — OAuth Setup for Nexa

Last updated: 2025-09-04

## Purpose
Help you connect HubSpot to Nexa using OAuth safely.

## Who should read this
Admins and engineers who manage CRM integrations.

## Prerequisites
- A HubSpot app with client ID and client secret.
- Required scopes granted.
- Access to Nexa web app settings.

## Redirect URI
Use this exact redirect URI in your HubSpot app:

```
${APP_BASE_URL}/api/connectors/hubspot/callback
```

## Required scopes (example)
- crm.objects.contacts.read
- crm.objects.contacts.write
- oauth

## Add environment variables
Do not paste real secrets here.

```
# Do not paste real secrets here
HUBSPOT_CLIENT_ID=***redacted***
HUBSPOT_CLIENT_SECRET=***redacted***
HUBSPOT_SCOPES="crm.objects.contacts.read crm.objects.contacts.write oauth"
HUBSPOT_REDIRECT_URL=${APP_BASE_URL}/api/connectors/hubspot/callback
```

## Health and test
- GET `/api/connectors/hubspot/health` should return `{ ok: true }` when variables are present.
- GET `/api/connectors/hubspot/test` runs a harmless check (e.g. metadata) with masked logs.

### Masking example
```
hubspot_token=***redacted***
contact_id=xxx
```

## Troubleshooting
1) Wrong redirect URI: update HubSpot app to the URI above.
2) Invalid scopes: ensure scopes match the list shown.
3) 401 errors: refresh the app secrets in Nexa (never log them).

## Checklist
- [ ] Redirect URI added in HubSpot app
- [ ] Scopes confirmed
- [ ] `.env.local` set (placeholders replaced in production only)
- [ ] Health and test endpoints pass
- [ ] Logs show redaction where expected





