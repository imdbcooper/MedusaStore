from app.services.chat import sse_event, tokenize_for_stream


def test_sse_event_format():
    assert sse_event("done", {"done": True}) == 'event: done\ndata: {"done": true}\n\n'


def test_tokenize_for_stream_splits_text():
    tokens = tokenize_for_stream("abcdef", chunk_size=2)
    assert tokens == ["ab", "cd", "ef"]


def test_chat_stream_endpoint(client):
    ingest = client.post(
        "/api/v1/ingest/markdown/sync",
        json={"store_id": "default", "locale": "ru"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert ingest.status_code == 200

    with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"message": "Как работает доставка?", "store_id": "default", "locale": "ru"},
    ) as response:
        body = "".join(response.iter_text())

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: session" in body
    assert "event: token" in body
    assert "event: citations" in body
    assert "event: done" in body
