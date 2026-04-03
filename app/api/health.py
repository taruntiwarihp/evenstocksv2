from fastapi import APIRouter
from app.config import MODEL

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "model": MODEL}
