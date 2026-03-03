# Observability & Guard Rails

- Correlation IDs: `withCorrelation()` returns an object to merge into responses
- Audit logging: `audit({...})` with `hasMasked: true` where PII could appear
- RBAC: `getRoleFromRequest(req)`, `ensureRoleAllowed(module, role)`; respond 403 when denied
- Errors: return `{ ok: false, code, message }` with masked details
- Headers: `x-role` and optional `x-tenant-id`




