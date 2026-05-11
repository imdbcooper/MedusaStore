from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest

from app.api.dependencies import get_medusa_product_client
from app.core.auth import require_api_token
from app.core.security import enforce_rate_limit, rate_limit_identity
from app.medusa import MedusaClientError, MedusaProductClient
from app.tools.commerce import propose_add_to_cart_mutation

router = APIRouter(prefix="/tools", tags=["commerce-tools"])


class AddCartItemRequest(BaseModel):
    cart_id: str = Field(min_length=1)
    variant_id: str = Field(min_length=1)
    quantity: int = Field(default=1, ge=1, le=100)
    confirmed: bool = False


class ProductLiveDataRequest(BaseModel):
    product_ids: list[str] = Field(min_length=1, max_length=20)
    region_id: str | None = Field(default=None, min_length=1)
    currency_code: str | None = Field(default=None, min_length=3, max_length=3)
    cart_id: str | None = Field(default=None, min_length=1)


@router.post("/cart/add-item")
async def add_cart_item(
    payload: AddCartItemRequest,
    http_request: FastAPIRequest,
    product_client: MedusaProductClient = Depends(get_medusa_product_client),
    _: None = Depends(require_api_token),
):
    enforce_rate_limit(http_request, scope="tools", identity=rate_limit_identity(http_request, scope="tools"))
    try:
        result, tool_call = await propose_add_to_cart_mutation(
            product_client=product_client,
            cart_id=payload.cart_id,
            variant_id=payload.variant_id,
            quantity=payload.quantity,
            confirmed=payload.confirmed,
        )
    except MedusaClientError as exc:
        raise HTTPException(
            status_code=502,
            detail={"error": {"code": "MEDUSA_UNAVAILABLE", "message": str(exc), "retryable": True}},
        ) from exc
    return {"result": result, "tool_call": tool_call.model_dump()}


@router.post("/product-live-data")
async def product_live_data(
    payload: ProductLiveDataRequest,
    http_request: FastAPIRequest,
    product_client: MedusaProductClient = Depends(get_medusa_product_client),
    _: None = Depends(require_api_token),
):
    enforce_rate_limit(http_request, scope="tools", identity=rate_limit_identity(http_request, scope="tools"))
    try:
        products = await product_client.list_products(
            product_ids=payload.product_ids,
            region_id=payload.region_id,
            currency_code=payload.currency_code,
        )
    except MedusaClientError as exc:
        raise HTTPException(
            status_code=502,
            detail={"error": {"code": "MEDUSA_UNAVAILABLE", "message": str(exc), "retryable": True}},
        ) from exc
    return {"products": products, "live_data_checked": True}
