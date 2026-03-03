# Story E0.S4: Code Quality Standards

Status: done

## Story

As a developer,
I want automated code quality enforcement via ESLint, Prettier, Husky, and commitlint,
so that every commit meets the project's strict TypeScript standards.

## Acceptance Criteria

1. GIVEN ESLint configuration WHEN I run `turbo lint` THEN all TypeScript files are checked with strict rules including no-any, no-explicit-any, no-unused-vars, and consistent-type-imports
2. GIVEN Prettier configuration WHEN I run `turbo format` THEN all source files are formatted consistently with single quotes, trailing commas, and 100-char line width
3. GIVEN Husky pre-commit hooks WHEN I attempt to commit code THEN lint-staged runs ESLint and Prettier on staged files, blocking commits with lint errors
4. GIVEN commitlint WHEN I write a commit message THEN it must follow conventional commit format (feat:, fix:, chore:, etc.) or the commit is rejected
5. GIVEN the shared eslint configuration in packages/config WHEN any app or package extends it THEN it inherits all strict TypeScript rules without local overrides

## Tasks / Subtasks

- [x] Task 1: Create shared ESLint configuration in packages/config (AC: #1, #5)
  - [x] 1.1 Install ESLint v9+ and `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` (strict preset) in packages/config
  - [x] 1.2 Install `eslint-plugin-jsx-a11y` for accessibility linting (GAP-1 from Architecture)
  - [x] 1.3 Create `packages/config/eslint/base.js` using ESLint flat config format (eslint.config.js style)
  - [x] 1.4 Configure rules: `no-explicit-any: error`, `no-console: error`, `no-unused-vars: error`, `consistent-type-imports: error`, `naming-convention` (PascalCase components, camelCase functions/vars, UPPER_SNAKE_CASE constants)
  - [x] 1.5 Create `packages/config/eslint/react.js` extending base with jsx-a11y and React-specific rules
  - [x] 1.6 Create `packages/config/eslint/node.js` extending base with Node.js-specific rules
  - [x] 1.7 Export all configs from packages/config (update package.json exports)

- [x] Task 2: Wire ESLint into each workspace package (AC: #1, #5)
  - [x] 2.1 Create `eslint.config.js` in apps/api extending `@nexa/config/eslint/node`
  - [x] 2.2 Create `eslint.config.js` in apps/web extending `@nexa/config/eslint/react`
  - [x] 2.3 Create `eslint.config.js` in apps/mobile extending `@nexa/config/eslint/react`
  - [x] 2.4 Create `eslint.config.js` in apps/platform-api extending `@nexa/config/eslint/node`
  - [x] 2.5 Create `eslint.config.js` in apps/platform-admin extending `@nexa/config/eslint/react`
  - [x] 2.6 Create `eslint.config.js` in each package (db, shared, api-client, ai-tools, platform-client, config) extending `@nexa/config/eslint/node`
  - [x] 2.7 Update each workspace's `lint` script to run `eslint .`
  - [x] 2.8 Verify `turbo lint` runs across all workspaces and passes

- [x] Task 3: Configure Prettier (AC: #2)
  - [x] 3.1 Install prettier as root devDependency
  - [x] 3.2 Create root `.prettierrc` with: singleQuote: true, trailingComma: "all", printWidth: 100, semi: true, tabWidth: 2, arrowParens: "always"
  - [x] 3.3 Create root `.prettierignore` for: dist/, node_modules/, .turbo/, coverage/, *.generated.*, prisma/generated/
  - [x] 3.4 Add `format` and `format:check` scripts to root package.json (`prettier --write .` / `prettier --check .`)
  - [x] 3.5 Install `eslint-config-prettier` to disable ESLint rules that conflict with Prettier
  - [x] 3.6 Verify `pnpm format:check` reports clean (fix any existing files that fail)

- [x] Task 4: Configure Husky + lint-staged (AC: #3)
  - [x] 4.1 Install husky and lint-staged as root devDependencies
  - [x] 4.2 Run `npx husky init` to create .husky/ directory
  - [x] 4.3 Create `.husky/pre-commit` hook running `npx lint-staged`
  - [x] 4.4 Configure lint-staged in root package.json: `*.{ts,tsx}` runs `eslint --fix` and `prettier --write`; `*.{json,md,yml,yaml}` runs `prettier --write`
  - [x] 4.5 Verify committing a file with lint errors is blocked

- [x] Task 5: Configure commitlint (AC: #4)
  - [x] 5.1 Install `@commitlint/cli` and `@commitlint/config-conventional` as root devDependencies
  - [x] 5.2 Create `commitlint.config.js` extending `@commitlint/config-conventional`
  - [x] 5.3 Create `.husky/commit-msg` hook running `npx commitlint --edit "$1"`
  - [x] 5.4 Verify commit with non-conventional message is rejected
  - [x] 5.5 Verify commit with conventional message (e.g., `feat(e0-4): add eslint config`) is accepted

- [x] Task 6: Update CI integration and verify end-to-end (AC: #1, #2)
  - [x] 6.1 Ensure `turbo lint` in CI (`ci-reusable.yml`) picks up the new ESLint configs
  - [x] 6.2 Add `format:check` step to CI workflow (after lint, before typecheck)
  - [x] 6.3 Run full pipeline locally: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm build`
  - [x] 6.4 Fix any lint/format errors found in existing stub files from E0-1/E0-2/E0-3

## Dev Notes

### Previous Story Intelligence

**From E0-1 (Initialize Monorepo Structure):**
- Manual setup used (not create-turbo template) due to Fastify + Vite + Expo stack
- All workspace packages use `@nexa/` scope (e.g., `@nexa/api`, `@nexa/db`, `@nexa/shared`)
- TypeScript strict mode already configured in `packages/config/typescript/base.json` with: `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`
- Node 22 LTS, pnpm 10.29.3, Turborepo ^2.8.9, TypeScript ^5.7.0
- Explicit deferral: "Do NOT add ESLint/Prettier/Husky in this story — that is Story E0.S4"
- `packages/config/eslint/.gitkeep` placeholder exists — replace with actual config
- `@nexa/config` package.json lint script is `echo 'lint configured in E0.S4'` — must be updated

**From E0-2 (CI/CD Pipeline):**
- CI runs: `turbo lint` → `turbo typecheck` → `turbo test` → `turbo build` (this order)
- CI file: `.github/workflows/ci-reusable.yml` already calls `turbo lint` — new ESLint config will automatically be picked up
- Placeholder lint scripts currently echo success — must be replaced with real `eslint .` calls
- Conventional commit format already used in commits: `feat(e0-1):`, `fix(e0-2):`, `test:`
- Remote caching via TURBO_TOKEN/TURBO_TEAM (opt-in)
- CI uses `pnpm turbo` (not bare `turbo`) — follow same pattern

**From E0-3 (Docker Compose Dev Environment):**
- `.gitignore` already updated with docker patterns
- `.env.example` exists at root with documented variables
- Pattern: CR issues are documented but not all fixed in-story — document remaining issues clearly

### Technology Versions

| Tool | Version | Notes |
|------|---------|-------|
| ESLint | v9+ | Must use flat config format (eslint.config.js), NOT legacy .eslintrc |
| @typescript-eslint | v8+ | Must match ESLint v9 flat config API |
| Prettier | v3+ | Latest stable |
| Husky | v9+ | Uses `husky init` style (not legacy install) |
| lint-staged | v15+ | Latest stable |
| commitlint | v19+ | Latest with conventional commits |
| eslint-plugin-jsx-a11y | latest | For WCAG 2.1 AA (NFR27-30, GAP-1) |
| eslint-config-prettier | latest | Disables conflicting ESLint format rules |

### ESLint Rules — Architecture Enforcement

The following rules MUST be configured based on Architecture anti-patterns and enforcement guidelines:

**HARD enforcement (error severity):**
- `@typescript-eslint/no-explicit-any` — No `any` type (use `unknown` and narrow)
- `no-console` — No `console.log` (use structured Pino logger)
- `@typescript-eslint/consistent-type-imports` — Use `import type` for type-only imports
- `@typescript-eslint/no-unused-vars` — No unused variables (with `_` prefix exception for intentional ignores)
- `@typescript-eslint/naming-convention` — kebab-case files, PascalCase components, camelCase functions/vars, UPPER_SNAKE_CASE constants

**RECOMMENDED for future stories (not E0-4 scope):**
- `import/no-restricted-paths` — Cross-module boundary enforcement (needs module structure from E1+)
- `no-restricted-syntax` for `number` type on monetary values (needs domain context from E1+)
- `import/no-restricted-imports` for direct Anthropic SDK imports from business modules (needs AI Gateway from E1+)

### Cross-Cutting Patterns (MANDATORY)

Every implementation MUST follow these patterns from project-context.md:
- **companyId**: N/A — infrastructure story, no database queries
- **i18n**: N/A — infrastructure story, no user-facing strings
- **Audit**: N/A — infrastructure story, no state-changing operations
- **Attachments/Notes/Tasks**: N/A — infrastructure story

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **Architecture** | §Implementation Patterns — Enforcement Guidelines (13 MUST rules), §Anti-Patterns (no `any`, no `console.log`), §Code Naming Conventions (kebab-case files, PascalCase components), §File Suffixes (.service.ts, .repository.ts, .test.ts), §Test Location (co-located), §Logging (Pino, no console.log) | All linting rules derive from these sections |
| **Architecture** | §Project Structure — packages/config/eslint/ directory, §Starter Template Evaluation — Vitest + Playwright testing stack | ESLint config lives at packages/config/eslint/base.js; Vitest (not Jest) is the test runner |
| **Architecture** | §Validation Results — GAP-1 Accessibility enforcement | Must add `eslint-plugin-jsx-a11y` to ESLint config |
| **API Contracts** | N/A | No endpoints in this story |
| **State Machine** | N/A | No state machines in this story |
| **Event Catalog** | N/A | No events in this story |
| **Data Models** | N/A | No models in this story |
| **Business Rules** | §14 Implicit Rules — IMP-017 (TypeScript strict mode, HARD), IMP-019 (80% test coverage, SOFT) | IMP-017 already enforced via TSConfig; IMP-019 is SOFT enforcement (CI reporting, not hard blocker) |
| **Project Context** | §11 Development Rules — Rule 6 (Claude Opus 4.6), Rule 7 (TDD red-green-refactor) | TDD pattern supported by pre-commit test runs; all coding via Claude Opus 4.6 |
| **PRD** | §NFR41 (TypeScript strict), §NFR43 (80% test coverage), §NFR27 (WCAG 2.1 AA) | NFR41/43 are primary drivers; NFR27 drives jsx-a11y plugin requirement |

### Project Structure Notes

**Files to CREATE:**
```
packages/config/eslint/base.js          # Shared ESLint base config (flat config format)
packages/config/eslint/react.js         # React + jsx-a11y extension
packages/config/eslint/node.js          # Node.js extension
.prettierrc                             # Prettier config
.prettierignore                         # Prettier ignore patterns
.husky/pre-commit                       # Pre-commit hook (lint-staged)
.husky/commit-msg                       # Commit message hook (commitlint)
commitlint.config.js                    # Commitlint config
apps/api/eslint.config.js              # Per-app ESLint config
apps/web/eslint.config.js
apps/mobile/eslint.config.js
apps/platform-api/eslint.config.js
apps/platform-admin/eslint.config.js
packages/db/eslint.config.js            # Per-package ESLint config
packages/shared/eslint.config.js
packages/api-client/eslint.config.js
packages/ai-tools/eslint.config.js
packages/platform-client/eslint.config.js
packages/config/eslint.config.js
```

**Files to MODIFY:**
```
package.json                            # Add format, format:check scripts; add devDependencies (prettier, husky, lint-staged, commitlint); add lint-staged config
packages/config/package.json            # Update lint script, add ESLint deps, add exports field
apps/*/package.json                     # Update lint scripts to "eslint ."
packages/*/package.json                 # Update lint scripts to "eslint ."
.github/workflows/ci-reusable.yml       # Add format:check step (optional — if not already there)
.gitignore                              # Add .husky/_/ if needed
```

**Files to DELETE:**
```
packages/config/eslint/.gitkeep         # Replace with actual config files
```

### Anti-Patterns to AVOID

- **DO NOT use legacy .eslintrc format** — ESLint v9+ uses flat config (eslint.config.js) exclusively
- **DO NOT install Jest** — Vitest is the chosen test runner (per Architecture §Starter Template Evaluation)
- **DO NOT create .eslintignore** — use `ignores` array in flat config instead
- **DO NOT put ESLint config at repo root** — shared config lives in `packages/config/eslint/`, per-workspace configs in each workspace
- **DO NOT use `husky install`** — Husky v9 uses `husky init` (the install command is deprecated)
- **DO NOT add `--no-verify` to any scripts** — git hooks are enforcement, not optional
- **DO NOT configure hard coverage threshold failures in Vitest** — IMP-019 specifies SOFT enforcement (CI reporting, not build-breaking). Coverage thresholds should warn, not fail
- **DO NOT add ESLint rules for cross-module boundaries yet** — module structure doesn't exist until E1+

### What Success Looks Like

1. `turbo lint` runs ESLint across all workspaces with zero errors
2. `pnpm format:check` confirms all files are formatted correctly
3. Committing a file with `any` type is blocked by pre-commit hook
4. Committing with message "fixed stuff" is blocked by commitlint
5. Committing with message `feat(e0-4): add eslint config` succeeds
6. CI pipeline in `ci-reusable.yml` continues to pass with new lint rules
7. All stub `index.ts` files from E0-1 pass lint and format checks

### Source References

- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md §Enforcement Guidelines] — 13 MUST rules, anti-patterns
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md §Code Naming Conventions] — naming convention table
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md §packages/config] — ESLint config directory location
- [Source: _bmad-output/planning-artifacts/architecture/architecture-validation-results.md §GAP-1] — jsx-a11y requirement
- [Source: _bmad-output/planning-artifacts/architecture/starter-template-evaluation.md §Technology Stack] — Vitest (not Jest), ESLint
- [Source: _bmad-output/planning-artifacts/business-rules-compendium.md §14 IMP-017, IMP-019] — TypeScript strict HARD, 80% coverage SOFT
- [Source: _bmad-output/planning-artifacts/project-context.md §11 Development Rules] — TDD, Claude Opus 4.6
- [Source: _bmad-output/planning-artifacts/prd/non-functional-requirements.md §NFR41, NFR43, NFR27] — TypeScript strict, test coverage, WCAG 2.1 AA

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- `auto-bmad_pack/logs/workflow/e0-4-code-quality-standards/` — task 1-6 logs, validation JSONs, code review logs

### Completion Notes List

1. **lint-staged requires `--flag v10_config_lookup_from_file`** — ESLint v9 looks for config in cwd (repo root) by default, but this monorepo has no root `eslint.config.js`. The `v10_config_lookup_from_file` flag makes ESLint look for config starting from each file's directory (the v10 default), which is required for per-workspace configs in a pnpm monorepo. This flag will become unnecessary when ESLint v10 is released.
2. **Used `strictTypeChecked` preset** — `tseslint.configs.strictTypeChecked` (not `strict`) is used to leverage the type-aware parser infrastructure (`projectService: true`). JS config files use `tseslint.configs.disableTypeChecked` to avoid type-checking errors on non-TS files.
3. **`eslint-plugin-n` used for `no-process-exit`** — The built-in ESLint `no-process-exit` rule is deprecated since v7 and removed in v11. Using `n/no-process-exit` from `eslint-plugin-n` instead.
4. **Naming convention shared via `baseNamingConvention` export** — `packages/config/eslint/base.js` exports `baseNamingConvention` array. `react.js` extends it with targeted `.map()` overrides for PascalCase on `variable` and `function` selectors, avoiding full duplication.
5. **Enum rule recommends union types only** — `const enum` is incompatible with `isolatedModules: true` (Vite/esbuild), so the lint message guides developers to union types exclusively.
6. **CI change limited to adding `format:check` step** — Only the `format:check` step was added to `ci.yml` (Task 6.2). No other CI/CD workflow refactoring included.

### File List

**Created:**
- `packages/config/eslint/base.js` — Shared ESLint base config (strictTypeChecked + flat config)
- `packages/config/eslint/react.js` — React + jsx-a11y + React Hooks extension
- `packages/config/eslint/node.js` — Node.js extension (eslint-plugin-n)
- `.prettierrc` — Prettier config
- `.prettierignore` — Prettier ignore patterns
- `.husky/pre-commit` — Pre-commit hook (lint-staged)
- `.husky/commit-msg` — Commit message hook (commitlint)
- `commitlint.config.js` — Commitlint config (conventional commits)
- `apps/api/eslint.config.js` — Per-app ESLint (node)
- `apps/web/eslint.config.js` — Per-app ESLint (react)
- `apps/mobile/eslint.config.js` — Per-app ESLint (react)
- `apps/platform-api/eslint.config.js` — Per-app ESLint (node)
- `apps/platform-admin/eslint.config.js` — Per-app ESLint (react)
- `packages/db/eslint.config.js` — Per-package ESLint (node)
- `packages/shared/eslint.config.js` — Per-package ESLint (node)
- `packages/api-client/eslint.config.js` — Per-package ESLint (node)
- `packages/ai-tools/eslint.config.js` — Per-package ESLint (node)
- `packages/platform-client/eslint.config.js` — Per-package ESLint (node)
- `packages/config/eslint.config.js` — Per-package ESLint (node)

**Modified:**
- `package.json` — Added format/format:check scripts, husky prepare, lint-staged config, devDependencies
- `packages/config/package.json` — Updated lint script, added ESLint/plugin dependencies, added exports
- `apps/*/package.json` — Updated lint scripts to `eslint .`, added @nexa/config + eslint devDependencies
- `packages/*/package.json` — Updated lint scripts to `eslint .`, added @nexa/config + eslint devDependencies
- `.github/workflows/ci.yml` — Added `format:check` step after lint
- `.gitignore` — Added docker-compose.override.yml pattern
- `pnpm-lock.yaml` — Updated with new dependencies

**Deleted:**
- `packages/config/eslint/.gitkeep` — Replaced with actual config files


## Code Review Notes (Auto-Generated)

**Status:** Completed with remaining issues after 3 CR iterations

**Date:** 2026-02-18 11:57

### Remaining Issues for Human Review:

- - **ISSUE #1: [HIGH] CI pipeline is duplicated — `ci.yml` inlines all steps while `ci-reusable.yml` duplicates them.** The main `ci.yml` still has all CI steps inline (112 lines) while the new `ci-reusable.yml` (68 lines) was created as a reusable workflow. Staging and production correctly call the reusable workflow, but the main `ci.yml` does NOT. This means two places to maintain CI step definitions. If a new CI step is added (e.g., E2E tests), it must be updated in both `ci.yml` AND `ci-reusable.yml` or they will drift. The `ci.yml` should call `ci-reusable.yml` too, or `ci-reusable.yml` should be deleted and the deploy workflows should inline CI steps.
- - **ISSUE #2: [HIGH] `turbo.json` lint task uses `dependsOn: ["^lint"]` which creates unnecessary dependency chains.** This means linting a package waits for all its dependency packages to lint first. Lint is a static analysis tool — it does NOT require dependencies to be linted first (unlike build). This adds serial latency to what should be a fully parallelizable task. The original `"lint": {}` with no dependencies was correct. This change slows down CI for no benefit.
- - **ISSUE #3: [HIGH] `lint-staged` uses `--flag v10_config_lookup_from_file` which is an ESLint v10 experimental flag on an ESLint v9 installation.** The root `package.json` specifies `eslint: ^9.39.2`. The `v10_config_lookup_from_file` flag is an ESLint v10 experimental feature. If ESLint v9 doesn't recognize this flag, `lint-staged` will fail on every commit. If it silently succeeds now, it's relying on undocumented forward-compatibility that could break. This flag needs verification — either it works on v9.39+ or it should be removed.
- - **ISSUE #4: [MEDIUM] Production deploy workflow has contradictory comment and active `environment: production` line.** Lines 40–46 of `deploy-production.yml` say "TODO: Configure GitHub Environment... When configured, uncomment the line below: `# environment: production`" — but then line 46 already has `environment: production` UNCOMMENTED. The TODO comment is stale and misleading. Either remove the comment or comment out the environment line.
- - **ISSUE #5: [MEDIUM] `ci-reusable.yml` coverage summary step has hardcoded stale message while `ci.yml` has full dynamic coverage parsing.** The reusable workflow (used by staging/production) has a dumbed-down coverage summary that just says "_No coverage reports generated..._". The main `ci.yml` has a proper dynamic script that parses `coverage-summary.json` files per package. When tests eventually produce coverage, the reusable workflow won't report it. The two CI files have diverged in capability.
- - **ISSUE #6: [MEDIUM] No `.css`, `.html`, `.graphql`, or `.prisma` file patterns in `lint-staged`.** The `lint-staged` config only handles `*.{ts,tsx}` and `*.{json,md,yml,yaml}`. CSS, HTML, GraphQL schemas, and other Prettier-supported formats will bypass pre-commit formatting. As the project grows with actual frontend code, CSS files will silently skip formatting on commit.
- - **ISSUE #7: [MEDIUM] The `@nexa/config` package `exports` field maps `./typescript/*` but no TypeScript config files exist yet.** The `exports` field in `packages/config/package.json` declares `"./typescript/*": "./typescript/*"` but there's no `typescript/` directory in the config package. This is a premature export — it will produce confusing "module not found" errors if anyone tries to import from it.
- - **ISSUE #8: [MEDIUM] ESLint base config bans enums via `no-restricted-syntax` on `TSEnumDeclaration`, but this is redundant with `strictTypeChecked` and adds a custom error message that may confuse.** The `no-restricted-syntax` selector approach catches enum declarations, but `@typescript-eslint/no-unsafe-enum-comparison` from `strictTypeChecked` already flags enum usage patterns. More importantly, the custom message says "const enums are incompatible with isolatedModules" — but the rule bans ALL enums including non-const ones, so the message is misleading for regular enum declarations that ARE compatible with isolatedModules.
- - **ISSUE #9: [LOW] `branch-protection.json` formatting change is cosmetic and unrelated to code quality standards.** The JSON formatting of `required_status_checks` was changed from multi-line to single-line. This is a Prettier auto-format side effect that should have been in a separate commit or at least acknowledged. It pollutes the diff for this story.
- - **ISSUE #10: [LOW] `CLAUDE.md` changes are pure whitespace (blank lines before lists).** The CLAUDE.md diff adds blank lines before markdown list items — purely cosmetic Prettier reformatting. These changes are noise in a code quality story and should be either committed separately or the file should be in `.prettierignore` since it's a project instructions file.
- - **ISSUE #11: [LOW] `packages/config/eslint.config.js` uses `createNodeConfig` to lint itself, but the config package is not a Node.js application — it's a shared config package containing only `.js` config files.** The Node.js config adds `eslint-plugin-n` rules like `n/no-process-exit` which are irrelevant for ESLint config files. A simpler config (or even the base config) would be more appropriate.
- - **ISSUE #12: [LOW] `.prettierignore` excludes `docs/` directory entirely.** The `docs/` directory likely contains markdown documentation that SHOULD be formatted consistently. Blanket-ignoring the entire docs directory means documentation prose will have inconsistent formatting over time. If specific generated files need ignoring, those should be targeted rather than the whole directory.
- **3 HIGH, 5 MEDIUM, 4 LOW issues found**

---

