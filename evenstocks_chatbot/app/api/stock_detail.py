"""
stock_detail.py — REST endpoints for stock detail pages
"""

from fastapi import APIRouter, HTTPException
from app.stock_db import get_conn, search_stocks, get_company_info, get_financial_tables

router = APIRouter(prefix="/api/stocks", tags=["stocks"])


@router.get("/search")
async def api_search_stocks(q: str = "", limit: int = 20):
    conn = get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        results = search_stocks(conn, q, limit)
        return {"results": results}
    finally:
        conn.close()


@router.get("/{stock_name}")
async def api_get_stock_detail(stock_name: str):
    conn = get_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        info = get_company_info(conn, stock_name)
        if not info:
            raise HTTPException(status_code=404, detail=f"Stock '{stock_name}' not found")
        tables = get_financial_tables(conn, stock_name)
        return {"info": info, "tables": tables}
    finally:
        conn.close()
