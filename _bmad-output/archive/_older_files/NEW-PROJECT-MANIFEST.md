# New Project Document Manifest

> **Purpose:** Checklist of documents to copy to the new AI-first ERP project.
> **Generated:** 2026-02-03
> **Source Project:** `nexa-erp-local-main`

---

## COPY TO NEW PROJECT → `_bmad-output/planning-artifacts/`

These are the foundation documents for PRD and Architecture creation.

### Core Requirements (MUST COPY)

| # | File | Size | Description |
|---|---|---|---|
| 1 | `nexa-erp-business-rules-requirements.md` | 612K | **THE core document.** 10,789 lines. Complete extraction of all business rules, entities, validations, APIs, status lifecycles, and gaps from the current ERP. Includes 72 contradiction resolutions and 33 MUST-HAVE feature additions. |
| 2 | `extraction-completeness-report.md` | 74K | Market research against 13 competitors. Classifies all content. Identifies 120 missing features (33 MUST, 55 SHOULD, 32 COULD). Competitor feature matrices. Prioritized addition list. |
| 3 | `extraction-contradictions-report.md` | 44K | Documents all 72 contradictions found and how they were resolved. Serves as audit trail for design decisions made during extraction. |

**Source path:** `_bmad-output/planning-artifacts/`

### Vision Document (MUST COPY)

| # | File | Size | Description |
|---|---|---|---|
| 4 | `ai-first-erp-vision-summary.md` | 6.2K | The AI-first ERP vision with perspectives from PM, Architect, UX Designer, and Business Analyst. Defines the product positioning, competitive advantage, and interaction paradigm. |

**Source path:** `_bmad-output/`

---

## REFERENCE ONLY — DO NOT COPY

These stay in the old project. Agents can read them from the old repo if needed during PRD/Architecture creation, but they are NOT part of the new project.

### Old Project Module Status

| File | Why Reference Only |
|---|---|
| `erp-module-status-summary.md` | Summarizes old project's module completion %. Useful context but superseded by the business rules extraction. |

### Old Project Specs (`_Old_Spec/`)

The entire `_Old_Spec/` directory (237 files) contains the old project's specifications, phase plans, verification docs, and compliance stubs. These are:
- **Architecture, phase plans, verification docs** — specific to old monolithic shared-DB architecture
- **Compliance stubs** — mostly placeholder files (41-90 bytes each)
- **AI engine docs** — v2.0-2.3 specs for the old read-only AI engine
- **Module specs** — brief stubs, all superseded by the business rules extraction

**Selectively useful as reference:**
- `_Old_Spec/docs/nexa/SCALE-DESIGN.md` (28K) — scaling patterns, some may apply
- `_Old_Spec/docs/nexa/currencies-fx-timezones.md` (8.7K) — FX/timezone handling considerations
- `_Old_Spec/docs/nexa/commercial/pricing-plans.md` (4.6K) — pricing model ideas
- `_Old_Spec/docs/nexa/commercial/gtm-overview.md` (8.5K) — go-to-market thinking
- `_Old_Spec/docs/legal/gdpr-overview.md` (2.9K) — GDPR compliance notes
- `_Old_Spec/docs/legal/sub-processors.md` (2.1K) — sub-processor list
- `_Old_Spec/apps/web/docs/nexa/rbac-matrix.md` (2.6K) — RBAC permission matrix
- `_Old_Spec/apps/web/docs/flows/` — business process flows (quote-to-cash, procure-to-pay, payroll-run)

> **Recommendation:** Don't copy these. When the Architect or PM agent needs them, they can read from the old repo path. Copying creates confusion about what's "current" vs "legacy".

### Old Project Docs (`docs/`)

152 files in the old project's `docs/` directory. Mostly operational docs, runbooks, and verification results. Not relevant to the new project except as historical reference.

### Old Project Plans (`PLANS/`)

5 phase plan files (PHASE0-4). These reflect the old project's 7-phase waterfall approach with 24 modules. Completely superseded by the new 5-module AI-first approach.

---

## NEW PROJECT FOLDER STRUCTURE

When you create the new project, set up BMAD and create this structure:

```
new-project/
├── _bmad/                          ← BMAD installation (run installer)
├── _bmad-output/
│   ├── planning-artifacts/
│   │   ├── nexa-erp-business-rules-requirements.md    ← COPY #1
│   │   ├── extraction-completeness-report.md          ← COPY #2
│   │   ├── extraction-contradictions-report.md        ← COPY #3
│   │   ├── ai-first-erp-vision-summary.md             ← COPY #4
│   │   ├── prd.md                                     ← TO BE CREATED (next step)
│   │   └── architecture.md                            ← TO BE CREATED (after PRD)
│   └── implementation-artifacts/                       ← Empty for now
└── docs/                                               ← Empty for now
```

---

## QUICK COPY COMMANDS

Once you have the new project created:

```bash
# Set these to your paths
OLD_PROJECT="/path/to/nexa-erp-local-main"
NEW_PROJECT="/path/to/new-project"

# Create directories
mkdir -p "$NEW_PROJECT/_bmad-output/planning-artifacts"
mkdir -p "$NEW_PROJECT/_bmad-output/implementation-artifacts"
mkdir -p "$NEW_PROJECT/docs"

# Copy the 4 foundation documents
cp "$OLD_PROJECT/_bmad-output/planning-artifacts/nexa-erp-business-rules-requirements.md" \
   "$NEW_PROJECT/_bmad-output/planning-artifacts/"

cp "$OLD_PROJECT/_bmad-output/planning-artifacts/extraction-completeness-report.md" \
   "$NEW_PROJECT/_bmad-output/planning-artifacts/"

cp "$OLD_PROJECT/_bmad-output/planning-artifacts/extraction-contradictions-report.md" \
   "$NEW_PROJECT/_bmad-output/planning-artifacts/"

cp "$OLD_PROJECT/_bmad-output/ai-first-erp-vision-summary.md" \
   "$NEW_PROJECT/_bmad-output/planning-artifacts/"
```

---

## NEXT STEPS (in new project)

1. Install BMAD in new project
2. Create PRD using PM agent → `/bmad-bmm-create-prd`
3. Create Architecture using Architect agent → `/bmad-bmm-create-architecture`
4. Create Epics & Stories → `/bmad-bmm-create-epics-and-stories`
5. Implementation Readiness Check → `/bmad-bmm-check-implementation-readiness`
