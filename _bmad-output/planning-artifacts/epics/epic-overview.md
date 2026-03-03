# Epic Overview

## Tier 0: Foundation (No UX Required)
| Epic | Name | Dependencies | Key FRs |
|------|------|-------------|---------|
| E0 | Monorepo + DevOps | — | Infrastructure only |
| E1 | Database + Core Models | E0 | FR80, FR84, FR171–FR177; Platform: FR193–FR197 |
| E2 | API Server + Auth + Multi-Company RBAC | E1 | FR80–FR83, FR178–FR180 |
| E2b | Granular RBAC & Access Groups | E2 | FR81, FR175–FR177 (extended) |
| E3 | Event Bus + Audit Trail | E2 | FR88 |
| E3b | Platform API + AI Gateway | E1 | FR198–FR207 |

## Tier 1: Core Platform
| Epic | Name | Dependencies | Key FRs |
|------|------|-------------|---------|
| E4 | i18n Infrastructure | E2 | FR181–FR184 |
| E5 | AI Orchestration | E3b, E4 | FR1–FR10, FR153–FR163 |
| E6 | Web Frontend Shell + Mobile Scaffold | E2, E4 | UX infrastructure |
| E7 | Saved Views / Filters / Columns | E6 | FR86 |
| E8 | Attachments + Notes + Record Links | E6 | FR85, FR87 |
| E9 | Notifications | E3, E6 | FR185–FR187 |
| E10 | Email Integration | E9 | FR188–FR189 |
| E11 | Cross-cutting Tasks | E6 | FR190–FR192 |
| E12 | Document Templates & PDF | E6 | FR79, FR85 |
| E13 | Printer Management | E12 | FR192 |
| E13b | Platform Admin Portal | E3b, E6 | FR208–FR222 |

## Tier 2: First Business Module
| Epic | Name | Dependencies | Key FRs |
|------|------|-------------|---------|
| E14 | Finance / NL (GL) | E3, E4, E6, E8 | FR11–FR18 |

## Tier 3: Business Modules (each ends with Mobile Adaptation story)
| Epic | Name | Dependencies | Key FRs |
|------|------|-------------|---------|
| E15 | Inventory | E14 | FR46–FR53 |
| E16 | Sales Orders | E14, E15 | FR33–FR40 |
| E17 | Sales Ledger / AR | E14 | FR19–FR25 |
| E18 | Purchase Orders | E14, E15 | FR41–FR45 |
| E19 | Purchase Ledger / AP | E14, E18 | FR26–FR32 |
| E20 | Document Understanding | E5, E19 | FR164–FR170 |
| E21 | CRM | E14, E17 | FR54–FR60, FR95–FR100 |
| E22 | Fixed Assets | E14 | FR89–FR94 |
| E23 | HR / Payroll | E14 | FR61–FR67, FR101–FR108 |
| E24 | Manufacturing / MRP | E14, E15 | FR68–FR73, FR109–FR114 |
| E25 | Reporting Engine | E14+ | FR74–FR79 |

## Phase 2+ Modules
| Epic | Name | Dependencies | Key FRs |
|------|------|-------------|---------|
| E26a | Warehouse Management | E15 | FR135–FR140 |
| E26b | POS | E14, E15, E17 | FR116–FR122 |
| E26c | Projects & Job Costing | E14, E17 | FR123–FR129 |
| E26d | Contracts & Agreements | E14, E17 | FR130–FR134 |
| E26e | Service Orders & Timekeeper | E14, E15 | FR149–FR152 |
| E26f | Intercompany & Consolidation | E14 | FR141–FR144 |
| E26g | Communications (Chat & Conference) | E9, E10 | FR145–FR148 |
| E27+ | Platform Admin Phase 2 | E13b | Auto-provisioning, Stripe, GDPR |

---

## Epic Descriptions

### E2b: Granular RBAC & Access Groups

**Tier:** 0 (Foundation) | **Dependencies:** E2 | **Dependents:** All business module epics (E14+)

Replaces the fixed 5-role hierarchy (`SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER`) with custom **Access Groups** for page/action/field-level permission control. Users are assigned one or more access groups per company; permissions merge with a most-permissive-wins rule. `SUPER_ADMIN` remains as a system-level bypass.

**Key Deliverables:**
- `Resource` table — registry of all controllable pages, reports, settings, and maintenances
- `AccessGroup` CRUD — admin UI to create, clone, and modify access groups per company
- `AccessGroupPermission` matrix — per resource: `canAccess`, `canNew`, `canView`, `canEdit`, `canDelete`
- `AccessGroupFieldOverride` — sparse field-level visibility: `VISIBLE`, `READ_ONLY`, `HIDDEN`
- `createPermissionGuard()` middleware — replaces `createRbacGuard()` for route-level enforcement
- `filterFieldsByPermission()` response hook — strips/marks fields based on group overrides
- Default data file (`packages/db/default-data/company-defaults.json`) — seeded on company creation with pre-built access groups (Full Access, Sales Manager, Finance Clerk, etc.)
- 12 pre-built access groups shipped as `isSystem: true` defaults

**Design Document:** `docs/plans/2026-02-19-granular-rbac-access-groups-design.md`

---

<!-- TIER 0 BEGINS -->