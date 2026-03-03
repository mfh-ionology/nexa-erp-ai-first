# HMRC RTI — Production Setup (Nexa Payroll)

Last updated: 2025-09-04

## Purpose
Help you connect Nexa Payroll to HMRC RTI in production.

## Who should read this
Payroll admins and engineers.

## Redirect URI
```
${APP_BASE_URL}/api/hmrc/rti/callback
```

## Environment variables
Do not paste real secrets here.

```
# Do not paste real secrets here
HMRC_RTI_ENV=production
HMRC_RTI_CLIENT_ID=***redacted***
HMRC_RTI_CLIENT_SECRET=***redacted***
HMRC_RTI_VRN=***redacted***
HMRC_RTI_CALLBACK_URL=${APP_BASE_URL}/api/hmrc/rti/callback
```

## Smoke steps
- GET `/api/hmrc/rti/health` returns `{ ok: true }` when variables exist.
- POST `/api/hmrc/rti/employments/payrun` with a stub payload returns a stubbed result.

### Masking examples
```
vrn=***redacted***
employee_nino=xxx
submission_id=xxx
```

## Test payload (redacted example)
```
{
  "payrunId": "xxx",
  "period": "2025-08",
  "employees": [
    { "id": "xxx", "nino": "xxx", "gross": 0 }
  ]
}
```

## Troubleshooting
1) Callback mismatch: check the redirect URL.
2) 403/401: confirm client credentials; never log them.
3) VRN formatting: mask VRNs in logs.

## Checklist
- [ ] Redirect URI set
- [ ] Env present
- [ ] Health OK
- [ ] Stub submit OK
- [ ] Logs show redaction



