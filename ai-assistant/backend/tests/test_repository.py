from uuid import uuid4

import pytest

from app.repositories.postgres import PostgresAssistantRepository


@pytest.mark.asyncio
async def test_memory_repository_session_message_lifecycle(repository):
    session = await repository.ensure_session(
        session_id=None,
        store_id="default",
        locale="ru",
        customer_id=None,
        cart_id=None,
        region_id=None,
    )
    user_message = await repository.add_message(
        session_id=session["id"],
        role="user",
        content="Привет",
    )
    assistant_message = await repository.add_message(
        session_id=session["id"],
        role="assistant",
        content="Здравствуйте",
        intent="smalltalk",
    )

    messages = await repository.list_messages(session["id"])
    assert [message["id"] for message in messages] == [user_message["id"], assistant_message["id"]]


@pytest.mark.asyncio
async def test_memory_repository_upserts_sources_and_searches(repository):
    source = await repository.upsert_source_with_chunks(
        store_id="default",
        locale="ru",
        source_type="policy",
        source_id="faq.md",
        title="FAQ",
        uri="faq.md",
        content_hash="hash",
        metadata={},
        chunks=[
            {
                "id": uuid4(),
                "chunk_index": 0,
                "content": "Доставка по Москве занимает 1-2 дня",
                "content_hash": "chunk-hash",
                "metadata": {},
            }
        ],
    )

    results = await repository.search_chunks(
        store_id="default",
        locale="ru",
        query="доставка москва",
    )
    assert source["title"] == "FAQ"
    assert len(results) == 1
    assert results[0]["source"]["title"] == "FAQ"

    stats = await repository.stats()
    assert stats["document_count"] == 1
    assert stats["chunk_count"] == 1


@pytest.mark.asyncio
async def test_postgres_repository_list_messages_normalizes_json_string_columns():
    session_id = uuid4()
    rows = [
        {
            "id": uuid4(),
            "session_id": session_id,
            "role": "user",
            "content": "Привет",
            "intent": None,
            "citations": "[]",
            "products": "[]",
            "actions": "[]",
            "tool_calls": "[]",
            "token_usage": "{}",
            "created_at": "2026-05-19T00:00:00Z",
        }
    ]

    class FakeConn:
        async def fetch(self, *_args, **_kwargs):
            return rows

    class FakeAcquire:
        async def __aenter__(self):
            return FakeConn()

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakePool:
        def acquire(self):
            return FakeAcquire()

    class FakeDatabase:
        pool = FakePool()

    repository = PostgresAssistantRepository(FakeDatabase())
    messages = await repository.list_messages(session_id)

    assert messages[0]["citations"] == []
    assert messages[0]["products"] == []
    assert messages[0]["actions"] == []
    assert messages[0]["tool_calls"] == []
    assert messages[0]["token_usage"] == {}


@pytest.mark.asyncio
async def test_postgres_repository_search_chunks_normalizes_json_string_source_columns():
    rows = [
        {
            "id": uuid4(),
            "source_id": uuid4(),
            "chunk_index": 0,
            "content": "Политика доставки",
            "content_hash": "chunk-hash",
            "metadata": '{"tenant_id":"tenant-a"}',
            "source": '{"source_type":"markdown","source_id":"faq.md","title":"FAQ","metadata":"{\\"tenant_id\\":\\"tenant-a\\"}"}',
            "score": 1,
            "created_at": "2026-05-21T00:00:00Z",
        }
    ]

    class FakeConn:
        async def fetch(self, *_args, **_kwargs):
            return rows

    class FakeAcquire:
        async def __aenter__(self):
            return FakeConn()

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakePool:
        def acquire(self):
            return FakeAcquire()

    class FakeDatabase:
        pool = FakePool()

    repository = PostgresAssistantRepository(FakeDatabase())
    chunks = await repository.search_chunks(
        store_id="default",
        locale="ru",
        query="политика доставки",
    )

    assert chunks[0]["metadata"] == {"tenant_id": "tenant-a"}
    assert chunks[0]["source"]["source_type"] == "markdown"
    assert chunks[0]["source"]["source_id"] == "faq.md"
    assert chunks[0]["source"]["metadata"] == {"tenant_id": "tenant-a"}


@pytest.mark.asyncio
async def test_postgres_repository_list_chunks_for_source_normalizes_json_string_source_columns():
    rows = [
        {
            "id": uuid4(),
            "source_id": uuid4(),
            "chunk_index": 0,
            "content": "Политика доставки",
            "content_hash": "chunk-hash",
            "metadata": '{"tenant_id":"tenant-a"}',
            "source": '{"source_type":"markdown","source_id":"faq.md","title":"FAQ","metadata":"{\\"tenant_id\\":\\"tenant-a\\"}"}',
            "created_at": "2026-05-21T00:00:00Z",
        }
    ]

    class FakeConn:
        async def fetch(self, *_args, **_kwargs):
            return rows

    class FakeAcquire:
        async def __aenter__(self):
            return FakeConn()

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakePool:
        def acquire(self):
            return FakeAcquire()

    class FakeDatabase:
        pool = FakePool()

    repository = PostgresAssistantRepository(FakeDatabase())
    chunks = await repository.list_chunks_for_source(
        store_id="default",
        locale="ru",
        source_type="markdown",
        source_id="faq.md",
    )

    assert chunks[0]["metadata"] == {"tenant_id": "tenant-a"}
    assert chunks[0]["source"]["source_type"] == "markdown"
    assert chunks[0]["source"]["source_id"] == "faq.md"
    assert chunks[0]["source"]["metadata"] == {"tenant_id": "tenant-a"}


@pytest.mark.asyncio
async def test_postgres_repository_get_ingestion_job_normalizes_json_string_columns():
    job_id = uuid4()
    row = {
        "id": job_id,
        "store_id": "default",
        "job_type": "markdown_sync",
        "status": "completed",
        "source_type": "markdown",
        "source_id": "knowledge",
        "input": '{"locale":"ru"}',
        "result": '{"file_count": 2, "chunk_count": 4}',
        "error": None,
        "started_at": "2026-05-20T00:00:00Z",
        "finished_at": "2026-05-20T00:01:00Z",
        "created_at": "2026-05-20T00:00:00Z",
    }

    class FakeConn:
        async def fetchrow(self, *_args, **_kwargs):
            return row

    class FakeAcquire:
        async def __aenter__(self):
            return FakeConn()

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakePool:
        def acquire(self):
            return FakeAcquire()

    class FakeDatabase:
        pool = FakePool()

    repository = PostgresAssistantRepository(FakeDatabase())
    job = await repository.get_ingestion_job(job_id)

    assert job["input"] == {"locale": "ru"}
    assert job["result"] == {"file_count": 2, "chunk_count": 4}


@pytest.mark.asyncio
async def test_postgres_repository_complete_ingestion_job_normalizes_json_string_columns():
    job_id = uuid4()
    row = {
        "id": job_id,
        "store_id": "default",
        "job_type": "markdown_sync",
        "status": "completed",
        "source_type": "markdown",
        "source_id": "knowledge",
        "input": '{"locale":"ru"}',
        "result": '{"file_count": 2, "chunk_count": 4}',
        "error": None,
        "started_at": "2026-05-20T00:00:00Z",
        "finished_at": "2026-05-20T00:01:00Z",
        "created_at": "2026-05-20T00:00:00Z",
    }

    class FakeConn:
        async def fetchrow(self, query, *args):
            return row

    class FakeAcquire:
        async def __aenter__(self):
            return FakeConn()

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakePool:
        def acquire(self):
            return FakeAcquire()

    class FakeDatabase:
        pool = FakePool()

    repository = PostgresAssistantRepository(FakeDatabase())
    job = await repository.complete_ingestion_job(
        job_id=job_id,
        result={"file_count": 2, "chunk_count": 4},
    )

    assert job["input"] == {"locale": "ru"}
    assert job["result"] == {"file_count": 2, "chunk_count": 4}


@pytest.mark.asyncio
async def test_postgres_repository_list_reindex_intents_normalizes_json_string_columns():
    rows = [
        {
            "id": uuid4(),
            "store_id": "default",
            "tenant_id": None,
            "locale": "ru",
            "event_name": "admin.reindex",
            "event_id": None,
            "action": "reindex",
            "scope": "all_products",
            "product_ids": "[]",
            "reason": "admin.reindex",
            "coalescing_key": "assistant:catalog:all-products",
            "status": "pending",
            "attempts": 0,
            "max_attempts": 3,
            "next_attempt_at": "2026-05-19T00:00:00Z",
            "last_error": None,
            "assistant_job_id": None,
            "metadata": '{"force": true}',
            "created_at": "2026-05-19T00:00:00Z",
            "updated_at": "2026-05-19T00:00:00Z",
            "started_at": None,
            "finished_at": None,
        }
    ]

    class FakeConn:
        async def fetch(self, *_args, **_kwargs):
            return rows

    class FakeAcquire:
        async def __aenter__(self):
            return FakeConn()

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakePool:
        def acquire(self):
            return FakeAcquire()

    class FakeDatabase:
        pool = FakePool()

    repository = PostgresAssistantRepository(FakeDatabase())
    intents = await repository.list_reindex_intents(limit=20)

    assert intents[0]["product_ids"] == []
    assert intents[0]["metadata"] == {"force": True}


@pytest.mark.asyncio
async def test_postgres_repository_enqueue_reindex_intent_coalesces_empty_arrays():
    captured: dict[str, object] = {}
    row = {
        "id": uuid4(),
        "store_id": "default",
        "tenant_id": None,
        "locale": "ru",
        "event_name": "admin.reindex",
        "event_id": None,
        "action": "reindex",
        "scope": "all_products",
        "product_ids": [],
        "reason": "admin.reindex",
        "coalescing_key": "assistant:catalog:all-products",
        "status": "pending",
        "attempts": 0,
        "max_attempts": 3,
        "next_attempt_at": "2026-05-19T00:00:00Z",
        "last_error": None,
        "assistant_job_id": None,
        "metadata": {},
        "created_at": "2026-05-19T00:00:00Z",
        "updated_at": "2026-05-19T00:00:00Z",
        "started_at": None,
        "finished_at": None,
    }

    class FakeConn:
        async def fetchrow(self, query, *args):
            captured["query"] = query
            captured["args"] = args
            return row

    class FakeAcquire:
        async def __aenter__(self):
            return FakeConn()

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakePool:
        def acquire(self):
            return FakeAcquire()

    class FakeDatabase:
        pool = FakePool()

    repository = PostgresAssistantRepository(FakeDatabase())
    await repository.enqueue_reindex_intent(
        store_id="default",
        locale="ru",
        event_name="admin.reindex",
        scope="all_products",
        product_ids=[],
        coalescing_key="assistant:catalog:all-products",
    )

    assert "COALESCE(" in str(captured["query"])
    assert "'[]'::jsonb" in str(captured["query"])
    assert captured["args"][8] == "[]"


@pytest.mark.asyncio
async def test_postgres_repository_complete_reindex_intent_uses_integer_interval_backoff():
    captured: dict[str, object] = {}
    row = {
        "id": uuid4(),
        "store_id": "default",
        "tenant_id": None,
        "locale": "ru",
        "event_name": "admin.reindex",
        "event_id": None,
        "action": "reindex",
        "scope": "all_products",
        "product_ids": [],
        "reason": "admin.reindex",
        "coalescing_key": "assistant:catalog:all-products",
        "status": "pending",
        "attempts": 1,
        "max_attempts": 3,
        "next_attempt_at": "2026-05-19T00:01:00Z",
        "last_error": "boom",
        "assistant_job_id": None,
        "metadata": {},
        "created_at": "2026-05-19T00:00:00Z",
        "updated_at": "2026-05-19T00:00:00Z",
        "started_at": None,
        "finished_at": None,
    }

    class FakeConn:
        async def fetchrow(self, query, *args):
            captured["query"] = query
            captured["args"] = args
            return row

    class FakeAcquire:
        async def __aenter__(self):
            return FakeConn()

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakePool:
        def acquire(self):
            return FakeAcquire()

    class FakeDatabase:
        pool = FakePool()

    repository = PostgresAssistantRepository(FakeDatabase())
    await repository.complete_reindex_intent(
        intent_id=row["id"],
        status="error",
        error="boom",
        retry_backoff_seconds=60,
    )

    assert "INTERVAL '1 second'" in str(captured["query"])
    assert "text || ' seconds'" not in str(captured["query"])
    assert captured["args"][5] == 60
