from fastapi import APIRouter

router = APIRouter(prefix="/deals", tags=["deals"])


@router.get("")
async def list_deals():
    return []
