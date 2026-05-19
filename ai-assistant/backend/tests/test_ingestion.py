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


def test_parse_markdown_uses_description_frontmatter_for_chunk_context(tmp_path: Path):
    file_path = tmp_path / "knowledge.md"
    file_path.write_text(
        """---
title: Условия гарантии
description: Краткая сводка по гарантийному обслуживанию кофемашин.
---
## Детали

Гарантия действует 12 месяцев.
""",
        encoding="utf-8",
    )

    chunks = parse_markdown_file(
        file_path,
        root=tmp_path,
        store_id="default",
        locale="ru",
    )

    assert chunks
    assert "Краткая сводка по гарантийному обслуживанию кофемашин." in chunks[0].content


def test_markdown_sync_endpoint(client):
    response = client.post(
        "/api/v1/ingest/markdown/sync",
        json={"store_id": "default", "locale": "ru"},
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["job"]["status"] == "completed"
    assert data["job"]["result"]["file_count"] == 1
    assert data["chunks"]


def test_markdown_sync_scopes_uploaded_documents_by_store_and_locale(client):
    uploads_root = client.app.state.settings.knowledge_uploads_dir
    (uploads_root / "default" / "global" / "ru").mkdir(parents=True)
    (uploads_root / "default" / "global" / "en").mkdir(parents=True)

    (uploads_root / "default" / "global" / "ru" / "delivery.md").write_text(
        """---
title: Доставка для RU
description: Условия доставки для русской локали.
source_type: markdown
source_id: default/global/ru/delivery.md
locale: ru
store_id: default
source_origin: admin
---
Доставка по Москве — 1-2 дня.
""",
        encoding="utf-8",
    )
    (uploads_root / "default" / "global" / "en" / "delivery.md").write_text(
        """---
title: Delivery for EN
description: Delivery terms for English locale.
source_type: markdown
source_id: default/global/en/delivery.md
locale: en
store_id: default
source_origin: admin
---
Delivery takes 3-5 days.
""",
        encoding="utf-8",
    )

    response = client.post(
        "/api/v1/ingest/markdown/sync",
        json={"store_id": "default", "locale": "ru"},
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["job"]["result"]["file_count"] == 2
    source_ids = {chunk["source_id"] for chunk in data["chunks"]}
    assert "default/global/ru/delivery.md" in source_ids
    assert "default/global/en/delivery.md" not in source_ids


def test_create_knowledge_document_endpoint_saves_frontmatter_and_syncs(client):
    response = client.post(
        "/api/v1/admin/knowledge/documents",
        json={
            "store_id": "default",
            "locale": "ru",
            "title": "Гарантия и возвраты",
            "description": "Краткая памятка по возвратам и гарантийному обслуживанию.",
            "content": "# Возвраты\n\nМожно вернуть товар в течение 14 дней.",
            "file_name": "returns-policy.md",
        },
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["document"]["path"] == "default/global/ru/returns-policy.md"
    assert data["job"]["status"] == "completed"
    assert data["chunks"]

    saved = (
        client.app.state.settings.knowledge_uploads_dir
        / "default"
        / "global"
        / "ru"
        / "returns-policy.md"
    ).read_text(encoding="utf-8")
    assert "title: Гарантия и возвраты" in saved
    assert "description: Краткая памятка по возвратам и гарантийному обслуживанию." in saved
    assert "source_id: default/global/ru/returns-policy.md" in saved


def test_medusa_products_sync_endpoint_requires_token(client):
    response = client.post(
        "/api/v1/ingest/medusa/products/sync",
        json={"store_id": "default", "locale": "ru", "full": True, "region_id": "reg_ru"},
    )

    assert response.status_code == 401
    assert response.json()["detail"]["error"]["code"] == "AUTH_REQUIRED"


def test_markdown_sync_endpoint_requires_token(client):
    response = client.post(
        "/api/v1/ingest/markdown/sync",
        json={"store_id": "default", "locale": "ru"},
    )

    assert response.status_code == 401
    assert response.json()["detail"]["error"]["code"] == "AUTH_REQUIRED"


def test_create_knowledge_document_endpoint_requires_token(client):
    response = client.post(
        "/api/v1/admin/knowledge/documents",
        json={
            "store_id": "default",
            "locale": "ru",
            "title": "Без токена",
            "description": "Этот запрос должен быть запрещён.",
            "content": "# Запрет\n\nНет токена.",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"]["error"]["code"] == "AUTH_REQUIRED"


def test_medusa_products_sync_endpoint_uses_fake_client(client):
    response = client.post(
        "/api/v1/ingest/medusa/products/sync",
        json={"store_id": "default", "locale": "ru", "full": True, "region_id": "reg_ru"},
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["job"]["status"] == "completed"
    assert data["products_indexed"] == 1
    assert data["chunks"][0]["source_type"] == "medusa_product"
    assert data["chunks"][0]["metadata"]["product_id"] == "prod_espresso"
