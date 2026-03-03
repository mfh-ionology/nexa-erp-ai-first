# Flow — Payroll Run and RTI

Last updated: 2025-09-04

## Purpose
Describe the payroll run and HMRC RTI submission.

## Who should read this
Payroll admins and finance.

## Steps
1) Prepare payroll
2) Validate
3) Submit RTI
4) Confirm

## Redacted sample payload
```
{
  "payrunId": "xxx",
  "employees": [ { "id": "xxx", "nino": "xxx" } ]
}
```

## Acceptance checks
- Totals balanced
- Submission acknowledged
- Logs are masked (`***redacted***`, `xxx`)



