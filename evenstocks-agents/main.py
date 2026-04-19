"""FastAPI entrypoint for evenstocks-agents service.

Endpoints:
  GET  /health                          — service health
  GET  /analyze/{ticker}                — one-shot JSON verdict (blocking)
  GET  /analyze/{ticker}/stream         — SSE stream of per-agent events
  GET  /compare/{a}/{b}                 — side-by-side verdict for two tickers
  POST /portfolio/health                — verdict on a basket of tickers
  POST /goal/plan                       — SIP / lumpsum requirement for a goal
  GET  /history                         — recent verdicts (optionally per ticker)
"""

import json
import logging
import queue
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import AsyncIterator, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from config import settings
from data_providers import goal_planner, verdict_store
from graph.orchestrator import run_pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("evenstocks-agents")

app = FastAPI(title="EvenStocks Agents", version="0.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeResponse(BaseModel):
    ticker: str
    stock_name: str | None = None
    current_price: float | str | None = None
    analyst_reports: dict | None = None
    analyst_errors: dict | None = None
    debate: dict | None = None
    risk_views: dict | None = None
    risk_final: str | None = None
    verdict: dict | None = None
    verdict_error: str | None = None
    elapsed_sec: float | None = None
    error: str | None = None


class PortfolioRequest(BaseModel):
    tickers: list[str] = Field(..., min_length=1, max_length=10)


class GoalRequest(BaseModel):
    target_corpus: float = Field(..., gt=0)
    horizon_years: float = Field(..., gt=0, le=60)
    inflation_pct: float = Field(default=6.0, ge=0, le=20)
    equity_pct: Optional[int] = Field(default=None, ge=0, le=100)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "evenstocks-agents",
        "version": "0.5.0",
        "models": {"deep": settings.DEEP_MODEL, "quick": settings.QUICK_MODEL},
        "anthropic_key_configured": bool(settings.ANTHROPIC_API_KEY),
    }


@app.get("/analyze/{ticker}", response_model=AnalyzeResponse)
def analyze(ticker: str):
    _require_api_key()
    log.info("analyze ticker=%s", ticker)
    result = run_pipeline(ticker)
    if result.get("error") and "not found" in str(result.get("error", "")).lower():
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.get("/analyze/{ticker}/stream")
async def analyze_stream(ticker: str):
    """SSE stream: emits per-agent events as the pipeline progresses."""
    _require_api_key()
    log.info("stream ticker=%s", ticker)

    q: queue.Queue = queue.Queue()
    sentinel = object()

    def worker():
        try:
            def on_event(event: str, payload: dict):
                q.put({"event": event, "data": json.dumps(payload)})

            final = run_pipeline(ticker, on_event=on_event)
            q.put({"event": "result", "data": json.dumps(final, default=str)})
        except Exception as exc:
            log.exception("stream worker failed")
            q.put({"event": "error", "data": json.dumps({"message": f"{type(exc).__name__}: {exc}"})})
        finally:
            q.put(sentinel)

    threading.Thread(target=worker, daemon=True).start()

    async def event_gen() -> AsyncIterator[dict]:
        import asyncio
        loop = asyncio.get_event_loop()
        while True:
            item = await loop.run_in_executor(None, q.get)
            if item is sentinel:
                break
            yield item

    return EventSourceResponse(event_gen())


@app.get("/compare/{ticker_a}/{ticker_b}")
def compare(ticker_a: str, ticker_b: str):
    """Run pipeline on two tickers in parallel and return both verdicts."""
    _require_api_key()
    log.info("compare %s vs %s", ticker_a, ticker_b)
    with ThreadPoolExecutor(max_workers=2) as pool:
        fa = pool.submit(run_pipeline, ticker_a)
        fb = pool.submit(run_pipeline, ticker_b)
        a, b = fa.result(), fb.result()
    return {"a": a, "b": b}


@app.post("/portfolio/health")
def portfolio_health(req: PortfolioRequest):
    """Verdict on each ticker plus aggregate diversification picture."""
    _require_api_key()
    tickers = [t.strip().upper() for t in req.tickers if t.strip()]
    if not tickers:
        raise HTTPException(status_code=400, detail="no tickers provided")

    log.info("portfolio_health %d tickers", len(tickers))
    results: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=min(len(tickers), 5)) as pool:
        futures = {pool.submit(run_pipeline, t): t for t in tickers}
        for fut in futures:
            t = futures[fut]
            try:
                results[t] = fut.result()
            except Exception as exc:
                results[t] = {"ticker": t, "error": f"{type(exc).__name__}: {exc}"}

    rating_counts: dict[str, int] = {}
    avg_confidence_acc = 0.0
    rated_n = 0
    for r in results.values():
        v = r.get("verdict") or {}
        rating = v.get("rating")
        if rating:
            rating_counts[rating] = rating_counts.get(rating, 0) + 1
            try:
                avg_confidence_acc += float(v.get("confidence") or 0)
                rated_n += 1
            except (TypeError, ValueError):
                pass

    summary = {
        "tickers": tickers,
        "count": len(tickers),
        "rating_counts": rating_counts,
        "avg_confidence": round(avg_confidence_acc / rated_n, 1) if rated_n else None,
        "actionable_buys": sum(rating_counts.get(k, 0) for k in ("Strong Buy", "Accumulate")),
        "actionable_sells": sum(rating_counts.get(k, 0) for k in ("Reduce", "Sell")),
    }
    return {"summary": summary, "results": results}


@app.post("/goal/plan")
def goal_plan(req: GoalRequest):
    plan = goal_planner.plan(
        target_corpus=req.target_corpus,
        horizon_years=req.horizon_years,
        inflation_pct=req.inflation_pct,
        equity_pct=req.equity_pct,
    )
    return plan.to_dict()


@app.get("/history")
def history(limit: int = 50, ticker: Optional[str] = None):
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=400, detail="limit must be 1..500")
    rows = verdict_store.list_recent(limit=limit, ticker=ticker)
    return {"count": len(rows), "rows": rows}


def _require_api_key():
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY not configured on the agents service.",
        )
