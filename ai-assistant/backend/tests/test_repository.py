from uuid import uuid4

import pytest

from app.database.postgres import SCHEMA_SQL
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
async def test_memory_repository_handoff_ticket_lifecycle(repository):
    session = await repository.ensure_session(
        session_id=None,
        store_id="default",
        locale="ru",
    )
    handoff = await repository.create_handoff(
        session_id=session["id"],
        store_id="default",
        locale="ru",
        source="assistant_widget",
        email="lead@example.com",
        summary="Нужен созвон по интеграциям и SLA",
    )

    submitted = await repository.upsert_handoff_ticket(
        handoff_id=handoff["id"],
        channel="telegram",
        ticket_status="submitted",
        created_at=handoff["created_at"],
        last_sync_at=handoff["created_at"],
    )
    opened = await repository.upsert_handoff_ticket(
        handoff_id=handoff["id"],
        channel="telegram",
        ticket_status="open",
        telegram_chat_id="-1001234567890",
        telegram_topic_id=321,
        telegram_topic_title="#ABC12345 · Алексей",
        telegram_root_message_id=654,
        opened_at=handoff["created_at"],
    )
    loaded = await repository.get_handoff_ticket(
        handoff_id=handoff["id"],
        channel="telegram",
    )

    assert submitted["ticket_status"] == "submitted"
    assert opened["ticket_status"] == "open"
    assert loaded is not None
    assert loaded["telegram_chat_id"] == "-1001234567890"
    assert loaded["telegram_topic_id"] == 321
    assert loaded["telegram_root_message_id"] == 654


@pytest.mark.asyncio
async def test_memory_repository_handoff_ticket_upsert_preserves_open_metadata_on_submitted_retry(
    repository,
):
    session = await repository.ensure_session(
        session_id=None,
        store_id="default",
        locale="ru",
    )
    handoff = await repository.create_handoff(
        session_id=session["id"],
        store_id="default",
        locale="ru",
        source="assistant_widget",
        email="lead@example.com",
        summary="Нужен созвон по интеграциям и SLA",
    )

    opened = await repository.upsert_handoff_ticket(
        handoff_id=handoff["id"],
        channel="telegram",
        ticket_status="open",
        telegram_chat_id="-1001234567890",
        telegram_topic_id=321,
        telegram_topic_title="#ABC12345 · Алексей",
        telegram_root_message_id=654,
        created_at=handoff["created_at"],
        opened_at=handoff["created_at"],
        last_sync_at=handoff["created_at"],
    )
    retried = await repository.upsert_handoff_ticket(
        handoff_id=handoff["id"],
        channel="telegram",
        ticket_status="submitted",
        created_at=handoff["created_at"],
    )

    assert opened["ticket_status"] == "open"
    assert retried["ticket_status"] == "open"
    assert retried["telegram_chat_id"] == "-1001234567890"
    assert retried["telegram_topic_id"] == 321
    assert retried["telegram_topic_title"] == "#ABC12345 · Алексей"
    assert retried["telegram_root_message_id"] == 654
    assert retried["opened_at"] == handoff["created_at"]


@pytest.mark.asyncio
async def test_memory_repository_handoff_message_reservation_reuses_failed_mapping(
    repository,
):
    session = await repository.ensure_session(
        session_id=None,
        store_id="default",
        locale="ru",
    )
    handoff = await repository.create_handoff(
        session_id=session["id"],
        store_id="default",
        locale="ru",
        source="assistant_widget",
        email="lead@example.com",
        summary="Нужен созвон по интеграциям и SLA",
    )

    reserved, is_reserved = await repository.reserve_handoff_message(
        handoff_id=handoff["id"],
        session_id=session["id"],
        telegram_chat_id="-1001234567890",
        telegram_topic_id=321,
        telegram_message_id=777,
        telegram_update_id=9001,
        direction="telegram_inbound",
        message_kind="message_processing",
        operator_telegram_user_id="7001",
        operator_username="operator_alex",
        content="/reply Привет",
        metadata={"reason": "processing"},
    )
    duplicate, duplicate_reserved = await repository.reserve_handoff_message(
        handoff_id=handoff["id"],
        session_id=session["id"],
        telegram_chat_id="-1001234567890",
        telegram_topic_id=321,
        telegram_message_id=777,
        telegram_update_id=9001,
        direction="telegram_inbound",
        message_kind="message_processing",
        operator_telegram_user_id="7001",
        operator_username="operator_alex",
        content="/reply Привет",
        metadata={"reason": "processing"},
    )

    assert is_reserved is True
    assert reserved["delivery_status"] == "processing"
    assert duplicate_reserved is False
    assert duplicate["id"] == reserved["id"]

    assistant_message_id = uuid4()
    failed = await repository.update_handoff_message(
        handoff_message_id=reserved["id"],
        delivery_status="failed",
        assistant_message_id=assistant_message_id,
        content="Привет",
        metadata={"reason": "unexpected_error"},
    )
    retried, retried_reserved = await repository.reserve_handoff_message(
        handoff_id=handoff["id"],
        session_id=session["id"],
        telegram_chat_id="-1001234567890",
        telegram_topic_id=321,
        telegram_message_id=777,
        telegram_update_id=9001,
        direction="telegram_inbound",
        message_kind="command_reply",
        operator_telegram_user_id="7001",
        operator_username="operator_alex",
        content="Привет",
        metadata={"reason": "processing"},
    )

    assert failed["delivery_status"] == "failed"
    assert retried_reserved is True
    assert retried["id"] == reserved["id"]
    assert retried["delivery_status"] == "processing"
    assert retried["assistant_message_id"] == assistant_message_id
    assert retried["content"] == "Привет"
    assert len(repository.handoff_messages) == 1


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


def test_postgres_schema_declares_handoff_ticket_table():
    assert "CREATE TABLE IF NOT EXISTS assistant_handoff_tickets" in SCHEMA_SQL
    assert "idx_assistant_handoff_tickets_status_updated" in SCHEMA_SQL


@pytest.mark.asyncio
async def test_postgres_repository_reserve_handoff_message_uses_atomic_insert():
    captured: dict[str, object] = {}
    row = {
        "id": uuid4(),
        "handoff_id": uuid4(),
        "session_id": uuid4(),
        "telegram_chat_id": "-1001234567890",
        "telegram_topic_id": 321,
        "telegram_message_id": 777,
        "telegram_update_id": 9001,
        "direction": "telegram_inbound",
        "delivery_status": "processing",
        "message_kind": "message_processing",
        "assistant_message_id": None,
        "operator_telegram_user_id": "7001",
        "operator_username": "operator_alex",
        "content": "/reply Привет",
        "metadata": "{}",
    }

    class FakeTransaction:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakeConn:
        def transaction(self):
            return FakeTransaction()

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
    reserved, is_reserved = await repository.reserve_handoff_message(
        handoff_id=row["handoff_id"],
        session_id=row["session_id"],
        telegram_chat_id="-1001234567890",
        telegram_topic_id=321,
        telegram_message_id=777,
        telegram_update_id=9001,
        direction="telegram_inbound",
        message_kind="message_processing",
        operator_telegram_user_id="7001",
        operator_username="operator_alex",
        content="/reply Привет",
        metadata={"reason": "processing"},
    )

    query = " ".join(str(captured["query"]).split())
    assert "ON CONFLICT (telegram_update_id) DO NOTHING" in query
    assert reserved["delivery_status"] == "processing"
    assert is_reserved is True


@pytest.mark.asyncio
async def test_postgres_repository_update_handoff_message_only_updates_requested_fields():
    captured: dict[str, object] = {}
    row = {
        "id": uuid4(),
        "handoff_id": uuid4(),
        "session_id": uuid4(),
        "telegram_chat_id": "-1001234567890",
        "telegram_topic_id": 321,
        "telegram_message_id": 777,
        "telegram_update_id": 9001,
        "direction": "telegram_inbound",
        "delivery_status": "failed",
        "message_kind": "command_reply",
        "assistant_message_id": uuid4(),
        "operator_telegram_user_id": "7001",
        "operator_username": "operator_alex",
        "content": "Привет",
        "metadata": "{}",
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
    await repository.update_handoff_message(
        handoff_message_id=row["id"],
        delivery_status="failed",
        metadata={"reason": "unexpected_error"},
    )

    query = " ".join(str(captured["query"]).split())
    assert "delivery_status = $2" in query
    assert "metadata = $3::jsonb" in query
    assert "assistant_message_id" not in query


@pytest.mark.asyncio
async def test_postgres_repository_handoff_ticket_upsert_sql_preserves_existing_metadata():
    captured: dict[str, object] = {}
    row = {
        "handoff_id": uuid4(),
        "channel": "telegram",
        "ticket_status": "open",
        "telegram_chat_id": "-1001234567890",
        "telegram_topic_id": 321,
        "telegram_topic_title": "#ABC12345 · Алексей",
        "telegram_root_message_id": 654,
        "failure_reason": None,
        "created_at": "2026-05-22T12:00:00Z",
        "opened_at": "2026-05-22T12:00:00Z",
        "last_sync_at": "2026-05-22T12:00:00Z",
        "updated_at": "2026-05-22T12:00:01Z",
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
    await repository.upsert_handoff_ticket(
        handoff_id=row["handoff_id"],
        channel="telegram",
        ticket_status="submitted",
    )

    query = " ".join(str(captured["query"]).split())
    assert "COALESCE( EXCLUDED.telegram_chat_id, assistant_handoff_tickets.telegram_chat_id )" in query
    assert "COALESCE( EXCLUDED.telegram_topic_id, assistant_handoff_tickets.telegram_topic_id )" in query
    assert "COALESCE( EXCLUDED.telegram_root_message_id, assistant_handoff_tickets.telegram_root_message_id )" in query
    assert "assistant_handoff_tickets.ticket_status = 'open'" in query
    assert "assistant_handoff_tickets.ticket_status = 'failed'" in query
    assert "COALESCE( assistant_handoff_tickets.opened_at, EXCLUDED.opened_at )" in query


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
