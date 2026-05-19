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
