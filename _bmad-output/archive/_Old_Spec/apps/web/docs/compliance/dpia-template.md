# DPIA — Template

Last updated: 2025-09-04

## Purpose
A template for Data Protection Impact Assessments for Nexa ERP.

## Who should read this
Privacy, security, and legal teams.

## System overview
Nexa ERP processes business operations data with secure defaults.

## Data categories
- Identification: names, emails (pseudonymised in logs)
- Finance: invoices, payments
- HR: payroll details (masked in logs)

## Lawful bases
- Contract
- Legitimate interests
- Consent (where applicable)

## Risk assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Personal data leak | Low | High | Masking, RBAC, SoD, audits |
| Over-retention | Medium | Medium | Retention schedules |

## Mitigations and residual risk
Describe controls and any residual risk.

## Sign-off
- DPO: ______________________
- Security Lead: ______________________
- Date: ______________________



