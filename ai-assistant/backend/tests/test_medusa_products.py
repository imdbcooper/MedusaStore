import pytest

from app.core.config import Settings
from app.ingestion.products import chunk_text, normalize_medusa_product
from app.repositories.memory import InMemoryAssistantRepository
from app.services.ingestion import MedusaProductIngestionService
from tests.fakes import ESPRESSO_MACHINE_PRODUCT, FakeMedusaProductClient


def test_normalize_medusa_product_creates_indexable_chunk():
    chunks = normalize_medusa_product(
        ESPRESSO_MACHINE_PRODUCT,
        store_id="default",
        locale="ru",
        chunk_target_chars=1200,
        chunk_overlap_chars=150,
    )

    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.source_type == "medusa_product"
    assert chunk.source_id == "prod_espresso"
    assert "# Product: Espresso Pro" in chunk.content
    assert "SKU: ESP-BLK" in chunk.content
    assert "Price, stock, delivery and promotions must be checked live" in chunk.content
    assert chunk.metadata["product_id"] == "prod_espresso"
    assert chunk.metadata["handle"] == "espresso-pro"
    assert chunk.metadata["category_handles"] == ["coffee-machines"]
    assert chunk.metadata["price_hint_min"] == 49900
    assert chunk.metadata["availability_hint"] == "in_stock"


def test_product_chunk_text_progresses_when_only_early_paragraph_break_exists():
    text = "# Product: Demo\n\n" + ("A" * 1400)

    chunks = chunk_text(text, target_chars=1200, overlap_chars=150)

    assert len(chunks) == 2
    assert chunks[0].startswith("# Product: Demo")
    assert len(chunks[0]) == 1200
    assert chunks[1] == "A" * len(chunks[1])
    assert 0 < len(chunks[1]) < 500


@pytest.mark.asyncio
async def test_medusa_product_ingestion_service_indexes_products():
    repository = InMemoryAssistantRepository()
    client = FakeMedusaProductClient([ESPRESSO_MACHINE_PRODUCT])
    settings = Settings(ASSISTANT_POSTGRES_URI=None)
    service = MedusaProductIngestionService(
        repository=repository,
        product_client=client,
        settings=settings,
    )

    response = await service.sync_products(
        store_id="default",
        locale="ru",
        full=True,
        region_id="reg_ru",
        currency_code="rub",
    )

    assert response.job.status == "completed"
    assert response.products_indexed == 1
    assert response.job.result["product_count"] == 1
    assert response.chunks[0].metadata["thumbnail"] == "https://example.test/espresso.jpg"
    assert client.calls[0]["region_id"] == "reg_ru"

    results = await repository.search_chunks(store_id="default", locale="ru", query="эспрессо кофемашина")
    assert results
    assert results[0]["source"]["source_type"] == "medusa_product"

    stats = await repository.stats()
    assert stats["indexed_product_count"] == 1
