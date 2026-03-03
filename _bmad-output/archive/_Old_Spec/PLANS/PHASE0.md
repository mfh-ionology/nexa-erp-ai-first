# Phase 0 Plan (≤12 files)

This plan lists the 12 files to be created in Phase 0 to scaffold the monorepo, CI, governance skeletons, and gate scripts.

Files to create in Phase 0 (excluding this plan file):

1. `package.json` — Monorepo root with workspaces, scripts (lint/type/test/cov/a11y/sbom/gate:phase0), and inline ESLint/Prettier/Commitlint configs.
2. `pnpm-workspace.yaml` — Workspace definitions for `apps/*` and `packages/*`.
3. `tsconfig.base.json` — Shared TypeScript config with strict settings and path aliases.
4. `.github/workflows/ci.yml` — Base CI pipeline running lint, type-check, tests, coverage, a11y, SAST/SBOM stubs.
5. `README.md` — Project overview and Phase 0 scope/commands.
6. `ARCHITECTURE.md` — High-level architecture and monorepo layout.
7. `AI-GOVERNANCE.md` — AI governance skeleton (regulated_submit=false, confirmation card placeholder, token caps).
8. `SECURITY.md` — Security posture, SoD/MFA/SSO placeholders, SBOM note.
9. `RUNBOOKS/DEV-QUICKSTART.md` — Dev setup and run/test instructions.
10. `packages/core/src/index.js` — RBAC + SoD skeleton, multitenant query scoping helper, AI governance defaults, OpenAPI stub.
11. `prisma/schema.prisma` — Prisma schema skeleton with `tenant_id` on base entity.
12. `scripts/gate-phase0.cjs` — Phase 0 gate checks (SoD, tenant scoping, AI defaults, OpenAPI stub).

Note: Tests are validated via the Phase 0 gate script and CI workflow in this phase; dedicated test files will be added in Phase 1.
