def _ingest_products(client):
    response = client.post(
        "/api/v1/ingest/medusa/products/sync",
        json={"store_id": "default", "locale": "ru", "full": True, "region_id": "reg_ru"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 200


def test_product_cards_include_live_price_stock_and_tool_calls(client):
    _ingest_products(client)

    response = client.post(
        "/api/v1/chat",
        json={
            "message": "Подбери кофемашину для эспрессо",
            "store_id": "default",
            "locale": "ru",
            "region_id": "reg_ru",
            "currency_code": "rub",
        },
    )

    assert response.status_code == 200
    data = response.json()
    product = data["products"][0]
    assert product["id"] == "prod_espresso"
    assert product["price"] == "499 RUB"
    assert product["availability"] == "in_stock"
    assert data["safety"]["live_data_checked"] is True
    assert data["safety"]["medusa_available"] is True
    assert "цена 499 RUB" in data["answer"]
    assert "наличие: in_stock" in data["answer"]
    tool_names = [call["name"] for call in data["tool_calls"]]
    assert "search_products" in tool_names
    assert "medusa_get_product_live_data" in tool_names
    assert "medusa_get_price_and_variants" in tool_names
    assert "medusa_check_inventory" in tool_names


def test_price_and_stock_are_not_taken_from_index_when_medusa_unavailable(client):
    _ingest_products(client)
    fake_client = client.app.state.fake_medusa_product_client
    fake_client.available = False

    response = client.post(
        "/api/v1/chat",
        json={
            "message": "Подбери кофемашину для эспрессо с ценой и наличием",
            "store_id": "default",
            "locale": "ru",
            "region_id": "reg_ru",
            "currency_code": "rub",
        },
    )

    assert response.status_code == 200
    data = response.json()
    product = data["products"][0]
    assert product["price"] is None
    assert product["availability"] == "unknown"
    assert "499" not in data["answer"]
    assert "in_stock" not in data["answer"]
    assert data["safety"]["live_data_checked"] is False
    assert data["safety"]["medusa_available"] is False
    assert data["safety"]["status"] == "live_data_unavailable"
    assert data["safety"]["notes"]
    assert data["tool_calls"][-1]["result"]["error_code"] == "MEDUSA_UNAVAILABLE"


def test_add_to_cart_chat_only_proposes_action_without_mutation(client):
    _ingest_products(client)
    fake_client = client.app.state.fake_medusa_product_client

    response = client.post(
        "/api/v1/chat",
        json={
            "message": "Добавь кофемашину для эспрессо в корзину",
            "store_id": "default",
            "locale": "ru",
            "region_id": "reg_ru",
            "currency_code": "rub",
            "cart_id": "cart_123",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["actions"]
    action = data["actions"][0]
    assert action["type"] == "add_to_cart_proposal"
    assert action["payload"]["requires_confirmation"] is True
    assert action["payload"]["variant_id"] == "variant_espresso_black"
    assert fake_client.add_to_cart_calls == []
    assert [call["name"] for call in data["tool_calls"]][-1] == "medusa_get_cart_state"


def test_cart_state_failure_keeps_product_live_data_consistent(client):
    _ingest_products(client)
    fake_client = client.app.state.fake_medusa_product_client
    fake_client.cart_available = False

    response = client.post(
        "/api/v1/chat",
        json={
            "message": "Подбери кофемашину для эспрессо и проверь корзину",
            "store_id": "default",
            "locale": "ru",
            "region_id": "reg_ru",
            "currency_code": "rub",
            "cart_id": "cart_123",
        },
    )

    assert response.status_code == 200
    data = response.json()
    product = data["products"][0]
    assert product["price"] == "499 RUB"
    assert product["availability"] == "in_stock"
    assert data["safety"]["live_data_checked"] is True
    assert data["safety"]["medusa_available"] is True
    assert data["safety"]["status"] == "ok"
    assert data["safety"]["notes"] == [
        "Цена и наличие товаров проверены live, но текущую корзину в Medusa проверить не удалось."
    ]
    assert data["tool_calls"][-1]["name"] == "medusa_get_cart_state"
    assert data["tool_calls"][-1]["result"]["ok"] is False


def test_cart_add_item_endpoint_requires_confirmation_before_mutation(client):
    fake_client = client.app.state.fake_medusa_product_client

    response = client.post(
        "/api/v1/tools/cart/add-item",
        json={
            "cart_id": "cart_123",
            "variant_id": "variant_espresso_black",
            "quantity": 1,
            "confirmed": False,
        },
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["result"]["status"] == "confirmation_required"
    assert data["result"]["mutated"] is False
    assert fake_client.add_to_cart_calls == []


def test_cart_add_item_endpoint_blocks_confirmed_mutation_without_ownership_validation(client):
    fake_client = client.app.state.fake_medusa_product_client

    response = client.post(
        "/api/v1/tools/cart/add-item",
        json={
            "cart_id": "cart_123",
            "variant_id": "variant_espresso_black",
            "quantity": 1,
            "confirmed": True,
        },
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["result"]["status"] == "unsupported_until_ownership_validation"
    assert data["result"]["mutated"] is False
    assert data["tool_call"]["result"]["mutated"] is False
    assert fake_client.add_to_cart_calls == []


def test_product_live_data_endpoint_validates_product_ids_shape(client):
    response = client.post(
        "/api/v1/tools/product-live-data",
        json={"product_ids": "prod_espresso", "region_id": "reg_ru", "currency_code": "rub"},
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 422


def test_product_live_data_endpoint_validates_non_empty_product_ids(client):
    response = client.post(
        "/api/v1/tools/product-live-data",
        json={"product_ids": []},
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 422


def test_product_live_data_endpoint_uses_pydantic_schema(client):
    response = client.post(
        "/api/v1/tools/product-live-data",
        json={"product_ids": ["prod_espresso"], "region_id": "reg_ru", "currency_code": "rub"},
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["live_data_checked"] is True
    assert data["products"][0]["id"] == "prod_espresso"
    assert client.app.state.fake_medusa_product_client.calls[-1]["product_ids"] == ["prod_espresso"]
