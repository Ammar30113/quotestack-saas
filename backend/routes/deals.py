"""Routing module for deal-related endpoints backed by Supabase."""

from fastapi import APIRouter, Depends, HTTPException

from backend.core.auth import UserContext, get_current_user
from backend.models.schemas import DealCreateRequest, DealUpdate
from backend.services.supabase_client import get_supabase_client_for_user

router = APIRouter(prefix="/deals", tags=["deals"])


def _map_deal(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "company_name": row.get("company_name"),
        "currency": row.get("currency"),
        "description": row.get("description"),
        "created_at": row.get("created_at"),
    }


def _get_client(user: UserContext):
    return get_supabase_client_for_user(user.token)


def _require_deal(deal_id: int, user: UserContext) -> dict:
    supabase = _get_client(user)
    rows = supabase.select(
        "deals",
        select="id,company_name,currency,description,created_at",
        filters={"id": f"eq.{deal_id}", "user_id": f"eq.{user.user_id}"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Deal not found")
    return _map_deal(rows[0])


@router.get("/")
def list_deals(user: UserContext = Depends(get_current_user)):
    """Return a list of all deals for the authenticated user."""
    supabase = _get_client(user)
    rows = supabase.select(
        "deals",
        select="id,company_name,currency,description,created_at",
        filters={"user_id": f"eq.{user.user_id}"},
    )
    return [_map_deal(row) for row in rows]


@router.get("/{deal_id}")
def retrieve_deal(deal_id: int, user: UserContext = Depends(get_current_user)):
    """Retrieve a single deal by its identifier."""
    deal = _require_deal(deal_id, user)
    return {"deal": deal}


@router.post("/", status_code=201)
def create_deal(payload: DealCreateRequest, user: UserContext = Depends(get_current_user)):
    """Create a new deal from the provided payload."""
    supabase = _get_client(user)
    insert_data = payload.model_dump()
    insert_data["user_id"] = user.user_id
    rows = supabase.insert("deals", insert_data)
    if not rows:
        raise HTTPException(status_code=500, detail="Failed to create deal")
    return _map_deal(rows[0])


@router.put("/{deal_id}")
def update_deal(deal_id: int, payload: DealUpdate, user: UserContext = Depends(get_current_user)):
    """Update an existing deal with new data."""
    _require_deal(deal_id, user)

    update_data = payload.model_dump(exclude_unset=True, exclude={"id"})
    if not update_data:
        return {"deal": _require_deal(deal_id, user), "message": "Deal updated"}

    supabase = _get_client(user)
    rows = supabase.update(
        "deals",
        update_data,
        filters={"id": f"eq.{deal_id}", "user_id": f"eq.{user.user_id}"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Deal not found")
    return {"deal": _map_deal(rows[0]), "message": "Deal updated"}


@router.delete("/{deal_id}")
def delete_deal(deal_id: int, user: UserContext = Depends(get_current_user)):
    """Delete a deal by its identifier."""
    _require_deal(deal_id, user)
    supabase = _get_client(user)
    supabase.delete("deals", filters={"id": f"eq.{deal_id}", "user_id": f"eq.{user.user_id}"})
    return {"message": "Deal deleted"}
