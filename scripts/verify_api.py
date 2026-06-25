#!/usr/bin/env python3
"""E2E verification for zMailR programmatic API (lease + mail poll).

Requires: pip install requests  (see requirements-dev.txt)

Environment variables (overridden by CLI flags):
  ZMAIL_BASE_URL  API base URL, e.g. https://your-domain
  ZMAIL_TOKEN     Bearer API token from /admin

Typical flow:
  1. POST /api/lease — obtain a temporary mailbox
  2. Trigger an external registration / OTP send to that address (unless --send-test)
  3. GET /api/mail — single long-poll; server waits up to `timeout` seconds

The server automatically skips emails already returned by prior successful /api/mail
calls for the same mailbox, so repeated polls wait for the next message without
passing `since`. Optional `since` (Unix seconds) still filters by receive time.
"""

from __future__ import annotations

import argparse
import os
import sys
import time

try:
    import requests
except ImportError:
    print("Missing dependency: pip install requests", file=sys.stderr)
    sys.exit(1)


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def lease_mailbox(session: requests.Session, base_url: str, token: str) -> str:
    url = f"{base_url.rstrip('/')}/api/lease"
    resp = session.post(url, headers=auth_headers(token), timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("success"):
        raise RuntimeError(f"lease failed: {data.get('error') or data}")
    email = data.get("email")
    if not email:
        raise RuntimeError(f"lease response missing email: {data}")
    return email


def poll_mail(
    session: requests.Session,
    base_url: str,
    token: str,
    email: str,
    *,
    since: int | None = None,
    timeout: int,
) -> dict:
    url = f"{base_url.rstrip('/')}/api/mail"
    params: dict[str, str | int] = {"to": email, "timeout": timeout}
    if since is not None:
        params["since"] = since
    # HTTP timeout must exceed server long-poll window.
    http_timeout = timeout + 10
    resp = session.get(
        url,
        headers=auth_headers(token),
        params=params,
        timeout=http_timeout,
    )
    return resp.json()


def send_test_mail(
    session: requests.Session,
    base_url: str,
    token: str,
    to_email: str,
    code: str,
) -> None:
    """Optional self-test: send a message with a known code via POST /api/send."""
    url = f"{base_url.rstrip('/')}/api/send"
    payload = {
        "to": to_email,
        "subject": "您的验证码",
        "text": f"验证码是：{code}",
    }
    resp = session.post(
        url,
        headers={**auth_headers(token), "Content-Type": "application/json"},
        json=payload,
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data.get("success"):
        raise RuntimeError(f"send failed: {data.get('error') or data}")


def extract_code(data: dict) -> str | None:
    if not data.get("success"):
        return None
    code = data.get("code")
    if code is None:
        return None
    text = str(code).strip()
    return text or None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify zMailR lease + mail API (UTF-8 safe JSON, no client retries).",
        epilog=(
            "Without --send-test, trigger OTP delivery to the leased address yourself "
            "(e.g. start registration) before or while this script polls."
        ),
    )
    parser.add_argument(
        "--base-url",
        default=os.environ.get("ZMAIL_BASE_URL", ""),
        help="API base URL (env: ZMAIL_BASE_URL)",
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("ZMAIL_TOKEN", ""),
        help="Bearer API token (env: ZMAIL_TOKEN)",
    )
    parser.add_argument(
        "--email",
        help="Skip lease; poll this mailbox address instead",
    )
    parser.add_argument(
        "--since",
        type=int,
        help="Unix timestamp for optional `since` param (power users)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=55,
        help="Long-poll timeout in seconds (API max 55, default 55)",
    )
    parser.add_argument(
        "--send-test",
        action="store_true",
        help="After lease, POST /api/send a UTF-8 test message with a known code to the mailbox",
    )
    parser.add_argument(
        "--test-code",
        default="847291",
        help="Code embedded in --send-test message (default: 847291)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.base_url or not args.token:
        print("Error: set ZMAIL_BASE_URL and ZMAIL_TOKEN, or pass --base-url / --token", file=sys.stderr)
        return 1

    timeout = max(1, min(args.timeout, 55))
    session = requests.Session()
    t0 = time.perf_counter()

    try:
        if args.email:
            email = args.email
            print(f"Using mailbox: {email}")
        else:
            print("Leasing mailbox...")
            email = lease_mailbox(session, args.base_url, args.token)
            elapsed = time.perf_counter() - t0
            print(f"Leased: {email} ({elapsed:.2f}s)")

            if args.send_test:
                print(f"Sending test mail (code={args.test_code})...")
                send_test_mail(session, args.base_url, args.token, email, args.test_code)
                print("Test mail sent.")

        since = args.since
        poll_label = f"timeout={timeout}s"
        if since is not None:
            poll_label = f"{poll_label}, since={since}"
        print(f"Polling /api/mail ({poll_label})...")
        poll_start = time.perf_counter()
        mail = poll_mail(
            session,
            args.base_url,
            args.token,
            email,
            since=since,
            timeout=timeout,
        )
        poll_elapsed = time.perf_counter() - poll_start

        code = extract_code(mail)
        if code:
            total = time.perf_counter() - t0
            subject = (mail.get("email") or {}).get("subject", "")
            print(f"Code: {code}")
            if subject:
                print(f"Subject: {subject}")
            print(f"Poll finished in {poll_elapsed:.2f}s (total {total:.2f}s)")
            return 0

        err = mail.get("error") or mail.get("message") or "no code in response"
        print(f"Failed: {err}", file=sys.stderr)
        print(f"Response: {mail}", file=sys.stderr)
        print(f"Poll finished in {poll_elapsed:.2f}s", file=sys.stderr)
        return 3

    except requests.HTTPError as exc:
        print(f"HTTP error: {exc}", file=sys.stderr)
        if exc.response is not None:
            try:
                print(exc.response.json(), file=sys.stderr)
            except Exception:
                print(exc.response.text[:500], file=sys.stderr)
        return 4
    except requests.RequestException as exc:
        print(f"Request error: {exc}", file=sys.stderr)
        return 4
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
