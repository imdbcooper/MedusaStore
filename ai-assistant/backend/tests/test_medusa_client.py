import httpx
import pytest
from urllib.parse import unquote

from app.core.config import Settings
from app.medusa import MedusaProductClient


class CaptureTransport(httpx.AsyncBaseTransport):
    def __init__(self):
        self.requests = []

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return httpx.Response(200, json={"products": [], "count": 0}, request=request)


@pytest.mark.asyncio
async def test_store_product_client_does_not_send_admin_token():
    transport = CaptureTransport()
    async_client = httpx.AsyncClient(transport=transport)
    settings = Settings(
        ASSISTANT_POSTGRES_URI=None,
        MEDUSA_BACKEND_URL="http://medusa.test",
        MEDUSA_ADMIN_API_TOKEN="secret-admin-token",
        MEDUSA_STORE_PUBLISHABLE_KEY="pk_test",
    )
    client = MedusaProductClient(settings=settings, http_client=async_client)

    try:
        await client.list_products()
    finally:
        await async_client.aclose()

    assert transport.requests
    headers = transport.requests[0].headers
    assert headers.get("x-publishable-api-key") == "pk_test"
    assert "authorization" not in headers


@pytest.mark.asyncio
async def test_store_product_client_omits_calculated_price_without_region_context():
    transport = CaptureTransport()
    async_client = httpx.AsyncClient(transport=transport)
    settings = Settings(
        ASSISTANT_POSTGRES_URI=None,
        MEDUSA_BACKEND_URL="http://medusa.test",
        MEDUSA_STORE_PUBLISHABLE_KEY="pk_test",
    )
    client = MedusaProductClient(settings=settings, http_client=async_client)

    try:
        await client.list_products()
    finally:
        await async_client.aclose()

    assert transport.requests
    query = unquote(str(transport.requests[0].url))
    assert "*variants.calculated_price" not in query
    assert "region_id=" not in query


@pytest.mark.asyncio
async def test_store_product_client_keeps_calculated_price_with_region_context():
    transport = CaptureTransport()
    async_client = httpx.AsyncClient(transport=transport)
    settings = Settings(
        ASSISTANT_POSTGRES_URI=None,
        MEDUSA_BACKEND_URL="http://medusa.test",
        MEDUSA_STORE_PUBLISHABLE_KEY="pk_test",
        MEDUSA_DEFAULT_REGION_ID="reg_ru",
    )
    client = MedusaProductClient(settings=settings, http_client=async_client)

    try:
        await client.list_products()
    finally:
        await async_client.aclose()

    assert transport.requests
    query = unquote(str(transport.requests[0].url))
    assert "*variants.calculated_price" in query
    assert "region_id=reg_ru" in query
