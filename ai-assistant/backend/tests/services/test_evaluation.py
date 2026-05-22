import json

from app.services.evaluation import (
    EvaluationCase,
    compare_replay_turns,
    evaluate_case_response,
    extract_assistant_messages,
    extract_user_messages,
    load_evaluation_cases,
    load_transcript_messages,
    load_transcript_user_messages,
    summarize_session_messages,
)


def test_load_evaluation_cases_normalizes_message_to_conversation(tmp_path):
    dataset = tmp_path / "dataset.jsonl"
    dataset.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "id": "single-turn",
                        "store_id": "default",
                        "locale": "ru",
                        "message": "Подбери кофемашину",
                    },
                    ensure_ascii=False,
                ),
                json.dumps(
                    {
                        "id": "multi-turn",
                        "store_id": "default",
                        "locale": "ru",
                        "conversation": ["Сначала чайник", "Не хочу чайник"],
                    },
                    ensure_ascii=False,
                ),
            ]
        ),
        encoding="utf-8",
    )

    cases = load_evaluation_cases(dataset)

    assert [case.id for case in cases] == ["single-turn", "multi-turn"]
    assert cases[0].conversation == ["Подбери кофемашину"]
    assert cases[1].conversation == ["Сначала чайник", "Не хочу чайник"]


def test_evaluate_case_response_reports_missing_contracts():
    case = EvaluationCase(
        id="enterprise",
        store_id="default",
        locale="ru",
        conversation=["Подбери решение"],
        expected_intent="product_discovery",
        expected_safety_status="clarification_required",
        expected_needs_human=True,
        expected_handoff_reason="enterprise_low_confidence_recommendation",
        must_have_tool_calls=["search_products"],
        must_have_action_types=["request_human_follow_up"],
        must_not_have_action_types=["add_to_cart_proposal"],
        must_have_citations=True,
        must_have_answer_regex=["специалист"],
        must_not_answer_regex=["prod_espresso"],
        forbidden_product_ids=["prod_espresso"],
    )

    failures = evaluate_case_response(
        case,
        {
            "intent": "product_discovery",
            "answer": "Покажу prod_espresso",
            "safety": {"status": "ok", "needs_human": False},
            "observability": {"human_handoff": {"reason": "wrong_reason"}},
            "tool_calls": [],
            "citations": [],
            "products": [{"id": "prod_espresso"}],
            "actions": [{"type": "add_to_cart_proposal"}],
        },
    )

    assert "expected_safety_status=clarification_required, got=ok" in failures
    assert "expected_needs_human=True, got=False" in failures
    assert "expected_handoff_reason=enterprise_low_confidence_recommendation, got=wrong_reason" in failures
    assert "missing_tool_call=search_products" in failures
    assert "missing_action_type=request_human_follow_up" in failures
    assert "forbidden_action_type=add_to_cart_proposal" in failures
    assert "citations_required" in failures
    assert "answer_missing_regex=специалист" in failures
    assert "answer_forbidden_regex=prod_espresso" in failures
    assert "forbidden_product_id=prod_espresso" in failures


def test_summarize_session_messages_collects_replay_signals():
    summary = summarize_session_messages(
        [
            {"role": "user", "content": "Подбери кофемашину"},
            {
                "role": "assistant",
                "content": "Уточните бюджет.",
                "products": [],
                "actions": [{"type": "request_human_follow_up"}],
                "tool_calls": [{"name": "search_products"}],
            },
            {"role": "user", "content": "До 1000"},
            {
                "role": "assistant",
                "content": "Вот варианты",
                "products": [{"id": "prod_espresso"}, {"id": "prod_kettle"}],
                "actions": [],
                "tool_calls": [{"name": "medusa_get_product_live_data"}],
            },
            {
                "role": "assistant",
                "content": "Ещё раз тот же вариант",
                "products": [{"id": "prod_espresso"}],
                "actions": [],
                "tool_calls": [],
            },
        ]
    )

    assert summary["user_turns"] == 2
    assert summary["assistant_turns"] == 3
    assert summary["assistant_product_turns"] == 2
    assert summary["clarification_turns"] == 1
    assert summary["human_handoff_turns"] == 1
    assert summary["repeated_product_ids"] == ["prod_espresso"]
    assert summary["tool_names"] == ["medusa_get_product_live_data", "search_products"]


def test_transcript_helpers_support_json_and_history_shape(tmp_path):
    transcript = tmp_path / "transcript.json"
    transcript.write_text(
        json.dumps(
            [
                {"role": "user", "content": "Первый запрос"},
                {"role": "assistant", "content": "Ответ"},
                {"role": "user", "content": "Второй запрос"},
            ],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    assert load_transcript_user_messages(transcript) == ["Первый запрос", "Второй запрос"]
    assert [message["role"] for message in load_transcript_messages(transcript)] == [
        "user",
        "assistant",
        "user",
    ]
    assert extract_user_messages(
        [
            {"role": "assistant", "content": "Ответ"},
            {"role": "user", "content": "Повтори"},
        ]
    ) == ["Повтори"]
    assert extract_assistant_messages(
        [
            {"role": "assistant", "content": "Ответ"},
            {"role": "user", "content": "Повтори"},
        ]
    ) == [{"role": "assistant", "content": "Ответ"}]


def test_compare_replay_turns_reports_changed_fields():
    report = compare_replay_turns(
        ["Подбери решение", "Сравни варианты"],
        baseline_messages=[
            {
                "role": "assistant",
                "content": "Уточните контекст.",
                "intent": "product_discovery",
                "safety": {"status": "clarification_required", "needs_human": True},
                "products": [],
                "actions": [{"type": "request_human_follow_up"}],
            },
            {
                "role": "assistant",
                "content": "Вот сравнение.",
                "intent": "product_compare",
                "safety": {"status": "ok", "needs_human": False},
                "products": [{"id": "prod_espresso"}],
                "actions": [],
            },
        ],
        replay_responses=[
            {
                "answer": "Уточните контекст и бюджет.",
                "intent": "product_discovery",
                "safety": {"status": "clarification_required", "needs_human": False},
                "products": [],
                "actions": [],
            },
            {
                "answer": "Вот сравнение.",
                "intent": "product_compare",
                "safety": {"status": "ok", "needs_human": False},
                "products": [{"id": "prod_espresso"}],
                "actions": [],
            },
        ],
    )

    assert report["changed_turns"] == 1
    assert report["per_turn"][0]["changed"] is True
    assert "needs_human" in report["per_turn"][0]["differences"]
    assert "action_types" in report["per_turn"][0]["differences"]
    assert "answer_preview" in report["per_turn"][0]["differences"]
    assert report["per_turn"][1]["changed"] is False
