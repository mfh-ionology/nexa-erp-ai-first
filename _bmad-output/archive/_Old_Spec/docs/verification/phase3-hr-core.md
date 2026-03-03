# Phase 3 – hr_core verification

- **BASE_REF:** 25d44ff
- **HEAD:** e7412c2
- **Slice:** `hr_core`
- **Evidence:** `reports/verification/phase3-hr_core-20260115-225314`

## Permissions & module gate
- READ: `ui:finance_reports:view`
- MANAGE: `inventory:manage`
- Module gate: `assertModuleEnabled('hr')`
- Staff self-service: staff can create/read/submit/cancel their own leave only when `employee.userId === session userId`; approve/reject requires MANAGE.

## Endpoints
- Employees: `GET/POST /api/hr/employees`, `GET/PATCH /api/hr/employees/[id]`, `POST /api/hr/employees/[id]/disable`, `POST /api/hr/employees/[id]/enable`
- Leave policy: `GET /api/hr/leave/policy`, `PUT /api/hr/leave/policy`
- Leave requests: `GET/POST /api/hr/leave/requests`, `GET/PATCH /api/hr/leave/requests/[id]`, `POST /api/hr/leave/requests/[id]/submit`, `POST /api/hr/leave/requests/[id]/approve`, `POST /api/hr/leave/requests/[id]/reject`, `POST /api/hr/leave/requests/[id]/cancel`

## UI routes
- `/hr` (landing)
- `/hr/employees`
- `/hr/leave`
- `/hr/leave/requests`
- `/hr/leave/requests/[leaveId]`
- `/hr/leave/policy`

## Leave calculation
- Days are calculated as inclusive calendar days using UTC date-only boundaries (`inclusiveDays`), no weekend exclusion in this slice. Entitlement check uses holiday year window from `holidayYearStartMonth` and enforces `entitlementDays + carryOverDays`.

## Self-service rules
- Staff without MANAGE can act only on their own mapped employee record (create/read/update/submit/cancel leave). Approve/reject requires MANAGE. Inactive employees cannot submit new leave.

## Seed / unseed / verifier
- `scripts/qa/seed_hr_core.ts`: creates tenant, sets policy (10 days), creates admin/staff employees, creates/submits/approves a 3-day annual leave, ensures overlap submit fails and entitlement is enforced.
- `scripts/qa/unseed_hr_core.ts`: removes runId tenant, employees, TenantConfig keys.
- `scripts/verification/verify_phase3_hr_core.mjs`: runs seed, checks employee/policy/leave lifecycle, overlap and entitlement enforcement, staff visibility, then unseed cleanup. Uses `TEST_DATABASE_URL`.

## Commands executed
- `pnpm -s spec:coverage`
- `TEST_DATABASE_URL=... SLICE_KEY=hr_core BASE_REF=25d44ff bash scripts/verification/run_phase3_slice.sh`
