from types import SimpleNamespace

from app.medusa import MedusaClientError


class FakeMedusaProductClient:
    def __init__(self, products, *, available=True, cart_available=True, cart=None):
        self.products = products
        self.available = available
        self.cart_available = cart_available
        self.cart = cart or {"id": "cart_test", "items": [], "currency_code": "rub"}
        self.calls = []
        self.cart_calls = []
        self.add_to_cart_calls = []

    async def list_products(self, *, product_ids=None, region_id=None, currency_code=None, limit=None):
        self.calls.append(
            {
                "product_ids": product_ids,
                "region_id": region_id,
                "currency_code": currency_code,
                "limit": limit,
            }
        )
        if not self.available:
            raise MedusaClientError("Medusa unavailable in fake client")
        if product_ids:
            requested = set(product_ids)
            return [product for product in self.products if product.get("id") in requested]
        return list(self.products)

    async def get_cart(self, *, cart_id):
        self.cart_calls.append({"cart_id": cart_id})
        if not self.available or not self.cart_available:
            raise MedusaClientError("Medusa cart unavailable in fake client")
        return {**self.cart, "id": cart_id}

    async def health(self):
        return {"status": "ok" if self.available else "error", "fake": True}

    async def add_to_cart(self, *, cart_id, variant_id, quantity):
        self.add_to_cart_calls.append(
            {"cart_id": cart_id, "variant_id": variant_id, "quantity": quantity}
        )
        if not self.available:
            raise MedusaClientError("Medusa unavailable in fake client")
        return {**self.cart, "id": cart_id, "items": [{"variant_id": variant_id, "quantity": quantity}]}


class FakeQdrantClient:
    def __init__(self, *, fail_search=False):
        self.fail_search = fail_search
        self.collections = set()
        self.points = []
        self.upserts = []
        self.searches = []
        self.deletes = []

    async def get_collections(self):
        return SimpleNamespace(collections=[SimpleNamespace(name=name) for name in sorted(self.collections)])

    async def create_collection(self, *, collection_name, vectors_config):
        self.collections.add(collection_name)

    async def upsert(self, *, collection_name, points):
        self.collections.add(collection_name)
        normalized = []
        for point in points:
            if isinstance(point, dict):
                normalized.append(point)
            else:
                normalized.append(
                    {"id": point.id, "vector": point.vector, "payload": point.payload}
                )
        self.points.extend({"collection_name": collection_name, **point} for point in normalized)
        self.upserts.append({"collection_name": collection_name, "points": normalized})

    async def search(self, *, collection_name, query_vector, query_filter, limit, with_payload):
        if self.fail_search:
            raise RuntimeError("qdrant unavailable")
        self.searches.append(
            {
                "collection_name": collection_name,
                "query_vector": query_vector,
                "query_filter": query_filter,
                "limit": limit,
                "with_payload": with_payload,
            }
        )
        matches = [point for point in self.points if point["collection_name"] == collection_name]
        matches = [point for point in matches if _payload_matches_filter(point["payload"], query_filter)]
        return [
            {"id": point["id"], "payload": point["payload"], "score": 0.9}
            for point in matches[:limit]
        ]

    async def delete(self, *, collection_name, points_selector):
        self.deletes.append({"collection_name": collection_name, "points_selector": points_selector})

    async def close(self):
        return None


class FakeEmbeddingProvider:
    def __init__(self, *, available=True, dimension=8):
        self.available = available
        self.dimension = dimension
        self.calls = []

    async def embed_texts(self, texts):
        self.calls.append(list(texts))
        if not self.available:
            raise RuntimeError("embedding unavailable")
        return [[1.0] + [0.0] * (self.dimension - 1) for _ in texts]

    async def health(self):
        return {"status": "ok" if self.available else "error", "provider": "fake"}


def _payload_matches_filter(payload, query_filter):
    if not query_filter:
        return True
    must = _filter_conditions(query_filter, "must")
    should = _filter_conditions(query_filter, "should")
    for condition in must:
        if not _payload_matches_condition(payload, condition):
            return False
    if should and not any(_payload_matches_condition(payload, condition) for condition in should):
        return False
    return True


def _payload_matches_condition(payload, condition):
    nested_should = _filter_conditions(condition, "should")
    if nested_should:
        return any(_payload_matches_condition(payload, item) for item in nested_should)
    key = _condition_value(condition, "key")
    match = _condition_value(condition, "match") or {}
    expected = _condition_value(match, "value")
    value = payload.get(key)
    if isinstance(value, list):
        return expected in value
    return value == expected


def _filter_conditions(item, field):
    value = _condition_value(item, field)
    return list(value or [])


def _condition_value(item, field):
    if isinstance(item, dict):
        return item.get(field)
    return getattr(item, field, None)


ESPRESSO_MACHINE_PRODUCT = {
    "id": "prod_espresso",
    "handle": "espresso-pro",
    "title": "Espresso Pro",
    "subtitle": "Домашняя рожковая кофемашина",
    "description": "Подходит для эспрессо и капучино дома.",
    "thumbnail": "https://example.test/espresso.jpg",
    "collection": {"id": "pcol_coffee", "title": "Кофе"},
    "categories": [{"id": "pcat_machines", "name": "Кофемашины", "handle": "coffee-machines"}],
    "tags": [{"value": "espresso"}, {"value": "home"}],
    "options": [{"id": "opt_color", "title": "Color", "values": [{"value": "black"}]}],
    "variants": [
        {
            "id": "variant_espresso_black",
            "title": "Black",
            "sku": "ESP-BLK",
            "options": [{"value": "black"}],
            "calculated_price": {"calculated_amount": 49900, "currency_code": "rub"},
            "inventory_quantity": 4,
        }
    ],
    "images": [{"url": "https://example.test/espresso.jpg"}],
    "metadata": {"brand": "Acme", "material": "steel"},
    "updated_at": "2026-05-11T00:00:00Z",
}
