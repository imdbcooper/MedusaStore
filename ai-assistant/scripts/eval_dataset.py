#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.evaluation import evaluate_case_response, load_evaluation_cases

BASE_URL = os.environ.get("AI_ASSISTANT_BASE_URL", "http://localhost:8000/api/v1").rstrip("/")
TOKEN = os.environ.get("AI_ASSISTANT_API_TOKEN", "")


def request(
    path: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    token: bool = False,
    request_id: str = "eval-ai-assistant",
) -> tuple[int, dict[str, Any]]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json", "X-Request-ID": request_id}
    if token and TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    req = urllib.request.Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        return exc.code, json.loads(body) if body else {}


def run_case(case, *, assume_not_live: bool) -> tuple[list[str], dict[str, Any] | None]:
    session_id = None
    final_response: dict[str, Any] | None = None
    for turn_index, message in enumerate(case.conversation, start=1):
        payload: dict[str, Any] = {
            "message": message,
            "store_id": case.store_id,
            "locale": case.locale,
        }
        if session_id:
            payload["session_id"] = session_id
        if case.tenant_id is not None:
            payload["tenant_id"] = case.tenant_id
        if case.customer_id is not None:
            payload["customer_id"] = case.customer_id
        status, response = request(
            "/chat",
            method="POST",
            payload=payload,
            request_id=f"eval-{case.id}-{turn_index}",
        )
        if status != 200:
            return [f"http_status={status}", json.dumps(response, ensure_ascii=False)], response
        session_id = response.get("session_id")
        final_response = response
    if final_response is None:
        return ["empty_conversation"], None
    return evaluate_case_response(case, final_response, assume_not_live=assume_not_live), final_response


def main() -> int:
    parser = argparse.ArgumentParser(description="Run assistant evaluation dataset against the live /chat API.")
    parser.add_argument(
        "--dataset",
        default=str(ROOT / "evaluation" / "dataset.jsonl"),
        help="Path to evaluation/dataset.jsonl",
    )
    parser.add_argument(
        "--case",
        action="append",
        default=[],
        help="Case id to run. Repeat to run multiple ids.",
    )
    parser.add_argument(
        "--assume-not-live",
        action="store_true",
        help="Also enforce *_when_medusa_down and forbidden_when_not_live checks.",
    )
    parser.add_argument(
        "--fail-fast",
        action="store_true",
        help="Stop on the first failing case.",
    )
    args = parser.parse_args()

    status, health = request("/health", request_id="eval-health")
    if status != 200 or health.get("status") != "ok":
        raise SystemExit(f"health failed: {status} {health}")

    selected = set(args.case)
    cases = [
        case
        for case in load_evaluation_cases(args.dataset)
        if not selected or case.id in selected
    ]
    if not cases:
        raise SystemExit("no evaluation cases selected")

    passed = 0
    failed = 0
    for case in cases:
        failures, response = run_case(case, assume_not_live=args.assume_not_live)
        if failures:
            failed += 1
            print(f"[FAIL] {case.id}")
            for failure in failures:
                print(f"  - {failure}")
            if response:
                print(f"  answer: {response.get('answer')}")
                print(f"  intent: {response.get('intent')}")
                print(f"  safety: {json.dumps(response.get('safety') or {}, ensure_ascii=False)}")
                print(f"  actions: {json.dumps(response.get('actions') or [], ensure_ascii=False)}")
                print(
                    "  human_handoff: "
                    f"{json.dumps(((response.get('observability') or {}).get('human_handoff') or {}), ensure_ascii=False)}"
                )
            if args.fail_fast:
                break
            continue
        passed += 1
        print(f"[PASS] {case.id}")

    print(f"\nEvaluation summary: {passed} passed, {failed} failed, {len(cases)} total")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
