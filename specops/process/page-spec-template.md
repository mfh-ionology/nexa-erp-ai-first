# Page Spec: {PAGE NAME}

**Module:** {MODULE CODE}
**Page Type:** List + Detail / List + Form / Dashboard
**Priority:** Core / Secondary / Deferred
**Depends on:** {list any settings or other pages that must exist first}
**HansaWorld reference:** `legacy-src/c8520240417/hal/WActions/{PREFIX}VcWAction.hal`, `RActions/{PREFIX}VcRAction.hal`

---

## 1. Overview

{One paragraph: what this page does, who uses it, why it matters.}

---

## 2. Database Tables

### 2.1 Primary Table: `{EntityName}`

| Field     | Type     | Required | Default | Indexed | Notes                          |
| --------- | -------- | -------- | ------- | ------- | ------------------------------ |
| id        | UUID     | Yes      | auto    | PK      |                                |
| companyId | UUID     | Yes      | —       | Yes     | FK → Company, tenant isolation |
|           |          |          |         |         |                                |
| createdAt | DateTime | Yes      | now()   |         |                                |
| updatedAt | DateTime | Yes      | now()   |         |                                |
| createdBy | UUID     | Yes      | —       |         | FK → User                      |
| updatedBy | UUID     | Yes      | —       |         | FK → User                      |

**Relations:**

- {e.g., belongsTo Customer, hasMany InvoiceLine}

### 2.2 Line Item Table: `{EntityLineName}` (if applicable)

| Field      | Type | Required | Default | Notes              |
| ---------- | ---- | -------- | ------- | ------------------ |
| id         | UUID | Yes      | auto    | PK                 |
| {parentId} | UUID | Yes      | —       | FK → parent entity |
| sortOrder  | Int  | Yes      | 0       | line ordering      |
|            |      |          |         |                    |

### 2.3 Computed / Hidden Tables (if any)

{Tables maintained by the system, not directly visible in UI.}
{e.g., aging buckets, running balances, summary caches.}
{Describe: what triggers updates, what data is stored, what reads from it.}

### 2.4 Settings & LOV Dependencies

**This section MUST be completed before the backend task starts.** Every dropdown, default value, and configurable behaviour on this page depends on settings and LOVs being defined and seeded.

| Setting / LOV | Used For                                   | UI Control                | Seed Data Source                                                           | HansaWorld Reference      |
| ------------- | ------------------------------------------ | ------------------------- | -------------------------------------------------------------------------- | ------------------------- |
|               | {which field or behaviour depends on this} | dropdown / radio / config | {where initial values come from: HW manual, HW code, business requirement} | {HAL file or manual page} |

{Example for Sales Invoice:}
{| PaymentTerm | Payment terms dropdown on invoice header | dropdown | HW manual: Sales → Settings → Payment Terms | `amaster/datadef.hal` → PayTermVc |}
{| NumberSeries | Auto-generated invoice number (INV-00001) | auto | System seed: one series per document type | `CYBlock` in datadef.hal |}
{| PriceList | Determines which prices to use for line items | lookup | User-created — no seed data | HW manual: Sales → Settings → Price Lists |}
{| VATCode | VAT rate applied to each line item | dropdown | UK standard codes: S/Z/E/RS/RC | `amaster/datadef.hal` → VATCodeVc |}
{| CustomerGroup | Customer classification affecting pricing/reporting | dropdown | User-defined — suggest defaults | HW manual: Sales → Settings → Customer Categories |}

**How to populate this table:**

1. List every dropdown, lookup, and configurable default on this page
2. For each one, check the HansaWorld manual (`https://hansaworldmanuals.com` → module → settings) for what options exist
3. Check the HAL source (`legacy-src/c8520240417/hal/RActions/{PREFIX}VcRAction.hal` → `RecordDefaults()`) for what defaults are set on record creation
4. Check the HAL source (`hal/WActions/{PREFIX}VcWAction.hal` → field EFAfter handlers) for what lookups fire when fields change
5. Document the seed data: what values ship with the system vs what the user creates

**Settings must be built and seeded (via `{MOD}-BE-settings` task) BEFORE any page backend task starts.**

---

## 3. API Endpoints

### 3.1 List

```
GET /api/v1/{module}/{entities}
```

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number (default 1) |
| limit | number | Items per page (default 25, max 100) |
| sortBy | string | Field to sort by (default: createdAt) |
| sortOrder | asc/desc | Sort direction (default: desc) |
| search | string | Full-text search across {fields} |
| status | string | Filter by status |
| {field} | string | Filter by specific field |

**Response:** `{ data: [...], total: number, page: number, limit: number }`

### 3.2 Get by ID

```
GET /api/v1/{module}/{entities}/:id
```

**Response:** Full entity with relations ({list which relations to include})

### 3.3 Create

```
POST /api/v1/{module}/{entities}
```

**Body:** {list required and optional fields}
**Side effects:** {e.g., update stock levels, create GL entries, update aging}

### 3.4 Update

```
PATCH /api/v1/{module}/{entities}/:id
```

**Body:** {list updatable fields}
**Restrictions:** {e.g., cannot update after posting, cannot change customer after lines exist}

### 3.5 Delete

```
DELETE /api/v1/{module}/{entities}/:id
```

**Restrictions:** {e.g., only draft status, no linked transactions}
**Soft/Hard:** {soft delete (set deletedAt) or hard delete}

### 3.6 Custom Actions (if any)

{e.g., POST .../post, POST .../reverse, POST .../duplicate}

---

## 4. Record Lifecycle Rules

_Inspired by HansaWorld RActions — defines what happens at each stage of a record's life._

### 4.1 Defaults (on create)

{What fields are auto-populated when a new record is created?}

| Field | Default Value | Source                                                         |
| ----- | ------------- | -------------------------------------------------------------- |
|       |               | e.g., from company settings, from user preferences, calculated |

### 4.2 Validation (before save)

{Business rules checked before the record can be saved. If any fail, save is blocked.}

| Rule | Error Message | Blocking |
| ---- | ------------- | -------- |
|      |               | Yes/No   |

### 4.3 Pre-Save Logic

{What happens just before the record is written to the database?}
{e.g., calculate totals, set computed fields, reserve stock}

### 4.4 Post-Save Side Effects

{What happens after the record is successfully saved?}
{e.g., create GL entries, update aging table, send notification, create linked records}

| Side Effect | Condition | Description |
| ----------- | --------- | ----------- |
|             |           |             |

### 4.5 Delete Guard

{When can a record NOT be deleted?}
{e.g., has linked payments, has been posted, is referenced by other records}

### 4.6 Post-Delete Cleanup

{What happens after deletion?}
{e.g., reverse GL entries, release reserved stock, update balances}

---

## 5. Field Cascading Rules

_Inspired by HansaWorld WActions — defines what happens when a user changes a field value on the form._

| When Field Changes | Then Update | Logic                                                                                        |
| ------------------ | ----------- | -------------------------------------------------------------------------------------------- |
|                    |             | e.g., "Look up customer's default price list, payment terms, VAT code, and shipping address" |

{Example for a Sales Invoice:}
{- Customer selected → populate: payment terms, price list, currency, billing address, shipping address, VAT code}
{- Item selected on line → populate: description, UOM, price (from customer's price list), VAT code, account}
{- Quantity changed → recalculate: line amount = qty × price - discount}
{- Any line changed → recalculate: invoice total, VAT total, grand total}

---

## 6. Status Flow & Transitions (if applicable)

### 6.1 Status Diagram

```
{Status A} → {Status B} → {Status C}
                ↘ {Status D}
```

### 6.2 Transition Rules

| From | To  | Trigger       | Conditions | Required Fields | Side Effects | Roles Allowed |
| ---- | --- | ------------- | ---------- | --------------- | ------------ | ------------- |
|      |     | button / auto |            |                 |              |               |

---

## 7. Notifications (if applicable)

| Event | Channel        | Recipients            | Template           |
| ----- | -------------- | --------------------- | ------------------ |
|       | in-app / email | role or specific user | {message template} |

---

## 8. Frontend — List Page

### 8.1 Columns

| Column | Field | Width | Sortable | Format |
| ------ | ----- | ----- | -------- | ------ |
|        |       |       |          |        |

### 8.2 Filters

| Filter | Field | Type                           | Options/Source |
| ------ | ----- | ------------------------------ | -------------- |
|        |       | text / date / dropdown / range |                |

### 8.3 Status Tabs (if applicable)

| Tab | Filter Value | Badge Count |
| --- | ------------ | ----------- |
| All | —            | total       |
|     |              |             |

### 8.4 Action Bar

- **Primary action:** {e.g., "+ New Invoice"}
- **Row actions:** {e.g., View, Edit, Delete, Duplicate}
- **Bulk actions:** {e.g., Batch delete, Batch post}

---

## 9. Frontend — Detail / Form Page

### 9.1 Field Layout

**Section: {Section Name}**

| Field | Type                                                  | Required | Source                                                       | Validation |
| ----- | ----------------------------------------------------- | -------- | ------------------------------------------------------------ | ---------- |
|       | text / number / date / dropdown / lookup / calculated |          | manual / LOV:{name} / lookup:{entity} / calculated:{formula} |            |

**Section: {Line Items}** (if applicable)

| Column | Type | Required | Source | Cascading                    |
| ------ | ---- | -------- | ------ | ---------------------------- |
|        |      |          |        | see §5 Field Cascading Rules |

### 9.2 Actions per Status

| Status | Available Actions |
| ------ | ----------------- |
|        |                   |

### 9.3 Related Data Displayed

{e.g., Payment history panel, Stock level indicator, Activity timeline}

---

## 10. Happy Path Scenario

_One end-to-end walkthrough of the main use case for this page._

**Scenario:** {e.g., "Create and post a sales invoice"}

| Step | Actor | Action | Expected Result |
| ---- | ----- | ------ | --------------- |
| 1    |       |        |                 |
| 2    |       |        |                 |
| 3    |       |        |                 |

---

## 11. HansaWorld Reference

{Which HAL files to consult for business logic reference:}

- **Form:** `hal/Documents/{PREFIX}Form.hal`
- **Window Actions:** `hal/WActions/{PREFIX}VcWAction.hal`
- **Record Actions:** `hal/RActions/{PREFIX}VcRAction.hal`
- **Reports:** `hal/Reports/{PREFIX}Rn.hal`
- **Manual:** `https://hansaworldmanuals.com` → {module} → {feature}

---

## 12. Tasks Generated from This Spec

Each page produces **2 tasks** — one backend, one frontend:

| Task ID         | Layer    | Description                                                                                                                          | Status |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| {MOD}-BE-{page} | DB + API | Schema, migration, seed data, CRUD endpoints, record lifecycle rules, field cascading logic, status transitions, side effects, tests |        |
| {MOD}-FE-{page} | Frontend | List page, detail/form page, field cascading UI, status flow UI, API integration, i18n, visual design                                |        |

**Why 2 tasks, not 6:** The DB schema and API are tightly coupled — the API developer needs to design both together because business logic (validation, defaults, cascading, side effects) spans both layers. Similarly, the frontend list and form pages share state and interact with each other, so they belong in one task.

**Backend must be complete and tested before frontend starts.**
