"""Portfolio Manager — synthesizes analyst reports into final verdict with structured JSON."""

import json
import re
from typing import Optional

from data_providers import tax_engine

from .base import BaseAgent, AgentResult


HORIZON_TO_MONTHS = {
    "1-3 months": 2,
    "3-6 months": 4.5,
    "6-12 months": 9,
    "1-3 years": 24,
    "3+ years": 48,
}


class PortfolioManager(BaseAgent):
    name = "portfolio_manager"
    max_tokens = 2000

    def system_prompt(self) -> str:
        return (
            "You are the Chief Investment Officer of an Indian PMS (Portfolio Management Service). "
            "You synthesize input from fundamentals, technical, news, sentiment, governance, macro, "
            "and concall analysts into a final, actionable verdict for Indian retail investors. "
            "You use the Indian rating convention: Strong Buy, Accumulate, Hold, Reduce, Sell. "
            "You specify target price and stop-loss in INR. You think in time horizons relevant to "
            "Indian tax: short-term (≤1y, 20% STCG) vs long-term (>1y, 12.5% LTCG above ₹1.25L). "
            "You are decisive — no wishy-washy answers. Every verdict ties to evidence from the analysts."
        )

    def user_prompt(self, context: dict) -> str:
        ticker = context.get("ticker", "UNKNOWN")
        current_price = (
            (context.get("company_info") or {}).get("current_price") or "N/A"
        )

        reports = context.get("analyst_reports") or {}
        reports_text = ""
        for agent_name, report in reports.items():
            reports_text += f"\n### {agent_name.upper()} ANALYST\n{report}\n"

        return f"""Give the final Investment Committee verdict for Indian stock **{ticker}** (current price: ₹{current_price}).

## Analyst reports
{reports_text}

## Required output: valid JSON only (no markdown fences, no commentary)

{{
  "rating": "Strong Buy | Accumulate | Hold | Reduce | Sell",
  "confidence": 0-100,
  "target_price": <number in INR>,
  "stop_loss": <number in INR>,
  "time_horizon": "1-3 months | 3-6 months | 6-12 months | 1-3 years | 3+ years",
  "thesis": [
    "bullet 1 — key reason to act",
    "bullet 2 — supporting reason",
    "bullet 3 — supporting reason"
  ],
  "risks": [
    "risk 1 — what can go wrong",
    "risk 2",
    "risk 3"
  ],
  "executive_summary": "2-3 sentence action plan covering entry strategy, position sizing hint, and when to revisit."
}}

Rules:
- Output ONLY the JSON object. No prose before or after.
- `target_price` and `stop_loss` must be realistic INR values based on current price.
- `confidence` reflects analyst agreement: high agreement = high confidence.
- If data is thin, still give a verdict but lower `confidence`."""

    def run(self, context: dict) -> AgentResult:
        result = super().run(context)
        if result.error:
            return result

        parsed = _extract_json(result.report)
        if parsed:
            current_price = _to_float((context.get("company_info") or {}).get("current_price"))
            target = _to_float(parsed.get("target_price"))
            horizon = HORIZON_TO_MONTHS.get(parsed.get("time_horizon"), 12)
            if current_price and target:
                parsed["after_tax_projection"] = tax_engine.project_after_tax(
                    current_price=current_price,
                    target_price=target,
                    horizon_months=horizon,
                )
            result.report = json.dumps(parsed)
            result.confidence = float(parsed.get("confidence", 50)) / 100.0
        return result


def _to_float(val) -> Optional[float]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).replace(",", "").replace("₹", "").strip()
    if not s or s in {"-", "—", "N/A"}:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _extract_json(text: str) -> Optional[dict]:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
