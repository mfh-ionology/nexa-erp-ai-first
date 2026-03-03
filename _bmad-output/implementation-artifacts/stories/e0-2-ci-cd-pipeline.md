# Story E0.2: CI/CD Pipeline

Status: done

## Story

As a developer,
I want automated CI/CD pipelines running on every push and pull request,
so that code quality is enforced before merge and deployments are reliable.

## Acceptance Criteria

1. GIVEN a pull request is opened WHEN CI triggers THEN lint, typecheck, unit tests, and build steps all execute and must pass before merge is allowed
2. GIVEN a merge to main WHEN the deploy-staging workflow triggers THEN the staging environment is updated automatically
3. GIVEN branch protection rules WHEN a developer attempts to push directly to main THEN the push is rejected requiring PR review
4. GIVEN a CI run WHEN Turborepo caching is configured THEN unchanged packages are skipped, reducing CI time by at least 40%
5. GIVEN a failed CI step WHEN a developer views the GitHub Actions summary THEN the failure reason is clearly identified with the specific failing test or lint error

## Tasks / Subtasks

- [x] Task 1: Create `.github/workflows/ci.yml` (AC: #1, #4, #5)
  - [x] 1.1 Configure workflow trigger on `pull_request` (all branches) and `push` to `main`
  - [x] 1.2 Set up pnpm with `pnpm/action-setup@v4` reading version from `packageManager` field in root `package.json`
  - [x] 1.3 Set up Node.js 22 via `actions/setup-node@v4` with `cache: 'pnpm'` for automatic store caching
  - [x] 1.4 Run `pnpm install --frozen-lockfile` (fails on lockfile mismatch — enforces reproducibility)
  - [x] 1.5 Run `turbo lint` — ESLint across all workspaces (Note: lint config not wired until E0.S4, but the pipeline step must exist. Use a no-op lint script as placeholder)
  - [x] 1.6 Run `turbo typecheck` — TypeScript strict compilation across all workspaces
  - [x] 1.7 Run `turbo test` — unit tests across all workspaces (Note: no test runner installed yet; placeholder scripts from E0.S1 will echo success)
  - [x] 1.8 Run `turbo build` — full build in topological order
  - [x] 1.9 Configure Turborepo remote caching via `TURBO_TOKEN` and `TURBO_TEAM` environment variables from GitHub secrets (ready for activation — remote caching is opt-in)
  - [x] 1.10 Ensure structured failure output: if any step fails, the specific failing package and error message is visible in the GitHub Actions job summary

- [x] Task 2: Create `.github/workflows/deploy-staging.yml` (AC: #2)
  - [x] 2.1 Configure workflow trigger on `push` to `main` only (post-merge)
  - [x] 2.2 Run full CI pipeline (lint, typecheck, test, build) as prerequisite
  - [x] 2.3 Add stub deployment step: echo "Deploy to staging — implementation deferred to infrastructure epic" (actual Docker build + push to registry will be implemented when Docker/Kubernetes infrastructure is set up)
  - [x] 2.4 Include environment variable for `DEPLOY_ENVIRONMENT: staging`

- [x] Task 3: Create `.github/workflows/deploy-production.yml` stub (AC: architecture alignment)
  - [x] 3.1 Configure as manual trigger (`workflow_dispatch`) per Architecture §Project Structure
  - [x] 3.2 Add stub deployment step with `DEPLOY_ENVIRONMENT: production`
  - [x] 3.3 Require manual approval gate (GitHub Environments with required reviewers — document as TODO comment if GitHub plan doesn't support environments)

- [x] Task 4: Configure branch protection rules for `main` (AC: #3)
  - [x] 4.1 Document the branch protection configuration as a JSON file (`.github/branch-protection.json`) for reference and reproducibility
  - [x] 4.2 Include configuration: require PR reviews (min 1 reviewer), require status checks (`ci` workflow must pass), disallow force push, disallow direct push to main, require linear history
  - [x] 4.3 Add a `scripts/setup-branch-protection.sh` script that uses `gh api` to apply rulesets — this is run once manually by the repo admin (NOT automated in CI)
  - [x] 4.4 Use GitHub Repository Rulesets API (modern approach) rather than classic branch protection

- [x] Task 5: Configure CI reporting and coverage infrastructure (AC: #5)
  - [x] 5.1 Add test coverage report upload step to `ci.yml` — use `actions/upload-artifact@v4` to store coverage reports as workflow artifacts (no third-party service yet)
  - [x] 5.2 Add coverage summary step: parse coverage reports and add to GitHub Actions job summary using `$GITHUB_STEP_SUMMARY`
  - [x] 5.3 Ensure each Turborepo task reports its package name in output for clear failure identification

- [x] Task 6: Verify complete CI/CD setup (AC: #1-#5)
  - [x] 6.1 Create a test branch, push a commit, and verify CI triggers on PR
  - [x] 6.2 Verify `turbo typecheck` passes in CI (already passes locally from E0.S1)
  - [x] 6.3 Verify `turbo build` passes in CI with correct topological order
  - [x] 6.4 Introduce a deliberate TypeScript error on a branch, verify CI fails with clear error message
  - [x] 6.5 Merge to main, verify `deploy-staging.yml` triggers

## Dev Notes

### Previous Story Intelligence (E0.S1)

**Learnings from E0.S1 code review:**
- 12 remaining CR issues documented (3 HIGH, 6 MEDIUM, 3 LOW) — do NOT fix these in E0.S2; they are tracked as tech debt
- Issue #1 (HIGH): Node.js engine constraint — `.nvmrc` says `22` but dev machine runs Node v20.19.6. **CI must use Node 22** regardless of local machine version. The `actions/setup-node@v4` with `node-version-file: '.nvmrc'` will correctly use Node 22 in CI
- Issue #6 (MEDIUM): `.env.example` port inconsistency (both DBs on 5432) — not relevant to CI but noted for awareness
- Issue #9 (MEDIUM): Task 6.4 verification gap — the E0.S2 CI pipeline will implicitly test workspace auto-inclusion by building all packages

**Files created in E0.S1 that CI must handle:**
- Root: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`, `.npmrc`
- 5 apps and 6 packages, each with `package.json`, `tsconfig.json`, `src/index.ts`
- Config: `packages/config/typescript/{base,node,react}.json`
- Existing scripts: `build` (tsc), `typecheck` (tsc --noEmit), `lint` (echo placeholder), `test` (echo placeholder)

**Git history:** Single commit `8abf62a` — monorepo initialization. Clean working tree.

### Technology Versions (Verified Latest Stable as of Feb 2026)

| Technology | Version | Notes |
|-----------|---------|-------|
| `actions/checkout` | `@v4` | Resolves to v6.0.2 |
| `actions/setup-node` | `@v4` | Resolves to v6.2.0 |
| `pnpm/action-setup` | `@v4` | v4.2.0 — reads `packageManager` from `package.json` |
| `actions/cache` | `@v5` | v5.0.3 — requires runner >= 2.327.1, legacy cache backend deprecated Feb 2025 |
| `actions/upload-artifact` | `@v4` | For coverage report artifacts |
| Node.js | 22 LTS | Matched from `.nvmrc` |
| pnpm | 10.29.3 | Auto-detected from root `package.json` `packageManager` field |
| Turborepo | ^2.8.9 | Already installed as devDependency |

### Turborepo Remote Caching

**IMPORTANT: `--remote-only` is DEPRECATED as of Turborepo 2.3+.**

Use the new `--cache` flag instead:
```bash
# Remote cache only (CI optimization):
turbo build --cache=local:,remote:rw

# Both local + remote (default when TURBO_TOKEN set):
turbo build
```

When `TURBO_TOKEN` and `TURBO_TEAM` environment variables are present, Turborepo automatically enables remote caching. No code changes needed — just set the secrets.

**For this story:** Configure the CI to accept these secrets but do NOT require them. The pipeline must work without remote caching (local caching only). Remote caching is opt-in when secrets are configured.

### CI Workflow Structure

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: ['*']
  push:
    branches: [main]

# Cancel in-progress runs for the same branch/PR
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    env:
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_TEAM: ${{ vars.TURBO_TEAM }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        # version auto-read from packageManager field
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: turbo lint
      - run: turbo typecheck
      - run: turbo test
      - run: turbo build
```

### Branch Protection Rules (Rulesets API)

Use GitHub Repository Rulesets (modern, replaces classic branch protection):

```json
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "required_status_checks",
      "parameters": {
        "required_status_checks": [
          { "context": "CI / build-and-test" }
        ],
        "strict_required_status_checks_policy": true
      }
    },
    {
      "type": "pull_request",
      "parameters": {
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_approving_review_count": 1,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "deletion"
    }
  ]
}
```

**Note on `required_approving_review_count`:** Set to 1 for now. Mohammed is the sole developer; requiring >1 reviewer is impractical. Can increase later.

**Note:** The `context` value in `required_status_checks` must exactly match the job name as it appears in GitHub UI: `"CI / build-and-test"` (workflow name / job name).

### Deploy Staging Workflow

The deploy-staging workflow triggers on merge to main. For now, the actual deployment is a stub — no Docker registry or Kubernetes cluster is set up yet. The workflow validates the build succeeds and logs a placeholder deploy message.

### Coverage Reporting Strategy

For E0.S2, use `actions/upload-artifact@v4` to store coverage reports as GitHub Actions artifacts. No third-party service (Codecov, etc.) is needed yet. When tests are properly configured (E0.S4+), coverage thresholds (80% per NFR43/IMP-019) will be enforced.

### Cross-Cutting Patterns (MANDATORY)

Every implementation MUST follow these patterns from project-context.md:
- **companyId**: N/A for this story (infrastructure only, no ERP data tables)
- **i18n**: N/A for this story (no user-facing strings)
- **Audit**: N/A for this story (no state-changing business operations)
- **Attachments/Notes/Tasks**: N/A for this story (infrastructure only)

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **Architecture** | §Project Structure — `.github/workflows/` directory: `ci.yml`, `deploy-staging.yml`, `deploy-production.yml` | Three workflow files defined in architecture directory tree. [Source: architecture/project-structure-boundaries.md] |
| **Architecture** | §Implementation Patterns — Enforcement Guidelines, 13 MUST rules | CI must enforce TypeScript strict mode, no `any` type, no `console.log`. These are linted (E0.S4) but typecheck catches strict violations. [Source: architecture/implementation-patterns-consistency-rules.md] |
| **Architecture** | §Core Architectural Decisions — Technology Stack | Node.js 22 LTS, pnpm 10.x, Turborepo 2.x, TypeScript 5.7+ strict. CI environment must match. [Source: architecture/core-architectural-decisions.md] |
| **API Contracts** | N/A | N/A — no endpoints in this story |
| **State Machine** | N/A | N/A — no state machines in this story |
| **Event Catalog** | N/A | N/A — no events in this story |
| **Data Models** | N/A | N/A — no models in this story |
| **Business Rules** | §14 Implicit Rules — IMP-017, IMP-019 | IMP-017: TypeScript strict mode enforcement (CI `turbo typecheck` enforces this). IMP-019: 80% test coverage for business logic (coverage infrastructure set up here, enforcement in later stories). [Source: business-rules-compendium.md §14] |
| **Project Context** | §11 Development Rules — Rule 6, Rule 7 | Rule 6: Claude Opus 4.6 for all coding. Rule 7: TDD red-green-refactor (CI must run tests). [Source: project-context.md §11] |
| **PRD** | §Non-Functional Requirements — NFR41, NFR43, NFR44 | NFR41: TypeScript strict mode. NFR43: 80% test coverage. NFR44: Versioned migrations (CI must not break migrations). [Source: prd/non-functional-requirements.md] |

### Project Structure Notes

- `.github/workflows/` directory already exists with `.gitkeep` (created in E0.S1 Task 2.5)
- Remove `.gitkeep` after adding actual workflow files
- The three workflow files match Architecture §Project Structure exactly: `ci.yml`, `deploy-staging.yml`, `deploy-production.yml`
- `scripts/setup-branch-protection.sh` goes in the existing `scripts/` directory
- `.github/branch-protection.json` is a documentation artifact, not consumed by CI

### Source References

- [Source: architecture/project-structure-boundaries.md] — `.github/workflows/` directory tree with ci.yml, deploy-staging.yml, deploy-production.yml
- [Source: architecture/core-architectural-decisions.md] — Technology stack (Node 22, pnpm, Turborepo, TypeScript strict)
- [Source: architecture/implementation-patterns-consistency-rules.md] — 13 enforcement rules, anti-patterns
- [Source: prd/non-functional-requirements.md] — NFR41 (strict TS), NFR43 (80% coverage), NFR44 (versioned migrations)
- [Source: business-rules-compendium.md §14] — IMP-017 (TypeScript strict), IMP-019 (80% coverage)
- [Source: project-context.md §9] — E0 build sequence scope
- [Source: project-context.md §11] — Development rules (TDD, Claude Opus 4.6)
- [Source: epics/epic-e0-monorepo-devops.md] — Epic E0, Story E0.S2 requirements and acceptance criteria

### Anti-Patterns to AVOID

1. **Do NOT use `actions/cache` manually for pnpm** — use `actions/setup-node` with `cache: 'pnpm'` (simpler, official approach)
2. **Do NOT use Turborepo `--remote-only`** — it is deprecated in Turborepo 2.3+. Use `--cache=local:,remote:rw` if needed
3. **Do NOT require `TURBO_TOKEN` / `TURBO_TEAM`** — pipeline must work without remote caching secrets
4. **Do NOT install ESLint/Prettier in this story** — lint is a placeholder (echo) until E0.S4
5. **Do NOT install a test runner in this story** — tests are placeholders until E0.S4
6. **Do NOT configure Husky/commitlint in this story** — that is E0.S4
7. **Do NOT create Docker build/push steps** — that is E0.S3 (Docker Compose) and a future infrastructure epic
8. **Do NOT use `node-version: '22'` directly** — use `node-version-file: '.nvmrc'` to stay in sync with repo config
9. **Do NOT add `pnpm install --no-frozen-lockfile` in CI** — always use `--frozen-lockfile` in CI for reproducibility
10. **Do NOT skip concurrency settings** — use `cancel-in-progress: true` to avoid wasting CI minutes on outdated runs

### What Success Looks Like

After this story is complete:
- Opening a PR triggers CI automatically; lint, typecheck, test, and build all run
- CI passes on current codebase (all placeholder scripts succeed, TypeScript compiles clean)
- Merging to main triggers the deploy-staging workflow
- Branch protection rules are documented and a setup script exists (applied manually by repo admin)
- `deploy-production.yml` exists as a manual-trigger stub
- Turborepo caching works in CI (local cache within job; remote cache ready for activation via secrets)
- A deliberate TypeScript error in a PR causes CI to fail with a clear, specific error message

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- PR #1: test: verify CI triggers on PR (merged to main)

### Completion Notes List

- All 6 tasks completed across 3 commits (df7f366, 5fa87be, 89eb782)
- CI workflow (`ci.yml`) triggers on PR and push to main with lint, typecheck, test, build steps
- Deploy-staging workflow triggers on push to main with stub deployment
- Deploy-production workflow configured as manual `workflow_dispatch` trigger
- Branch protection rules documented in `.github/branch-protection.json` with setup script
- Turborepo remote caching configured (opt-in via `TURBO_TOKEN` / `TURBO_TEAM` secrets)
- Coverage artifact upload step included for future test coverage reporting
- Concurrency groups configured to cancel in-progress runs
- CI reusable workflow (`ci-reusable.yml`) created to DRY shared pipeline steps
- Fix applied (5fa87be): use `pnpm turbo` instead of bare `turbo` in CI workflows
- CI verified via PR #1 (89eb782): triggers confirmed, all steps pass

### File List

- `.github/workflows/ci.yml` — Main CI pipeline (lint, typecheck, test, build)
- `.github/workflows/ci-reusable.yml` — Reusable CI workflow for DRY pipeline steps
- `.github/workflows/deploy-staging.yml` — Staging deployment (auto on merge to main)
- `.github/workflows/deploy-production.yml` — Production deployment (manual trigger stub)
- `.github/branch-protection.json` — Branch protection ruleset configuration (documentation)
- `scripts/setup-branch-protection.sh` — Script to apply branch protection via GitHub API
