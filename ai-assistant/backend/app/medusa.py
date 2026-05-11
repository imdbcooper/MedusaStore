from __future__ import annotations

from collections.abc import Iterable
from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.config import Settings


class MedusaClientError(RuntimeError):
    """Raised when the Medusa Store API cannot be reached or returns an error."""


class MedusaProductClient:
    """Small Store API client used only by the standalone assistant service.

    The client reads products and carts through Medusa Store API so the assistant
    can index catalog text and verify live commerce facts. Store API calls use
    only publishable/public context; admin tokens are not sent to storefront
    commerce endpoints.
    """

    def __init__(self, *, settings: Settings, http_client: httpx.AsyncClient | None = None) -> None:
        self.settings = settings
        self._client = http_client

    async def list_products(
        self,
        *,
        product_ids: Iterable[str] | None = None,
        region_id: str | None = None,
        currency_code: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        if not self.settings.medusa_backend_url:
            raise MedusaClientError("MEDUSA_BACKEND_URL is not configured")

        page_limit = limit or self.settings.medusa_products_page_limit
        offset = 0
        products: list[dict[str, Any]] = []
        product_ids_list = [item for item in product_ids or [] if item]

        while True:
            payload = await self._get_products_page(
                limit=page_limit,
                offset=offset,
                product_ids=product_ids_list,
                region_id=region_id or self.settings.medusa_default_region_id,
                currency_code=currency_code,
            )
            page_products = payload.get("products") or []
            products.extend(page_products)

            count = int(payload.get("count") or len(page_products))
            offset += len(page_products)
            if not page_products or offset >= count or product_ids_list:
                break

        return products

    async def _get_products_page(
        self,
        *,
        limit: int,
        offset: int,
        product_ids: list[str],
        region_id: str | None,
        currency_code: str | None,
    ) -> dict[str, Any]:
        query: dict[str, Any] = {
            "limit": limit,
            "offset": offset,
            "fields": self.settings.medusa_products_fields,
        }
        if region_id:
            query["region_id"] = region_id
        if currency_code:
            query["currency_code"] = currency_code
        for product_id in product_ids:
            query.setdefault("id[]", []).append(product_id)

        url = f"{self.settings.medusa_backend_url.rstrip('/')}/store/products"
        headers = self._headers()
        params = _encode_query(query)

        try:
            if self._client:
                response = await self._client.get(url, params=params, headers=headers)
            else:
                async with httpx.AsyncClient(timeout=self.settings.medusa_request_timeout_seconds) as client:
                    response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise MedusaClientError(f"Could not fetch products from Medusa: {exc}") from exc

        data = response.json()
        if not isinstance(data, dict):
            raise MedusaClientError("Medusa product list response is not an object")
        return data

    async def get_cart(self, *, cart_id: str) -> dict[str, Any]:
        if not self.settings.medusa_backend_url:
            raise MedusaClientError("MEDUSA_BACKEND_URL is not configured")
        url = f"{self.settings.medusa_backend_url.rstrip('/')}/store/carts/{cart_id}"
        try:
            if self._client:
                response = await self._client.get(url, headers=self._headers())
            else:
                async with httpx.AsyncClient(timeout=self.settings.medusa_request_timeout_seconds) as client:
                    response = await client.get(url, headers=self._headers())
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise MedusaClientError(f"Could not fetch cart from Medusa: {exc}") from exc
        data = response.json()
        if not isinstance(data, dict):
            raise MedusaClientError("Medusa cart response is not an object")
        cart = data.get("cart", data)
        if not isinstance(cart, dict):
            raise MedusaClientError("Medusa cart payload is not an object")
        return cart

    async def add_to_cart(self, *, cart_id: str, variant_id: str, quantity: int) -> dict[str, Any]:
        if not self.settings.medusa_backend_url:
            raise MedusaClientError("MEDUSA_BACKEND_URL is not configured")
        url = f"{self.settings.medusa_backend_url.rstrip('/')}/store/carts/{cart_id}/line-items"
        payload = {"variant_id": variant_id, "quantity": quantity}
        try:
            if self._client:
                response = await self._client.post(url, json=payload, headers=self._headers())
            else:
                async with httpx.AsyncClient(timeout=self.settings.medusa_request_timeout_seconds) as client:
                    response = await client.post(url, json=payload, headers=self._headers())
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise MedusaClientError(f"Could not add item to Medusa cart: {exc}") from exc
        data = response.json()
        if not isinstance(data, dict):
            raise MedusaClientError("Medusa add-to-cart response is not an object")
        cart = data.get("cart", data)
        if not isinstance(cart, dict):
            raise MedusaClientError("Medusa add-to-cart payload is not an object")
        return cart

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {"accept": "application/json"}
        if self.settings.medusa_store_publishable_key:
            headers["x-publishable-api-key"] = self.settings.medusa_store_publishable_key
        return headers


def _encode_query(query: dict[str, Any]) -> str:
    pairs: list[tuple[str, Any]] = []
    for key, value in query.items():
        if isinstance(value, list):
            pairs.extend((key, item) for item in value)
        else:
            pairs.append((key, value))
    return urlencode(pairs)
