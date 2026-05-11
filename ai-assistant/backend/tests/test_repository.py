from uuid import uuid4

import pytest


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
