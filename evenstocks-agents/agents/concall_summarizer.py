"""Concall Summarizer — distils latest earnings-call coverage into management
guidance, capex plans, demand commentary and analyst pushback."""

import logging

from config import settings
from data_providers import concall_feed

from .base import BaseAgent

log = logging.getLogger(__name__)


class ConcallSummarizer(BaseAgent):
    name = "concall"
    model = settings.QUICK_MODEL
    max_tokens = 1000

    def system_prompt(self) -> str:
        return (
            "You are an equity research associate who summarises Indian-listed companies' "
            "quarterly earnings calls. You extract: management guidance, demand commentary, "
            "capex / order book, margin trajectory, segmental colour, and analyst Q&A pushback. "
            "You distinguish *what management said* from *what brokerages think*, and you call "
            "out gap between guidance and street expectations."
        )

    def user_prompt(self, context: dict) -> str:
        ticker = context.get("ticker", "UNKNOWN")
        company_info = context.get("company_info") or {}
        company_name = company_info.get("stock_name") or ticker

        try:
            coverage = concall_feed.get_concall_coverage(ticker, company_name=company_name)
        except Exception as exc:
            log.warning("concall fetch failed: %s", exc)
            coverage = {"items": [], "count": 0}

        formatted = concall_feed.format_for_prompt(coverage)

        return f"""## Latest concall / earnings-call coverage for **{ticker}** ({company_name})

{formatted}

---

## Your task

From the coverage above, infer and produce:

### Most recent quarter result snapshot
1-2 lines: revenue / EBITDA / PAT direction. Cite article/date if quoted.

### Management guidance & tone
- FY-ahead guidance (revenue growth, margin, capex)
- Demand commentary (rural / urban / export / B2B)
- Tone: confident / cautious / hedging

### Capex / capacity / new business
What's management investing in next 12-24 months?

### Analyst Q&A pushback
What are brokerages worried about? Did management adequately address it?

### Brokerage scorecard
Aggregate from coverage: how many "Buy / Hold / Sell" calls? Average target if mentioned.

### Verdict
One of: **Beat & Raise / In-Line / Miss / Cut Guidance / No Coverage Available**

If coverage is empty, say so honestly and give a 2-line generic note about the company. Keep under 320 words."""
