"""Routing module for quote-related endpoints backed by Supabase."""

from decimal import Decimal, InvalidOperation
from fastapi import APIRouter, Depends, HTTPException, Query

from backend.core.auth import UserContext, get_current_user
from backend.models.schemas import PaginationParams, QuoteCreate, QuoteUpdate
from backend.services.supabase_client import get_supabase_client_for_user

router = APIRouter(prefix="/quotes", tags=["quotes"])


def _format_amount(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return format(value, "f")
    try:
        return format(Decimal(str(value)), "f")
    except (InvalidOperation, ValueError):
        return str(value)


def _map_quote(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "deal_id": row.get("deal_id"),
        "amount": _format_amount(row.get("price")),
        "currency": row.get("currency"),
        "supplier": row.get("supplier"),
        "lead_time_days": row.get("lead_time_days"),
        "moq": row.get("moq"),
        "created_at": row.get("created_at"),
    }


def _get_client(user: UserContext):
    return get_supabase_client_for_user(user.token)


def _ensure_deal_exists(deal_id: int, user: UserContext) -> None:
    supabase = _get_client(user)
    rows = supabase.select(
        "deals",
        select="id",
        filters={"id": f"eq.{deal_id}", "user_id": f"eq.{user.user_id}"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Deal not found")


def _require_quote(quote_id: int, user: UserContext) -> dict:
    supabase = _get_client(user)
    rows = supabase.select(
        "quotes",
        select="id,deal_id,price,currency,supplier,lead_time_days,moq,created_at,user_id",
        filters={"id": f"eq.{quote_id}", "user_id": f"eq.{user.user_id}"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Quote not found")
    return rows[0]


def _quote_payload_to_db(payload: QuoteCreate | QuoteUpdate, user: UserContext) -> dict:
    data = payload.model_dump(exclude_unset=True, by_alias=True)
    db_data: dict = {"user_id": user.user_id}
    if "deal_id" in data:
        db_data["deal_id"] = data["deal_id"]
    if "amount" in data and data["amount"] is not None:
        db_data["price"] = _format_amount(data["amount"])
    if "currency" in data:
        db_data["currency"] = data["currency"]
    if "supplier" in data:
        db_data["supplier"] = data["supplier"]
    lead_time = data.get("lead_time_days") if "lead_time_days" in data else data.get("lead_time")
    if lead_time is not None:
        db_data["lead_time_days"] = lead_time
    if "moq" in data:
        db_data["moq"] = data["moq"]
    return db_data


def _get_pagination_params(limit: int = Query(default=20, ge=1), offset: int = Query(default=0, ge=0)) -> PaginationParams:
    # Keep pagination validation consistent across endpoints.
    return PaginationParams(limit=limit, offset=offset)


@router.get("/")
def list_quotes(
    deal_id: int | None = Query(default=None),
    pagination: PaginationParams = Depends(_get_pagination_params),
    user: UserContext = Depends(get_current_user),
):
    """Return a paginated list of quotes for the authenticated user."""
    supabase = _get_client(user)
    filters = {"user_id": f"eq.{user.user_id}"}
    if deal_id is not None:
        filters["deal_id"] = f"eq.{deal_id}"
    rows, total = supabase.select_with_count(
        "quotes",
        select="id,deal_id,price,currency,supplier,lead_time_days,moq,created_at",
        filters=filters,
        limit=pagination.limit,
        offset=pagination.offset,
    )
    quotes = [_map_quote(row) for row in rows]
    total_count = total if total is not None else len(quotes)
    has_more = pagination.offset + len(quotes) < total_count
    return {
        "items": quotes,
        "limit": pagination.limit,
        "offset": pagination.offset,
        "total": total_count,
        "has_more": has_more,
    }


@router.get("/{quote_id}")
def retrieve_quote(quote_id: int, user: UserContext = Depends(get_current_user)):
    """Retrieve a single quote by its identifier."""
    quote = _require_quote(quote_id, user)
    return {"quote": _map_quote(quote)}


@router.post("/", status_code=201)
def create_quote(payload: QuoteCreate, user: UserContext = Depends(get_current_user)):
    """Create a new quote from the provided payload."""
    _ensure_deal_exists(payload.deal_id, user)
    supabase = _get_client(user)
    insert_data = _quote_payload_to_db(payload, user)
    rows = supabase.insert(
        "quotes",
        insert_data,
    )
    if not rows:
        raise HTTPException(status_code=500, detail="Failed to create quote")
    return {"quote": _map_quote(rows[0]), "message": "Quote created"}


@router.put("/{quote_id}")
def update_quote(quote_id: int, payload: QuoteUpdate, user: UserContext = Depends(get_current_user)):
    """Update an existing quote with new data."""
    existing = _require_quote(quote_id, user)

    raw_data = payload.model_dump(exclude_unset=True, by_alias=True)
    if not raw_data:
        raise HTTPException(
            status_code=400,
            detail={"code": "NO_FIELDS_TO_UPDATE", "message": "No fields provided to update"},
        )

    update_data = _quote_payload_to_db(payload, user)

    if "deal_id" in update_data:
        _ensure_deal_exists(update_data["deal_id"], user)

    supabase = _get_client(user)
    rows = supabase.update(
        "quotes",
        update_data,
        filters={"id": f"eq.{quote_id}", "user_id": f"eq.{user.user_id}"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Quote not found")
    return {"quote": _map_quote(rows[0]), "message": "Quote updated"}


@router.delete("/{quote_id}")
def delete_quote(quote_id: int, user: UserContext = Depends(get_current_user)):
    """Delete a quote by its identifier."""
    _require_quote(quote_id, user)
    supabase = _get_client(user)
    supabase.delete("quotes", filters={"id": f"eq.{quote_id}", "user_id": f"eq.{user.user_id}"})
    return {"message": "Quote deleted"}
