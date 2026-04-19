"""Concall / earnings transcript discovery via news search.

True transcript scraping is brittle (paywalled aggregators, Trendlyne, ResearchBytes).
We instead surface *coverage* of the latest concall — analyst notes, brokerage
takeaways, management commentary blurbs that cluster around earnings results.

The LLM then summarises management tone, guidance, capex plans and Q&A pushback
from these secondary sources.
"""

import logging
from datetime import datetime
from typing import Optional

from . import news_feed

log = logging.getLogger(__name__)

CONCALL_QUERY_TEMPLATES = [
    '{name} concall transcript',
    '{name} earnings call management commentary',
    '{name} Q4 results guidance',
    '{name} brokerage view target price',
]


def get_concall_coverage(ticker: str, company_name: Optional[str] = None) -> dict:
    name = company_name or ticker
    seen: set[str] = set()
    items: list[dict] = []

    for tmpl in CONCALL_QUERY_TEMPLATES:
        query = tmpl.format(name=name)
        try:
            fetched = news_feed.fetch_google_news(query)[:5]
        except Exception as exc:
            log.debug("concall fetch '%s' failed: %s", query, exc)
            continue
        for it in fetched:
            key = it["title"].lower()[:80]
            if key not in seen:
                seen.add(key)
                items.append(it)

    items.sort(key=lambda x: x.get("published") or "", reverse=True)
    items = items[:12]

    return {
        "items": items,
        "count": len(items),
        "fetched_at": datetime.utcnow().isoformat(),
    }


def format_for_prompt(coverage: dict) -> str:
    items = coverage.get("items") or []
    if not items:
        return "_No concall / earnings-coverage articles found in the last news cycle._"
    lines: list[str] = []
    for i, it in enumerate(items[:10], 1):
        date = (it.get("published") or "")[:10]
        lines.append(f"{i}. {date} — {it['title']}")
        if it.get("summary"):
            lines.append(f"   > {it['summary'][:180]}")
    return "\n".join(lines)
