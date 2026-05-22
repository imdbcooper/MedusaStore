from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class EvaluationCase:
    id: str
    store_id: str
    locale: str
    conversation: list[str]
    tenant_id: str | None = None
    customer_id: str | None = None
    expected_intent: str | None = None
    expected_safety_status: str | None = None
    expected_needs_human: bool | None = None
    expected_handoff_reason: str | None = None
    expected_safety_when_medusa_down: str | None = None
    must_have_tool_calls: list[str] | None = None
    must_have_action_types: list[str] | None = None
    must_not_have_action_types: list[str] | None = None
    must_have_citations: bool | None = None
    must_have_answer_regex: list[str] | None = None
    must_not_answer_regex: list[str] | None = None
    forbidden_when_not_live: list[str] | None = None
    forbidden_product_ids: list[str] | None = None
    forbidden_citations_from_tenant: str | None = None
    requires_prior_session_memory: bool = False
    notes: str | None = None


def load_evaluation_cases(path: str | Path) -> list[EvaluationCase]:
    cases: list[EvaluationCase] = []
    dataset_path = Path(path)
    for line in dataset_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        raw = json.loads(line)
        conversation = raw.get("conversation")
        if not conversation:
            message = raw.get("message")
            conversation = [str(message)] if message else []
        cases.append(
            EvaluationCase(
                id=str(raw["id"]),
                store_id=str(raw.get("store_id") or "default"),
                locale=str(raw.get("locale") or "ru"),
                conversation=[str(item) for item in conversation if str(item).strip()],
                tenant_id=raw.get("tenant_id"),
                customer_id=raw.get("customer_id"),
                expected_intent=raw.get("expected_intent"),
                expected_safety_status=raw.get("expected_safety_status"),
                expected_needs_human=raw.get("expected_needs_human"),
                expected_handoff_reason=raw.get("expected_handoff_reason"),
                expected_safety_when_medusa_down=raw.get("expected_safety_when_medusa_down"),
                must_have_tool_calls=_ensure_list(raw.get("must_have_tool_calls")),
                must_have_action_types=_ensure_list(raw.get("must_have_action_types")),
                must_not_have_action_types=_ensure_list(raw.get("must_not_have_action_types")),
                must_have_citations=raw.get("must_have_citations"),
                must_have_answer_regex=_ensure_list(raw.get("must_have_answer_regex")),
                must_not_answer_regex=_ensure_list(raw.get("must_not_answer_regex")),
                forbidden_when_not_live=_ensure_list(raw.get("forbidden_when_not_live")),
                forbidden_product_ids=_ensure_list(raw.get("forbidden_product_ids")),
                forbidden_citations_from_tenant=raw.get("forbidden_citations_from_tenant"),
                requires_prior_session_memory=bool(raw.get("requires_prior_session_memory")),
                notes=raw.get("notes"),
            )
        )
    return cases


def evaluate_case_response(
    case: EvaluationCase,
    response: dict[str, Any],
    *,
    assume_not_live: bool = False,
) -> list[str]:
    failures: list[str] = []
    answer = str(response.get("answer") or "")
    intent = response.get("intent")
    safety = response.get("safety") or {}
    observability = response.get("observability") or {}
    citations = response.get("citations") or []
    products = response.get("products") or []
    actions = response.get("actions") or []
    tool_calls = response.get("tool_calls") or []
    tool_names = [str(item.get("name")) for item in tool_calls if isinstance(item, dict)]
    action_types = [str(item.get("type")) for item in actions if isinstance(item, dict)]

    if case.expected_intent and intent != case.expected_intent:
        failures.append(f"expected_intent={case.expected_intent}, got={intent}")
    if case.expected_safety_status and safety.get("status") != case.expected_safety_status:
        failures.append(f"expected_safety_status={case.expected_safety_status}, got={safety.get('status')}")
    if case.expected_needs_human is not None and bool(safety.get("needs_human")) != case.expected_needs_human:
        failures.append(f"expected_needs_human={case.expected_needs_human}, got={bool(safety.get('needs_human'))}")
    if case.expected_handoff_reason:
        human_handoff = observability.get("human_handoff") if isinstance(observability, dict) else None
        actual_reason = human_handoff.get("reason") if isinstance(human_handoff, dict) else None
        if actual_reason != case.expected_handoff_reason:
            failures.append(f"expected_handoff_reason={case.expected_handoff_reason}, got={actual_reason}")
    if assume_not_live and case.expected_safety_when_medusa_down and safety.get("status") != case.expected_safety_when_medusa_down:
        failures.append(
            "expected_safety_when_medusa_down="
            f"{case.expected_safety_when_medusa_down}, got={safety.get('status')}"
        )
    for required_tool in case.must_have_tool_calls or []:
        if required_tool not in tool_names:
            failures.append(f"missing_tool_call={required_tool}")
    for required_action_type in case.must_have_action_types or []:
        if required_action_type not in action_types:
            failures.append(f"missing_action_type={required_action_type}")
    for forbidden_action_type in case.must_not_have_action_types or []:
        if forbidden_action_type in action_types:
            failures.append(f"forbidden_action_type={forbidden_action_type}")
    if case.must_have_citations and not citations:
        failures.append("citations_required")
    for pattern in case.must_have_answer_regex or []:
        if not re.search(pattern, answer, re.IGNORECASE):
            failures.append(f"answer_missing_regex={pattern}")
    for pattern in case.must_not_answer_regex or []:
        if re.search(pattern, answer, re.IGNORECASE):
            failures.append(f"answer_forbidden_regex={pattern}")
    if assume_not_live:
        for forbidden in case.forbidden_when_not_live or []:
            if forbidden in answer:
                failures.append(f"answer_contains_forbidden_when_not_live={forbidden}")
    product_ids = {str(item.get("id")) for item in products if isinstance(item, dict) and item.get("id")}
    for forbidden_id in case.forbidden_product_ids or []:
        if forbidden_id in product_ids:
            failures.append(f"forbidden_product_id={forbidden_id}")
    if case.forbidden_citations_from_tenant:
        serialized_citations = json.dumps(citations, ensure_ascii=False)
        if case.forbidden_citations_from_tenant in serialized_citations:
            failures.append(f"forbidden_citation_tenant={case.forbidden_citations_from_tenant}")
    return failures


def summarize_session_messages(messages: list[dict[str, Any]]) -> dict[str, Any]:
    user_turns = 0
    assistant_turns = 0
    assistant_product_turns = 0
    clarification_turns = 0
    human_handoff_turns = 0
    repeated_product_ids: set[str] = set()
    seen_product_ids: set[str] = set()
    tool_names: set[str] = set()

    for message in messages:
        role = message.get("role")
        if role == "user":
            user_turns += 1
            continue
        if role != "assistant":
            continue
        assistant_turns += 1
        content = str(message.get("content") or "")
        products = message.get("products") or []
        actions = message.get("actions") or []
        tool_calls = message.get("tool_calls") or []
        if "уточн" in content.casefold():
            clarification_turns += 1
        if any((action.get("type") == "request_human_follow_up") for action in actions if isinstance(action, dict)):
            human_handoff_turns += 1
        product_ids = {
            str(item.get("id"))
            for item in products
            if isinstance(item, dict) and item.get("id")
        }
        if product_ids:
            assistant_product_turns += 1
        repeated_product_ids.update(product_ids & seen_product_ids)
        seen_product_ids.update(product_ids)
        tool_names.update(
            str(item.get("name"))
            for item in tool_calls
            if isinstance(item, dict) and item.get("name")
        )

    return {
        "user_turns": user_turns,
        "assistant_turns": assistant_turns,
        "assistant_product_turns": assistant_product_turns,
        "clarification_turns": clarification_turns,
        "human_handoff_turns": human_handoff_turns,
        "product_ids_seen": sorted(seen_product_ids),
        "repeated_product_ids": sorted(repeated_product_ids),
        "tool_names": sorted(tool_names),
    }


def summarize_assistant_response(message: dict[str, Any]) -> dict[str, Any]:
    content = str(message.get("content") or message.get("answer") or "").strip()
    safety = message.get("safety") or {}
    products = message.get("products") or []
    actions = message.get("actions") or []
    return {
        "intent": message.get("intent"),
        "status": safety.get("status"),
        "needs_human": bool(safety.get("needs_human")),
        "product_ids": sorted(
            str(item.get("id"))
            for item in products
            if isinstance(item, dict) and item.get("id")
        ),
        "action_types": sorted(
            str(item.get("type"))
            for item in actions
            if isinstance(item, dict) and item.get("type")
        ),
        "answer_preview": content[:160] + ("…" if len(content) > 160 else ""),
    }


def extract_user_messages(messages: list[dict[str, Any]]) -> list[str]:
    return [
        str(message.get("content") or "")
        for message in messages
        if message.get("role") == "user" and str(message.get("content") or "").strip()
    ]


def extract_assistant_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        message
        for message in messages
        if message.get("role") == "assistant"
    ]


def compare_replay_turns(
    user_messages: list[str],
    *,
    baseline_messages: list[dict[str, Any]],
    replay_responses: list[dict[str, Any]],
) -> dict[str, Any]:
    baseline_assistant = extract_assistant_messages(baseline_messages)
    total_turns = max(len(user_messages), len(baseline_assistant), len(replay_responses))
    per_turn: list[dict[str, Any]] = []
    changed_turns = 0

    for index in range(total_turns):
        baseline = baseline_assistant[index] if index < len(baseline_assistant) else None
        replay = replay_responses[index] if index < len(replay_responses) else None
        baseline_summary = summarize_assistant_response(baseline or {})
        replay_summary = summarize_assistant_response(replay or {})
        differences: list[str] = []
        for field in ("intent", "status", "needs_human", "product_ids", "action_types"):
            if baseline_summary.get(field) != replay_summary.get(field):
                differences.append(field)
        if baseline_summary.get("answer_preview") != replay_summary.get("answer_preview"):
            differences.append("answer_preview")
        changed = bool(differences)
        if changed:
            changed_turns += 1
        per_turn.append(
            {
                "turn": index + 1,
                "user": user_messages[index] if index < len(user_messages) else None,
                "changed": changed,
                "differences": differences,
                "baseline": baseline_summary,
                "replay": replay_summary,
            }
        )

    return {
        "user_turns": len(user_messages),
        "baseline_assistant_turns": len(baseline_assistant),
        "replay_assistant_turns": len(replay_responses),
        "changed_turns": changed_turns,
        "per_turn": per_turn,
    }


def load_transcript_user_messages(path: str | Path) -> list[str]:
    return extract_user_messages(load_transcript_messages(path))


def load_transcript_messages(path: str | Path) -> list[dict[str, Any]]:
    transcript_path = Path(path)
    raw = transcript_path.read_text(encoding="utf-8").strip()
    if not raw:
        return []
    if transcript_path.suffix.lower() == ".json":
        payload = json.loads(raw)
        return _records_from_payload(payload)
    if transcript_path.suffix.lower() == ".jsonl":
        messages: list[dict[str, Any]] = []
        for line in raw.splitlines():
            if not line.strip():
                continue
            payload = json.loads(line)
            messages.extend(_records_from_payload(payload))
        return messages
    return [{"role": "user", "content": line.strip()} for line in raw.splitlines() if line.strip()]


def _records_from_payload(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        messages: list[dict[str, Any]] = []
        for item in payload:
            messages.extend(_records_from_payload(item))
        return messages
    if isinstance(payload, dict):
        role = str(payload.get("role") or "")
        content = str(payload.get("content") or payload.get("message") or "").strip()
        normalized_role = role or "user"
        return [{"role": normalized_role, "content": content}] if content else []
    content = str(payload or "").strip()
    return [{"role": "user", "content": content}] if content else []


def _ensure_list(value: Any) -> list[str] | None:
    if value in (None, "", []):
        return None
    if isinstance(value, list):
        return [str(item) for item in value if str(item).strip()]
    return [str(value)]
