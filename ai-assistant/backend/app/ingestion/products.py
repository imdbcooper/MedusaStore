from __future__ import annotations

import re
from datetime import datetime
from typing import Any
from uuid import uuid4

from app.ingestion.markdown import sha256_text
from app.schemas.ingestion import ProductChunk

USE_CASE_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"(?:подходит|идеально|создан[ао]?|используется)\s+для\s+([^,.!?]{3,100})",
        r"\bfor\s+([^,.!?]{3,100})",
    )
]
SUITABILITY_LABEL_KEYWORDS = {
    "home": {"home", "дом", "дома", "домашний", "домашняя", "домашнее"},
    "office": {"office", "офис", "офиса", "команда", "team"},
    "kitchen": {"kitchen", "кухня", "кухни"},
    "enterprise": {"enterprise", "корпоративный", "корпоративная", "крупный", "крупного", "enterprise-grade"},
    "small_business": {"малый", "малого", "средний", "среднего", "бизнес", "startup", "стартап"},
    "ecommerce": {"ecommerce", "e-commerce", "commerce", "магазин", "каталог", "checkout"},
    "support": {"support", "helpdesk", "поддержка", "саппорт"},
    "marketing": {"marketing", "маркетинг", "лидогенерация", "seo", "контент"},
    "analytics": {"analytics", "аналитика", "дашборд", "dashboard", "bi", "отчетность"},
    "automation": {"automation", "автоматизация", "workflow", "бот", "боты"},
    "integration": {"integration", "интеграция", "erp", "crm", "api", "1c"},
    "security": {"security", "безопасность", "audit", "аудит", "hardening"},
    "mobile": {"mobile", "ios", "android", "app", "приложение", "миниапп"},
    "web": {"web", "site", "website", "сайт", "landing", "spa", "saas"},
}
SEARCH_TERM_STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "или",
    "для",
    "это",
    "подходит",
    "товар",
    "товары",
    "product",
    "products",
    "solution",
    "solutions",
    "услуга",
    "услуги",
    "решение",
    "решения",
    "live",
    "medusa",
}


def normalize_medusa_product(
    product: dict[str, Any],
    *,
    store_id: str,
    locale: str,
    tenant_id: str | None = None,
    chunk_target_chars: int = 1200,
    chunk_overlap_chars: int = 150,
) -> list[ProductChunk]:
    """Convert one Medusa product payload into stable indexable chunks."""
    text = build_product_document(product)
    metadata = build_product_metadata(product, store_id=store_id, locale=locale, tenant_id=tenant_id)
    product_id = str(product.get("id") or "unknown")
    title = str(product.get("title") or product_id)
    handle = product.get("handle")
    path = f"/products/{handle}" if handle else None
    chunks = chunk_text(text, target_chars=chunk_target_chars, overlap_chars=chunk_overlap_chars)

    return [
        ProductChunk(
            id=uuid4(),
            source_id=product_id,
            source_type="medusa_product",
            title=title,
            path=path,
            content=chunk,
            content_hash=sha256_text(chunk),
            chunk_index=index,
            metadata=metadata,
        )
        for index, chunk in enumerate(chunks)
    ]


def build_product_document(product: dict[str, Any]) -> str:
    title = clean_text(product.get("title")) or "Untitled product"
    product_id = clean_text(product.get("id")) or "unknown"
    handle = clean_text(product.get("handle"))
    subtitle = clean_text(product.get("subtitle"))
    description = clean_text(product.get("description"))
    categories = ", ".join(category_label(item) for item in ensure_list(product.get("categories")))
    collection = collection_label(product.get("collection"))
    tags = ", ".join(tag_label(item) for item in ensure_list(product.get("tags")))
    options = ", ".join(option_label(item) for item in ensure_list(product.get("options")))
    variants = [variant_line(item) for item in ensure_list(product.get("variants"))]
    attributes = metadata_lines(product.get("metadata"))
    suitability = build_suitability_metadata(product)

    lines = [
        f"# Product: {title}",
        "",
        f"Product ID: {product_id}",
    ]
    if handle:
        lines.append(f"Handle: {handle}")
    if subtitle:
        lines.append(f"Subtitle: {subtitle}")
    if categories:
        lines.append(f"Categories: {categories}")
    if collection:
        lines.append(f"Collection: {collection}")
    if tags:
        lines.append(f"Tags: {tags}")
    if options:
        lines.append(f"Options: {options}")

    lines.extend(["", "## Description", description or "No product description provided."])
    if variants:
        lines.extend(["", "## Variants", *variants])
    if attributes:
        lines.extend(["", "## Attributes", *attributes])
    if suitability["use_case_phrases"] or suitability["suitability_labels"] or suitability["search_terms"]:
        lines.extend(["", "## Suitability signals"])
        if suitability["use_case_phrases"]:
            lines.append("Use cases: " + ", ".join(suitability["use_case_phrases"]))
        if suitability["suitability_labels"]:
            lines.append("Suitability labels: " + ", ".join(suitability["suitability_labels"]))
        if suitability["search_terms"]:
            lines.append("Search terms: " + ", ".join(suitability["search_terms"][:20]))
    lines.extend(
        [
            "",
            "## Use cases",
            "Derived from product metadata, tags, categories, collection and variant names.",
            "",
            "## Commerce note",
            "Price, stock, delivery and promotions must be checked live from Medusa before answering.",
        ]
    )
    return "\n".join(lines).strip() + "\n"


def build_product_metadata(
    product: dict[str, Any],
    *,
    store_id: str,
    locale: str,
    tenant_id: str | None = None,
) -> dict[str, Any]:
    variants = ensure_list(product.get("variants"))
    categories = ensure_list(product.get("categories"))
    collection = product.get("collection") if isinstance(product.get("collection"), dict) else {}
    price_values = [value for variant in variants for value in variant_price_values(variant)]
    inventory_values = [
        variant.get("inventory_quantity")
        for variant in variants
        if variant.get("inventory_quantity") is not None
    ]
    currency = first_currency_code(variants)
    metadata = product.get("metadata") if isinstance(product.get("metadata"), dict) else {}
    suitability = build_suitability_metadata(product)

    return {
        "store_id": store_id,
        "tenant_id": tenant_id,
        "locale": locale,
        "source_type": "medusa_product",
        "source_id": product.get("id"),
        "title": product.get("title"),
        "subtitle": product.get("subtitle"),
        "description": clean_text(product.get("description")),
        "url": f"/products/{product.get('handle')}" if product.get("handle") else None,
        "product_id": product.get("id"),
        "variant_ids": [variant.get("id") for variant in variants if variant.get("id")],
        "handle": product.get("handle"),
        "category_names": [
            category_label(category)
            for category in categories
            if category_label(category)
        ],
        "category_ids": [
            category.get("id")
            for category in categories
            if isinstance(category, dict) and category.get("id")
        ],
        "category_handles": [
            category.get("handle")
            for category in categories
            if isinstance(category, dict) and category.get("handle")
        ],
        "collection_id": collection.get("id"),
        "collection_title": collection.get("title"),
        "collection_handle": collection.get("handle"),
        "tags": [tag_label(item) for item in ensure_list(product.get("tags")) if tag_label(item)],
        "option_titles": [
            clean_text(option.get("title") or option.get("id"))
            for option in ensure_list(product.get("options"))
            if isinstance(option, dict) and clean_text(option.get("title") or option.get("id"))
        ],
        "variant_titles": [
            clean_text(variant.get("title") or variant.get("id"))
            for variant in variants
            if isinstance(variant, dict) and clean_text(variant.get("title") or variant.get("id"))
        ],
        "use_case_phrases": suitability["use_case_phrases"],
        "suitability_labels": suitability["suitability_labels"],
        "search_terms": suitability["search_terms"],
        "brand": metadata.get("brand") or metadata.get("manufacturer"),
        "price_hint_min": min(price_values) if price_values else None,
        "price_hint_max": max(price_values) if price_values else None,
        "currency_code": currency,
        "availability_hint": availability_hint(inventory_values),
        "thumbnail": product.get("thumbnail"),
        "image_urls": [
            item.get("url")
            for item in ensure_list(product.get("images"))
            if isinstance(item, dict) and item.get("url")
        ],
        "updated_at": iso_or_none(product.get("updated_at")),
    }


def build_suitability_metadata(product: dict[str, Any]) -> dict[str, list[str]]:
    categories = ensure_list(product.get("categories"))
    collection = product.get("collection") if isinstance(product.get("collection"), dict) else {}
    metadata = product.get("metadata") if isinstance(product.get("metadata"), dict) else {}
    corpus = [
        clean_text(product.get("title")),
        clean_text(product.get("subtitle")),
        clean_text(product.get("description")),
        *(category_label(item) for item in categories),
        collection_label(collection),
        *(tag_label(item) for item in ensure_list(product.get("tags"))),
        *(option_label(item) for item in ensure_list(product.get("options"))),
        *(variant_line(item) for item in ensure_list(product.get("variants"))),
        *metadata_text_values(metadata),
    ]
    combined_text = " ".join(part for part in corpus if part)
    use_case_phrases = extract_use_case_phrases(corpus)
    suitability_labels = infer_suitability_labels(combined_text)
    search_terms = extract_search_terms([*corpus, *use_case_phrases, *suitability_labels])
    return {
        "use_case_phrases": use_case_phrases,
        "suitability_labels": suitability_labels,
        "search_terms": search_terms,
    }


def chunk_text(text: str, *, target_chars: int, overlap_chars: int) -> list[str]:
    normalized = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(normalized) <= target_chars:
        return [normalized]

    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(start + target_chars, len(normalized))
        split_at = normalized.rfind("\n\n", start, end)
        if split_at <= start + overlap_chars:
            split_at = end
        chunks.append(normalized[start:split_at].strip())
        if split_at >= len(normalized):
            break
        next_start = max(split_at - overlap_chars, 0)
        start = next_start if next_start > start else end
    return [chunk for chunk in chunks if chunk]


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def ensure_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def tag_label(tag: Any) -> str:
    if isinstance(tag, dict):
        return clean_text(tag.get("value") or tag.get("name") or tag.get("title") or tag.get("id"))
    return clean_text(tag)


def category_label(category: Any) -> str:
    if not isinstance(category, dict):
        return clean_text(category)
    return clean_text(category.get("name") or category.get("title") or category.get("handle") or category.get("id"))


def collection_label(collection: Any) -> str:
    if not isinstance(collection, dict):
        return clean_text(collection)
    return clean_text(collection.get("title") or collection.get("handle") or collection.get("id"))


def option_label(option: Any) -> str:
    if not isinstance(option, dict):
        return clean_text(option)
    values = [
        clean_text(item.get("value") if isinstance(item, dict) else item)
        for item in ensure_list(option.get("values"))
    ]
    values = [value for value in values if value]
    suffix = f" ({', '.join(values)})" if values else ""
    return f"{clean_text(option.get('title') or option.get('id'))}{suffix}".strip()


def variant_line(variant: Any) -> str:
    if not isinstance(variant, dict):
        return f"- Variant: {clean_text(variant)}"
    options = ", ".join(
        clean_text(option.get("value") if isinstance(option, dict) else option)
        for option in ensure_list(variant.get("options"))
    )
    details = [f"Variant: {clean_text(variant.get('title') or variant.get('id'))}"]
    if variant.get("sku"):
        details.append(f"SKU: {clean_text(variant.get('sku'))}")
    if options:
        details.append(f"Options: {options}")
    return "- " + "; ".join(details)


def metadata_lines(metadata: Any) -> list[str]:
    if not isinstance(metadata, dict):
        return []
    lines = []
    for key, value in sorted(metadata.items()):
        if value in (None, "", [], {}):
            continue
        lines.append(f"- {clean_text(key).replace('_', ' ').title()}: {clean_text(value)}")
    return lines


def metadata_text_values(metadata: Any) -> list[str]:
    if isinstance(metadata, dict):
        values: list[str] = []
        for item in metadata.values():
            values.extend(metadata_text_values(item))
        return values
    if isinstance(metadata, list):
        values: list[str] = []
        for item in metadata:
            values.extend(metadata_text_values(item))
        return values
    text = clean_text(metadata)
    return [text] if text else []


def extract_use_case_phrases(parts: list[str]) -> list[str]:
    phrases: list[str] = []
    for part in parts:
        normalized = clean_text(part)
        if not normalized:
            continue
        for pattern in USE_CASE_PATTERNS:
            match = pattern.search(normalized)
            if not match:
                continue
            phrase = clean_text(match.group(1)).strip(" ,.;:-")
            if phrase:
                phrases.append(phrase)
    return list(dict.fromkeys(phrases))[:8]


def infer_suitability_labels(text: str) -> list[str]:
    normalized_tokens = set(tokenize_text(text))
    labels: list[str] = []
    for label, keywords in SUITABILITY_LABEL_KEYWORDS.items():
        keyword_tokens = {token.casefold().replace("ё", "е") for token in keywords}
        if normalized_tokens & keyword_tokens:
            labels.append(label)
    return labels


def extract_search_terms(parts: list[str]) -> list[str]:
    terms: list[str] = []
    seen: set[str] = set()
    for part in parts:
        for token in tokenize_text(part):
            if token in SEARCH_TERM_STOPWORDS or token.isdigit():
                continue
            if token in seen:
                continue
            seen.add(token)
            terms.append(token)
    return terms[:32]


def tokenize_text(value: Any) -> list[str]:
    return [
        token
        for token in re.findall(r"[\wа-яА-ЯёЁ-]+", clean_text(value).casefold().replace("ё", "е"))
        if len(token) > 2
    ]


def variant_price_values(variant: Any) -> list[int]:
    if not isinstance(variant, dict):
        return []
    calculated = variant.get("calculated_price")
    candidates: list[Any] = []
    if isinstance(calculated, dict):
        candidates.extend(
            calculated.get(key)
            for key in ("calculated_amount", "original_amount", "amount")
            if calculated.get(key) is not None
        )
    candidates.extend(variant.get(key) for key in ("price", "amount") if variant.get(key) is not None)
    values: list[int] = []
    for candidate in candidates:
        try:
            values.append(int(candidate))
        except (TypeError, ValueError):
            continue
    return values


def first_currency_code(variants: list[Any]) -> str | None:
    for variant in variants:
        if not isinstance(variant, dict):
            continue
        calculated = variant.get("calculated_price")
        if isinstance(calculated, dict) and calculated.get("currency_code"):
            return str(calculated["currency_code"]).lower()
    return None


def availability_hint(inventory_values: list[Any]) -> str:
    if not inventory_values:
        return "unknown"
    numbers: list[int] = []
    for value in inventory_values:
        try:
            numbers.append(int(value))
        except (TypeError, ValueError):
            continue
    if not numbers:
        return "unknown"
    return "in_stock" if any(value > 0 for value in numbers) else "out_of_stock"


def iso_or_none(value: Any) -> str | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)
