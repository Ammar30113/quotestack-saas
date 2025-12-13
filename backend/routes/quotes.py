"""Routing module for quote-related endpoints."""

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/quotes", tags=["quotes"])

# In-memory placeholder store for quotes
_quotes = {
    1: {"id": 1, "deal_id": 1, "amount": 500},
    2: {"id": 2, "deal_id": 1, "amount": 750},
}


def _next_id() -> int:
    """Generate the next quote identifier based on the current store."""
    return max(_quotes.keys(), default=0) + 1


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
def create_quote(payload: dict):
    """Create a new quote from the provided payload."""
    quote_id = _next_id()
    quote = {"id": quote_id, **payload}
    _quotes[quote_id] = quote
    return {"quote": quote, "message": "Quote created"}


@router.put("/{quote_id}")
def update_quote(quote_id: int, payload: dict):
    """Update an existing quote with new data."""
    if quote_id not in _quotes:
        raise HTTPException(status_code=404, detail="Quote not found")
    _quotes[quote_id].update(payload)
    return {"quote": _quotes[quote_id], "message": "Quote updated"}


@router.delete("/{quote_id}")
def delete_quote(quote_id: int):
    """Delete a quote by its identifier."""
    if quote_id not in _quotes:
        raise HTTPException(status_code=404, detail="Quote not found")
    _quotes.pop(quote_id)
    return {"message": "Quote deleted"}
