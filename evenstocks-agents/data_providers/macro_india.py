"""India macro-context provider.

Fetches headlines for the macro indicators that move Indian equities. Uses the
existing Google News RSS plumbing — no extra API keys needed. We deliberately
keep this thin: the LLM agent does the synthesis, this just supplies signal.
"""

import logging
from datetime import datetime
from typing import Optional

from . import news_feed

log = logging.getLogger(__name__)

MACRO_QUERIES = [
    ("RBI repo rate India", "monetary_policy"),
    ("India CPI inflation latest", "inflation"),
    ("India GDP growth quarter", "growth"),
    ("FII DII flows India", "flows"),
    ("USD INR rupee dollar", "currency"),
    ("Brent crude oil price India", "commodities"),
    ("Nifty Sensex outlook today", "market_breadth"),
]

SECTOR_QUERIES: dict[str, list[str]] = {
    "Banks": ["RBI banking sector India", "NPA Indian banks"],
    "IT": ["Indian IT services demand outlook", "TCS Infosys deal wins"],
    "Auto": ["India auto sales monthly", "EV adoption India"],
    "Pharma": ["India pharma USFDA Indian companies", "API import China"],
    "FMCG": ["India rural demand FMCG", "consumption slowdown India"],
    "Metals": ["China steel demand", "metal prices India tariff"],
    "Power": ["India power demand peak", "coal supply India"],
    "Real Estate": ["India real estate sales housing demand"],
    "Oil & Gas": ["crude oil demand India OMC margins"],
}


def get_macro_snapshot(sector: Optional[str] = None) -> dict:
    """Build a macro snapshot for India + (optionally) sector-specific context."""
    by_topic: dict[str, list[dict]] = {}
    for query, topic in MACRO_QUERIES:
        try:
            items = news_feed.fetch_google_news(query)[:4]
        except Exception as exc:
            log.debug("macro fetch '%s' failed: %s", query, exc)
            items = []
        if items:
            by_topic[topic] = items

    sector_items: list[dict] = []
    if sector:
        for sect_key, queries in SECTOR_QUERIES.items():
            if sect_key.lower() in sector.lower():
                for q in queries:
                    try:
                        sector_items.extend(news_feed.fetch_google_news(q)[:3])
                    except Exception as exc:
                        log.debug("macro sector fetch '%s' failed: %s", q, exc)
                break

    return {
        "by_topic": by_topic,
        "sector": sector,
        "sector_items": sector_items[:6],
        "fetched_at": datetime.utcnow().isoformat(),
    }


def format_for_prompt(macro: dict) -> str:
    if not macro.get("by_topic") and not macro.get("sector_items"):
        return "_No macro headlines retrieved._"

    lines: list[str] = []
    topic_labels = {
        "monetary_policy": "RBI / monetary policy",
        "inflation": "CPI / inflation",
        "growth": "GDP / growth",
        "flows": "FII / DII flows",
        "currency": "USD / INR",
        "commodities": "Brent / commodities",
        "market_breadth": "Index / breadth",
    }
    for topic, items in macro.get("by_topic", {}).items():
        lines.append(f"**{topic_labels.get(topic, topic)}**")
        for it in items[:3]:
            date = (it.get("published") or "")[:10]
            lines.append(f"- {date} — {it['title']}")
        lines.append("")

    if macro.get("sector_items"):
        lines.append(f"**Sector context — {macro.get('sector') or 'sector'}**")
        for it in macro["sector_items"]:
            date = (it.get("published") or "")[:10]
            lines.append(f"- {date} — {it['title']}")

    return "\n".join(lines).strip()
