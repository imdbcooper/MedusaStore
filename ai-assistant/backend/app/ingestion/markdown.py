import hashlib
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any
from uuid import uuid5, NAMESPACE_URL

import yaml

from app.schemas.ingestion import MarkdownChunk

FRONTMATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.DOTALL)
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
PATH_SEGMENT_RE = re.compile(r"[^\w.-]+", re.UNICODE)


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize_markdown(content: str) -> str:
    content = content.replace("\r\n", "\n").replace("\r", "\n")
    content = re.sub(r"[ \t]+\n", "\n", content)
    content = re.sub(r"\n{3,}", "\n\n", content)
    return content.strip()


def parse_frontmatter(content: str) -> tuple[dict[str, Any], str]:
    match = FRONTMATTER_RE.match(content)
    if not match:
        return {}, content
    raw = match.group(1)
    metadata = yaml.safe_load(raw) or {}
    if not isinstance(metadata, dict):
        metadata = {}
    return normalize_metadata_values(metadata), content[match.end() :]


def strip_frontmatter(content: str) -> str:
    _, body = parse_frontmatter(content)
    return body


def normalize_metadata_values(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): normalize_metadata_values(item) for key, item in value.items()}
    if isinstance(value, list):
        return [normalize_metadata_values(item) for item in value]
    if isinstance(value, tuple | set):
        return [normalize_metadata_values(item) for item in value]
    if isinstance(value, datetime | date):
        return value.isoformat()
    return value


def infer_title(path: Path, metadata: dict[str, Any], body: str) -> str:
    if metadata.get("title"):
        return str(metadata["title"])
    heading = HEADING_RE.search(body)
    if heading:
        return heading.group(2).strip()
    return path.stem.replace("-", " ").replace("_", " ").title()


def sanitize_path_segment(value: str, *, default: str = "document") -> str:
    normalized = PATH_SEGMENT_RE.sub("-", value.replace("/", "-").replace("\\", "-").strip().casefold())
    normalized = normalized.strip(" .-_")
    return normalized or default


def build_admin_markdown_document(
    *,
    title: str,
    description: str,
    content: str,
    source_id: str,
    store_id: str,
    locale: str,
    tenant_id: str | None = None,
    uploaded_file_name: str | None = None,
) -> str:
    body = normalize_markdown(strip_frontmatter(content))
    metadata: dict[str, Any] = {
        "title": title.strip(),
        "description": normalize_markdown(description),
        "source_type": "markdown",
        "source_id": source_id,
        "source_origin": "admin",
        "store_id": store_id,
        "locale": locale,
    }
    if tenant_id:
        metadata["tenant_id"] = tenant_id
    if uploaded_file_name:
        metadata["uploaded_file_name"] = uploaded_file_name
    frontmatter = yaml.safe_dump(
        metadata,
        allow_unicode=True,
        sort_keys=False,
    ).strip()
    return f"---\n{frontmatter}\n---\n\n{body}\n"


def split_markdown_sections(body: str) -> list[str]:
    matches = list(HEADING_RE.finditer(body))
    if not matches:
        return [body]

    sections: list[str] = []
    if matches[0].start() > 0:
        intro = body[: matches[0].start()].strip()
        if intro:
            sections.append(intro)

    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(body)
        section = body[start:end].strip()
        if section:
            sections.append(section)
    return sections


def enrich_body_with_frontmatter_context(
    *,
    body: str,
    title: str,
    metadata: dict[str, Any],
) -> str:
    description = metadata.get("description")
    if not isinstance(description, str) or not description.strip():
        return body
    normalized_description = normalize_markdown(description)
    if not normalized_description:
        return body

    prefix: list[str] = []
    first_heading = HEADING_RE.search(body)
    if not first_heading or normalize_heading(first_heading.group(2)) != normalize_heading(title):
        prefix.append(f"# {title}")
    if normalized_description.casefold() not in body.casefold():
        prefix.append(normalized_description)
    if not prefix:
        return body
    return normalize_markdown("\n\n".join([*prefix, body]))


def chunk_text(section: str, *, target_chars: int, overlap_chars: int) -> list[str]:
    section = section.strip()
    if not section:
        return []
    if len(section) <= target_chars:
        return [section]

    chunks: list[str] = []
    start = 0
    while start < len(section):
        end = min(start + target_chars, len(section))
        if end < len(section):
            boundary = max(section.rfind("\n\n", start, end), section.rfind(". ", start, end))
            if boundary > start + target_chars // 2:
                end = boundary + 1
        chunks.append(section[start:end].strip())
        if end >= len(section):
            break
        start = max(0, end - overlap_chars)
    return [chunk for chunk in chunks if chunk]


def parse_markdown_file(
    path: Path,
    *,
    root: Path,
    store_id: str,
    locale: str,
    target_chars: int = 1200,
    overlap_chars: int = 150,
) -> list[MarkdownChunk]:
    raw = path.read_text(encoding="utf-8")
    metadata, body = parse_frontmatter(raw)
    body = normalize_markdown(body)
    title = infer_title(path, metadata, body)
    body = enrich_body_with_frontmatter_context(
        body=body,
        title=title,
        metadata=metadata,
    )
    relative_path = str(path.relative_to(root)) if path.is_relative_to(root) else str(path)
    source_id = metadata.get("source_id") or relative_path
    source_type = metadata.get("source_type") or "markdown"
    base_metadata = {
        **metadata,
        "store_id": metadata.get("store_id", store_id),
        "tenant_id": metadata.get("tenant_id"),
        "locale": metadata.get("locale", locale),
        "path": relative_path,
    }

    chunks: list[MarkdownChunk] = []
    chunk_index = 0
    for section in split_markdown_sections(body):
        for chunk in chunk_text(section, target_chars=target_chars, overlap_chars=overlap_chars):
            chunk_hash = sha256_text(chunk)
            chunk_id = uuid5(NAMESPACE_URL, f"{store_id}:{locale}:{source_id}:{chunk_index}:{chunk_hash}")
            chunks.append(
                MarkdownChunk(
                    id=chunk_id,
                    source_id=str(source_id),
                    source_type=str(source_type),
                    title=title,
                    path=relative_path,
                    content=chunk,
                    content_hash=chunk_hash,
                    chunk_index=chunk_index,
                    metadata=base_metadata,
                )
            )
            chunk_index += 1
    return chunks


def discover_markdown_files(path: Path) -> list[Path]:
    if path.is_file() and path.suffix.lower() in {".md", ".markdown"}:
        return [path]
    if not path.exists():
        return []
    return sorted(
        candidate
        for candidate in path.rglob("*")
        if candidate.is_file() and candidate.suffix.lower() in {".md", ".markdown"}
    )


def normalize_heading(value: str) -> str:
    return " ".join(value.strip().casefold().split())
