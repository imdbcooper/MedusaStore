from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.repositories.memory import InMemoryAssistantRepository


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
    )
    return create_app(settings=settings, repository=repository)


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client
