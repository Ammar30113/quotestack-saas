"""Routing module for deal-related endpoints backed by Supabase."""

from fastapi import APIRouter, HTTPException

from backend.models.schemas import DealCreate, DealUpdate
from backend.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/deals", tags=["deals"])


def _map_deal(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "name": row.get("name", ""),
        "value": row.get("value"),
    }


def _require_deal(deal_id: int) -> dict:
    supabase = get_supabase_client()
    response = supabase.table("deals").select("id,name,value").eq("id", deal_id).limit(1).execute()
    if getattr(response, "error", None):
        raise HTTPException(status_code=500, detail=str(response.error))
    data = response.data or []
    if not data:
        raise HTTPException(status_code=404, detail="Deal not found")
    return _map_deal(data[0])


@router.get("/")
def list_deals():
    """Return a list of all deals."""
    supabase = get_supabase_client()
    response = supabase.table("deals").select("id,name,value").execute()
    if getattr(response, "error", None):
        raise HTTPException(status_code=500, detail=str(response.error))
    deals = [_map_deal(row) for row in response.data or []]
    return {"deals": deals}


@router.get("/{deal_id}")
def retrieve_deal(deal_id: int):
    """Retrieve a single deal by its identifier."""
    deal = _require_deal(deal_id)
    return {"deal": deal}


@router.post("/")
def create_deal(payload: DealCreate):
    """Create a new deal from the provided payload."""
    supabase = get_supabase_client()
    insert_data = payload.model_dump(exclude={"id"})
    if insert_data.get("value") is not None:
        insert_data["value"] = float(insert_data["value"])
    response = supabase.table("deals").insert(insert_data).select("id,name,value").execute()
    if getattr(response, "error", None):
        raise HTTPException(status_code=500, detail=str(response.error))
    created = response.data[0] if response.data else None
    if not created:
        raise HTTPException(status_code=500, detail="Failed to create deal")
    return {"deal": _map_deal(created), "message": "Deal created"}


@router.put("/{deal_id}")
def update_deal(deal_id: int, payload: DealUpdate):
    """Update an existing deal with new data."""
    _require_deal(deal_id)

    update_data = payload.model_dump(exclude_unset=True, exclude={"id"})
    if update_data.get("value") is not None:
        update_data["value"] = float(update_data["value"])
    supabase = get_supabase_client()
    response = (
        supabase.table("deals")
        .update(update_data)
        .eq("id", deal_id)
        .select("id,name,value")
        .execute()
    )
    if getattr(response, "error", None):
        raise HTTPException(status_code=500, detail=str(response.error))
    updated = response.data[0] if response.data else None
    if not updated:
        raise HTTPException(status_code=404, detail="Deal not found")
    return {"deal": _map_deal(updated), "message": "Deal updated"}


@router.delete("/{deal_id}")
def delete_deal(deal_id: int):
    """Delete a deal by its identifier."""
    _require_deal(deal_id)
    supabase = get_supabase_client()
    response = supabase.table("deals").delete().eq("id", deal_id).execute()
    if getattr(response, "error", None):
        raise HTTPException(status_code=500, detail=str(response.error))
    return {"message": "Deal deleted"}
