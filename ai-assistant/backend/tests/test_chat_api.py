def test_chat_endpoint_persists_session_and_messages(client):
    ingest = client.post(
        "/api/v1/ingest/markdown/sync",
        json={"store_id": "default", "locale": "ru"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert ingest.status_code == 200

    response = client.post(
        "/api/v1/chat",
        json={"message": "Расскажи про доставку", "store_id": "default", "locale": "ru"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["session_id"]
    assert data["message_id"]
    assert data["intent"] == "policy"
    assert data["citations"]
    assert "Medusa" in data["answer"]

    public_history = client.get(f"/api/v1/chat/history?session_id={data['session_id']}")
    assert public_history.status_code == 401

    history = client.get(
        f"/api/v1/chat/history?session_id={data['session_id']}",
        headers={"Authorization": "Bearer test-token"},
    )
    assert history.status_code == 200
    messages = history.json()
    assert [message["role"] for message in messages] == ["user", "assistant"]


def test_chat_without_knowledge_is_graceful(client):
    response = client.post(
        "/api/v1/chat",
        json={"message": "Что есть в наличии?", "store_id": "default", "locale": "ru"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["safety"]["grounded"] is False
    assert "нет подходящего фрагмента" in data["answer"]


def test_chat_returns_product_cards_for_catalog_question(client):
    ingest = client.post(
        "/api/v1/ingest/medusa/products/sync",
        json={"store_id": "default", "locale": "ru", "full": True},
        headers={"Authorization": "Bearer test-token"},
    )
    assert ingest.status_code == 200

    response = client.post(
        "/api/v1/chat",
        json={"message": "Подбери кофемашину для эспрессо", "store_id": "default", "locale": "ru"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "product_discovery"
    assert data["products"]
    assert data["products"][0]["id"] == "prod_espresso"
    assert data["products"][0]["handle"] == "espresso-pro"
    assert data["products"][0]["price"] == "499 RUB"
    assert data["products"][0]["availability"] == "in_stock"
    assert "49900" not in data["answer"]
    assert "499 RUB" in data["answer"]
    assert data["tool_calls"][0]["name"] == "search_products"
    assert data["safety"]["grounded"] is True
    assert data["safety"]["live_data_checked"] is True
