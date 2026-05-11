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
