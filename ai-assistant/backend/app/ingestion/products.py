from __future__ import annotations

import re
from datetime import datetime
from typing import Any
from uuid import uuid4

from app.ingestion.markdown import sha256_text
from app.schemas.ingestion import ProductChunk


def normalize_medusa_product(
    product: dict[str, Any],
    *,
    store_id: str,
    locale: str,
    chunk_target_chars: int = 1200,
    chunk_overlap_chars: int = 150,
) -> list[ProductChunk]:
    """Convert one Medusa product payload into stable indexable chunks."""
    text = build_product_document(product)
    metadata = build_product_metadata(product, store_id=store_id, locale=locale)
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


def build_product_metadata(product: dict[str, Any], *, store_id: str, locale: str) -> dict[str, Any]:
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

    return {
        "store_id": store_id,
        "locale": locale,
        "source_type": "medusa_product",
        "source_id": product.get("id"),
        "title": product.get("title"),
        "url": f"/products/{product.get('handle')}" if product.get("handle") else None,
        "product_id": product.get("id"),
        "variant_ids": [variant.get("id") for variant in variants if variant.get("id")],
        "handle": product.get("handle"),
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
        "tags": [tag_label(item) for item in ensure_list(product.get("tags")) if tag_label(item)],
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


def chunk_text(text: str, *, target_chars: int, overlap_chars: int) -> list[str]:
    normalized = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(normalized) <= target_chars:
        return [normalized]

    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(start + target_chars, len(normalized))
        split_at = normalized.rfind("\n\n", start, end)
        if split_at <= start:
            split_at = end
        chunks.append(normalized[start:split_at].strip())
        if split_at >= len(normalized):
            break
        start = max(split_at - overlap_chars, 0)
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
