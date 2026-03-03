# Incident Management and SLOs — Process

Last updated: 2025-09-04

## Purpose
Define incident handling and service levels for Nexa.

## Who should read this
On-call engineers and managers.

## Incident levels
- P1: Critical outage
- P2: Major degradation
- P3: Minor impact

## Roles and escalation
- Incident Commander
- Comms Lead
- Tech Lead
- Escalation path: L1 → L2 → L3

## SLO examples
- API p95 < 1s
- Error rate < 0.1%
- Uptime 99.9%

## Comms templates
Initial notice
```
Service impact detected. Teams are responding. Next update in 15 minutes.
```

Resolution notice
```
Service restored. Root cause under review. Post-mortem to follow.
```

## Post-mortem template
- Summary
- Timeline
- Root cause
- Actions and owners
- Lessons learned



