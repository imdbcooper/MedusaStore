from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.repositories.memory import InMemoryAssistantRepository
from tests.fakes import ESPRESSO_MACHINE_PRODUCT, FakeMedusaProductClient


@pytest.fixture
def repository():
    return InMemoryAssistantRepository()


@pytest.fixture
def knowledge_dir(tmp_path: Path) -> Path:
    directory = tmp_path / "knowledge"
    directory.mkdir()
    (directory / "faq.md").write_text(
        """---
title: Доставка и оплата
source_type: policy
locale: ru
store_id: default
tags: [delivery, payment]
---
# Доставка

Доставка по Москве занимает 1-2 дня.

# Оплата

Можно оплатить картой онлайн или при получении.
""",
        encoding="utf-8",
    )
    return directory


@pytest.fixture
def app(repository, knowledge_dir):
    settings = Settings(
        KNOWLEDGE_DIR=knowledge_dir,
        ASSISTANT_POSTGRES_URI=None,
        AI_ASSISTANT_CORS_ORIGINS=["http://testserver"],
        AI_ASSISTANT_API_TOKEN="test-token",
    )
    app = create_app(settings=settings, repository=repository)
    app.state.fake_medusa_product_client = FakeMedusaProductClient([ESPRESSO_MACHINE_PRODUCT])
    return app


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        fake_client = test_client.app.state.fake_medusa_product_client
        test_client.app.state.medusa_product_client = fake_client
        test_client.app.state.medusa_product_ingestion_service.product_client = fake_client
        yield test_client
