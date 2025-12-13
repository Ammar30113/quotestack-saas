"""Routing module for deal-related endpoints."""

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/deals", tags=["deals"])

# In-memory placeholder store for deals
_deals = {
    1: {"id": 1, "name": "Sample Deal", "value": 1000},
    2: {"id": 2, "name": "Second Deal", "value": 2500},
}


def _next_id() -> int:
    """Generate the next deal identifier based on the current store."""
    return max(_deals.keys(), default=0) + 1


@router.get("/")
def list_deals():
    """Return a list of all deals."""
    return {"deals": list(_deals.values())}


@router.get("/{deal_id}")
def retrieve_deal(deal_id: int):
    """Retrieve a single deal by its identifier."""
    deal = _deals.get(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return {"deal": deal}


@router.post("/")
def create_deal(payload: dict):
    """Create a new deal from the provided payload."""
    deal_id = _next_id()
    deal = {"id": deal_id, **payload}
    _deals[deal_id] = deal
    return {"deal": deal, "message": "Deal created"}


@router.put("/{deal_id}")
def update_deal(deal_id: int, payload: dict):
    """Update an existing deal with new data."""
    if deal_id not in _deals:
        raise HTTPException(status_code=404, detail="Deal not found")
    _deals[deal_id].update(payload)
    return {"deal": _deals[deal_id], "message": "Deal updated"}


@router.delete("/{deal_id}")
def delete_deal(deal_id: int):
    """Delete a deal by its identifier."""
    if deal_id not in _deals:
        raise HTTPException(status_code=404, detail="Deal not found")
    _deals.pop(deal_id)
    return {"message": "Deal deleted"}
