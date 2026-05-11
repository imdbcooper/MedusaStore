class FakeMedusaProductClient:
    def __init__(self, products):
        self.products = products
        self.calls = []

    async def list_products(self, *, product_ids=None, region_id=None, currency_code=None, limit=None):
        self.calls.append(
            {
                "product_ids": product_ids,
                "region_id": region_id,
                "currency_code": currency_code,
                "limit": limit,
            }
        )
        if product_ids:
            requested = set(product_ids)
            return [product for product in self.products if product.get("id") in requested]
        return list(self.products)


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
