#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.evaluation import (
    compare_replay_turns,
    extract_assistant_messages,
    extract_user_messages,
    load_transcript_messages,
    load_transcript_user_messages,
    summarize_session_messages,
)

BASE_URL = os.environ.get("AI_ASSISTANT_BASE_URL", "http://localhost:8000/api/v1").rstrip("/")
TOKEN = os.environ.get("AI_ASSISTANT_API_TOKEN", "")


def request(
    path: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    query: dict[str, Any] | None = None,
    token: bool = False,
    request_id: str = "replay-ai-assistant",
) -> tuple[int, dict[str, Any]]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    url = f"{BASE_URL}{path}"
    if query:
        encoded = urllib.parse.urlencode({key: value for key, value in query.items() if value is not None})
        url = f"{url}?{encoded}"
    headers = {"Content-Type": "application/json", "X-Request-ID": request_id}
    if token and TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        return exc.code, json.loads(body) if body else {}


def fetch_scoped_history(
    *,
    session_id: str,
    store_id: str,
    locale: str,
    customer_id: str | None,
    limit: int,
) -> dict[str, Any]:
    if not TOKEN:
        raise SystemExit("AI_ASSISTANT_API_TOKEN is required for /chat/history/scoped")
    status, history = request(
        "/chat/history/scoped",
        query={
            "session_id": session_id,
            "store_id": store_id,
            "locale": locale,
            "customer_id": customer_id,
            "limit": limit,
        },
        token=True,
        request_id=f"replay-history-{session_id}",
    )
    if status != 200:
        raise SystemExit(f"history fetch failed: {status} {history}")
    return history


def print_history(messages: list[dict[str, Any]]) -> None:
    for index, message in enumerate(messages, start=1):
        role = (message.get("role") or "unknown").upper()
        content = str(message.get("content") or "").strip()
        print(f"{index:02d}. {role}: {content}")
        products = message.get("products") or []
        actions = message.get("actions") or []
        if products:
            product_titles = ", ".join(str(item.get("title") or item.get("id")) for item in products if isinstance(item, dict))
            print(f"    products: {product_titles}")
        if actions:
            action_types = ", ".join(str(item.get("type")) for item in actions if isinstance(item, dict))
            print(f"    actions: {action_types}")


def replay_messages(
    messages: list[str],
    *,
    store_id: str,
    locale: str,
    tenant_id: str | None,
    customer_id: str | None,
) -> tuple[int, list[dict[str, Any]]]:
    session_id: str | None = None
    responses: list[dict[str, Any]] = []
    for index, message in enumerate(messages, start=1):
        payload: dict[str, Any] = {"message": message, "store_id": store_id, "locale": locale}
        if session_id:
            payload["session_id"] = session_id
        if tenant_id is not None:
            payload["tenant_id"] = tenant_id
        if customer_id is not None:
            payload["customer_id"] = customer_id
        status, response = request(
            "/chat",
            method="POST",
            payload=payload,
            request_id=f"replay-chat-{index}",
        )
        print(f"\n[TURN {index}] USER: {message}")
        if status != 200:
            print(f"[TURN {index}] FAILED: {status} {json.dumps(response, ensure_ascii=False)}")
            return 1, responses
        session_id = response.get("session_id")
        responses.append(response)
        print(f"[TURN {index}] ASSISTANT: {response.get('answer')}")
        print(
            f"[TURN {index}] META: "
            f"intent={response.get('intent')} "
            f"status={(response.get('safety') or {}).get('status')} "
            f"needs_human={(response.get('safety') or {}).get('needs_human')}"
        )
    return 0, responses


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect or replay assistant sessions and bad-dialog transcripts.")
    parser.add_argument("--session-id", help="Existing assistant session id to inspect.")
    parser.add_argument("--store-id", default="default", help="Store id for history fetch/replay.")
    parser.add_argument("--locale", default="ru", help="Locale for history fetch/replay.")
    parser.add_argument("--customer-id", help="Optional bound customer id for scoped history.")
    parser.add_argument("--tenant-id", help="Optional tenant id when replaying turns.")
    parser.add_argument("--limit", type=int, default=50, help="Max history messages to fetch.")
    parser.add_argument("--transcript-file", help="JSON/JSONL/text file containing user turns or chat history.")
    parser.add_argument(
        "--replay",
        action="store_true",
        help="Replay extracted user turns through the current /chat endpoint.",
    )
    parser.add_argument(
        "--diff-report",
        action="store_true",
        help="After replay, compare current assistant turns with the original transcript/history.",
    )
    parser.add_argument(
        "--report-json",
        help="Optional file path to save the replay diff report as JSON.",
    )
    args = parser.parse_args()

    user_messages: list[str] = []
    baseline_messages: list[dict[str, Any]] = []
    if args.session_id:
        history = fetch_scoped_history(
            session_id=args.session_id,
            store_id=args.store_id,
            locale=args.locale,
            customer_id=args.customer_id,
            limit=args.limit,
        )
        messages = history.get("messages") or []
        baseline_messages = messages
        print_history(messages)
        print("\nSummary:")
        print(json.dumps(summarize_session_messages(messages), ensure_ascii=False, indent=2))
        user_messages = extract_user_messages(messages)
    if args.transcript_file:
        transcript_messages = load_transcript_messages(args.transcript_file)
        if transcript_messages:
            baseline_messages = transcript_messages
            user_messages = load_transcript_user_messages(args.transcript_file)
        else:
            user_messages = load_transcript_user_messages(args.transcript_file)
        print(f"Loaded {len(user_messages)} user turns from {args.transcript_file}")

    if args.replay:
        if not user_messages:
            raise SystemExit("no user turns available to replay")
        exit_code, responses = replay_messages(
            user_messages,
            store_id=args.store_id,
            locale=args.locale,
            tenant_id=args.tenant_id,
            customer_id=args.customer_id,
        )
        if args.diff_report and baseline_messages and responses:
            report = compare_replay_turns(
                user_messages,
                baseline_messages=baseline_messages,
                replay_responses=responses,
            )
            print("\nReplay diff report:")
            print(json.dumps(report, ensure_ascii=False, indent=2))
            if args.report_json:
                Path(args.report_json).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            changed_turns = int(report.get("changed_turns") or 0)
            print(
                "\nReplay diff summary: "
                f"{changed_turns} changed of {len(report.get('per_turn') or [])} assistant turns"
            )
            print(
                "Baseline assistant turns: "
                f"{len(extract_assistant_messages(baseline_messages))}, replay turns: {len(responses)}"
            )
        return exit_code
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
