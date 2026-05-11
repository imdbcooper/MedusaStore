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

    async def add_to_cart(self, *, cart_id, variant_id, quantity):
        self.add_to_cart_calls.append(
            {"cart_id": cart_id, "variant_id": variant_id, "quantity": quantity}
        )
        if not self.available:
            raise MedusaClientError("Medusa unavailable in fake client")
        return {**self.cart, "id": cart_id, "items": [{"variant_id": variant_id, "quantity": quantity}]}


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
