def test_chat_endpoint_persists_session_and_messages(client):
    ingest = client.post("/api/v1/ingest/markdown/sync", json={"store_id": "default", "locale": "ru"})
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

    history = client.get(f"/api/v1/chat/history?session_id={data['session_id']}")
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
