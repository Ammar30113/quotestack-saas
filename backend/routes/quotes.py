"""Routing module for quote-related endpoints backed by Supabase."""

from fastapi import APIRouter, HTTPException

from backend.models.schemas import QuoteCreate, QuoteUpdate
from backend.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/quotes", tags=["quotes"])


def _map_quote(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "deal_id": row.get("deal_id"),
        "amount": row.get("price"),
        "currency": row.get("currency"),
        "supplier": row.get("supplier"),
        "lead_time_days": row.get("lead_time_days"),
        "moq": row.get("moq"),
    }


def _ensure_deal_exists(deal_id: int) -> None:
    supabase = get_supabase_client()
    response = supabase.table("deals").select("id").eq("id", deal_id).limit(1).execute()
    if getattr(response, "error", None):
        raise HTTPException(status_code=500, detail=str(response.error))
    data = response.data or []
    if not data:
        raise HTTPException(status_code=404, detail="Deal not found")


def _require_quote(quote_id: int) -> dict:
    supabase = get_supabase_client()
    response = (
        supabase.table("quotes")
        .select("id,deal_id,price,currency,supplier,lead_time_days,moq")
        .eq("id", quote_id)
        .limit(1)
        .execute()
    )
    if getattr(response, "error", None):
        raise HTTPException(status_code=500, detail=str(response.error))
    data = response.data or []
    if not data:
        raise HTTPException(status_code=404, detail="Quote not found")
    return data[0]


def _quote_payload_to_db(payload: QuoteCreate | QuoteUpdate) -> dict:
    data = payload.model_dump(exclude_unset=True, by_alias=True)
    db_data: dict = {}
    if "deal_id" in data:
        db_data["deal_id"] = data["deal_id"]
    if "amount" in data:
        db_data["price"] = float(data["amount"])
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


@router.get("/")
def list_quotes():
    """Return a list of all quotes."""
    supabase = get_supabase_client()
    response = supabase.table("quotes").select("id,deal_id,price,currency,supplier,lead_time_days,moq").execute()
    if getattr(response, "error", None):
        raise HTTPException(status_code=500, detail=str(response.error))
    quotes = [_map_quote(row) for row in response.data or []]
    return {"quotes": quotes}


@router.get("/{quote_id}")
def retrieve_quote(quote_id: int):
    """Retrieve a single quote by its identifier."""
    quote = _require_quote(quote_id)
    return {"quote": _map_quote(quote)}


@router.post("/")
def create_quote(payload: QuoteCreate):
    """Create a new quote from the provided payload."""
    _ensure_deal_exists(payload.deal_id)
    supabase = get_supabase_client()
    insert_data = _quote_payload_to_db(payload)
    response = (
        supabase.table("quotes")
        .insert(insert_data)
        .select("id,deal_id,price,currency,supplier,lead_time_days,moq")
        .execute()
    )
    if getattr(response, "error", None):
        raise HTTPException(status_code=500, detail=str(response.error))
    created = response.data[0] if response.data else None
    if not created:
        raise HTTPException(status_code=500, detail="Failed to create quote")
    return {"quote": _map_quote(created), "message": "Quote created"}


@router.put("/{quote_id}")
def update_quote(quote_id: int, payload: QuoteUpdate):
    """Update an existing quote with new data."""
    existing = _require_quote(quote_id)

    update_data = _quote_payload_to_db(payload)
    if not update_data:
        return {"quote": _map_quote(existing), "message": "Quote updated"}

    if "deal_id" in update_data:
        _ensure_deal_exists(update_data["deal_id"])

    supabase = get_supabase_client()
    response = (
        supabase.table("quotes")
        .update(update_data)
        .eq("id", quote_id)
        .select("id,deal_id,price,currency,supplier,lead_time_days,moq")
        .execute()
    )
    if getattr(response, "error", None):
        raise HTTPException(status_code=500, detail=str(response.error))
    updated = response.data[0] if response.data else None
    if not updated:
        raise HTTPException(status_code=404, detail="Quote not found")
    return {"quote": _map_quote(updated), "message": "Quote updated"}


@router.delete("/{quote_id}")
def delete_quote(quote_id: int):
    """Delete a quote by its identifier."""
    _require_quote(quote_id)
    supabase = get_supabase_client()
    response = supabase.table("quotes").delete().eq("id", quote_id).execute()
    if getattr(response, "error", None):
        raise HTTPException(status_code=500, detail=str(response.error))
    return {"message": "Quote deleted"}
