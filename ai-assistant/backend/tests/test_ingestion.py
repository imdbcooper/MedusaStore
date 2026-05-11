from pathlib import Path

from app.ingestion.markdown import normalize_markdown, parse_markdown_file


def test_parse_markdown_frontmatter_and_chunks(knowledge_dir: Path):
    chunks = parse_markdown_file(
        knowledge_dir / "faq.md",
        root=knowledge_dir,
        store_id="default",
        locale="ru",
        target_chars=80,
        overlap_chars=10,
    )

    assert chunks
    assert chunks[0].title == "Доставка и оплата"
    assert chunks[0].source_type == "policy"
    assert chunks[0].metadata["tags"] == ["delivery", "payment"]
    assert any("Доставка" in chunk.content for chunk in chunks)


def test_normalize_markdown_collapses_blank_lines():
    assert normalize_markdown("# A\r\n\r\n\r\nText  \n") == "# A\n\nText"


def test_markdown_sync_endpoint(client):
    response = client.post(
        "/api/v1/ingest/markdown/sync",
        json={"store_id": "default", "locale": "ru"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["job"]["status"] == "completed"
    assert data["job"]["result"]["file_count"] == 1
    assert data["chunks"]
