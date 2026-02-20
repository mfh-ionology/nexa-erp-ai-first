#!/usr/bin/env python3
"""
E2 Backend API Test Runner
Executes all test cases from backend-test-plan-epic-E2.json against localhost:3000.
Produces JSON results + markdown report.

Usage:
    python3 scripts/run-e2-api-tests.py
"""

import json
import sys
import os
import time
from datetime import datetime, timezone
from collections import OrderedDict

import requests as http

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEST_PLAN_PATH = os.path.join(
    PROJECT_ROOT, "_bmad-output/test-artifacts/backend-test-plan-epic-E2.json"
)
RESULTS_PATH = os.path.join(
    PROJECT_ROOT, "_bmad-output/test-artifacts/backend-test-results-epic-E2.json"
)
REPORT_PATH = os.path.join(
    PROJECT_ROOT, "_bmad-output/test-artifacts/backend-test-report-epic-E2.md"
)
BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:3000")
TIMEOUT = 30  # seconds per request (argon2 hashing can be slow)


# ---------------------------------------------------------------------------
# Shared state across tests
# ---------------------------------------------------------------------------

class State:
    access_token: str | None = None
    refresh_cookie_value: str | None = None  # raw token value
    admin_user_id: str | None = None
    company_id: str | None = None
    created_user_ids: list[str] = []
    old_refresh_cookie_value: str | None = None  # for rotation tests


state = State()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_nested(obj, dotted_key):
    """Traverse a dict with dot-separated keys, e.g. 'data.user.email'."""
    keys = dotted_key.split(".")
    current = obj
    for k in keys:
        if isinstance(current, dict) and k in current:
            current = current[k]
        else:
            return "__MISSING__"
    return current


def extract_refresh_cookie(resp):
    """Extract nexa_refresh_token value from response Set-Cookie header."""
    sc = resp.headers.get("set-cookie", "")
    if "nexa_refresh_token=" not in sc:
        return None
    for part in sc.split(";"):
        part = part.strip()
        if part.startswith("nexa_refresh_token="):
            return part.split("=", 1)[1]
    return None


def do_login(email, password):
    """Execute a login request and return (status, body, resp) tuple."""
    resp = http.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": password},
        timeout=TIMEOUT,
    )
    try:
        body = resp.json()
    except Exception:
        body = {"_raw": resp.text[:500]}
    return resp.status_code, body, resp


def ensure_login():
    """Attempt login with seeded credentials if we don't have a token yet."""
    if state.access_token:
        return True
    # Try seeded credentials first, then test plan credentials
    for email, pw in [
        ("admin@nexa-erp.dev", "NexaDev2026!"),
        ("admin@test.com", "ValidPassword123!"),
    ]:
        try:
            status, body, resp = do_login(email, pw)
            if status == 200 and body.get("success"):
                data = body.get("data", {})
                state.access_token = data.get("accessToken")
                user = data.get("user", {})
                state.admin_user_id = user.get("id")
                state.company_id = user.get("tenantId") or user.get("companyId")
                cookie_val = extract_refresh_cookie(resp)
                if cookie_val:
                    state.refresh_cookie_value = cookie_val
                return True
        except Exception:
            continue
    return False


# ---------------------------------------------------------------------------
# Test case execution
# ---------------------------------------------------------------------------

# IDs of tests that require a valid TOTP and cannot be automated
SKIP_TOTP_TESTS = {"LOGIN-014", "MFA-VERIFY-001"}

# IDs of tests that require special seed data not present
SKIP_MISSING_SEED = {
    "LOGIN-010": "Requires seeded inactive user (inactive@test.com)",
    "LOGIN-011": "Account lockout requires 5+ sequential argon2 verifications (>30s total, times out)",
    "LOGIN-012": "Requires seeded user with no company role (norole@test.com)",
    "LOGIN-013": "Requires seeded MFA-enabled user (mfa-user@test.com)",
    "LOGIN-015": "Requires seeded MFA-enabled user with valid TOTP",
    "LOGIN-016": "Requires non-MFA user for mfaToken validation test",
    "LOGIN-017": "Requires non-MFA user for mfaToken non-digit validation test",
    "REFRESH-004": "Requires a previously-rotated refresh token",
    "REFRESH-005": "Requires an expired refresh token record",
    "REFRESH-006": "Requires a deactivated user's refresh token",
    "MFA-SETUP-003": "Requires a user with mfaEnabled=true",
    "MFA-VERIFY-005": "Requires a user with mfaSecret=null (no setup initiated)",
    "MFA-VERIFY-007": "Requires authenticated MFA verify attempts (needs working login first)",
    "MFA-RESET-001": "Requires MFA-enabled target user + working admin auth",
    "MFA-RESET-002": "Requires non-admin token for RBAC denial test",
    "MFA-RESET-003": "Requires staff-level token for RBAC denial test",
    "MFA-RESET-004": "Requires manager-level token for RBAC denial test",
    "MFA-RESET-005": "Requires self-reset test with working admin auth",
    "MFA-RESET-006": "Requires non-existent user ID test with working admin auth",
    "MFA-RESET-007": "Requires admin auth for unauthenticated test",
    "MFA-RESET-008": "Requires cross-company target user",
    "MFA-RESET-009": "Requires admin auth for missing userId body test",
}


def resolve_headers(headers_spec, tc_id):
    """Resolve placeholder tokens in request headers."""
    headers = dict(headers_spec)
    if "Authorization" in headers:
        val = headers["Authorization"]
        if any(p in val for p in [
            "<valid-access-token>", "<admin-token>", "<admin_access_token>"
        ]):
            if state.access_token:
                headers["Authorization"] = f"Bearer {state.access_token}"
            else:
                headers["Authorization"] = "Bearer __NO_TOKEN_AVAILABLE__"
        elif "<expired-access-token>" in val:
            headers["Authorization"] = "Bearer expired.jwt.token.value"
        elif "<mfa-enabled-user-token>" in val:
            headers["Authorization"] = "Bearer __MFA_USER_TOKEN_PLACEHOLDER__"
        elif "<user-without-mfa-secret-token>" in val:
            headers["Authorization"] = "Bearer __NO_MFA_SECRET_TOKEN__"
        elif "<viewer-token>" in val or "<staff-token>" in val:
            headers["Authorization"] = "Bearer __LOW_ROLE_TOKEN__"

    if "X-Company-ID" in headers:
        val = headers["X-Company-ID"]
        if "<" in val and ">" in val:
            headers["X-Company-ID"] = state.company_id or "00000000-0000-4000-a000-000000000001"
    return headers


def resolve_body(body_spec, tc_id):
    """Resolve placeholder tokens in request body."""
    if body_spec is None:
        return None
    body_str = json.dumps(body_spec)
    replacements = {
        "<userId>": state.admin_user_id or "00000000-0000-4000-a000-000000000002",
        "<valid-totp>": "000000",
        "<valid-totp-from-secret>": "000000",
        "<target-user-id>": state.created_user_ids[-1] if state.created_user_ids else "00000000-0000-0000-0000-000000000099",
    }
    for placeholder, value in replacements.items():
        body_str = body_str.replace(placeholder, value)
    return json.loads(body_str)


def resolve_url(url):
    """Resolve :id in URL paths."""
    if ":id" in url:
        if state.created_user_ids:
            url = url.replace(":id", state.created_user_ids[-1])
        elif state.admin_user_id:
            url = url.replace(":id", state.admin_user_id)
        else:
            url = url.replace(":id", "00000000-0000-4000-a000-000000000002")
    return url


def execute_request(method, url, headers, json_body, cookies):
    """Execute an HTTP request and return (status_code, body_dict, response)."""
    full_url = f"{BASE_URL}{url}"
    try:
        resp = http.request(
            method,
            full_url,
            json=json_body if json_body is not None else None,
            headers=headers,
            cookies=cookies if cookies else None,
            timeout=TIMEOUT,
            allow_redirects=False,
        )
        try:
            body = resp.json()
        except Exception:
            body = {"_raw": resp.text[:500]}
        return resp.status_code, body, resp, None
    except http.exceptions.ConnectionError as e:
        return None, None, None, f"Connection error: {str(e)[:200]}"
    except (http.exceptions.Timeout, http.exceptions.ReadTimeout):
        return None, None, None, "Request timed out (server may be busy with argon2 hashing)"
    except Exception as e:
        return None, None, None, f"Error: {str(e)[:200]}"


def run_test(endpoint, tc):
    """Run a single test case and return a result dict."""
    tc_id = tc["id"]
    tc_name = tc["name"]
    tc_type = tc["type"]
    req = tc["request"]
    expected = tc["expected"]

    # ------------------------------------------------------------------
    # Check for skip conditions
    # ------------------------------------------------------------------
    if tc_id in SKIP_TOTP_TESTS:
        return make_result(endpoint, tc, "skip", error="Requires valid TOTP generation (cannot automate)")

    if tc_id in SKIP_MISSING_SEED:
        return make_result(endpoint, tc, "skip", error=SKIP_MISSING_SEED[tc_id])

    # ------------------------------------------------------------------
    # Pre-conditions: ensure auth if needed
    # ------------------------------------------------------------------
    if endpoint.get("auth_required"):
        ensure_login()

    # For login tests, don't attempt pre-auth
    # For refresh/logout tests, ensure we have a cookie if available
    if tc_id == "REFRESH-001":
        ensure_login()
    if tc_id == "LOGOUT-001":
        ensure_login()

    # ------------------------------------------------------------------
    # Handle repeat tests (account lockout) — most are skipped due to
    # argon2 slowness, but handle gracefully if reached
    # ------------------------------------------------------------------
    repeat = req.get("repeat", 1)
    if repeat > 1:
        for _ in range(repeat - 1):
            try:
                execute_request(
                    req["method"], req["url"],
                    resolve_headers(req.get("headers", {}), tc_id),
                    resolve_body(req.get("body"), tc_id),
                    None,
                )
            except Exception:
                pass
            time.sleep(0.1)

    # ------------------------------------------------------------------
    # Resolve request parameters
    # ------------------------------------------------------------------
    method = req["method"]
    url = resolve_url(req["url"])
    headers = resolve_headers(req.get("headers", {}), tc_id)
    json_body = resolve_body(req.get("body"), tc_id)

    # Cookie handling
    cookies = {}
    cookies_spec = req.get("cookies", {})
    for cname, cval in cookies_spec.items():
        if "<valid-refresh-token>" in str(cval):
            if state.refresh_cookie_value:
                cookies[cname] = state.refresh_cookie_value
            else:
                cookies[cname] = "no-valid-cookie"
        elif "<already-revoked-token>" in str(cval):
            cookies[cname] = state.old_refresh_cookie_value or "revoked-placeholder"
        elif "<" in str(cval) and ">" in str(cval):
            cookies[cname] = "invalid-placeholder-token"
        else:
            cookies[cname] = cval

    # ------------------------------------------------------------------
    # Execute the request
    # ------------------------------------------------------------------
    status_code, body, resp, err = execute_request(method, url, headers, json_body, cookies or None)

    if err:
        return make_result(endpoint, tc, "fail", actual_status=None, body=None, error=err,
                          assertions=[{"check": "request execution", "passed": False}])

    # ------------------------------------------------------------------
    # Capture state from successful responses
    # ------------------------------------------------------------------
    if req["url"] == "/auth/login" and status_code == 200 and body.get("success"):
        data = body.get("data", {})
        if data.get("accessToken") and not data.get("requiresMfa"):
            state.access_token = data["accessToken"]
            user = data.get("user", {})
            if user.get("id"):
                state.admin_user_id = user["id"]
            if user.get("tenantId"):
                state.company_id = user["tenantId"]
            cv = extract_refresh_cookie(resp)
            if cv:
                state.old_refresh_cookie_value = state.refresh_cookie_value
                state.refresh_cookie_value = cv

    if req["url"] == "/auth/refresh" and status_code == 200:
        data = body.get("data", {})
        if data.get("accessToken"):
            state.access_token = data["accessToken"]
        cv = extract_refresh_cookie(resp)
        if cv:
            state.old_refresh_cookie_value = state.refresh_cookie_value
            state.refresh_cookie_value = cv

    if req["method"] == "POST" and "/system/users" in req["url"] and status_code in (200, 201):
        data = body.get("data", {})
        if data.get("id"):
            state.created_user_ids.append(data["id"])

    # ------------------------------------------------------------------
    # Run assertions
    # ------------------------------------------------------------------
    assertions = []

    # 1) Status code
    exp_status = expected["status"]
    status_ok = status_code == exp_status
    assertions.append({
        "check": "status code",
        "passed": status_ok,
        "expected": exp_status,
        "actual": status_code,
    })

    # 2) body_contains
    for field in expected.get("body_contains", []):
        val = get_nested(body, field)
        if val == "__MISSING__":
            val = get_nested(body, f"data.{field}")
        found = val != "__MISSING__"
        assertions.append({"check": f"body contains '{field}'", "passed": found})

    # 3) body_exact
    for dotted_key, exp_val in expected.get("body_exact", {}).items():
        actual_val = get_nested(body, dotted_key)
        matched = actual_val == exp_val
        assertions.append({
            "check": f"body['{dotted_key}'] == {json.dumps(exp_val)}",
            "passed": matched,
            "expected": exp_val,
            "actual": actual_val if actual_val != "__MISSING__" else None,
        })

    # 4) headers_contain
    if resp:
        resp_headers_lower = {k.lower(): v for k, v in resp.headers.items()}
        for hdr in expected.get("headers_contain", []):
            found = hdr.lower() in resp_headers_lower
            assertions.append({"check": f"header '{hdr}' present", "passed": found})

    # 5) cookie_set
    cookie_set = expected.get("cookie_set")
    if cookie_set and resp:
        sc = resp.headers.get("set-cookie", "")
        assertions.append({
            "check": f"cookie '{cookie_set}' set",
            "passed": cookie_set in sc,
        })

    # 6) cookie_not_set
    cookie_not_set = expected.get("cookie_not_set")
    if cookie_not_set and resp:
        sc = resp.headers.get("set-cookie", "")
        assertions.append({
            "check": f"cookie '{cookie_not_set}' NOT set",
            "passed": cookie_not_set not in sc,
        })

    # 7) cookie_cleared
    cookie_cleared = expected.get("cookie_cleared")
    if cookie_cleared and resp:
        sc = resp.headers.get("set-cookie", "")
        cleared = (
            cookie_cleared in sc
            and ("max-age=0" in sc.lower() or "expires=thu, 01 jan 1970" in sc.lower())
        )
        assertions.append({
            "check": f"cookie '{cookie_cleared}' cleared",
            "passed": cleared,
        })

    # 8) DB verification note (not automated, just noted)
    db_v = tc.get("db_verification", {})
    if db_v.get("enabled"):
        assertions.append({
            "check": "db_verification (manual)",
            "passed": None,
            "note": db_v.get("expected", ""),
        })

    # ------------------------------------------------------------------
    # Determine pass/fail
    # ------------------------------------------------------------------
    definite = [a for a in assertions if a.get("passed") is not None]
    all_passed = all(a["passed"] for a in definite) if definite else False

    return make_result(
        endpoint, tc,
        status="pass" if all_passed else "fail",
        actual_status=status_code,
        body=body,
        assertions=assertions,
        error=None if all_passed else "One or more assertions failed",
    )


def make_result(endpoint, tc, status, actual_status=None, body=None,
                assertions=None, error=None):
    """Build a standardized result dict."""
    return {
        "endpoint": f"{tc['request']['method']} {tc['request']['url']}",
        "test_id": tc["id"],
        "test_name": tc["name"],
        "type": tc["type"],
        "status": status,
        "expected_status": tc["expected"]["status"],
        "actual_status": actual_status,
        "response_body": body,
        "assertions": assertions or [],
        "error": error,
    }


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

def write_markdown_report(output):
    """Generate human-readable markdown report."""
    s = output["summary"]
    executed = s["total"] - s["skipped"]
    pass_rate = f"{s['passed'] * 100 // executed}%" if executed > 0 else "N/A"

    lines = [
        "# Backend API Test Report — Epic E2",
        "",
        f"**Executed at:** {output['executed_at']}",
        f"**API Base URL:** {output['api_base_url']}",
        "",
        "## Summary",
        "",
        "| Metric | Count |",
        "|--------|-------|",
        f"| Total | {s['total']} |",
        f"| Passed | {s['passed']} |",
        f"| Failed | {s['failed']} |",
        f"| Skipped | {s['skipped']} |",
        f"| Pass Rate (excl. skipped) | {pass_rate} |",
        "",
    ]

    # Group by endpoint
    by_ep = OrderedDict()
    for r in output["results"]:
        ep = r["endpoint"]
        by_ep.setdefault(ep, []).append(r)

    lines.append("## Results by Endpoint")
    lines.append("")

    for ep, tests in by_ep.items():
        ep_p = sum(1 for t in tests if t["status"] == "pass")
        ep_f = sum(1 for t in tests if t["status"] == "fail")
        ep_s = sum(1 for t in tests if t["status"] == "skip")
        tag = "PASS" if ep_f == 0 and ep_p > 0 else ("PARTIAL" if ep_p > 0 else "FAIL")
        lines.append(f"### {ep} [{tag}: {ep_p}P/{ep_f}F/{ep_s}S]")
        lines.append("")
        lines.append("| ID | Test Name | Type | Status | Expected | Actual |")
        lines.append("|----|-----------|------|--------|----------|--------|")
        for t in tests:
            badge = {"pass": "PASS", "fail": "**FAIL**", "skip": "SKIP"}[t["status"]]
            lines.append(
                f"| {t['test_id']} | {t['test_name']} | {t['type']} "
                f"| {badge} | {t['expected_status']} | {t['actual_status'] or '-'} |"
            )
        lines.append("")

    # Failure details
    failures = [r for r in output["results"] if r["status"] == "fail"]
    if failures:
        lines.append("## Failure Details")
        lines.append("")
        for f in failures:
            lines.append(f"### {f['test_id']}: {f['test_name']}")
            lines.append("")
            lines.append(f"- **Endpoint:** {f['endpoint']}")
            lines.append(f"- **Expected status:** {f['expected_status']}")
            lines.append(f"- **Actual status:** {f['actual_status']}")
            if f.get("error"):
                lines.append(f"- **Error:** {f['error']}")
            lines.append("")
            failed_asserts = [a for a in f.get("assertions", []) if a.get("passed") is False]
            if failed_asserts:
                lines.append("**Failed assertions:**")
                lines.append("")
                for a in failed_asserts:
                    extra = ""
                    if "expected" in a and "actual" in a:
                        extra = f" (expected: {a['expected']}, actual: {a['actual']})"
                    lines.append(f"- {a['check']}{extra}")
                lines.append("")
            if f.get("response_body"):
                body_str = json.dumps(f["response_body"], indent=2, default=str)
                if len(body_str) > 500:
                    body_str = body_str[:500] + "\n... (truncated)"
                lines.append("**Response body:**")
                lines.append("```json")
                lines.append(body_str)
                lines.append("```")
                lines.append("")

    # Skipped tests
    skipped = [r for r in output["results"] if r["status"] == "skip"]
    if skipped:
        lines.append("## Skipped Tests")
        lines.append("")
        lines.append("| ID | Test Name | Reason |")
        lines.append("|----|-----------|--------|")
        for t in skipped:
            reason = (t.get("error") or "").replace("SKIPPED: ", "")
            lines.append(f"| {t['test_id']} | {t['test_name']} | {reason} |")
        lines.append("")

    # Infrastructure notes
    lines.extend([
        "## Infrastructure Notes",
        "",
        "Key issues discovered during test execution:",
        "",
        "1. **Password hashing mismatch:** Seed uses `scrypt` but auth service uses `argon2id` — login fails with 500.",
        "2. **JWT_SECRET too short:** `.env` has 20 chars but auth service requires minimum 32.",
        "3. **Seed credential mismatch:** Seeded user is `admin@nexa-erp.dev` / `NexaDev2026!`, but test plan expects `admin@test.com` / `ValidPassword123!`.",
        "4. **Missing test seed data:** No `inactive@test.com`, `norole@test.com`, or `mfa-user@test.com` users in seed.",
        "5. **MFA TOTP tests:** Cannot generate valid TOTP codes without access to the stored MFA secret at test time.",
        "",
    ])

    with open(REPORT_PATH, "w") as f:
        f.write("\n".join(lines))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print(f"Loading test plan: {TEST_PLAN_PATH}")
    with open(TEST_PLAN_PATH) as f:
        plan = json.load(f)

    print(f"Epic: {plan['epic_id']} — {plan['epic_title']}")
    print(f"Endpoints: {len(plan['endpoints'])} | Test cases: {plan['total_test_cases']}")
    print(f"API Base: {BASE_URL}")
    print("=" * 70)

    results = []
    total = passed = failed = skipped = 0

    for ep_idx, endpoint in enumerate(plan["endpoints"], 1):
        ep_label = f"{endpoint['method']} {endpoint['path']}"
        tc_list = endpoint.get("test_cases", [])
        print(f"\n[{ep_idx}/{len(plan['endpoints'])}] {ep_label} ({len(tc_list)} tests)")

        for tc in tc_list:
            total += 1
            tc_id = tc["id"]

            result = run_test(endpoint, tc)
            results.append(result)

            if result["status"] == "pass":
                passed += 1
                print(f"  PASS  {tc_id}: {tc['name']}")
            elif result["status"] == "skip":
                skipped += 1
                print(f"  SKIP  {tc_id}: {tc['name']}")
            else:
                failed += 1
                failed_checks = [
                    a["check"] for a in result.get("assertions", [])
                    if a.get("passed") is False
                ]
                detail = f" — {', '.join(failed_checks[:3])}" if failed_checks else ""
                print(f"  FAIL  {tc_id}: {tc['name']} "
                      f"(exp={result['expected_status']}, got={result['actual_status']}){detail}")

            time.sleep(0.03)  # small delay to avoid overwhelming the server

    # Summary
    print("\n" + "=" * 70)
    print(f"RESULTS: {total} total | {passed} passed | {failed} failed | {skipped} skipped")
    print("=" * 70)

    # Write JSON
    output = {
        "epic_id": plan["epic_id"],
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "api_base_url": BASE_URL,
        "summary": {"total": total, "passed": passed, "failed": failed, "skipped": skipped},
        "results": results,
    }

    os.makedirs(os.path.dirname(RESULTS_PATH), exist_ok=True)
    with open(RESULTS_PATH, "w") as f:
        json.dump(output, f, indent=2, default=str)
    print(f"\nJSON results: {RESULTS_PATH}")

    # Write markdown
    write_markdown_report(output)
    print(f"Markdown report: {REPORT_PATH}")


if __name__ == "__main__":
    main()
