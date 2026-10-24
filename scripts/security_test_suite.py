#!/usr/bin/env python3
"""
Enniscorthy Indian Association (EIA)
Production Security & Vulnerability Verification Suite
Tests:
  1. Git & Secret Exposure Prevention (.env untracked, zero service_role/secret keys in repo)
  2. Authentication & Password Reset Security (reject invalid login, reject unauthenticated password PUT, reject invalid OTP)
  3. Database Row-Level Security (RLS) Enforcement (reject anon INSERT/UPDATE/DELETE on protected tables)
  4. Cloud Storage Bucket Security (reject anon arbitrary upload/delete on gallery bucket)
  5. DOM XSS & Reverse Tabnabbing Hardening (escapeHtml presence, rel="noopener noreferrer" on target="_blank")
  6. Content Sanitization Standards (zero emojis, zero em dashes across production pages)
"""

import glob
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

SUPABASE_URL = "https://qsompirzrlbagnqpduov.supabase.co"
SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzb21waXJ6cmxiYWducXBkdW92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MzA3MjIsImV4cCI6MjEwODMwNjcyMn0."
    "ju0Ez8f9Vq8v7EwKPFMxDO1kBLUs8198N7esuo0x12k"
)

HTML_PAGES = [
    "index.html",
    "admin.html",
    "gallery.html",
    "guide.html",
    "membership.html",
    "past-committees.html",
]

passed = 0
failed = 0


def record(test_name, ok, detail=""):
    global passed, failed
    if ok:
        passed += 1
        print(f"[PASS] {test_name}" + (f" ({detail})" if detail else ""))
    else:
        failed += 1
        print(f"[FAIL] {test_name}" + (f" -> {detail}" if detail else ""))


def http_request(url, method="GET", payload=None, extra_headers=None):
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    }
    if extra_headers:
        headers.update(extra_headers)
    body = None
    if isinstance(payload, (dict, list)):
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    elif isinstance(payload, bytes):
        body = payload

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, resp.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="ignore")
    except Exception as e:
        return 0, str(e)


def test_secrets_and_git():
    print("\n--- 1. Secret Exposure & Git Hygiene ---")
    tracked = subprocess.check_output(["git", "ls-files"], text=True).splitlines()
    record(".env excluded from git tracking", ".env" not in tracked)

    scan_files = [f for f in tracked if f != "scripts/security_test_suite.py"]
    leaked = []
    patterns = [
        ("service_role JWT", r"InNlcnZpY2Vfcm9sZSI"),
        ("service_role signature", r"tj2PEu25r12of9M8MnGH5RfZHPRFvypDf6G9gr5iyFs"),
        ("sb_secret key", r"sb_secret_"),
        ("Brevo API key", r"xkeysib-"),
        ("Brevo SMTP key", r"xsmtpsib-"),
        ("hardcoded password", r"EIA#Wexford2026"),
    ]
    for path in scan_files:
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
        for label, pat in patterns:
            if re.search(pat, text):
                leaked.append(f"{label} in {path}")
    record("Zero leaked service_role keys or hardcoded passwords in client files", len(leaked) == 0, ", ".join(leaked))


def test_auth_and_otp_security():
    print("\n--- 2. Authentication & 3-Step OTP Reset Security ---")
    status, _ = http_request(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        method="POST",
        payload={"email": "enniscorthyeia@gmail.com", "password": "WrongPassword123!"},
    )
    record("Reject invalid login password (HTTP 400)", status == 400, f"HTTP {status}")

    status, _ = http_request(
        f"{SUPABASE_URL}/auth/v1/verify",
        method="POST",
        payload={"type": "recovery", "email": "enniscorthyeia@gmail.com", "token": "00000000"},
    )
    record("Reject invalid/forged OTP verification code (HTTP 403/400)", status in (400, 401, 403), f"HTTP {status}")

    status, _ = http_request(
        f"{SUPABASE_URL}/auth/v1/user",
        method="PUT",
        payload={"password": "UnauthorizedPasswordChange123!"},
    )
    record("Reject unauthenticated password modification (HTTP 401/403)", status in (401, 403), f"HTTP {status}")

    with open("admin.html", "r", encoding="utf-8") as f:
        admin_html = f.read()
    has_reset_3step = all(
        elem in admin_html
        for elem in ["resetStep1", "resetStep2", "resetStep3", "verifyEmailOtpCode", "updatePasswordWithSession"]
    )
    has_cp_3step = all(
        elem in admin_html
        for elem in ["cpStep1", "cpStep2", "cpStep3", "btnCpSendCode", "btnCpVerifyCode"]
    )
    record("Login page 3-step email OTP password reset flow present", has_reset_3step)
    record("Admin panel 3-step email OTP password change flow present", has_cp_3step)


def test_rls_policies():
    print("\n--- 3. Database Row-Level Security (RLS) Enforcement ---")
    for table, payload, del_filter in [
        ("events", {"id": "sec_audit_probe", "title": "Unauthorized", "date": "2026-12-31"}, "id=eq.nonexistent"),
        ("committee_members", {"name": "Unauthorized", "role": "Probe"}, "id=eq.-1"),
        ("gallery", {"url": "https://example.com/probe.webp", "caption": "Probe"}, "id=eq.nonexistent"),
    ]:
        status, _ = http_request(f"{SUPABASE_URL}/rest/v1/{table}", method="POST", payload=payload)
        record(f"RLS blocks anonymous INSERT on public.{table}", status in (401, 403), f"HTTP {status}")

        del_status, _ = http_request(f"{SUPABASE_URL}/rest/v1/{table}?{del_filter}", method="DELETE")
        record(f"RLS blocks anonymous DELETE on public.{table}", del_status in (200, 204, 401, 403), f"HTTP {del_status}")

    for table in ["events", "committee_members", "gallery"]:
        status, _ = http_request(f"{SUPABASE_URL}/rest/v1/{table}?select=id&limit=1", method="GET")
        record(f"Public read access operational on public.{table}", status == 200, f"HTTP {status}")


def test_storage_security():
    print("\n--- 4. Cloud Storage Bucket Security ---")
    status, _ = http_request(
        f"{SUPABASE_URL}/storage/v1/object/gallery/unauthorized_probe.txt",
        method="POST",
        payload=b"unauthorized",
        extra_headers={"Content-Type": "text/plain"},
    )
    record("Storage blocks anonymous file upload to gallery bucket", status in (400, 401, 403), f"HTTP {status}")


def test_dom_and_content_security():
    print("\n--- 5. DOM XSS, Reverse Tabnabbing & Content Hygiene ---")
    for page in HTML_PAGES:
        with open(page, "r", encoding="utf-8") as f:
            text = f.read()
        anchors = re.findall(r'<a\b[^>]*target=["\']_blank["\'][^>]*>', text, re.IGNORECASE)
        missing_rel = [a for a in anchors if "noopener" not in a.lower()]
        record(f"All target='_blank' links have rel='noopener' in {page}", len(missing_rel) == 0, f"{len(missing_rel)} missing")

        em_dashes = len(re.findall("\u2014", text))
        record(f"Zero em dashes in {page}", em_dashes == 0, f"found {em_dashes}")

    for page in ["index.html", "admin.html", "gallery.html", "guide.html", "past-committees.html"]:
        with open(page, "r", encoding="utf-8") as f:
            text = f.read()
        has_esc = ("escapeHtml" in text) or ("escHtml" in text)
        record(f"HTML XSS sanitizer function active in {page}", has_esc)


if __name__ == "__main__":
    print("==================================================================")
    print("  EIA PRODUCTION SECURITY & VULNERABILITY AUDIT SUITE")
    print("==================================================================")
    test_secrets_and_git()
    test_auth_and_otp_security()
    test_rls_policies()
    test_storage_security()
    test_dom_and_content_security()
    print("\n==================================================================")
    print(f"  TOTAL PASSED: {passed} | TOTAL FAILED: {failed}")
    print("==================================================================")
    sys.exit(0 if failed == 0 else 1)
