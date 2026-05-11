import pytest

from app.core.config import Settings
from app.tools.commerce import LiveCommerceTools, propose_add_to_cart_mutation
from tests.fakes import ESPRESSO_MACHINE_PRODUCT, FakeMedusaProductClient


@pytest.mark.asyncio
async def test_live_data_tool_enriches_price_stock_and_cart_state():
    client = FakeMedusaProductClient([ESPRESSO_MACHINE_PRODUCT])
    tools = LiveCommerceTools(product_client=client)

    result = await tools.enrich_product_cards(
        candidates=[
            {
                "id": "prod_espresso",
                "handle": "espresso-pro",
                "title": "Espresso Pro",
                "thumbnail": None,
                "reason": "candidate",
            }
        ],
        region_id="reg_ru",
        currency_code="rub",
        cart_id="cart_123",
        propose_add_to_cart=False,
    )

    assert result.live_data_checked is True
    assert result.products[0].price == "499 RUB"
    assert result.products[0].availability == "in_stock"
    assert client.calls[0]["region_id"] == "reg_ru"
    assert client.cart_calls == [{"cart_id": "cart_123"}]
    assert [call.name for call in result.tool_calls] == [
        "medusa_get_product_live_data",
        "medusa_get_price_and_variants",
        "medusa_check_inventory",
        "medusa_get_cart_state",
    ]


@pytest.mark.asyncio
async def test_cart_state_failure_does_not_reset_product_live_status():
    client = FakeMedusaProductClient([ESPRESSO_MACHINE_PRODUCT], cart_available=False)
    tools = LiveCommerceTools(product_client=client)

    result = await tools.enrich_product_cards(
        candidates=[
            {
                "id": "prod_espresso",
                "handle": "espresso-pro",
                "title": "Espresso Pro",
                "thumbnail": None,
                "reason": "candidate",
            }
        ],
        region_id="reg_ru",
        currency_code="rub",
        cart_id="cart_123",
        propose_add_to_cart=False,
    )

    assert result.live_data_checked is True
    assert result.medusa_available is True
    assert result.cart_state_checked is False
    assert result.cart_state_status == "unavailable"
    assert result.products[0].price == "499 RUB"
    assert result.products[0].availability == "in_stock"
    assert result.status_note == (
        "Цена и наличие товаров проверены live, но текущую корзину в Medusa проверить не удалось."
    )
    assert result.tool_calls[-1].name == "medusa_get_cart_state"
    assert result.tool_calls[-1].result["ok"] is False


@pytest.mark.asyncio
async def test_add_to_cart_requires_confirmation_without_mutation():
    client = FakeMedusaProductClient([ESPRESSO_MACHINE_PRODUCT])

    result, tool_call = await propose_add_to_cart_mutation(
        product_client=client,
        cart_id="cart_123",
        variant_id="variant_espresso_black",
        quantity=1,
        confirmed=False,
    )

    assert result["status"] == "confirmation_required"
    assert result["mutated"] is False
    assert tool_call.result["mutated"] is False
    assert client.add_to_cart_calls == []


@pytest.mark.asyncio
async def test_confirmed_add_to_cart_is_blocked_until_ownership_validation():
    client = FakeMedusaProductClient([ESPRESSO_MACHINE_PRODUCT])

    result, tool_call = await propose_add_to_cart_mutation(
        product_client=client,
        cart_id="cart_123",
        variant_id="variant_espresso_black",
        quantity=2,
        confirmed=True,
    )

    assert result["status"] == "unsupported_until_ownership_validation"
    assert result["mutated"] is False
    assert tool_call.result["mutated"] is False
    assert tool_call.result["status"] == "unsupported_until_ownership_validation"
    assert client.add_to_cart_calls == []


def test_settings_still_construct_for_live_commerce_phase():
    settings = Settings(ASSISTANT_POSTGRES_URI=None, MEDUSA_BACKEND_URL="http://medusa.test")
    assert settings.medusa_backend_url == "http://medusa.test"
