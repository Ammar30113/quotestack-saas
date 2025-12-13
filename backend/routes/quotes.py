"""Routing module for quote-related endpoints."""

from itertools import count

from fastapi import APIRouter, HTTPException

from backend.models.schemas import QuoteCreate, QuoteUpdate
from backend.routes import deals

router = APIRouter(prefix="/quotes", tags=["quotes"])

# In-memory placeholder store for quotes
_quotes = {
    1: {"id": 1, "deal_id": 1, "amount": 500},
    2: {"id": 2, "deal_id": 1, "amount": 750},
}
_quote_id_counter = count(start=max(_quotes.keys(), default=0) + 1)


@router.get("/")
def list_quotes():
    """Return a list of all quotes."""
    return {"quotes": list(_quotes.values())}


@router.get("/{quote_id}")
def retrieve_quote(quote_id: int):
    """Retrieve a single quote by its identifier."""
    quote = _quotes.get(quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return {"quote": quote}


@router.post("/")
def create_quote(payload: QuoteCreate):
    """Create a new quote from the provided payload."""
    if payload.deal_id not in deals._deals:
        raise HTTPException(status_code=404, detail="Deal not found")

    quote_id = next(_quote_id_counter)
    data = payload.model_dump(exclude={"id"})
    quote = {"id": quote_id, **data}
    _quotes[quote_id] = quote
    return {"quote": quote, "message": "Quote created"}


@router.put("/{quote_id}")
def update_quote(quote_id: int, payload: QuoteUpdate):
    """Update an existing quote with new data."""
    if quote_id not in _quotes:
        raise HTTPException(status_code=404, detail="Quote not found")
    update_data = payload.model_dump(exclude_unset=True, exclude={"id"})
    _quotes[quote_id].update(update_data)
    _quotes[quote_id]["id"] = quote_id
    return {"quote": _quotes[quote_id], "message": "Quote updated"}


@router.delete("/{quote_id}")
def delete_quote(quote_id: int):
    """Delete a quote by its identifier."""
    if quote_id not in _quotes:
        raise HTTPException(status_code=404, detail="Quote not found")
    _quotes.pop(quote_id)
    return {"message": "Quote deleted"}
