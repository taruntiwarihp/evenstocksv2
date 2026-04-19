"""News Analyst — Phase 3: consumes real Google News + Yahoo Finance RSS feed."""

import logging

from data_providers import news_feed

from .base import BaseAgent

log = logging.getLogger(__name__)


class NewsAnalyst(BaseAgent):
    name = "news"
    max_tokens = 900

    def system_prompt(self) -> str:
        return (
            "You are a financial news analyst covering Indian markets. "
            "You synthesize news impact on stocks from Moneycontrol, Economic Times, Livemint, "
            "Business Standard, BSE/NSE filings and Yahoo Finance. You distinguish noise from "
            "material events and explicitly flag rumours vs. confirmed announcements."
        )

    def user_prompt(self, context: dict) -> str:
        ticker = context.get("ticker", "UNKNOWN")
        company_info = context.get("company_info") or {}
        company_name = company_info.get("stock_name") or ticker
        sector = company_info.get("sector") or company_info.get("industry") or "Unknown"

        try:
            news = news_feed.get_news(ticker, company_name=company_name)
        except Exception as exc:
            log.warning("news fetch failed for %s: %s", ticker, exc)
            news = {"items": [], "count": 0, "sources": []}

        formatted = news_feed.format_for_prompt(news)
        sources_line = ", ".join(news.get("sources") or []) or "none"

        return f"""## Live news feed for **{ticker}** ({company_name}) — sector: {sector}

Sources hit: {sources_line}
Items: {news.get('count', 0)}

{formatted}

---

## Your task

Analyse the **headlines above** and produce a markdown report:

### Material events (last 30 days)
List the headlines that genuinely matter (earnings, regulatory, M&A, large orders, management change, downgrades). Cite source + date.

### Noise
1-2 lines on items that look like clickbait / routine coverage.

### Likely catalysts to watch (next 7-30 days)
- ...

### Risk events
Specific events from the news that could move the stock.

### Verdict
One of: **Tailwinds / Neutral / Headwinds**

Be specific — quote tickers, numbers, dates from the feed. If feed is empty, say so honestly and fall back to sector-level context. Keep under 280 words."""
