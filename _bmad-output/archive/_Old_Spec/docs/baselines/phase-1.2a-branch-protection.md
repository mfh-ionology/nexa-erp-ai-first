# Phase 1.2a Branch Protection – main

Baseline: `phase-1.2a-baseline` @ 6d851d302c057c66fdaace39737b9662ec9f1232  
Evidence: `reports/verification/phase-1.2a-lock-20260105-155338`

## Required protections (applied via GitHub API)
- Protect branch: `main`
- Require pull request before merging
- Require ≥1 approving review
- Dismiss stale approvals on new commits
- Require status checks to pass (strict/up-to-date)
  - Required contexts: `api-ci`, `web-release`
- Require branches to be up to date before merging (strict=true)
- Require conversation resolution
- Enforce admins
- Disallow force pushes
- Disallow deletions
- Required linear history
- Required signatures: currently disabled (enable if org policy mandates)
- Restrictions: none (no push allowlist configured)

## How check names were chosen
- Workflow list: see `reports/verification/phase-1.2a-lock-20260105-155338/34.workflows.ls.txt`
- Scan of workflow names/jobs: `reports/verification/phase-1.2a-lock-20260105-155338/35.workflow.scan.txt`
- Required contexts set to the primary CI workflows:
  - `api-ci`
  - `web-release`
If additional checks are added later, repeat the scan and update the required contexts accordingly.

## Verification evidence
- API apply + reads:
  - `reports/verification/phase-1.2a-lock-20260105-155338/44.protection.after.json`
  - `reports/verification/phase-1.2a-lock-20260105-155338/45.required_checks.json`
  - `reports/verification/phase-1.2a-lock-20260105-155338/46.required_reviews.json`
- Repo + head:
  - `.../31.remote.txt`, `.../32.branch.txt`, `.../33.head.txt`

## How to adjust (if needed)
1) Update required contexts:
   ```bash
   gh repo view --json nameWithOwner -q .nameWithOwner
   gh api repos/<owner>/<repo>/branches/main/protection -X PUT -H "Accept: application/vnd.github+json" --input protection.json
   ```
   Where `protection.json` mirrors the structure in `44.protection.after.json`, changing `contexts` as needed.
2) If GitHub CLI is unavailable, use GitHub UI:
   - Settings → Branches → Add rule for `main`
   - Enable: Require pull request, approvals (≥1), dismiss stale reviews, require status checks (strict), require conversation resolution, linear history, block force pushes/deletions.
   - Select required checks: `api-ci`, `web-release`.

