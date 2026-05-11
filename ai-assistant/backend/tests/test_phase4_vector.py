import pytest

from app.services.vector import QdrantAdapter, build_qdrant_filter
from tests.fakes import FakeQdrantClient


def _ingest_products(client):
    response = client.post(
        "/api/v1/ingest/medusa/products/sync",
        json={"store_id": "default", "locale": "ru", "full": True, "region_id": "reg_ru"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 200
    return response.json()


def test_payload_filter_construction_includes_phase4_fields():
    qdrant_filter = build_qdrant_filter(
        store_id="default",
        locale="ru",
        source_type="medusa_product",
        product_id="prod_espresso",
        category="coffee-machines",
        brand="Acme",
    )

    assert _filter_keys(qdrant_filter) == ["store_id", "locale", "source_type", "product_id", "brand"]
    assert _filter_values(qdrant_filter) == ["default", "ru", "medusa_product", "prod_espresso", "Acme"]
    category_filter = _filter_must(qdrant_filter)[-1]
    assert _filter_keys(category_filter, clause="should") == ["category", "category_handles", "category_ids"]
    assert _filter_values(category_filter, clause="should") == [
        "coffee-machines",
        "coffee-machines",
        "coffee-machines",
    ]


@pytest.mark.anyio
async def test_qdrant_adapter_upsert_search_and_delete(app):
    settings = app.state.settings
    fake_client = FakeQdrantClient()
    adapter = QdrantAdapter(settings=settings, client=fake_client)
    source = {
        "store_id": "default",
        "locale": "ru",
        "source_type": "medusa_product",
        "source_id": "prod_espresso",
        "title": "Espresso Pro",
        "uri": "/products/espresso-pro",
        "metadata": {
            "store_id": "default",
            "locale": "ru",
            "source_type": "medusa_product",
            "product_id": "prod_espresso",
            "category_handles": ["coffee-machines"],
            "brand": "Acme",
            "title": "Espresso Pro",
        },
    }
    chunks = [
        {
            "id": "chunk-1",
            "source_id": "prod_espresso",
            "source_type": "medusa_product",
            "title": "Espresso Pro",
            "content": "espresso coffee machine",
            "chunk_index": 0,
            "metadata": source["metadata"],
        }
    ]

    count = await adapter.upsert_chunks(chunks=chunks, source=source, vectors=[[1.0] + [0.0] * 7])
    assert count == 1
    assert fake_client.upserts

    results = await adapter.search(
        query_vector=[1.0] + [0.0] * 7,
        store_id="default",
        locale="ru",
        limit=5,
        source_type="medusa_product",
        product_id="prod_espresso",
        category="coffee-machines",
        brand="Acme",
    )
    assert results[0]["source"]["source_id"] == "prod_espresso"
    assert _filter_keys(fake_client.searches[-1]["query_filter"])[0] == "store_id"

    await adapter.delete_source(
        store_id="default",
        locale="ru",
        source_type="medusa_product",
        source_id="prod_espresso",
    )
    assert fake_client.deletes
    selector = fake_client.deletes[-1]["points_selector"]
    selector_filter = selector["filter"] if isinstance(selector, dict) else selector.filter
    assert _filter_keys(selector_filter) == ["store_id", "locale", "source_type", "source_id", "product_id"]
    assert _filter_values(selector_filter) == [
        "default",
        "ru",
        "medusa_product",
        "prod_espresso",
        "prod_espresso",
    ]



def test_vector_retrieval_mode_uses_qdrant_and_live_commerce_tools(client):
    client.app.state.settings.retrieval_mode = "vector"
    _ingest_products(client)
    response = client.post(
        "/api/v1/chat",
        json={
            "message": "Подбери кофемашину для эспрессо",
            "store_id": "default",
            "locale": "ru",
            "mode": "vector",
            "region_id": "reg_ru",
            "currency_code": "rub",
            "page_context": {"category_handle": "coffee-machines"},
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["products"][0]["id"] == "prod_espresso"
    assert data["products"][0]["price"] == "499 RUB"
    assert data["safety"]["live_data_checked"] is True
    assert client.app.state.fake_qdrant_client.searches
    assert client.app.state.fake_qdrant_client.searches[-1]["query_filter"]



def test_source_scoped_chunk_listing_and_vector_reindex_without_truncation(client):
    client.app.state.settings.retrieval_mode = "vector"
    repository = client.app.state.repository
    source_count = 3
    chunks_per_source = 7
    for source_index in range(source_count):
        chunks = [
            {
                "id": f"source-{source_index}-chunk-{chunk_index}",
                "source_id": f"source-{source_index}",
                "source_type": "markdown",
                "title": f"Source {source_index}",
                "content": f"source {source_index} chunk {chunk_index}",
                "content_hash": f"hash-{source_index}-{chunk_index}",
                "chunk_index": chunk_index,
                "metadata": {},
            }
            for chunk_index in range(chunks_per_source)
        ]
        client.portal.call(
            repository.upsert_source_with_chunks,
            store_id="default",
            locale="ru",
            source_type="markdown",
            source_id=f"source-{source_index}",
            title=f"Source {source_index}",
            uri=f"/source-{source_index}",
            content_hash=f"source-hash-{source_index}",
            metadata={},
            chunks=chunks,
        )

    listed = client.portal.call(
        repository.list_chunks_for_source,
        store_id="default",
        locale="ru",
        source_type="markdown",
        source_id="source-1",
        offset=2,
        limit=3,
    )
    assert [chunk["chunk_index"] for chunk in listed] == [2, 3, 4]
    assert all(chunk["source"]["source_id"] == "source-1" for chunk in listed)

    response = client.post(
        "/api/v1/ingest/vector/index",
        json={"store_id": "default", "locale": "ru", "source_type": "markdown"},
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["result"] == {
        "status": "completed",
        "source_count": source_count,
        "chunk_count": source_count * chunks_per_source,
        "error": None,
    }
    assert sum(len(call) for call in client.app.state.fake_embedding_provider.calls) == source_count * chunks_per_source



def test_vector_indexing_job_status_and_job_lookup(client):
    client.app.state.settings.retrieval_mode = "vector"
    _ingest_products(client)
    response = client.post(
        "/api/v1/ingest/vector/index",
        json={"store_id": "default", "locale": "ru", "source_type": "medusa_product"},
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["result"]["status"] == "completed"
    assert data["result"]["source_count"] == 1
    assert data["result"]["chunk_count"] >= 1
    assert data["result"]["error"] is None

    lookup = client.get(
        f"/api/v1/ingest/jobs/{data['job_id']}",
        headers={"Authorization": "Bearer test-token"},
    )
    assert lookup.status_code == 200
    assert lookup.json()["status"] == "completed"


def test_markdown_sync_with_empty_qdrant_url_does_not_fail(client):
    client.app.state.settings.qdrant_url = None
    client.app.state.settings.retrieval_mode = "markdown"
    client.app.state.fake_qdrant_client.upserts.clear()
    client.app.state.fake_embedding_provider.calls.clear()

    response = client.post(
        "/api/v1/ingest/markdown/sync",
        json={"store_id": "default", "locale": "ru"},
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["job"]["status"] == "completed"
    assert data["job"]["result"]["vector_indexed_count"] == 0
    assert data["job"]["result"]["vector_status"] == "skipped"
    assert data["chunks"]
    assert client.app.state.fake_qdrant_client.upserts == []
    assert client.app.state.fake_embedding_provider.calls == []



def test_deep_health_checks_optional_backends(client):
    response = client.get("/api/v1/health/deep")

    assert response.status_code == 200
    data = response.json()
    assert data["postgres"]["status"] == "memory"
    assert data["qdrant"]["status"] == "ok"
    assert data["medusa"]["status"] == "ok"
    assert data["llm_provider"]["status"] == "ok"
    assert data["lightrag"]["status"] == "disabled"


def test_auto_mode_falls_back_to_markdown_when_vector_backend_unavailable(client):
    markdown = client.post(
        "/api/v1/ingest/markdown/sync",
        json={"store_id": "default", "locale": "ru"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert markdown.status_code == 200
    client.app.state.fake_qdrant_client.fail_search = True

    response = client.post(
        "/api/v1/chat",
        json={
            "message": "Расскажи про доставку",
            "store_id": "default",
            "locale": "ru",
            "mode": "auto",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["citations"]
    assert any("fallback to markdown" in note for note in data["safety"]["notes"])


def test_vector_mode_returns_safe_error_when_backend_unavailable(client):
    client.app.state.fake_qdrant_client.fail_search = True

    response = client.post(
        "/api/v1/chat",
        json={
            "message": "Подбери кофемашину",
            "store_id": "default",
            "locale": "ru",
            "mode": "vector",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["products"] == []
    assert data["safety"]["status"] == "retrieval_unavailable"
    assert any("Vector retrieval unavailable" in note for note in data["safety"]["notes"])


def _filter_must(qdrant_filter, *, clause="must"):
    if isinstance(qdrant_filter, dict):
        return qdrant_filter.get(clause, [])
    return list(getattr(qdrant_filter, clause, None) or [])


def _filter_keys(qdrant_filter, *, clause="must"):
    return [_condition_value(condition, "key") for condition in _filter_must(qdrant_filter, clause=clause)]


def _filter_values(qdrant_filter, *, clause="must"):
    values = []
    for condition in _filter_must(qdrant_filter, clause=clause):
        match = _condition_value(condition, "match")
        values.append(_condition_value(match, "value"))
    return values


def _condition_value(item, field):
    if isinstance(item, dict):
        return item.get(field)
    return getattr(item, field, None)
