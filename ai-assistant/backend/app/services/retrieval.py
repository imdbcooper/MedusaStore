from app.schemas.chat import Citation


class SimpleMarkdownRetriever:
    """Keyword retriever for Phase 1 Markdown mode.

    This intentionally stays lightweight. Qdrant/LightRAG adapters can implement
    the same search shape in later phases.
    """

    def __init__(self, *, repository):
        self.repository = repository

    async def search(
        self,
        *,
        query: str,
        store_id: str,
        locale: str,
        limit: int = 5,
    ) -> tuple[list[dict], list[Citation]]:
        chunks = await self.repository.search_chunks(
            store_id=store_id,
            locale=locale,
            query=query,
            limit=limit,
        )
        citations: list[Citation] = []
        for chunk in chunks:
            source = chunk.get("source", {})
            citations.append(
                Citation(
                    source_type=source.get("source_type", "markdown"),
                    source_id=source.get("source_id", chunk.get("source_id", "unknown")),
                    title=source.get("title", chunk.get("title", "Markdown knowledge")),
                    url=source.get("uri") or chunk.get("path"),
                    chunk_id=str(chunk.get("id")),
                )
            )
        return chunks, citations

    async def product_cards(
        self,
        *,
        store_id: str,
        locale: str,
        chunks: list[dict],
        limit: int = 3,
    ) -> list[dict]:
        seen: set[str] = set()
        cards: list[dict] = []
        for chunk in chunks:
            source = chunk.get("source", {})
            if source.get("source_type") != "medusa_product":
                continue
            metadata = source.get("metadata") or chunk.get("metadata") or {}
            product_id = source.get("source_id") or metadata.get("product_id")
            if not product_id or product_id in seen:
                continue
            seen.add(product_id)
            cards.append(product_card_from_metadata(metadata, source, chunk))
            if len(cards) >= limit:
                return cards

        if len(cards) < limit and hasattr(self.repository, "list_sources"):
            sources = await self.repository.list_sources(
                store_id=store_id,
                locale=locale,
                source_type="medusa_product",
            )
            for source in sources:
                metadata = source.get("metadata") or {}
                product_id = source.get("source_id") or metadata.get("product_id")
                if not product_id or product_id in seen:
                    continue
                seen.add(product_id)
                cards.append(product_card_from_metadata(metadata, source, None))
                if len(cards) >= limit:
                    break
        return cards


def product_card_from_metadata(metadata: dict, source: dict, chunk: dict | None) -> dict:
    reason = None
    if chunk:
        title = source.get("title") or metadata.get("title") or "товар"
        reason = f"Подходит по найденному описанию из карточки «{title}»."
    return {
        "id": str(metadata.get("product_id") or source.get("source_id")),
        "handle": metadata.get("handle"),
        "title": metadata.get("title") or source.get("title") or "Product",
        "thumbnail": metadata.get("thumbnail"),
        "price": None,
        "availability": "unknown",
        "reason": reason or "Индексированный товар из каталога Medusa; цена и наличие требуют live-проверки.",
    }


