from app.repositories.memory import InMemoryAssistantRepository
from app.services.vector import build_qdrant_filter


def _filter_must(qdrant_filter, *, clause="must"):
    if isinstance(qdrant_filter, dict):
        return qdrant_filter.get(clause, [])
    return list(getattr(qdrant_filter, clause, None) or [])


def _filter_keys(qdrant_filter, *, clause="must"):
    keys = []
    for condition in _filter_must(qdrant_filter, clause=clause):
        if isinstance(condition, dict):
            keys.append(condition.get("key"))
        else:
            keys.append(getattr(condition, "key", None))
    return keys


def test_memory_repository_matches_russian_delivery_inflection():
    repository = InMemoryAssistantRepository()

    async def run():
        await repository.upsert_source_with_chunks(
            store_id="default",
            locale="ru",
            source_type="policy",
            source_id="delivery",
            title="Доставка",
            uri="/delivery",
            content_hash="hash",
            metadata={},
            chunks=[
                {
                    "id": "chunk-delivery",
                    "source_id": "delivery",
                    "source_type": "policy",
                    "title": "Доставка",
                    "content": "Доставка по Москве занимает 1-2 дня.",
                    "content_hash": "hash",
                    "chunk_index": 0,
                    "metadata": {},
                }
            ],
        )
        return await repository.search_chunks(
            store_id="default",
            locale="ru",
            query="Расскажи про доставку",
        )

    import asyncio

    chunks = asyncio.run(run())
    assert chunks
    assert chunks[0]["source"]["source_id"] == "delivery"


def test_qdrant_category_filter_shape_keeps_category_as_nested_condition():
    qdrant_filter = build_qdrant_filter(
        store_id="default",
        locale="ru",
        source_type="medusa_product",
        product_id="prod_espresso",
        category="coffee-machines",
        brand="Acme",
    )

    assert _filter_keys(qdrant_filter) == [
        "store_id",
        "locale",
        "source_type",
        "product_id",
        "brand",
        None,
    ]
    category_filter = _filter_must(qdrant_filter)[-1]
    assert _filter_keys(category_filter, clause="should") == [
        "category",
        "category_handles",
        "category_ids",
    ]
