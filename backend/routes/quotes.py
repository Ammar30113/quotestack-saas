from fastapi import APIRouter

router = APIRouter(prefix="/quotes", tags=["quotes"])


@router.get("")
async def list_quotes():
    return []
