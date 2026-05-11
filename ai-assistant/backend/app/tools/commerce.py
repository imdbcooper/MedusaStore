from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from app.medusa import MedusaClientError, MedusaProductClient
from app.schemas.chat import Action, ProductCard, ToolCall


@dataclass(slots=True)
class CommerceToolResult:
    products: list[ProductCard] = field(default_factory=list)
    actions: list[Action] = field(default_factory=list)
    tool_calls: list[ToolCall] = field(default_factory=list)
    live_data_checked: bool = False
    medusa_available: bool = True
    cart_state_checked: bool = False
    cart_state_status: str | None = None
    status_note: str | None = None


class LiveCommerceTools:
    """Commerce-safe tool layer backed by Medusa Store API.

    The layer is read-only for Phase 3 except that it may propose add-to-cart UI
    actions. It never mutates cart state unless a future explicit confirmation
    endpoint is added.
    """

    def __init__(self, *, product_client: MedusaProductClient) -> None:
        self.product_client = product_client

    async def enrich_product_cards(
        self,
        *,
        candidates: list[dict[str, Any]],
        region_id: str | None,
        currency_code: str | None,
        cart_id: str | None,
        propose_add_to_cart: bool,
    ) -> CommerceToolResult:
        product_ids = [str(item["id"]) for item in candidates if item.get("id")]
        result = CommerceToolResult()
        if not product_ids:
            return result

        live_products = await self._get_product_live_data(
            product_ids=product_ids,
            region_id=region_id,
            currency_code=currency_code,
            tool_calls=result.tool_calls,
        )
        if live_products is None:
            result.medusa_available = False
            result.live_data_checked = False
            result.status_note = (
                "Medusa сейчас недоступна, поэтому цена и наличие не подтверждены live."
            )
            result.products = [safe_unknown_card(item) for item in candidates]
            return result

        by_id = {str(product.get("id")): product for product in live_products if product.get("id")}
        enriched: list[ProductCard] = []
        for candidate in candidates:
            product = by_id.get(str(candidate.get("id")))
            if not product:
                enriched.append(safe_unknown_card(candidate))
                continue
            card, variant = live_card_from_product(product, fallback=candidate)
            enriched.append(card)
            result.tool_calls.append(
                ToolCall(
                    name="medusa_get_price_and_variants",
                    arguments={
                        "product_id": card.id,
                        "region_id": region_id,
                        "currency_code": currency_code,
                    },
                    result={
                        "variant_count": len(ensure_list(product.get("variants"))),
                        "selected_variant_id": variant.get("id") if variant else None,
                        "price": card.price,
                        "currency_code": extract_currency_code(variant),
                    },
                )
            )
            result.tool_calls.append(
                ToolCall(
                    name="medusa_check_inventory",
                    arguments={"product_id": card.id, "variant_id": variant.get("id") if variant else None},
                    result={"availability": card.availability},
                )
            )
            if propose_add_to_cart and variant and card.availability == "in_stock":
                result.actions.append(build_add_to_cart_proposal(card, variant, cart_id=cart_id))

        result.products = enriched
        result.live_data_checked = True

        if cart_id:
            cart_state = await self._get_cart_state(cart_id=cart_id, tool_calls=result.tool_calls)
            if cart_state is None:
                result.cart_state_checked = False
                result.cart_state_status = "unavailable"
                result.status_note = (
                    "Цена и наличие товаров проверены live, но текущую корзину в Medusa проверить не удалось."
                )
            else:
                result.cart_state_checked = True
                result.cart_state_status = "ok"

        return result

    async def _get_product_live_data(
        self,
        *,
        product_ids: list[str],
        region_id: str | None,
        currency_code: str | None,
        tool_calls: list[ToolCall],
    ) -> list[dict[str, Any]] | None:
        arguments = {
            "product_ids": product_ids,
            "region_id": region_id,
            "currency_code": currency_code,
        }
        try:
            products = await self.product_client.list_products(
                product_ids=product_ids,
                region_id=region_id,
                currency_code=currency_code,
            )
        except MedusaClientError as exc:
            tool_calls.append(
                ToolCall(
                    name="medusa_get_product_live_data",
                    arguments=arguments,
                    result={"ok": False, "error_code": "MEDUSA_UNAVAILABLE", "message": str(exc)},
                )
            )
            return None
        tool_calls.append(
            ToolCall(
                name="medusa_get_product_live_data",
                arguments=arguments,
                result={"ok": True, "count": len(products), "live_data_checked": True},
            )
        )
        return products

    async def _get_cart_state(
        self,
        *,
        cart_id: str,
        tool_calls: list[ToolCall],
    ) -> dict[str, Any] | None:
        if not hasattr(self.product_client, "get_cart"):
            tool_calls.append(
                ToolCall(
                    name="medusa_get_cart_state",
                    arguments={"cart_id": cart_id},
                    result={"ok": False, "status": "not_supported"},
                )
            )
            return None
        try:
            cart = await self.product_client.get_cart(cart_id=cart_id)
        except MedusaClientError as exc:
            tool_calls.append(
                ToolCall(
                    name="medusa_get_cart_state",
                    arguments={"cart_id": cart_id},
                    result={"ok": False, "error_code": "MEDUSA_UNAVAILABLE", "message": str(exc)},
                )
            )
            return None
        tool_calls.append(
            ToolCall(
                name="medusa_get_cart_state",
                arguments={"cart_id": cart_id},
                result={
                    "ok": True,
                    "id": cart.get("id"),
                    "items_count": len(ensure_list(cart.get("items"))),
                    "currency_code": cart.get("currency_code"),
                },
            )
        )
        return cart


async def propose_add_to_cart_mutation(
    *,
    product_client: MedusaProductClient,
    cart_id: str,
    variant_id: str,
    quantity: int,
    confirmed: bool,
) -> tuple[dict[str, Any], ToolCall]:
    """Proposal-only helper until cart ownership validation is available."""

    arguments = {
        "cart_id": cart_id,
        "variant_id": variant_id,
        "quantity": quantity,
        "confirmed": confirmed,
    }
    if not confirmed:
        return (
            {
                "status": "confirmation_required",
                "mutated": False,
                "message": "Добавление в корзину требует явного подтверждения пользователя.",
            },
            ToolCall(
                name="medusa_add_to_cart",
                arguments=arguments,
                result={"ok": False, "mutated": False, "status": "confirmation_required"},
            ),
        )

    return (
        {
            "status": "unsupported_until_ownership_validation",
            "mutated": False,
            "message": (
                "Confirmed cart mutations through the assistant API are disabled "
                "until trusted Medusa cart ownership/session validation is implemented."
            ),
        },
        ToolCall(
            name="medusa_add_to_cart",
            arguments=arguments,
            result={
                "ok": False,
                "mutated": False,
                "status": "unsupported_until_ownership_validation",
            },
        ),
    )


def safe_unknown_card(candidate: dict[str, Any]) -> ProductCard:
    return ProductCard(
        id=str(candidate.get("id")),
        handle=candidate.get("handle"),
        title=str(candidate.get("title") or "Product"),
        thumbnail=candidate.get("thumbnail"),
        price=None,
        availability="unknown",
        reason=candidate.get("reason") or "Кандидат из индекса; live price/stock не подтверждены.",
    )


def live_card_from_product(
    product: dict[str, Any],
    *,
    fallback: dict[str, Any],
) -> tuple[ProductCard, dict[str, Any] | None]:
    variants = ensure_list(product.get("variants"))
    variant = select_sellable_variant(variants)
    availability = availability_from_variant(variant)
    price = format_variant_price(variant)
    return (
        ProductCard(
            id=str(product.get("id") or fallback.get("id")),
            handle=product.get("handle") or fallback.get("handle"),
            title=str(product.get("title") or fallback.get("title") or "Product"),
            thumbnail=product.get("thumbnail") or fallback.get("thumbnail"),
            price=price,
            availability=availability,
            reason=fallback.get("reason") or "Live-данные Medusa проверены перед показом цены и наличия.",
        ),
        variant,
    )


def select_sellable_variant(variants: list[Any]) -> dict[str, Any] | None:
    normalized = [variant for variant in variants if isinstance(variant, dict)]
    for variant in normalized:
        if availability_from_variant(variant) == "in_stock":
            return variant
    return normalized[0] if normalized else None


def availability_from_variant(variant: dict[str, Any] | None) -> str:
    if not variant:
        return "unknown"
    if variant.get("manage_inventory") is False or variant.get("allow_backorder") is True:
        return "in_stock"
    value = variant.get("inventory_quantity")
    if value is None:
        return "unknown"
    try:
        return "in_stock" if int(value) > 0 else "out_of_stock"
    except (TypeError, ValueError):
        return "unknown"


def format_variant_price(variant: dict[str, Any] | None) -> str | None:
    if not variant:
        return None
    amount = extract_price_amount(variant)
    currency_code = extract_currency_code(variant)
    if amount is None or not currency_code:
        return None
    return f"{format_minor_amount(amount)} {currency_code.upper()}"


def extract_price_amount(variant: dict[str, Any] | None) -> int | None:
    if not variant:
        return None
    calculated = variant.get("calculated_price")
    candidates: list[Any] = []
    if isinstance(calculated, dict):
        candidates.extend(
            calculated.get(key)
            for key in ("calculated_amount", "original_amount", "amount")
            if calculated.get(key) is not None
        )
    candidates.extend(variant.get(key) for key in ("price", "amount") if variant.get(key) is not None)
    for candidate in candidates:
        try:
            return int(candidate)
        except (TypeError, ValueError):
            continue
    return None


def extract_currency_code(variant: dict[str, Any] | None) -> str | None:
    if not variant:
        return None
    calculated = variant.get("calculated_price")
    if isinstance(calculated, dict) and calculated.get("currency_code"):
        return str(calculated["currency_code"]).lower()
    if variant.get("currency_code"):
        return str(variant["currency_code"]).lower()
    return None


def format_minor_amount(amount: int) -> str:
    if amount % 100 == 0:
        return str(amount // 100)
    return f"{amount / 100:.2f}".rstrip("0").rstrip(".")


def build_add_to_cart_proposal(
    card: ProductCard,
    variant: dict[str, Any],
    *,
    cart_id: str | None,
) -> Action:
    action_id = f"act_{uuid4().hex}"
    return Action(
        type="add_to_cart_proposal",
        label=f"Добавить «{card.title}» в корзину",
        payload={
            "action_id": action_id,
            "requires_confirmation": True,
            "cart_id": cart_id,
            "product_id": card.id,
            "variant_id": variant.get("id"),
            "quantity": 1,
        },
    )


def ensure_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []
