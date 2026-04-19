"""Orchestrator — two-phase pipeline with streaming support.

Phase 1 (parallel): 4 analysts (fundamentals, technical, news, sentiment)
Phase 2 (sequential debate): Bull ↔ Bear rounds → Research Manager
Phase 3 (parallel): 3 risk debators (aggressive, conservative, neutral) → Risk Manager
Phase 4: Portfolio Manager synthesizes everything into final verdict
"""

import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, Optional

from agents.base import AgentResult
from agents.bear_researcher import BearResearcher, ResearchManager
from agents.bull_researcher import BullResearcher
from agents.concall_summarizer import ConcallSummarizer
from agents.fundamentals_analyst import FundamentalsAnalyst
from agents.macro_analyst import MacroAnalyst
from agents.news_analyst import NewsAnalyst
from agents.portfolio_manager import PortfolioManager
from agents.risk_team import (
    AggressiveRiskAnalyst,
    ConservativeRiskAnalyst,
    NeutralRiskAnalyst,
    RiskManager,
)
from agents.sebi_redflag_analyst import SebiRedFlagAnalyst
from agents.sentiment_analyst import SentimentAnalyst
from agents.technical_analyst import TechnicalAnalyst
from config import settings
from data_providers import stocks_db, verdict_store


ANALYST_CLASSES = [
    FundamentalsAnalyst,
    TechnicalAnalyst,
    NewsAnalyst,
    SentimentAnalyst,
    SebiRedFlagAnalyst,
    MacroAnalyst,
    ConcallSummarizer,
]

RISK_CLASSES = [
    AggressiveRiskAnalyst,
    ConservativeRiskAnalyst,
    NeutralRiskAnalyst,
]


EventCallback = Callable[[str, dict], None]


def _noop(event: str, payload: dict) -> None:
    pass


def run_pipeline(ticker: str, on_event: Optional[EventCallback] = None) -> dict:
    """Full pipeline. If `on_event` provided, emits events as phases complete."""
    emit = on_event or _noop
    start = time.time()

    emit("pipeline_started", {"ticker": ticker})

    snapshot = stocks_db.get_full_snapshot(ticker)
    if not snapshot:
        err = f"Stock '{ticker}' not found in database."
        emit("error", {"message": err})
        return {"ticker": ticker, "error": err, "elapsed_sec": round(time.time() - start, 2)}

    base_context = {
        "ticker": ticker,
        "company_info": snapshot["company_info"],
        "financial_tables": snapshot["financial_tables"],
    }

    # ─── Phase 1: Analysts (parallel) ─────────────────────────────
    analyst_reports, analyst_errors = _run_analysts(base_context, emit)

    # ─── Phase 2: Bull/Bear debate ────────────────────────────────
    debate_result = _run_debate(
        {**base_context, "analyst_reports": analyst_reports},
        emit,
        rounds=settings.MAX_DEBATE_ROUNDS,
    )

    # ─── Phase 3: Risk team (parallel) + synthesis ────────────────
    risk_context = {
        **base_context,
        "analyst_reports": analyst_reports,
        "research_view": debate_result.get("research_view", ""),
    }
    risk_views, risk_final = _run_risk(risk_context, emit)

    # ─── Phase 4: Portfolio Manager ───────────────────────────────
    pm_reports = {
        **analyst_reports,
        "research_synthesis": debate_result.get("research_view", ""),
        "risk_assessment": risk_final,
    }
    emit("agent_started", {"agent": "portfolio_manager"})
    pm = PortfolioManager()
    pm_context = {**base_context, "analyst_reports": pm_reports}
    verdict_result = pm.run(pm_context)
    verdict_json = _parse_verdict(verdict_result)
    emit("agent_completed", {
        "agent": "portfolio_manager",
        "report": verdict_result.report,
        "error": verdict_result.error,
    })

    final = {
        "ticker": ticker,
        "stock_name": snapshot["company_info"].get("stock_name"),
        "current_price": snapshot["company_info"].get("current_price"),
        "analyst_reports": analyst_reports,
        "analyst_errors": analyst_errors,
        "debate": debate_result,
        "risk_views": risk_views,
        "risk_final": risk_final,
        "verdict": verdict_json,
        "verdict_error": verdict_result.error,
        "elapsed_sec": round(time.time() - start, 2),
    }
    emit("pipeline_completed", {"elapsed_sec": final["elapsed_sec"], "rating": verdict_json.get("rating") if verdict_json else None})

    verdict_store.log_verdict(final)
    return final


# ─── Phase 1: Analysts ────────────────────────────────────────────
def _run_analysts(context: dict, emit: EventCallback) -> tuple[dict, dict]:
    reports: dict[str, str] = {}
    errors: dict[str, str] = {}

    for cls in ANALYST_CLASSES:
        emit("agent_started", {"agent": cls.name})

    with ThreadPoolExecutor(max_workers=len(ANALYST_CLASSES)) as pool:
        futures = {pool.submit(_run_agent, cls(), context): cls.name for cls in ANALYST_CLASSES}
        for fut in as_completed(futures):
            name = futures[fut]
            result: AgentResult = fut.result()
            if result.error:
                errors[name] = result.error
                reports[name] = f"[Agent error: {result.error}]"
            else:
                reports[name] = result.report
            emit("agent_completed", {"agent": name, "report": reports[name], "error": result.error})

    return reports, errors


# ─── Phase 2: Bull vs Bear debate ─────────────────────────────────
def _run_debate(context: dict, emit: EventCallback, rounds: int = 1) -> dict:
    bull = BullResearcher()
    bear = BearResearcher()

    bull_history: list[str] = []
    bear_history: list[str] = []
    combined_history = ""

    for r in range(1, max(1, rounds) + 1):
        emit("agent_started", {"agent": "bull", "round": r})
        bull_ctx = {
            **context,
            "debate_history": combined_history,
            "last_bear_argument": bear_history[-1] if bear_history else "",
            "debate_round": r,
        }
        bull_res = bull.run(bull_ctx)
        bull_text = bull_res.report or f"[Bull error: {bull_res.error}]"
        bull_history.append(bull_text)
        combined_history += f"\n\n### Bull (round {r})\n{bull_text}"
        emit("agent_completed", {"agent": "bull", "round": r, "report": bull_text, "error": bull_res.error})

        emit("agent_started", {"agent": "bear", "round": r})
        bear_ctx = {
            **context,
            "debate_history": combined_history,
            "last_bull_argument": bull_text,
            "debate_round": r,
        }
        bear_res = bear.run(bear_ctx)
        bear_text = bear_res.report or f"[Bear error: {bear_res.error}]"
        bear_history.append(bear_text)
        combined_history += f"\n\n### Bear (round {r})\n{bear_text}"
        emit("agent_completed", {"agent": "bear", "round": r, "report": bear_text, "error": bear_res.error})

    emit("agent_started", {"agent": "research_manager"})
    rm = ResearchManager()
    rm_ctx = {
        **context,
        "bull_history": "\n\n".join(bull_history),
        "bear_history": "\n\n".join(bear_history),
    }
    rm_res = rm.run(rm_ctx)
    emit("agent_completed", {"agent": "research_manager", "report": rm_res.report, "error": rm_res.error})

    return {
        "bull_history": bull_history,
        "bear_history": bear_history,
        "research_view": rm_res.report,
    }


# ─── Phase 3: Risk team ───────────────────────────────────────────
def _run_risk(context: dict, emit: EventCallback) -> tuple[dict, str]:
    views: dict[str, str] = {}

    for cls in RISK_CLASSES:
        emit("agent_started", {"agent": cls.name})

    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(_run_agent, cls(), context): cls.name for cls in RISK_CLASSES}
        for fut in as_completed(futures):
            name = futures[fut]
            result = fut.result()
            views[name] = result.report if not result.error else f"[Error: {result.error}]"
            emit("agent_completed", {"agent": name, "report": views[name], "error": result.error})

    emit("agent_started", {"agent": "risk_manager"})
    rm_ctx = {
        **context,
        "risk_aggressive_view": views.get("risk_aggressive", ""),
        "risk_conservative_view": views.get("risk_conservative", ""),
        "risk_neutral_view": views.get("risk_neutral", ""),
    }
    rm = RiskManager()
    rm_res = rm.run(rm_ctx)
    emit("agent_completed", {"agent": "risk_manager", "report": rm_res.report, "error": rm_res.error})

    return views, rm_res.report


# ─── Helpers ──────────────────────────────────────────────────────
def _run_agent(agent, context: dict) -> AgentResult:
    return agent.run(context)


def _parse_verdict(result: AgentResult) -> Optional[dict]:
    if result.error:
        return None
    try:
        return json.loads(result.report)
    except json.JSONDecodeError:
        return {"raw": result.report}
