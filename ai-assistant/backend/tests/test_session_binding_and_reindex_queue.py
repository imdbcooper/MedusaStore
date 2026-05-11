from uuid import UUID, uuid4

from tests.conftest import portal_call


def test_anonymous_chat_creates_unbound_session(client):
    response = client.post(
        "/api/v1/chat",
        json={"message": "Привет", "store_id": "default", "locale": "ru"},
    )

    assert response.status_code == 200
    session_id = response.json()["session_id"]
    session = portal_call(client, client.app.state.repository.get_session, session_id=UUID(session_id))
    assert session["customer_id"] is None


def test_session_bind_requires_token_and_rejects_browser_origin(client):
    chat = client.post(
        "/api/v1/chat",
        json={"message": "Привет", "store_id": "default", "locale": "ru"},
    )
    assert chat.status_code == 200
    payload = {
        "session_id": chat.json()["session_id"],
        "store_id": "default",
        "locale": "ru",
        "customer_id": "cus_123",
    }

    no_token = client.post("/api/v1/admin/sessions/bind", json=payload)
    assert no_token.status_code == 401

    browser = client.post(
        "/api/v1/admin/sessions/bind",
        json=payload,
        headers={"Authorization": "Bearer test-token", "Origin": "http://localhost:3000"},
    )
    assert browser.status_code == 403
    assert browser.json()["detail"]["error"]["code"] == "BROWSER_FORBIDDEN"


def test_session_bind_attaches_customer_and_is_idempotent(client):
    chat = client.post(
        "/api/v1/chat",
        json={"message": "Привет", "store_id": "default", "locale": "ru"},
    )
    assert chat.status_code == 200
    session_id = chat.json()["session_id"]
    payload = {
        "session_id": session_id,
        "store_id": "default",
        "locale": "ru",
        "customer_id": "cus_123",
        "customer_context": {"email_hash": "hash-only"},
    }

    first = client.post("/api/v1/admin/sessions/bind", json=payload, headers={"Authorization": "Bearer test-token"})
    second = client.post("/api/v1/admin/sessions/bind", json=payload, headers={"Authorization": "Bearer test-token"})

    assert first.status_code == 200
    assert second.status_code == 200
    session = portal_call(client, client.app.state.repository.get_session, session_id=UUID(session_id))
    assert session["customer_id"] == "cus_123"
    assert session["customer_context"] == {"email_hash": "hash-only"}


def test_session_bind_rejects_different_customer(client):
    chat = client.post(
        "/api/v1/chat",
        json={"message": "Привет", "store_id": "default", "locale": "ru"},
    )
    assert chat.status_code == 200
    session_id = chat.json()["session_id"]

    first = client.post(
        "/api/v1/admin/sessions/bind",
        json={"session_id": session_id, "store_id": "default", "locale": "ru", "customer_id": "cus_123"},
        headers={"Authorization": "Bearer test-token"},
    )
    conflict = client.post(
        "/api/v1/admin/sessions/bind",
        json={"session_id": session_id, "store_id": "default", "locale": "ru", "customer_id": "cus_456"},
        headers={"Authorization": "Bearer test-token"},
    )

    assert first.status_code == 200
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["error"]["code"] == "SESSION_ALREADY_BOUND_TO_DIFFERENT_CUSTOMER"


def test_bind_missing_session_returns_not_found(client):
    response = client.post(
        "/api/v1/admin/sessions/bind",
        json={"session_id": str(uuid4()), "store_id": "default", "locale": "ru", "customer_id": "cus_123"},
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 404


def test_reindex_intent_broad_events_coalesce(client):
    payload = {
        "store_id": "default",
        "locale": "ru",
        "event_name": "product-category.updated",
        "scope": "all_products",
        "reason": "broad_catalog_event",
        "coalescing_key": "assistant:catalog:all-products",
    }

    first = client.post("/api/v1/admin/reindex/intents", json=payload, headers={"Authorization": "Bearer test-token"})
    second = client.post("/api/v1/admin/reindex/intents", json=payload, headers={"Authorization": "Bearer test-token"})

    assert first.status_code == 200
    assert second.status_code == 200
    listed = client.get("/api/v1/admin/reindex/intents", headers={"Authorization": "Bearer test-token"})
    assert listed.status_code == 200
    data = listed.json()
    assert data["stats"]["pending"] == 1
    assert len(data["intents"]) == 1


def test_reindex_processor_completes_selected_product_intent(client):
    queued = client.post(
        "/api/v1/admin/reindex/intents",
        json={
            "store_id": "default",
            "locale": "ru",
            "event_name": "product.updated",
            "action": "reindex",
            "scope": "products",
            "product_ids": ["prod_espresso"],
            "reason": "product.updated",
            "coalescing_key": "assistant:product:prod_espresso",
        },
        headers={"Authorization": "Bearer test-token"},
    )
    assert queued.status_code == 200

    processed = client.post(
        "/api/v1/admin/reindex/process",
        json={"limit": 10, "retry_backoff_seconds": 1},
        headers={"Authorization": "Bearer test-token"},
    )

    assert processed.status_code == 200
    data = processed.json()
    assert data["claimed"] == 1
    assert data["processed"][0]["status"] == "completed"
    assert data["stats"]["completed"] == 1


def test_reindex_processor_retries_then_marks_error(client):
    async def failing_sync_products(**_kwargs):
        raise RuntimeError("temporary medusa failure")

    client.app.state.medusa_product_ingestion_service.sync_products = failing_sync_products
    queued = client.post(
        "/api/v1/admin/reindex/intents",
        json={
            "store_id": "default",
            "locale": "ru",
            "event_name": "product.updated",
            "action": "reindex",
            "scope": "products",
            "product_ids": ["prod_retry"],
            "coalescing_key": "assistant:product:prod_retry",
            "max_attempts": 1,
        },
        headers={"Authorization": "Bearer test-token"},
    )
    assert queued.status_code == 200

    processed = client.post(
        "/api/v1/admin/reindex/process",
        json={"limit": 10, "retry_backoff_seconds": 1},
        headers={"Authorization": "Bearer test-token"},
    )

    assert processed.status_code == 200
    data = processed.json()
    assert data["processed"][0]["status"] == "error"
    assert data["stats"]["error"] == 1


def test_delete_intent_calls_delete_source_path(client):
    portal_call(
        client,
        client.app.state.repository.upsert_source_with_chunks,
        store_id="default",
        locale="ru",
        source_type="medusa_product",
        source_id="prod_delete",
        title="To Delete",
        uri="/products/delete",
        content_hash="hash",
        metadata={"product_id": "prod_delete"},
        chunks=[],
    )

    queued = client.post(
        "/api/v1/admin/reindex/intents",
        json={
            "store_id": "default",
            "locale": "ru",
            "event_name": "product.deleted",
            "action": "delete",
            "scope": "products",
            "product_ids": ["prod_delete"],
            "coalescing_key": "assistant:product:prod_delete",
        },
        headers={"Authorization": "Bearer test-token"},
    )
    assert queued.status_code == 200

    processed = client.post(
        "/api/v1/admin/reindex/process",
        json={"limit": 10},
        headers={"Authorization": "Bearer test-token"},
    )

    assert processed.status_code == 200
    assert portal_call(
        client,
        client.app.state.repository.list_sources,
        store_id="default",
        locale="ru",
        source_type="medusa_product",
    ) == []
