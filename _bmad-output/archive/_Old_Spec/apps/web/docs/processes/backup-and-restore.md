# Backup and Restore — Process

Last updated: 2025-09-04

## Purpose
Describe backups and restore drills for Nexa ERP.

## Who should read this
Ops and engineering on-call.

## Backups overview
- Automated daily backups.
- Encrypted at rest.

## Restore drill — runbook
Steps:
1) Identify snapshot (timestamp).
2) Restore to staging.
3) Validate integrity and app start.

Example command (no real connection strings):
```
# Do not paste real secrets here
pg_restore --dbname=***redacted*** --clean --if-exists backup.dump
```

## RPO/RTO fields
- RPO: ____ minutes
- RTO: ____ minutes

## Checklist and sign-off
- [ ] Backup success alert
- [ ] Restore validated
- [ ] Sign-off by ops lead



