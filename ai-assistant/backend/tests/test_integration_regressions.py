import asyncio
from uuid import uuid4

from app.core.config import Settings
from app.repositories.memory import InMemoryAssistantRepository
from app.repositories.postgres import PostgresAssistantRepository
from app.schemas.chat import ChatRequest
from app.services.chat import ChatService
from app.services.retrieval import ModeAwareRetriever, SimpleMarkdownRetriever
from app.services.vector import build_qdrant_filter
from app.tools.commerce import LiveCommerceTools


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

    chunks = asyncio.run(run())
    assert chunks
    assert chunks[0]["source"]["source_id"] == "delivery"


class FakePostgresPool:
    def __init__(self):
        self.fetches = []

    def acquire(self):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def fetch(self, query, *args):
        self.fetches.append({"query": query, "args": args})
        return []

    async def fetchrow(self, query, *args):
        if "INSERT INTO assistant_sessions" in query:
            return {
                "id": args[0],
                "store_id": args[1],
                "customer_id": args[2],
                "cart_id": args[3],
                "locale": args[4],
                "region_id": args[5],
                "tenant_id": args[7],
            }
        if "INSERT INTO assistant_messages" in query:
            return {"id": args[0], "session_id": args[1], "role": args[2], "content": args[3]}
        raise AssertionError(f"Unexpected fetchrow query: {query}")


class FakePostgresDatabase:
    def __init__(self):
        self.pool = FakePostgresPool()


class FakeCommerceProductClient:
    async def list_products(self, **kwargs):
        return []

    async def get_cart(self, **kwargs):
        return {"id": kwargs.get("cart_id"), "items": [], "currency_code": "rub"}

    async def add_to_cart(self, **kwargs):
        return {"id": kwargs.get("cart_id"), "items": [], "currency_code": "rub"}


async def _run_postgres_chat_smoke(repository):
    settings = Settings(ASSISTANT_POSTGRES_URI=None, MEDUSA_BACKEND_URL="http://medusa.test")
    markdown_retriever = SimpleMarkdownRetriever(repository=repository)
    retriever = ModeAwareRetriever(markdown_retriever=markdown_retriever, vector_retriever=None, settings=settings)
    service = ChatService(
        repository=repository,
        retriever=retriever,
        commerce_tools=LiveCommerceTools(product_client=FakeCommerceProductClient()),
        settings=settings,
    )
    return await service.answer(
        ChatRequest(
            message="Найди товар",
            store_id="default",
            locale="ru",
        )
    )


def test_postgres_repository_accepts_source_type_filter_without_inlining_sql():
    repository = PostgresAssistantRepository(FakePostgresDatabase())

    chunks = asyncio.run(
        repository.search_chunks(
            store_id="default",
            locale="ru",
            query="доставка markdown",
            limit=3,
            source_type="markdown",
        )
    )

    assert chunks == []
    fetch = repository.database.pool.fetches[-1]
    assert "s.source_type = $5" in fetch["query"]
    assert "LIMIT $6" in fetch["query"]
    assert fetch["args"] == ("default", "ru", 0, ["доставка", "markdown"], "markdown", 3)


def test_postgres_chat_retrieval_path_accepts_source_type_filtered_requests():
    repository = PostgresAssistantRepository(FakePostgresDatabase())

    response = asyncio.run(_run_postgres_chat_smoke(repository))

    assert response.safety.status == "ok"
    search_fetch = next(fetch for fetch in repository.database.pool.fetches if "assistant_source_chunks" in fetch["query"])
    assert "s.source_type" not in search_fetch["query"]
    assert search_fetch["args"] == ("default", "ru", 0, ["Найди", "товар"], 5)


def test_markdown_retriever_normalizes_stringified_chunk_source_before_payload_filters():
    class BrokenRepository:
        async def search_chunks(self, **_kwargs):
            return [
                {
                    "id": "chunk-1",
                    "content": "Доставка по Москве",
                    "metadata": '{"tenant_id":"tenant-a"}',
                    "source": '{"source_type":"markdown","source_id":"faq.md","title":"FAQ","metadata":"{\\"tenant_id\\":\\"tenant-a\\"}"}',
                }
            ]

    async def run():
        retriever = SimpleMarkdownRetriever(repository=BrokenRepository())
        return await retriever.search(
            query="Доставка",
            store_id="default",
            locale="ru",
            tenant_id="tenant-a",
            filters={"source_type": "markdown"},
        )

    chunks, citations = asyncio.run(run())

    assert len(chunks) == 1
    assert chunks[0]["source"]["source_id"] == "faq.md"
    assert chunks[0]["source"]["metadata"] == {"tenant_id": "tenant-a"}
    assert citations[0].source_id == "faq.md"


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


def test_openai_compatible_provider_config_reads_base_url_without_network_calls():
    settings = Settings(
        LLM_PROVIDER="openai",
        OPENAI_API_KEY="test-key",
        OPENAI_BASE_URL="https://llm.example.com/v1",
        OPENAI_MODEL="gpt-compatible-mini",
    )

    assert settings.openai_base_url == "https://llm.example.com/v1"
    assert settings.openai_model == "gpt-compatible-mini"
    assert settings.llm_provider_config == {
        "provider": "openai",
        "api_key_configured": True,
        "base_url": "https://llm.example.com/v1",
        "model": "gpt-compatible-mini",
        "openai_compatible": True,
    }
