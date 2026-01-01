"""Routing module for quote-related endpoints backed by Supabase."""

from decimal import Decimal, InvalidOperation
from fastapi import APIRouter, Depends, HTTPException, Query

from backend.core.auth import UserContext, get_current_user
from backend.models.schemas import PaginationParams, QuoteCompareRequest, QuoteCreate, QuoteUpdate
from backend.services.fx_rates import get_fx_rate_for_date
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


def _parse_decimal(value: object) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _normalize_quote_amount(amount: Decimal, quote_currency: str, base_currency: str, user: UserContext) -> dict:
    rate, fx_date = get_fx_rate_for_date(user, base_currency, quote_currency)
    amount_base = amount * rate
    return {
        "amount_base": _format_amount(amount_base),
        "base_currency": base_currency,
        "fx_rate": _format_amount(rate),
        "fx_date": fx_date.isoformat(),
    }


def _map_quote(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "deal_id": row.get("deal_id"),
        "amount": _format_amount(row.get("price")),
        "currency": row.get("currency"),
        "amount_base": _format_amount(row.get("amount_base")),
        "base_currency": row.get("base_currency"),
        "fx_rate": _format_amount(row.get("fx_rate")),
        "fx_date": row.get("fx_date"),
        "supplier": row.get("supplier"),
        "lead_time_days": row.get("lead_time_days"),
        "moq": row.get("moq"),
        "created_at": row.get("created_at"),
    }


def _get_client(user: UserContext):
    return get_supabase_client_for_user(user.token)


def _require_deal(deal_id: int, user: UserContext) -> dict:
    supabase = _get_client(user)
    rows = supabase.select(
        "deals",
        select="id,currency",
        filters={"id": f"eq.{deal_id}", "user_id": f"eq.{user.user_id}"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Deal not found")
    return rows[0]


def _require_quote(quote_id: int, user: UserContext) -> dict:
    supabase = _get_client(user)
    rows = supabase.select(
        "quotes",
        select="id,deal_id,price,currency,amount_base,base_currency,fx_rate,fx_date,supplier,lead_time_days,moq,created_at,user_id",
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
        select="id,deal_id,price,currency,amount_base,base_currency,fx_rate,fx_date,supplier,lead_time_days,moq,created_at",
        filters=filters,
        limit=pagination.limit,
        offset=pagination.offset,
        order="created_at.desc",
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


@router.post("/compare")
def compare_quotes(payload: QuoteCompareRequest, user: UserContext = Depends(get_current_user)):
    """Compare quotes using normalized pricing and lead time."""
    if any(quote_id < 1 for quote_id in payload.quote_ids):
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_QUOTE_ID", "message": "Quote IDs must be positive integers"},
        )

    unique_ids = list(dict.fromkeys(payload.quote_ids))
    supabase = _get_client(user)
    rows = supabase.select(
        "quotes",
        select="id,deal_id,amount_base,base_currency,lead_time_days",
        filters={"id": f"in.({','.join(map(str, unique_ids))})", "user_id": f"eq.{user.user_id}"},
    )

    if not rows:
        raise HTTPException(status_code=404, detail="Quotes not found")

    found_ids = {row.get("id") for row in rows if row.get("id") is not None}
    missing_ids = [quote_id for quote_id in unique_ids if quote_id not in found_ids]
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail={"code": "QUOTE_NOT_FOUND", "message": f"Quotes not found: {missing_ids}"},
        )

    deal_ids = {row.get("deal_id") for row in rows}
    if len(deal_ids) > 1:
        raise HTTPException(
            status_code=400,
            detail={"code": "MISMATCHED_DEALS", "message": "Quotes must belong to the same deal"},
        )

    base_currencies = {row.get("base_currency") for row in rows if row.get("base_currency")}
    if len(base_currencies) > 1:
        raise HTTPException(
            status_code=400,
            detail={"code": "MISMATCHED_CURRENCY", "message": "Quotes must share the same base currency"},
        )
    base_currency = next(iter(base_currencies), None)

    candidates = []
    unscored = []
    for row in rows:
        amount_base = _parse_decimal(row.get("amount_base"))
        lead_time = row.get("lead_time_days") or 0
        if amount_base is None or amount_base <= 0 or lead_time <= 0:
            if row.get("id") is not None:
                unscored.append(row["id"])
            continue
        candidates.append({"id": row["id"], "amount_base": amount_base, "lead_time_days": lead_time})

    if not candidates:
        return {
            "base_currency": base_currency,
            "best_quote_id": None,
            "ranking": [],
            "unscored_quote_ids": unscored,
        }

    by_price = sorted(candidates, key=lambda row: row["amount_base"])
    by_lead = sorted(candidates, key=lambda row: row["lead_time_days"])

    price_rank = {row["id"]: rank for rank, row in enumerate(by_price)}
    lead_rank = {row["id"]: rank for rank, row in enumerate(by_lead)}

    ranking = []
    for row in candidates:
        score = (price_rank.get(row["id"]) or 0) + (lead_rank.get(row["id"]) or 0)
        ranking.append(
            {
                "quote_id": row["id"],
                "score": score,
                "price_rank": price_rank.get(row["id"], 0),
                "lead_time_rank": lead_rank.get(row["id"], 0),
                "amount_base": _format_amount(row["amount_base"]),
                "lead_time_days": row["lead_time_days"],
            }
        )

    ranking.sort(key=lambda row: (row["score"], row["price_rank"], row["lead_time_rank"]))
    best_quote_id = ranking[0]["quote_id"] if ranking else None

    return {
        "base_currency": base_currency,
        "best_quote_id": best_quote_id,
        "ranking": ranking,
        "unscored_quote_ids": unscored,
    }


@router.get("/{quote_id}")
def retrieve_quote(quote_id: int, user: UserContext = Depends(get_current_user)):
    """Retrieve a single quote by its identifier."""
    quote = _require_quote(quote_id, user)
    return {"quote": _map_quote(quote)}


@router.post("/", status_code=201)
def create_quote(payload: QuoteCreate, user: UserContext = Depends(get_current_user)):
    """Create a new quote from the provided payload."""
    deal = _require_deal(payload.deal_id, user)
    deal_currency = deal.get("currency")
    if not deal_currency:
        raise HTTPException(
            status_code=422,
            detail={"code": "INVALID_DEAL", "message": "Deal currency is required for FX normalization"},
        )
    supabase = _get_client(user)
    insert_data = _quote_payload_to_db(payload, user)
    if not insert_data.get("currency"):
        insert_data["currency"] = deal_currency
    quote_currency = insert_data.get("currency") or deal_currency
    insert_data.update(_normalize_quote_amount(payload.amount, quote_currency, deal_currency, user))
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

    deal_currency = None
    if "deal_id" in update_data:
        deal = _require_deal(update_data["deal_id"], user)
        deal_currency = deal.get("currency")

    should_recompute = any(field in raw_data for field in ("amount", "currency", "deal_id"))
    if should_recompute:
        if deal_currency is None:
            deal = _require_deal(existing.get("deal_id"), user)
            deal_currency = deal.get("currency")
        if not deal_currency:
            raise HTTPException(
                status_code=422,
                detail={"code": "INVALID_DEAL", "message": "Deal currency is required for FX normalization"},
            )

        amount_value = payload.amount if "amount" in raw_data else _parse_decimal(existing.get("price"))
        if amount_value is None:
            raise HTTPException(
                status_code=422,
                detail={"code": "INVALID_QUOTE", "message": "Quote amount is required for FX normalization"},
            )

        quote_currency = update_data.get("currency") or existing.get("currency") or deal_currency
        if not quote_currency:
            raise HTTPException(
                status_code=422,
                detail={"code": "INVALID_QUOTE", "message": "Quote currency is required for FX normalization"},
            )
        if "currency" not in update_data and existing.get("currency") is None:
            update_data["currency"] = quote_currency
        update_data.update(_normalize_quote_amount(amount_value, quote_currency, deal_currency, user))

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
