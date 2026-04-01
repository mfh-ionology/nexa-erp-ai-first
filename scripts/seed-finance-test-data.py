#!/usr/bin/env python3
"""
Seed comprehensive Finance test data for Nexa ERP.

Creates: dimension types/values, mandatory dimension assignments, fiscal year,
opening balances, 12 months of journals (10 per month = 120 total), bank account
with imported statement, 20 simulations, budget version + budget, VAT returns,
then runs and prints all reports.

Usage:
    python3 scripts/seed-finance-test-data.py
"""

import json
import sys
import time

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE = "http://localhost:5100"
DELAY = 1.0  # seconds between API calls
MAX_RETRIES = 3  # retries on 429

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

print("=" * 60)
print("NEXA ERP — Finance Test Data Seeder")
print("=" * 60)
print()

print("[AUTH] Logging in...")
login_resp = requests.post(
    f"{BASE}/auth/login",
    json={"email": "admin@nexa-erp.dev", "password": "NexaDev2026!"},
)
if login_resp.status_code != 200:
    print(f"FATAL: Login failed: {login_resp.status_code} {login_resp.text[:300]}")
    sys.exit(1)

login_data = login_resp.json()
TOKEN = login_data["data"]["accessToken"]
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
print(f"[AUTH] Logged in successfully. Token: {TOKEN[:20]}...")
print()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

call_count = 0


def _retry_on_429(fn):
    """Wrapper that retries on 429 with the delay the server specifies,
    and also handles connection errors gracefully."""
    import re as _re
    for attempt in range(MAX_RETRIES + 1):
        try:
            resp = fn()
        except requests.exceptions.ConnectionError:
            if attempt < MAX_RETRIES:
                wait = 5 * (attempt + 1)
                print(f"    [CONN] Connection error, waiting {wait}s (attempt {attempt+1}/{MAX_RETRIES})...")
                time.sleep(wait)
                continue
            print("    [CONN] Connection error — server may be down. Aborting.")
            raise
        if resp.status_code == 429:
            # Parse retry delay from response
            try:
                body = resp.json()
                msg = body.get("error", {}).get("message", "")
                m = _re.search(r"retry in (\d+)", msg)
                wait = int(m.group(1)) + 1 if m else 10
            except Exception:
                wait = 10
            print(f"    [429] Rate limited, waiting {wait}s (attempt {attempt+1}/{MAX_RETRIES})...")
            time.sleep(wait)
            continue
        return resp
    return resp  # Return last response even if still 429


def api_get(path, params=None):
    global call_count
    call_count += 1
    time.sleep(DELAY)
    url = f"{BASE}/finance{path}"
    return _retry_on_429(lambda: requests.get(url, headers=HEADERS, params=params))


def api_post(path, body=None):
    global call_count
    call_count += 1
    time.sleep(DELAY)
    url = f"{BASE}/finance{path}"
    # When body is None, send {} to avoid "body cannot be empty" with content-type json
    send_body = body if body is not None else {}
    return _retry_on_429(lambda: requests.post(url, headers=HEADERS, json=send_body))


def api_put(path, body=None):
    global call_count
    call_count += 1
    time.sleep(DELAY)
    url = f"{BASE}/finance{path}"
    send_body = body if body is not None else {}
    return _retry_on_429(lambda: requests.put(url, headers=HEADERS, json=send_body))


def extract_data(resp, label=""):
    """Extract .data from standard Nexa response envelope."""
    if resp.status_code not in (200, 201):
        print(f"  ERROR [{label}]: {resp.status_code} {resp.text[:300]}")
        return None
    body = resp.json()
    return body.get("data", body)


# ---------------------------------------------------------------------------
# STEP 1: Create Dimension Types + Values
# ---------------------------------------------------------------------------

print("=" * 60)
print("STEP 1: Create Dimension Types + Values")
print("=" * 60)

# --- Dimension Types ---
# First try to fetch existing types, then create missing ones

print("\n[DIM-TYPES] Fetching existing dimension types...")
existing_types_resp = api_get("/dimensions/types", params={"limit": 50})
existing_types = extract_data(existing_types_resp, "existing dim types") or []
# Handle pagination envelope — data may be nested
if isinstance(existing_types, dict):
    existing_types = existing_types.get("data", [])
if not isinstance(existing_types, list):
    existing_types = []

existing_type_map = {t["code"]: t for t in existing_types}
print(f"  Found {len(existing_type_map)} existing types: {list(existing_type_map.keys())}")


def get_or_create_dim_type(code, name, sort_order):
    """Return the dimension type (existing or newly created)."""
    if code in existing_type_map:
        t = existing_type_map[code]
        print(f"  {code}: EXISTS (id={t['id']})")
        return t
    resp = api_post("/dimensions/types", {
        "code": code,
        "name": name,
        "isSingleSelect": True,
        "sortOrder": sort_order,
    })
    t = extract_data(resp, f"{code} type")
    if t:
        print(f"  {code}: CREATED (id={t['id']})")
    else:
        print(f"  {code}: FAILED to create")
    return t


branch_type = get_or_create_dim_type("BRANCH", "Branch", 1)
dept_type = get_or_create_dim_type("DEPT", "Department", 2)
proj_type = get_or_create_dim_type("PROJECT", "Project", 3)

branch_type_id = branch_type["id"] if branch_type else None
dept_type_id = dept_type["id"] if dept_type else None
proj_type_id = proj_type["id"] if proj_type else None

if not all([branch_type_id, dept_type_id, proj_type_id]):
    print("FATAL: Could not resolve all dimension types. Exiting.")
    sys.exit(1)

# --- Dimension Values: Branch ---

print("\n[DIM-VALUES] Creating Branch values...")

dim_value_ids = {}


def fetch_existing_values(type_id):
    """Fetch all existing dimension values for a type."""
    resp = api_get(f"/dimensions/types/{type_id}/values", params={"limit": 100})
    data = extract_data(resp, f"existing values for {type_id}") or []
    if isinstance(data, dict):
        data = data.get("data", [])
    if not isinstance(data, list):
        data = []
    return {v["code"]: v for v in data}


def get_or_create_dim_value(type_id, code, name, key, existing_values):
    """Get existing or create new dimension value."""
    if code in existing_values:
        val = existing_values[code]
        dim_value_ids[key] = val["id"]
        print(f"  {code} ({name}): EXISTS {val['id']}")
        return
    resp = api_post(f"/dimensions/types/{type_id}/values", {"code": code, "name": name})
    val = extract_data(resp, f"{key} value")
    if val:
        dim_value_ids[key] = val["id"]
        print(f"  {code} ({name}): CREATED {val['id']}")
    else:
        print(f"  FAILED: {code} ({name})")


existing_branch_vals = fetch_existing_values(branch_type_id)
get_or_create_dim_value(branch_type_id, "LON", "London", "london", existing_branch_vals)
get_or_create_dim_value(branch_type_id, "MAN", "Manchester", "manchester", existing_branch_vals)
get_or_create_dim_value(branch_type_id, "BHM", "Birmingham", "birmingham", existing_branch_vals)

print("\n[DIM-VALUES] Creating Department values...")

existing_dept_vals = fetch_existing_values(dept_type_id)
get_or_create_dim_value(dept_type_id, "SALES", "Sales", "sales", existing_dept_vals)
get_or_create_dim_value(dept_type_id, "ADMIN", "Administration", "admin", existing_dept_vals)
get_or_create_dim_value(dept_type_id, "IT", "IT", "it", existing_dept_vals)
get_or_create_dim_value(dept_type_id, "OPS", "Operations", "ops", existing_dept_vals)

print("\n[DIM-VALUES] Creating Project values...")

existing_proj_vals = fetch_existing_values(proj_type_id)
get_or_create_dim_value(proj_type_id, "WEB", "Website Redesign", "web", existing_proj_vals)
get_or_create_dim_value(proj_type_id, "FIT", "Office Fit-Out", "office", existing_proj_vals)
get_or_create_dim_value(proj_type_id, "CRM", "CRM Implementation", "crm", existing_proj_vals)

DIM = dim_value_ids

print(f"\n[DIM-VALUES] Created {len(DIM)} dimension values total.")

# ---------------------------------------------------------------------------
# STEP 2: Build dimension lookup maps (already done above as DIM)
# ---------------------------------------------------------------------------

print("\n" + "=" * 60)
print("STEP 2: Dimension Lookup Map")
print("=" * 60)

for k, v in DIM.items():
    print(f"  {k}: {v}")

# ---------------------------------------------------------------------------
# STEP 3: Set Mandatory Dimensions on Accounts
# ---------------------------------------------------------------------------

print("\n" + "=" * 60)
print("STEP 3: Set Mandatory Dimensions on Accounts")
print("=" * 60)

# First, fetch all accounts
print("\n[ACCOUNTS] Fetching account list...")
resp = api_get("/accounts", params={"limit": 500})
accounts_data = extract_data(resp, "accounts list")

if not accounts_data:
    print("FATAL: Could not fetch accounts. Exiting.")
    sys.exit(1)

# The response may be an array directly or have nested data
if isinstance(accounts_data, list):
    all_accounts = accounts_data
elif isinstance(accounts_data, dict) and "data" in accounts_data:
    all_accounts = accounts_data["data"]
else:
    all_accounts = accounts_data

account_map = {}
for a in all_accounts:
    account_map[a["code"]] = a["id"]

print(f"[ACCOUNTS] Found {len(account_map)} accounts.")
print(f"  Sample codes: {list(account_map.keys())[:15]}...")

# Expense accounts that need Branch + Department mandatory
expense_accounts = [
    "6000", "6100", "6200", "6300", "6400", "6500", "6600", "6700",
    "6800", "6900", "7000", "7100", "7200", "7300", "7600",
]
# Also 5100 (Cost of Sales - Materials) needs Branch + Dept
expense_accounts.append("5100")

# Revenue accounts that need Branch mandatory
revenue_accounts = ["4000", "4100", "4200"]

print("\n[MANDATORY-DIMS] Setting mandatory dimensions on expense accounts...")
for code in expense_accounts:
    if code not in account_map:
        print(f"  SKIP {code}: not found in chart of accounts")
        continue

    dim_types = [branch_type_id, dept_type_id]
    if code == "6800":
        dim_types.append(proj_type_id)

    resp = api_put(f"/accounts/{account_map[code]}/mandatory-dimensions", {
        "dimensionTypeIds": dim_types,
    })
    result = extract_data(resp, f"mandatory dims {code}")
    extra = " (+PROJECT)" if code == "6800" else ""
    if result is not None:
        print(f"  {code}: BRANCH+DEPT{extra} set")
    else:
        print(f"  {code}: FAILED to set mandatory dims")

print("\n[MANDATORY-DIMS] Setting mandatory dimensions on revenue accounts...")
for code in revenue_accounts:
    if code not in account_map:
        print(f"  SKIP {code}: not found in chart of accounts")
        continue

    resp = api_put(f"/accounts/{account_map[code]}/mandatory-dimensions", {
        "dimensionTypeIds": [branch_type_id],
    })
    result = extract_data(resp, f"mandatory dims {code}")
    if result is not None:
        print(f"  {code}: BRANCH set")
    else:
        print(f"  {code}: FAILED to set mandatory dims")

# ---------------------------------------------------------------------------
# STEP 4: Create Fiscal Year 2025
# ---------------------------------------------------------------------------

print("\n" + "=" * 60)
print("STEP 4: Create Fiscal Year 2025")
print("=" * 60)

resp = api_post("/periods/year", {"fiscalYear": 2025})
fy_data = extract_data(resp, "fiscal year 2025")
if fy_data:
    print(f"[PERIODS] Created fiscal year 2025 ({len(fy_data)} periods)")
else:
    print("[PERIODS] Fiscal year 2025 may already exist, fetching periods...")

# Fetch all periods to build period_map
resp = api_get("/periods", params={"fiscalYear": 2025})
periods_data = extract_data(resp, "periods list")

# periods_data is usually grouped by fiscal year
period_map = {}  # month -> period ID

if isinstance(periods_data, list):
    for item in periods_data:
        # Could be grouped: [{fiscalYear: 2025, periods: [...]}]
        if "periods" in item:
            for p in item["periods"]:
                pn = p.get("periodNumber") or p.get("number")
                if pn and pn <= 12:
                    period_map[pn] = p["id"]
        elif "periodNumber" in item or "number" in item:
            pn = item.get("periodNumber") or item.get("number")
            if pn and pn <= 12:
                period_map[pn] = item["id"]
elif isinstance(periods_data, dict) and "periods" in periods_data:
    for p in periods_data["periods"]:
        pn = p.get("periodNumber") or p.get("number")
        if pn and pn <= 12:
            period_map[pn] = p["id"]

print(f"[PERIODS] Period map has {len(period_map)} entries.")
for m in sorted(period_map.keys()):
    print(f"  Period {m}: {period_map[m]}")

if len(period_map) < 12:
    print("WARNING: Expected 12 periods but got fewer. Some journals may fail.")

# ---------------------------------------------------------------------------
# STEP 5: Create Opening Balances
# ---------------------------------------------------------------------------

print("\n" + "=" * 60)
print("STEP 5: Create Opening Balances")
print("=" * 60)

ob_resp = api_post("/opening-balances/manual", {
    "transactionDate": "2025-01-01",
    "description": "Opening Balances FY2025",
    "lines": [
        {"accountCode": "1200", "debit": 75000, "credit": 0},
        {"accountCode": "1400", "debit": 25000, "credit": 0},
        {"accountCode": "0030", "debit": 40000, "credit": 0},
        {"accountCode": "0050", "debit": 15000, "credit": 0},
        {"accountCode": "0060", "debit": 8000,  "credit": 0},
        {"accountCode": "0130", "debit": 0,     "credit": 8000},
        {"accountCode": "0150", "debit": 0,     "credit": 5000},
        {"accountCode": "0160", "debit": 0,     "credit": 3000},
        {"accountCode": "2400", "debit": 0,     "credit": 18000},
        {"accountCode": "2300", "debit": 0,     "credit": 5000},
        {"accountCode": "3000", "debit": 0,     "credit": 75000},
        {"accountCode": "3200", "debit": 0,     "credit": 49000},
    ],
})
ob_data = extract_data(ob_resp, "opening balances")
if ob_data:
    lc = ob_data.get("lineCount", "?")
    sa = ob_data.get("suspenseAdded", "?")
    print(f"[OB] Opening balances posted: {lc} lines, suspense={sa}")
else:
    print("[OB] Opening balances may have failed — continuing anyway.")

# ---------------------------------------------------------------------------
# STEP 6: Create and POST Journals for Each Month
# ---------------------------------------------------------------------------

print("\n" + "=" * 60)
print("STEP 6: Create and Post Monthly Journals (12 months x 10 journals)")
print("=" * 60)


def make_dims(*dim_keys):
    """Build dimensions array for journal lines from our dim lookup."""
    return [{"dimensionValueId": DIM[k]} for k in dim_keys if k in DIM]


def make_sim_dims(*dim_keys):
    """Build dimensionValues array for simulation lines (needs dimensionTypeId too)."""
    type_lookup = {}
    for k in DIM:
        if k in ("london", "manchester", "birmingham"):
            type_lookup[k] = branch_type_id
        elif k in ("sales", "admin", "it", "ops"):
            type_lookup[k] = dept_type_id
        elif k in ("web", "office", "crm"):
            type_lookup[k] = proj_type_id
    return [
        {"dimensionTypeId": type_lookup[k], "dimensionValueId": DIM[k]}
        for k in dim_keys
        if k in DIM and k in type_lookup
    ]


monthly_sales = [15000, 18000, 22000, 16000, 17000, 20000, 14000, 12000, 19000, 21000, 25000, 23000]
monthly_services = [6000, 7000, 9000, 6000, 7000, 8000, 5000, 4000, 8000, 9000, 11000, 10000]

branches_per_month = [
    "london", "manchester", "london", "birmingham", "london", "manchester",
    "london", "birmingham", "manchester", "london", "manchester", "london",
]

journal_success = 0
journal_fail = 0

for month in range(1, 13):
    if month not in period_map:
        print(f"\n  [MONTH {month:02d}] SKIP — no period ID")
        continue

    period_id = period_map[month]
    date_15 = f"2025-{month:02d}-15"
    date_12 = f"2025-{month:02d}-12"
    date_18 = f"2025-{month:02d}-18"
    date_20 = f"2025-{month:02d}-20"
    date_25 = f"2025-{month:02d}-25"
    date_27 = f"2025-{month:02d}-27"
    date_28 = f"2025-{month:02d}-28"

    sales_amt = monthly_sales[month - 1]
    svc_amt = monthly_services[month - 1]
    sales_vat = round(sales_amt * 0.2)
    svc_vat = round(svc_amt * 0.2)

    branch = branches_per_month[month - 1]

    print(f"\n  [MONTH {month:02d}] branch={branch}, sales={sales_amt}, svc={svc_amt}")

    journals = [
        # J1: Product Sales — Dr 1400, Cr 4000 (branch dim), Cr 2200
        {
            "description": f"Sales Invoice - Products 2025-{month:02d}",
            "transactionDate": date_15,
            "periodId": period_id,
            "reference": f"INV-{month:02d}01",
            "lines": [
                {"accountCode": "1400", "debit": sales_amt + sales_vat, "credit": 0},
                {"accountCode": "4000", "debit": 0, "credit": sales_amt, "dimensions": make_dims(branch)},
                {"accountCode": "2200", "debit": 0, "credit": sales_vat},
            ],
        },
        # J2: Service Sales — Dr 1400, Cr 4100 (branch dim), Cr 2200
        {
            "description": f"Sales Invoice - Services 2025-{month:02d}",
            "transactionDate": date_15,
            "periodId": period_id,
            "reference": f"INV-{month:02d}02",
            "lines": [
                {"accountCode": "1400", "debit": svc_amt + svc_vat, "credit": 0},
                {"accountCode": "4100", "debit": 0, "credit": svc_amt, "dimensions": make_dims(branch)},
                {"accountCode": "2200", "debit": 0, "credit": svc_vat},
            ],
        },
        # J3: Rent — Dr 6000 (london+admin), Cr 1200
        {
            "description": f"Rent Payment 2025-{month:02d}",
            "transactionDate": date_20,
            "periodId": period_id,
            "reference": f"DD-RENT-{month:02d}",
            "lines": [
                {"accountCode": "6000", "debit": 3000, "credit": 0, "dimensions": make_dims("london", "admin")},
                {"accountCode": "1200", "debit": 0, "credit": 3000},
            ],
        },
        # J4: Salaries — multi-dept split
        {
            "description": f"Salaries 2025-{month:02d}",
            "transactionDate": date_25,
            "periodId": period_id,
            "reference": f"PAY-{month:02d}",
            "lines": [
                {"accountCode": "7000", "debit": 12000, "credit": 0, "dimensions": make_dims(branch, "admin")},
                {"accountCode": "7000", "debit": 8000,  "credit": 0, "dimensions": make_dims(branch, "sales")},
                {"accountCode": "7000", "debit": 5000,  "credit": 0, "dimensions": make_dims(branch, "it")},
                {"accountCode": "1200", "debit": 0,     "credit": 20500},
                {"accountCode": "2300", "debit": 0,     "credit": 4500},
            ],
        },
        # J5: IT Expenses — 6600 (branch+it), 6800 (branch+it+crm project)
        {
            "description": f"IT Expenses 2025-{month:02d}",
            "transactionDate": date_18,
            "periodId": period_id,
            "lines": [
                {"accountCode": "6600", "debit": 500,  "credit": 0, "dimensions": make_dims("london", "it")},
                {"accountCode": "6800", "debit": 2000, "credit": 0, "dimensions": make_dims("london", "it", "crm")},
                {"accountCode": "1200", "debit": 0,    "credit": 2500},
            ],
        },
        # J6: Customer Payment — Dr 1200, Cr 1400
        {
            "description": f"Customer Payments 2025-{month:02d}",
            "transactionDate": date_28,
            "periodId": period_id,
            "lines": [
                {"accountCode": "1200", "debit": sales_amt + svc_amt, "credit": 0},
                {"accountCode": "1400", "debit": 0, "credit": sales_amt + svc_amt},
            ],
        },
        # J7: Supplier Payment — Dr 2400, Cr 1200
        {
            "description": f"Supplier Payment 2025-{month:02d}",
            "transactionDate": date_27,
            "periodId": period_id,
            "lines": [
                {"accountCode": "2400", "debit": 6000, "credit": 0},
                {"accountCode": "1200", "debit": 0, "credit": 6000},
            ],
        },
        # J8: Materials Purchase — Dr 5100 (branch+ops), Dr 1500 (VAT), Cr 2400
        {
            "description": f"Materials Purchase 2025-{month:02d}",
            "transactionDate": date_12,
            "periodId": period_id,
            "lines": [
                {"accountCode": "5100", "debit": 5000, "credit": 0, "dimensions": make_dims(branch, "ops")},
                {"accountCode": "1500", "debit": 1000, "credit": 0},
                {"accountCode": "2400", "debit": 0, "credit": 6000},
            ],
        },
        # J9: Depreciation — Dr 6900 (branch+admin), Cr accum dep accounts
        {
            "description": f"Depreciation 2025-{month:02d}",
            "transactionDate": date_28,
            "periodId": period_id,
            "lines": [
                {"accountCode": "6900", "debit": 1000, "credit": 0, "dimensions": make_dims(branch, "admin")},
                {"accountCode": "0130", "debit": 0, "credit": 500},
                {"accountCode": "0150", "debit": 0, "credit": 300},
                {"accountCode": "0160", "debit": 0, "credit": 200},
            ],
        },
        # J10: Bank Charges — Dr 7600 (branch+admin), Cr 1200
        {
            "description": f"Bank Charges 2025-{month:02d}",
            "transactionDate": date_28,
            "periodId": period_id,
            "lines": [
                {"accountCode": "7600", "debit": 35, "credit": 0, "dimensions": make_dims(branch, "admin")},
                {"accountCode": "1200", "debit": 0, "credit": 35},
            ],
        },
    ]

    for j in journals:
        # Create draft
        create_resp = api_post("/journals", j)
        if create_resp.status_code != 201:
            journal_fail += 1
            print(f"    FAIL create: {j['description']}: {create_resp.status_code} {create_resp.text[:200]}")
            continue

        jdata = extract_data(create_resp, j["description"])
        if not jdata:
            journal_fail += 1
            continue

        jid = jdata["id"]

        # Post the journal
        post_resp = api_post(f"/journals/{jid}/post")
        if post_resp.status_code != 200:
            journal_fail += 1
            print(f"    FAIL post: {j['description']}: {post_resp.status_code} {post_resp.text[:200]}")
        else:
            journal_success += 1
            print(f"    OK {j['description']}")

print(f"\n[JOURNALS] Done: {journal_success} posted, {journal_fail} failed.")

# ---------------------------------------------------------------------------
# STEP 7: Create Bank Account + Import Transactions
# ---------------------------------------------------------------------------

print("\n" + "=" * 60)
print("STEP 7: Create Bank Account + Import Statement")
print("=" * 60)

bank_resp = api_post("/bank-accounts", {
    "name": "Lloyds Current Account",
    "sortCode": "309634",
    "accountNumber": "12345678",
    "glAccountCode": "1200",
    "currencyCode": "GBP",
})
bank_data = extract_data(bank_resp, "bank account")
bank_id = bank_data["id"] if bank_data else None

if bank_id:
    print(f"[BANK] Created bank account: {bank_id}")

    # Build CSV statement
    csv_lines = ["Date,Description,Amount,Reference"]
    for month in range(1, 13):
        customer_amt = monthly_sales[month - 1] + monthly_services[month - 1]
        csv_lines.extend([
            f"2025-{month:02d}-20,RENT PAYMENT,-3000.00,DD-RENT-{month:02d}",
            f"2025-{month:02d}-25,SALARY PAYMENTS,-20500.00,PAY-{month:02d}",
            f"2025-{month:02d}-28,CUSTOMER PAYMENTS,{customer_amt:.2f},FPI-{month:02d}",
            f"2025-{month:02d}-27,SUPPLIER PAYMENT,-6000.00,FPO-{month:02d}",
            f"2025-{month:02d}-18,IT EXPENSES,-2500.00,FPO-IT-{month:02d}",
            f"2025-{month:02d}-28,BANK CHARGES,-35.00,CHG-{month:02d}",
        ])
    csv_content = "\n".join(csv_lines)

    import_resp = api_post(f"/bank-accounts/{bank_id}/import", {
        "content": csv_content,
        "format": "csv",
    })
    import_data = extract_data(import_resp, "bank import")
    if import_data:
        print(f"[BANK] Imported {import_data.get('imported', '?')} transactions (dupes skipped: {import_data.get('duplicatesSkipped', '?')})")
    else:
        print("[BANK] Bank import may have failed — continuing.")
else:
    print("[BANK] FAILED to create bank account — skipping import.")

# ---------------------------------------------------------------------------
# STEP 8: Create 20 Simulations
# ---------------------------------------------------------------------------

print("\n" + "=" * 60)
print("STEP 8: Create 20 Simulations")
print("=" * 60)

# We need a period ID — use January 2025
sim_period_id = period_map.get(1)
if not sim_period_id:
    print("[SIM] No period ID for January — skipping simulations.")
else:
    sim_scenarios = [
        # --- 5 Hiring scenarios ---
        {
            "description": "Hire 2 developers - January cost",
            "transactionDate": "2025-01-15",
            "reference": "SIM-HIRE-01",
            "periodId": period_map.get(1, sim_period_id),
            "lines": [
                {"accountCode": "7000", "debit": 10000, "credit": 0, "dimensionValues": make_sim_dims("london", "it")},
                {"accountCode": "1200", "debit": 0, "credit": 10000},
            ],
        },
        {
            "description": "Hire 2 developers - February cost",
            "transactionDate": "2025-02-15",
            "reference": "SIM-HIRE-02",
            "periodId": period_map.get(2, sim_period_id),
            "lines": [
                {"accountCode": "7000", "debit": 10000, "credit": 0, "dimensionValues": make_sim_dims("london", "it")},
                {"accountCode": "1200", "debit": 0, "credit": 10000},
            ],
        },
        {
            "description": "Hire 2 developers - March cost",
            "transactionDate": "2025-03-15",
            "reference": "SIM-HIRE-03",
            "periodId": period_map.get(3, sim_period_id),
            "lines": [
                {"accountCode": "7000", "debit": 10000, "credit": 0, "dimensionValues": make_sim_dims("london", "it")},
                {"accountCode": "1200", "debit": 0, "credit": 10000},
            ],
        },
        {
            "description": "Hire sales manager - Q2",
            "transactionDate": "2025-04-15",
            "reference": "SIM-HIRE-04",
            "periodId": period_map.get(4, sim_period_id),
            "lines": [
                {"accountCode": "7000", "debit": 6000, "credit": 0, "dimensionValues": make_sim_dims("manchester", "sales")},
                {"accountCode": "1200", "debit": 0, "credit": 6000},
            ],
        },
        {
            "description": "Hire ops team lead - Q3",
            "transactionDate": "2025-07-15",
            "reference": "SIM-HIRE-05",
            "periodId": period_map.get(7, sim_period_id),
            "lines": [
                {"accountCode": "7000", "debit": 5500, "credit": 0, "dimensionValues": make_sim_dims("birmingham", "ops")},
                {"accountCode": "1200", "debit": 0, "credit": 5500},
            ],
        },
        # --- 5 New office scenarios ---
        {
            "description": "Birmingham office rent - Jan",
            "transactionDate": "2025-01-20",
            "reference": "SIM-OFFICE-01",
            "periodId": period_map.get(1, sim_period_id),
            "lines": [
                {"accountCode": "6000", "debit": 2000, "credit": 0, "dimensionValues": make_sim_dims("birmingham", "admin")},
                {"accountCode": "1200", "debit": 0, "credit": 2000},
            ],
        },
        {
            "description": "Birmingham office rent - Feb",
            "transactionDate": "2025-02-20",
            "reference": "SIM-OFFICE-02",
            "periodId": period_map.get(2, sim_period_id),
            "lines": [
                {"accountCode": "6000", "debit": 2000, "credit": 0, "dimensionValues": make_sim_dims("birmingham", "admin")},
                {"accountCode": "1200", "debit": 0, "credit": 2000},
            ],
        },
        {
            "description": "Birmingham office fit-out",
            "transactionDate": "2025-01-10",
            "reference": "SIM-OFFICE-03",
            "periodId": period_map.get(1, sim_period_id),
            "lines": [
                {"accountCode": "6800", "debit": 15000, "credit": 0, "dimensionValues": make_sim_dims("birmingham", "admin", "office")},
                {"accountCode": "1200", "debit": 0, "credit": 15000},
            ],
        },
        {
            "description": "Manchester office upgrade",
            "transactionDate": "2025-03-10",
            "reference": "SIM-OFFICE-04",
            "periodId": period_map.get(3, sim_period_id),
            "lines": [
                {"accountCode": "6800", "debit": 8000, "credit": 0, "dimensionValues": make_sim_dims("manchester", "admin", "office")},
                {"accountCode": "1200", "debit": 0, "credit": 8000},
            ],
        },
        {
            "description": "London office expansion",
            "transactionDate": "2025-06-01",
            "reference": "SIM-OFFICE-05",
            "periodId": period_map.get(6, sim_period_id),
            "lines": [
                {"accountCode": "6000", "debit": 5000, "credit": 0, "dimensionValues": make_sim_dims("london", "admin")},
                {"accountCode": "1200", "debit": 0, "credit": 5000},
            ],
        },
        # --- 5 Marketing scenarios ---
        {
            "description": "Marketing campaign Q1 - Website",
            "transactionDate": "2025-01-15",
            "reference": "SIM-MKT-01",
            "periodId": period_map.get(1, sim_period_id),
            "lines": [
                {"accountCode": "6800", "debit": 5000, "credit": 0, "dimensionValues": make_sim_dims("london", "sales", "web")},
                {"accountCode": "1200", "debit": 0, "credit": 5000},
            ],
        },
        {
            "description": "Marketing campaign Q2 - Digital",
            "transactionDate": "2025-04-15",
            "reference": "SIM-MKT-02",
            "periodId": period_map.get(4, sim_period_id),
            "lines": [
                {"accountCode": "6800", "debit": 7000, "credit": 0, "dimensionValues": make_sim_dims("london", "sales", "web")},
                {"accountCode": "1200", "debit": 0, "credit": 7000},
            ],
        },
        {
            "description": "Trade show Manchester",
            "transactionDate": "2025-05-15",
            "reference": "SIM-MKT-03",
            "periodId": period_map.get(5, sim_period_id),
            "lines": [
                {"accountCode": "6800", "debit": 3500, "credit": 0, "dimensionValues": make_sim_dims("manchester", "sales", "web")},
                {"accountCode": "1200", "debit": 0, "credit": 3500},
            ],
        },
        {
            "description": "CRM marketing integration",
            "transactionDate": "2025-08-15",
            "reference": "SIM-MKT-04",
            "periodId": period_map.get(8, sim_period_id),
            "lines": [
                {"accountCode": "6800", "debit": 4000, "credit": 0, "dimensionValues": make_sim_dims("london", "it", "crm")},
                {"accountCode": "1200", "debit": 0, "credit": 4000},
            ],
        },
        {
            "description": "Brand refresh campaign",
            "transactionDate": "2025-10-15",
            "reference": "SIM-MKT-05",
            "periodId": period_map.get(10, sim_period_id),
            "lines": [
                {"accountCode": "6800", "debit": 6000, "credit": 0, "dimensionValues": make_sim_dims("london", "sales", "web")},
                {"accountCode": "1200", "debit": 0, "credit": 6000},
            ],
        },
        # --- 5 Sales growth scenarios ---
        {
            "description": "20% sales growth - Jan projection",
            "transactionDate": "2025-01-15",
            "reference": "SIM-GROW-01",
            "periodId": period_map.get(1, sim_period_id),
            "lines": [
                {"accountCode": "1400", "debit": 3600, "credit": 0},
                {"accountCode": "4000", "debit": 0, "credit": 3000, "dimensionValues": make_sim_dims("london")},
                {"accountCode": "2200", "debit": 0, "credit": 600},
            ],
        },
        {
            "description": "20% sales growth - Feb projection",
            "transactionDate": "2025-02-15",
            "reference": "SIM-GROW-02",
            "periodId": period_map.get(2, sim_period_id),
            "lines": [
                {"accountCode": "1400", "debit": 4320, "credit": 0},
                {"accountCode": "4000", "debit": 0, "credit": 3600, "dimensionValues": make_sim_dims("manchester")},
                {"accountCode": "2200", "debit": 0, "credit": 720},
            ],
        },
        {
            "description": "New service line revenue - Q2",
            "transactionDate": "2025-04-15",
            "reference": "SIM-GROW-03",
            "periodId": period_map.get(4, sim_period_id),
            "lines": [
                {"accountCode": "1400", "debit": 6000, "credit": 0},
                {"accountCode": "4100", "debit": 0, "credit": 5000, "dimensionValues": make_sim_dims("birmingham")},
                {"accountCode": "2200", "debit": 0, "credit": 1000},
            ],
        },
        {
            "description": "Enterprise contract win - Q3",
            "transactionDate": "2025-07-15",
            "reference": "SIM-GROW-04",
            "periodId": period_map.get(7, sim_period_id),
            "lines": [
                {"accountCode": "1400", "debit": 12000, "credit": 0},
                {"accountCode": "4000", "debit": 0, "credit": 10000, "dimensionValues": make_sim_dims("london")},
                {"accountCode": "2200", "debit": 0, "credit": 2000},
            ],
        },
        {
            "description": "Christmas rush sales uplift",
            "transactionDate": "2025-12-15",
            "reference": "SIM-GROW-05",
            "periodId": period_map.get(12, sim_period_id),
            "lines": [
                {"accountCode": "1400", "debit": 9600, "credit": 0},
                {"accountCode": "4000", "debit": 0, "credit": 8000, "dimensionValues": make_sim_dims("manchester")},
                {"accountCode": "2200", "debit": 0, "credit": 1600},
            ],
        },
    ]

    sim_success = 0
    sim_fail = 0

    for scenario in sim_scenarios:
        resp = api_post("/simulations", scenario)
        sdata = extract_data(resp, scenario["description"])
        if sdata:
            sim_success += 1
            print(f"  OK {scenario['description']} (id={sdata['id'][:8]}...)")
        else:
            sim_fail += 1
            print(f"  FAIL {scenario['description']}")

    print(f"\n[SIM] Done: {sim_success} created, {sim_fail} failed.")

# ---------------------------------------------------------------------------
# STEP 9: Create Budget Version + Budget
# ---------------------------------------------------------------------------

print("\n" + "=" * 60)
print("STEP 9: Create Budget Version + Budget")
print("=" * 60)

ver_resp = api_post("/budget-versions", {
    "fiscalYear": 2025,
    "versionName": "Annual Budget v1",
})
ver_data = extract_data(ver_resp, "budget version")
version_id = ver_data["id"] if ver_data else None

if version_id:
    print(f"[BUDGET] Budget version created: {version_id}")
else:
    print("[BUDGET] Budget version creation failed — continuing without.")

budget_body = {
    "name": "FY2025 Annual Budget",
    "fiscalYear": 2025,
    "budgetType": "ANNUAL",
    "lines": [
        {"accountCode": "4000", "period1": 16000, "period2": 19000, "period3": 23000, "period4": 17000, "period5": 18000, "period6": 21000, "period7": 15000, "period8": 13000, "period9": 20000, "period10": 22000, "period11": 26000, "period12": 24000},
        {"accountCode": "4100", "period1": 7000, "period2": 8000, "period3": 10000, "period4": 7000, "period5": 8000, "period6": 9000, "period7": 6000, "period8": 5000, "period9": 9000, "period10": 10000, "period11": 12000, "period12": 11000},
        {"accountCode": "5100", "period1": 4500, "period2": 5000, "period3": 5500, "period4": 4500, "period5": 5000, "period6": 5500, "period7": 4500, "period8": 4500, "period9": 5000, "period10": 5500, "period11": 6000, "period12": 5500},
        {"accountCode": "6000", "period1": 3000, "period2": 3000, "period3": 3000, "period4": 3000, "period5": 3000, "period6": 3000, "period7": 3000, "period8": 3000, "period9": 3000, "period10": 3000, "period11": 3000, "period12": 3000},
        {"accountCode": "7000", "period1": 24000, "period2": 24000, "period3": 24000, "period4": 24000, "period5": 25000, "period6": 25000, "period7": 25000, "period8": 25000, "period9": 26000, "period10": 26000, "period11": 26000, "period12": 26000},
        {"accountCode": "6600", "period1": 500, "period2": 500, "period3": 500, "period4": 500, "period5": 500, "period6": 500, "period7": 500, "period8": 500, "period9": 500, "period10": 500, "period11": 500, "period12": 500},
        {"accountCode": "6800", "period1": 1800, "period2": 1800, "period3": 2000, "period4": 1800, "period5": 2000, "period6": 2000, "period7": 1800, "period8": 1800, "period9": 2000, "period10": 2000, "period11": 2200, "period12": 2000},
        {"accountCode": "6900", "period1": 1000, "period2": 1000, "period3": 1000, "period4": 1000, "period5": 1000, "period6": 1000, "period7": 1000, "period8": 1000, "period9": 1000, "period10": 1000, "period11": 1000, "period12": 1000},
        {"accountCode": "7600", "period1": 35, "period2": 35, "period3": 35, "period4": 35, "period5": 35, "period6": 35, "period7": 35, "period8": 35, "period9": 35, "period10": 35, "period11": 35, "period12": 35},
    ],
}

if version_id:
    budget_body["budgetVersionId"] = version_id

budget_resp = api_post("/budgets", budget_body)
budget_data = extract_data(budget_resp, "budget")
budget_id = budget_data["id"] if budget_data else None

if budget_id:
    print(f"[BUDGET] Budget created: {budget_id}")

    # Approve the budget
    approve_resp = api_post(f"/budgets/{budget_id}/approve")
    approve_data = extract_data(approve_resp, "budget approve")
    if approve_data:
        print(f"[BUDGET] Budget approved: status={approve_data.get('status', '?')}")
    else:
        print("[BUDGET] Budget approval failed — continuing.")
else:
    print("[BUDGET] Budget creation failed.")

# ---------------------------------------------------------------------------
# STEP 10: Create + Calculate VAT Returns
# ---------------------------------------------------------------------------

print("\n" + "=" * 60)
print("STEP 10: Create + Calculate VAT Returns")
print("=" * 60)

quarters = [
    ("2025-01-01", "2025-03-31"),
    ("2025-04-01", "2025-06-30"),
    ("2025-07-01", "2025-09-30"),
    ("2025-10-01", "2025-12-31"),
]

# First fetch any existing VAT returns so we can recalculate them
print("[VAT] Fetching existing VAT returns...")
existing_vat_resp = api_get("/vat-returns", params={"limit": 20})
existing_vat = extract_data(existing_vat_resp, "existing vat returns") or []
if isinstance(existing_vat, dict):
    existing_vat = existing_vat.get("data", [])
if not isinstance(existing_vat, list):
    existing_vat = []

# Build a lookup of existing VAT returns by period start
existing_vat_map = {}
for v in existing_vat:
    ps = str(v.get("periodStart", ""))[:10]
    existing_vat_map[ps] = v

for i, (start, end) in enumerate(quarters, 1):
    print(f"\n  [Q{i}] {start} to {end}")

    # Check if already exists
    if start in existing_vat_map:
        vat_id = existing_vat_map[start]["id"]
        print(f"    EXISTS: {vat_id} (status={existing_vat_map[start].get('status', '?')})")
    else:
        vat_resp = api_post("/vat-returns", {"periodStart": start, "periodEnd": end})
        vat_data = extract_data(vat_resp, f"vat return Q{i}")
        if not vat_data:
            print(f"    FAIL: Could not create VAT return for Q{i}")
            continue
        vat_id = vat_data["id"]
        print(f"    Created: {vat_id}")

    # (Re-)calculate
    calc_resp = api_post(f"/vat-returns/{vat_id}/calculate")
    calc_data = extract_data(calc_resp, f"vat calc Q{i}")
    if calc_data:
        print(f"    Calculated: Box1={calc_data.get('box1', '?')}, Box4={calc_data.get('box4', '?')}, Box5={calc_data.get('box5', '?')}")
    else:
        print(f"    Calculate failed for Q{i} (may be already submitted)")

# ---------------------------------------------------------------------------
# STEP 11: Run Reports and Print Results
# ---------------------------------------------------------------------------

print("\n" + "=" * 60)
print("STEP 11: Run Reports")
print("=" * 60)

# --- Trial Balance ---
print("\n" + "-" * 40)
print("TRIAL BALANCE (FY2025 Full Year)")
print("-" * 40)

tb_resp = api_get("/reports/trial-balance", params={
    "fiscalYear": 2025,
    "periodFrom": 1,
    "periodTo": 12,
})
tb_data = extract_data(tb_resp, "trial balance")
if tb_data:
    accounts_list = tb_data.get("accounts", [])
    totals = tb_data.get("totals", {})
    print(f"  {'Code':<8} {'Name':<35} {'Debit':>12} {'Credit':>12} {'Balance':>12}")
    print(f"  {'-'*8} {'-'*35} {'-'*12} {'-'*12} {'-'*12}")
    for a in accounts_list:
        if a["totalDebit"] != 0 or a["totalCredit"] != 0 or a["closingBalance"] != 0:
            print(f"  {a['accountCode']:<8} {a['accountName'][:35]:<35} {a['totalDebit']:>12,.2f} {a['totalCredit']:>12,.2f} {a['closingBalance']:>12,.2f}")
    print(f"  {'-'*8} {'-'*35} {'-'*12} {'-'*12}")
    print(f"  {'TOTALS':<44} {totals.get('totalDebit', 0):>12,.2f} {totals.get('totalCredit', 0):>12,.2f}")
    print(f"  Balanced: {totals.get('isBalanced', '?')}")

# --- Profit & Loss ---
print("\n" + "-" * 40)
print("PROFIT & LOSS (FY2025 Full Year)")
print("-" * 40)

pnl_resp = api_get("/reports/profit-and-loss", params={
    "fiscalYear": 2025,
    "periodFrom": 1,
    "periodTo": 12,
})
pnl_data = extract_data(pnl_resp, "P&L")
if pnl_data:
    for section in pnl_data.get("sections", []):
        print(f"\n  {section['name']} ({section['classification']})")
        for acc in section.get("accounts", []):
            print(f"    {acc['accountCode']:<8} {acc['accountName'][:30]:<30} {acc['balance']:>12,.2f}")
        print(f"    {'Section Total:':<38} {section['total']:>12,.2f}")

    print(f"\n  Gross Profit:       {pnl_data.get('grossProfit', 0):>12,.2f}")
    print(f"  Operating Expenses: {pnl_data.get('operatingExpenses', 0):>12,.2f}")
    print(f"  Operating Profit:   {pnl_data.get('operatingProfit', 0):>12,.2f}")
    print(f"  Other Income:       {pnl_data.get('otherIncome', 0):>12,.2f}")
    print(f"  Finance Costs:      {pnl_data.get('financeCosts', 0):>12,.2f}")
    print(f"  Profit Before Tax:  {pnl_data.get('profitBeforeTax', 0):>12,.2f}")
    print(f"  Taxation:           {pnl_data.get('taxation', 0):>12,.2f}")
    print(f"  NET PROFIT:         {pnl_data.get('netProfit', 0):>12,.2f}")

# --- P&L with Simulations ---
print("\n" + "-" * 40)
print("PROFIT & LOSS WITH SIMULATIONS")
print("-" * 40)

pnl_sim_resp = api_get("/reports/profit-and-loss", params={
    "fiscalYear": 2025,
    "periodFrom": 1,
    "periodTo": 12,
    "includeSimulations": "true",
})
pnl_sim_data = extract_data(pnl_sim_resp, "P&L+sim")
if pnl_sim_data:
    print(f"  NET PROFIT (with sims): {pnl_sim_data.get('netProfit', 0):>12,.2f}")
    if pnl_data:
        diff = pnl_sim_data.get("netProfit", 0) - pnl_data.get("netProfit", 0)
        print(f"  Simulation Impact:      {diff:>12,.2f}")

# --- Balance Sheet ---
print("\n" + "-" * 40)
print("BALANCE SHEET (FY2025 Full Year)")
print("-" * 40)

bs_resp = api_get("/reports/balance-sheet", params={
    "fiscalYear": 2025,
    "periodFrom": 1,
    "periodTo": 12,
})
bs_data = extract_data(bs_resp, "balance sheet")
if bs_data:
    for section in bs_data.get("sections", []):
        print(f"\n  {section['name']} ({section['classification']})")
        for acc in section.get("accounts", []):
            if acc["balance"] != 0:
                print(f"    {acc['accountCode']:<8} {acc['accountName'][:30]:<30} {acc['balance']:>12,.2f}")
        print(f"    {'Section Total:':<38} {section['total']:>12,.2f}")

    print(f"\n  Total Assets:      {bs_data.get('totalAssets', 0):>12,.2f}")
    print(f"  Total Liabilities: {bs_data.get('totalLiabilities', 0):>12,.2f}")
    print(f"  Total Equity:      {bs_data.get('totalEquity', 0):>12,.2f}")
    print(f"  Balanced:          {bs_data.get('isBalanced', '?')}")

# --- Budget Variance ---
print("\n" + "-" * 40)
print("BUDGET VARIANCE (FY2025)")
print("-" * 40)

bv_params = {"fiscalYear": 2025}
if version_id:
    bv_params["budgetVersionId"] = version_id
if budget_id:
    bv_params["budgetId"] = budget_id

bv_resp = api_get("/reports/budget-variance", params=bv_params)
bv_data = extract_data(bv_resp, "budget variance")
if bv_data:
    print(f"  Budget: {bv_data.get('budgetName', '?')}")
    print(f"\n  {'Code':<8} {'Name':<30} {'Budget':>12} {'Actual':>12} {'Variance':>12} {'Var %':>8}")
    print(f"  {'-'*8} {'-'*30} {'-'*12} {'-'*12} {'-'*12} {'-'*8}")
    for line in bv_data.get("accounts", []):
        var_pct = line.get("variancePercentage")
        pct_str = f"{var_pct:>7.1f}%" if var_pct is not None else "    N/A"
        print(f"  {line['accountCode']:<8} {line['accountName'][:30]:<30} {line['budgetAmount']:>12,.2f} {line['actualAmount']:>12,.2f} {line['variance']:>12,.2f} {pct_str}")

    summary = bv_data.get("summary", {})
    print(f"\n  Total Budget: {summary.get('totalBudget', 0):>12,.2f}")
    print(f"  Total Actual: {summary.get('totalActual', 0):>12,.2f}")
    print(f"  Total Variance: {summary.get('totalVariance', 0):>12,.2f}")
else:
    print("  Budget variance report not available.")

# --- Departmental P&L (by Branch) ---
print("\n" + "-" * 40)
print("DEPARTMENTAL P&L (by Branch)")
print("-" * 40)

if branch_type_id:
    dept_resp = api_get("/reports/departmental-pnl", params={
        "fiscalYear": 2025,
        "periodFrom": 1,
        "periodTo": 12,
        "dimensionTypeId": branch_type_id,
    })
    dept_data = extract_data(dept_resp, "departmental P&L")
    if dept_data:
        columns = dept_data.get("columns", [])
        col_names = [c["dimensionValueCode"] for c in columns]
        header = f"  {'Account':<38}" + "".join(f"{n:>12}" for n in col_names) + f"{'Total':>12}"
        print(header)
        print(f"  {'-'*38}" + "-" * 12 * (len(col_names) + 1))

        for section in dept_data.get("sections", []):
            print(f"\n  {section['name']}")
            for acc in section.get("accounts", []):
                vals = "".join(f"{v:>12,.2f}" for v in acc["values"])
                print(f"    {acc['accountCode']:<6} {acc['accountName'][:30]:<30}{vals}{acc['total']:>12,.2f}")
            totals_str = "".join(f"{t:>12,.2f}" for t in section["totals"])
            print(f"    {'Section Total:':<36}{totals_str}{section['grandTotal']:>12,.2f}")

        summary = dept_data.get("summary", {})
        net_per_col = summary.get("netProfitPerColumn", [])
        net_str = "".join(f"{n:>12,.2f}" for n in net_per_col)
        print(f"\n  {'NET PROFIT:':<38}{net_str}{summary.get('totalNetProfit', 0):>12,.2f}")
else:
    print("  Branch type not available — skipping.")

# --- Trial Balance filtered by London Branch ---
print("\n" + "-" * 40)
print("TRIAL BALANCE - London Branch Only")
print("-" * 40)

if branch_type_id and "london" in DIM:
    tb_lon_resp = api_get("/reports/trial-balance", params={
        "fiscalYear": 2025,
        "periodFrom": 1,
        "periodTo": 12,
        "dimensionTypeId": branch_type_id,
        "dimensionValueId": DIM["london"],
    })
    tb_lon_data = extract_data(tb_lon_resp, "TB London")
    if tb_lon_data:
        lon_accounts = tb_lon_data.get("accounts", [])
        lon_totals = tb_lon_data.get("totals", {})
        print(f"  {'Code':<8} {'Name':<35} {'Debit':>12} {'Credit':>12} {'Balance':>12}")
        print(f"  {'-'*8} {'-'*35} {'-'*12} {'-'*12} {'-'*12}")
        for a in lon_accounts:
            if a["totalDebit"] != 0 or a["totalCredit"] != 0:
                print(f"  {a['accountCode']:<8} {a['accountName'][:35]:<35} {a['totalDebit']:>12,.2f} {a['totalCredit']:>12,.2f} {a['closingBalance']:>12,.2f}")
        print(f"  {'TOTALS':<44} {lon_totals.get('totalDebit', 0):>12,.2f} {lon_totals.get('totalCredit', 0):>12,.2f}")
else:
    print("  Branch type or London value not available — skipping.")

# ---------------------------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------------------------

print("\n" + "=" * 60)
print("SEED COMPLETE")
print("=" * 60)
print(f"  API calls made:      {call_count}")
print(f"  Dimension types:     3 (BRANCH, DEPT, PROJECT)")
print(f"  Dimension values:    {len(DIM)}")
print(f"  Journals created:    {journal_success} posted ({journal_fail} failed)")
print(f"  Simulations:         20 attempted")
print(f"  Budget:              1 version + 1 budget (9 account lines)")
print(f"  VAT returns:         4 quarters")
print(f"  Bank account:        1 with 72 imported transactions")
print(f"  Opening balances:    12 account lines")
print()
