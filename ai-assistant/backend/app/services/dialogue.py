from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field

SUMMARY_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bsummary\b",
        r"\bresume\b",
        r"подведи\s+итог",
        r"подытож",
        r"резюмир",
        r"суммир",
        r"что\s+мы\s+(решили|обсудили)",
        r"какой\s+итог",
        r"напомни\s+(мне\s+)?(кратко|итог)",
    )
]
NEGATIVE_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bне\s+(подходит|то|нужно|надо)\b",
        r"\bне\s+это\b",
        r"\bмимо\b",
        r"\bдорого\b",
        r"\bслишком\s+дорого\b",
        r"\bдруго(й|е)\b",
        r"\bпокажи\s+друг(ое|ой)\b",
        r"\bнет,\s*это\b",
    )
]
GENERIC_TERMS = {
    "что",
    "какой",
    "какая",
    "какие",
    "какое",
    "можно",
    "можешь",
    "посоветуй",
    "подбери",
    "подобрать",
    "выбери",
    "выбрать",
    "помоги",
    "нужно",
    "надо",
    "хочу",
    "решение",
    "решения",
    "услугу",
    "услуга",
    "услуги",
    "товар",
    "товары",
    "вариант",
    "варианты",
    "лучший",
    "лучше",
    "подскажи",
}
SERVICE_BROAD_TERMS = {
    "аудит",
    "разработка",
    "поддержка",
    "seo",
    "devops",
    "cto",
    "crm",
    "qa",
    "бот",
    "боты",
    "сайт",
    "сайта",
    "приложение",
    "приложения",
    "интеграция",
    "интеграции",
    "аналитика",
    "безопасность",
}
STOPWORDS = {
    "и",
    "в",
    "во",
    "на",
    "по",
    "для",
    "про",
    "под",
    "над",
    "к",
    "ко",
    "от",
    "из",
    "с",
    "со",
    "о",
    "об",
    "за",
    "или",
    "а",
    "но",
    "ли",
    "же",
    "это",
    "этот",
    "эта",
    "эти",
    "мне",
    "нам",
    "вас",
    "у",
    "есть",
    "нужен",
    "нужна",
    "нужны",
    "нужно",
}
BUDGET_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"(?:до|не\s+больше|максимум)\s+(\d[\d\s]{1,12}\s*(?:₽|руб(?:лей|\.?)?|тыс(?:яч)?|млн)?)",
        r"бюджет\s+(?:до\s+)?(\d[\d\s]{1,12}\s*(?:₽|руб(?:лей|\.?)?|тыс(?:яч)?|млн)?)",
    )
]
TIMELINE_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bсрочно\b",
        r"\bна\s+этой\s+неделе\b",
        r"\bза\s+\d+\s+(?:дн(?:я|ей)|недел(?:ю|и)|месяц(?:а|ев)?)\b",
        r"\bв\s+этом\s+месяце\b",
        r"\bдо\s+конца\s+(?:недели|месяца|квартала)\b",
    )
]
COMPANY_SIZE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bмал(?:ый|ого|ому)\s+бизнес", re.IGNORECASE), "малый бизнес"),
    (re.compile(r"\bсредн(?:ий|его|ему)\s+бизнес", re.IGNORECASE), "средний бизнес"),
    (re.compile(r"\benterprise\b|\bкрупн(?:ый|ого|ому)\s+бизнес", re.IGNORECASE), "enterprise"),
    (re.compile(r"\bстартап\b|\bstartup\b", re.IGNORECASE), "стартап"),
]
OUTCOME_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"чтобы\s+([^,.!?]{6,120})",
        r"цель\s*[:\-]?\s*([^,.!?]{6,120})",
        r"важно\s+([^,.!?]{6,120})",
    )
]
NEGATED_TERM_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"(?:не\s+хочу|не\s+нуж(?:ен|на|но|ны)?|без)\s+([^,.!?]{2,60})",
        r"(?:кроме|исключая)\s+([^,.!?]{2,60})",
    )
]
PREFERENCE_STOPWORDS = STOPWORDS | GENERIC_TERMS | {
    "цена",
    "наличие",
    "стоимость",
    "сравни",
    "лучше",
    "против",
    "или",
    "другой",
    "другая",
    "другое",
    "вариант",
    "варианты",
    "покажи",
    "показать",
}


class DialogueState(BaseModel):
    version: int = 1
    turn_count: int = 0
    user_goal: str | None = None
    company_size: str | None = None
    summary: str = ""
    focus_areas: list[str] = Field(default_factory=list)
    desired_outcomes: list[str] = Field(default_factory=list)
    accepted_terms: list[str] = Field(default_factory=list)
    rejected_terms: list[str] = Field(default_factory=list)
    constraints: dict[str, str] = Field(default_factory=dict)
    recommended_product_ids: list[str] = Field(default_factory=list)
    recommended_product_titles: list[str] = Field(default_factory=list)
    rejected_product_ids: list[str] = Field(default_factory=list)
    rejected_product_titles: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    recent_user_messages: list[str] = Field(default_factory=list)


def load_dialogue_state(customer_context: dict[str, Any] | None) -> DialogueState:
    raw = {}
    if isinstance(customer_context, dict):
        raw = customer_context.get("dialogue_state") or {}
    try:
        return DialogueState.model_validate(raw)
    except Exception:
        return DialogueState()


def detect_summary_request(text: str) -> bool:
    normalized = text or ""
    return any(pattern.search(normalized) for pattern in SUMMARY_PATTERNS)


def detect_negative_feedback(text: str) -> bool:
    normalized = text or ""
    return any(pattern.search(normalized) for pattern in NEGATIVE_PATTERNS)


def is_generic_product_request(text: str) -> bool:
    tokens = _meaningful_tokens(text)
    if not tokens:
        return True
    specific_tokens = [token for token in tokens if token not in GENERIC_TERMS]
    if not specific_tokens:
        return True
    if len(specific_tokens) == 1 and specific_tokens[0] in SERVICE_BROAD_TERMS:
        return True
    return False


def build_clarification_question(
    message: str,
    *,
    dialogue_state: DialogueState,
    chunks: list[dict[str, Any]],
    page_context: Any | None = None,
    rejected_products_exhausted: bool = False,
    low_confidence: bool = False,
) -> str | None:
    if page_context and getattr(page_context, "product_id", None):
        return None
    if page_context and getattr(page_context, "category_handle", None):
        return None
    if dialogue_state.user_goal and not detect_negative_feedback(message) and not rejected_products_exhausted and not low_confidence:
        return None
    if not (
        is_generic_product_request(message)
        or rejected_products_exhausted
        or detect_negative_feedback(message)
        or low_confidence
    ):
        return None

    rejected_context_terms = [*dialogue_state.rejected_terms, *dialogue_state.rejected_product_titles]
    if detect_negative_feedback(message):
        rejected_context_terms = [
            *rejected_context_terms,
            *dialogue_state.recommended_product_titles,
            *_extract_negative_terms(message),
        ]
    labels = filter_rejected_labels(
        extract_candidate_labels(chunks),
        rejected_terms=rejected_context_terms,
    )
    if rejected_products_exhausted:
        prefix = "Ранее предложенные варианты уже исключили."
    elif detect_negative_feedback(message):
        prefix = "Понял, предыдущая рекомендация не подошла."
    elif low_confidence:
        prefix = "Пока не вижу достаточно уверенного совпадения"
    else:
        prefix = "Чтобы подобрать релевантное решение и не предлагать случайные варианты,"
    separator = " " if prefix.endswith((",", ".")) else ", "

    if len(labels) >= 2:
        options = ", ".join(labels[:3])
        return f"{prefix}{separator}уточните, какое направление вам ближе: {options}?"
    return (
        f"{prefix}{separator}уточните задачу, желаемый результат и, если есть, ограничения по срокам "
        "или бюджету."
    )


def build_summary_answer(state: DialogueState) -> str:
    lines: list[str] = ["Краткое резюме диалога:"]
    if state.user_goal:
        lines.append(f"- Цель: {state.user_goal}")
    if state.company_size:
        lines.append(f"- Контекст клиента: {state.company_size}")
    if state.focus_areas:
        lines.append(f"- Фокус: {', '.join(state.focus_areas)}")
    if state.desired_outcomes:
        lines.append(f"- Желаемый результат: {', '.join(state.desired_outcomes[:3])}")
    if state.constraints:
        rendered_constraints = ", ".join(f"{key}: {value}" for key, value in state.constraints.items())
        lines.append(f"- Ограничения: {rendered_constraints}")
    if state.accepted_terms:
        lines.append(f"- Предпочтения: {', '.join(state.accepted_terms[:5])}")
    if state.rejected_terms:
        lines.append(f"- Избегаем: {', '.join(state.rejected_terms[:5])}")
    if state.rejected_product_titles:
        lines.append(f"- Уже исключили: {', '.join(state.rejected_product_titles[:4])}")
    if state.open_questions:
        lines.append(f"- Нужно уточнить: {state.open_questions[0]}")
    if len(lines) == 1:
        return (
            "Пока у меня нет полезного резюме: в этой сессии ещё не накопилось достаточно "
            "контекста. Опишите задачу, и я зафиксирую главное по ходу разговора."
        )
    lines.append("Могу продолжить подбор и сузить рекомендации после следующего уточнения.")
    return "\n".join(lines)


def build_off_topic_answer() -> str:
    return (
        "Я помогаю только по товарам, услугам и условиям этого магазина. "
        "Могу подобрать решение, сравнить варианты, объяснить процесс работы, сроки и следующий шаг. "
        "Опишите, пожалуйста, задачу по каталогу или по проекту, и я продолжу как консультант."
    )


def render_dialogue_memory_block(state: DialogueState) -> str:
    sections: list[str] = []
    if state.summary:
        sections.append(f"Сжатая память диалога: {state.summary}")
    if state.user_goal:
        sections.append(f"Зафиксированная цель пользователя: {state.user_goal}")
    if state.company_size:
        sections.append(f"Размер/тип клиента: {state.company_size}")
    if state.desired_outcomes:
        sections.append(f"Желаемый результат: {', '.join(state.desired_outcomes[:3])}")
    if state.constraints:
        rendered_constraints = ", ".join(f"{key}={value}" for key, value in state.constraints.items())
        sections.append(f"Ограничения пользователя: {rendered_constraints}")
    if state.focus_areas:
        sections.append(f"Текущий фокус: {', '.join(state.focus_areas)}")
    if state.accepted_terms:
        sections.append(f"Учитывай предпочтения пользователя: {', '.join(state.accepted_terms[:6])}")
    if state.rejected_terms:
        sections.append(f"Избегай направлений/атрибутов: {', '.join(state.rejected_terms[:6])}")
    if state.rejected_product_titles:
        sections.append(
            f"Не повторяй сразу уже отвергнутые варианты: {', '.join(state.rejected_product_titles[:5])}"
        )
    if state.open_questions:
        sections.append(f"Нужно уточнить до следующей рекомендации: {state.open_questions[0]}")
    return "\n".join(sections)


def update_dialogue_state(
    state: DialogueState,
    *,
    user_message: str,
    intent: str,
    chunks: list[dict[str, Any]],
    product_cards: list[Any],
    response_kind: str,
    response_text: str,
) -> DialogueState:
    updated = state.model_copy(deep=True)
    updated.turn_count += 1
    updated.recent_user_messages = _append_unique(
        updated.recent_user_messages,
        [_compact_text(user_message, limit=180)],
        limit=4,
    )

    if detect_negative_feedback(user_message):
        new_rejected_terms = _extract_negative_terms(user_message) + _titles_to_terms(updated.rejected_product_titles[-4:])
        updated.rejected_product_ids = _append_unique(
            updated.rejected_product_ids,
            updated.recommended_product_ids,
            limit=12,
        )
        updated.rejected_product_titles = _append_unique(
            updated.rejected_product_titles,
            updated.recommended_product_titles,
            limit=12,
        )
        updated.recommended_product_ids = []
        updated.recommended_product_titles = []
        updated.rejected_terms = _append_unique(
            updated.rejected_terms,
            new_rejected_terms,
            limit=16,
        )
        if new_rejected_terms:
            updated.accepted_terms = [
                term for term in updated.accepted_terms if term.casefold() not in {item.casefold() for item in new_rejected_terms}
            ]

    budget_signal = _extract_budget(user_message)
    if budget_signal:
        updated.constraints["budget"] = budget_signal
    timeline_signal = _extract_timeline(user_message)
    if timeline_signal:
        updated.constraints["timeline"] = timeline_signal
    company_size = _extract_company_size(user_message)
    if company_size:
        updated.company_size = company_size
        updated.constraints["company_size"] = company_size
    outcomes = _extract_desired_outcomes(user_message)
    if outcomes:
        updated.desired_outcomes = _append_unique(updated.desired_outcomes, outcomes, limit=4)

    if (
        intent in {"product_discovery", "product_search", "product_compare", "product_detail", "policy"}
        and not detect_negative_feedback(user_message)
        and not detect_summary_request(user_message)
    ):
        updated.user_goal = _compact_text(user_message, limit=220)

    if not is_generic_product_request(user_message):
        updated.focus_areas = _append_unique(
            updated.focus_areas,
            extract_candidate_labels(chunks)[:2],
            limit=4,
        )
    if not detect_negative_feedback(user_message):
        new_accepted_terms = _extract_preference_terms(user_message)
        updated.accepted_terms = _append_unique(
            updated.accepted_terms,
            new_accepted_terms,
            limit=16,
        )
        if new_accepted_terms:
            updated.rejected_terms = [
                term for term in updated.rejected_terms if term.casefold() not in {item.casefold() for item in new_accepted_terms}
            ]

    if product_cards:
        product_payloads = [item.model_dump() if hasattr(item, "model_dump") else dict(item) for item in product_cards]
        updated.recommended_product_ids = [
            str(item.get("id"))
            for item in product_payloads
            if item.get("id")
        ][:6]
        updated.recommended_product_titles = [
            str(item.get("title"))
            for item in product_payloads
            if item.get("title")
        ][:6]

    if response_kind == "clarification":
        updated.open_questions = [_compact_text(response_text, limit=220)]
    elif response_kind != "summary":
        updated.open_questions = []

    updated.summary = _compose_summary(updated)
    return updated


def extract_candidate_labels(chunks: list[dict[str, Any]]) -> list[str]:
    labels: list[str] = []
    seen: set[str] = set()
    for chunk in chunks:
        source = chunk.get("source") or {}
        metadata = source.get("metadata") or chunk.get("metadata") or {}
        raw_labels: list[str] = []
        collection_title = metadata.get("collection_title")
        if isinstance(collection_title, str) and collection_title.strip():
            raw_labels.append(collection_title.strip())
        category_handles = metadata.get("category_handles")
        if isinstance(category_handles, list):
            raw_labels.extend(str(item).strip().replace("-", " ") for item in category_handles if str(item).strip())
        for raw_label in raw_labels:
            normalized = raw_label.strip(" -")
            if not normalized:
                continue
            dedupe_key = normalized.casefold()
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            labels.append(normalized)
            if len(labels) >= 4:
                return labels
    return labels


def filter_rejected_labels(labels: list[str], *, rejected_terms: list[str]) -> list[str]:
    normalized_rejected = {
        token
        for value in rejected_terms
        for token in _meaningful_tokens(str(value))
    }
    if not normalized_rejected:
        return labels
    rejected_stems = {token[:5] for token in normalized_rejected if len(token) >= 4}
    filtered: list[str] = []
    for label in labels:
        label_tokens = set(_meaningful_tokens(label))
        label_stems = {token[:5] for token in label_tokens if len(token) >= 4}
        if label_tokens & normalized_rejected:
            continue
        if label_stems & rejected_stems:
            continue
        filtered.append(label)
    return filtered


def _compose_summary(state: DialogueState) -> str:
    parts: list[str] = []
    if state.user_goal:
        parts.append(f"цель — {state.user_goal}")
    if state.company_size:
        parts.append(f"клиент — {state.company_size}")
    if state.focus_areas:
        parts.append(f"фокус — {', '.join(state.focus_areas[:3])}")
    if state.desired_outcomes:
        parts.append(f"результат — {', '.join(state.desired_outcomes[:2])}")
    if state.constraints:
        rendered_constraints = ", ".join(
            f"{key}: {value}" for key, value in list(state.constraints.items())[:3]
        )
        parts.append(f"ограничения — {rendered_constraints}")
    if state.accepted_terms:
        parts.append(f"предпочтения — {', '.join(state.accepted_terms[:4])}")
    if state.rejected_terms:
        parts.append(f"избегать — {', '.join(state.rejected_terms[:4])}")
    if state.rejected_product_titles:
        parts.append(f"исключены — {', '.join(state.rejected_product_titles[:3])}")
    if state.open_questions:
        parts.append(f"нужно уточнить — {state.open_questions[0]}")
    return "; ".join(parts)[:600]


def _meaningful_tokens(text: str) -> list[str]:
    tokens = [token.casefold() for token in re.findall(r"[\wа-яА-ЯёЁ-]+", text or "")]
    return [token for token in tokens if len(token) > 2 and token not in STOPWORDS]


def _append_unique(existing: list[str], values: list[str], *, limit: int) -> list[str]:
    result = list(existing)
    seen = {item.casefold() for item in result}
    for value in values:
        normalized = (value or "").strip()
        if not normalized:
            continue
        key = normalized.casefold()
        if key in seen:
            continue
        seen.add(key)
        result.append(normalized)
    if len(result) > limit:
        result = result[-limit:]
    return result


def _compact_text(text: str, *, limit: int) -> str:
    normalized = re.sub(r"\s+", " ", (text or "").strip())
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 3].rstrip() + "..."


def _extract_budget(text: str) -> str | None:
    normalized = text or ""
    for pattern in BUDGET_PATTERNS:
        match = pattern.search(normalized)
        if match:
            return _compact_text(match.group(0), limit=80)
    return None


def _extract_timeline(text: str) -> str | None:
    normalized = text or ""
    for pattern in TIMELINE_PATTERNS:
        match = pattern.search(normalized)
        if match:
            return _compact_text(match.group(0), limit=80)
    return None


def _extract_company_size(text: str) -> str | None:
    normalized = text or ""
    for pattern, label in COMPANY_SIZE_PATTERNS:
        if pattern.search(normalized):
            return label
    return None


def _extract_desired_outcomes(text: str) -> list[str]:
    outcomes: list[str] = []
    normalized = text or ""
    for pattern in OUTCOME_PATTERNS:
        match = pattern.search(normalized)
        if not match:
            continue
        value = _compact_text(match.group(1), limit=100).strip(" ,.;:-")
        if value:
            outcomes.append(value)
    return list(dict.fromkeys(outcomes))


def _extract_preference_terms(text: str) -> list[str]:
    return [
        token
        for token in _meaningful_tokens(text)
        if token not in PREFERENCE_STOPWORDS and not token.isdigit()
    ][:8]


def _extract_negative_terms(text: str) -> list[str]:
    extracted: list[str] = []
    normalized = text or ""
    for pattern in NEGATED_TERM_PATTERNS:
        match = pattern.search(normalized)
        if not match:
            continue
        extracted.extend(_extract_preference_terms(match.group(1)))
    return list(dict.fromkeys(extracted))


def _titles_to_terms(titles: list[str]) -> list[str]:
    terms: list[str] = []
    for title in titles:
        terms.extend(_extract_preference_terms(title))
    return list(dict.fromkeys(terms))
