# Phase Protocol (mandatory for all phases)

## Evidence requirements (per phase)
- Evidence folder name: `reports/verification/<phase-id>-YYYYMMDD-HHMMSS/`
- Must contain:
  - `SUMMARY.md` (human-readable status)
  - `summary.json` (machine-readable; fields below)
  - `logs/` (at least one file)
  - `artifacts/` (at least one file)
- Verify/B phases: include determinism note (log or `summary.json` entry) and repeatability evidence if reruns were executed.

## Mandatory summary.json fields
- `phaseId`: string
- `verdict`: `PASS` | `FAIL` | `UNKNOWN`
- `scope`: description of what the phase covers
- `checksRun`: array of checks/tests executed
- `evidencePaths`: object of key evidence paths
- `blockers`: array of blocker strings (empty if none)
- `nextActions`: array of follow-up items (empty if none)

## Ledger updates
- Every phase run must update `docs/verification/PHASE-LEDGER.md` and `PHASE-LEDGER.json` via the ledger builder.
- Ledger must record: `phase_id`, timestamp, verdict, evidence path, and presence of required files.

## Stop condition per phase
- At phase end, output the evidence folder path and a concise PASS/FAIL summary.
- Do **not** claim PASS if any required check or evidence element is missing.

## Protocol verifier
- `verify:phase-protocol` must fail if:
  - Required evidence files are missing for any ledger entry, or
  - Any Phase 1 entry (phase-1*) has verdict `FAIL` or `UNKNOWN`.

