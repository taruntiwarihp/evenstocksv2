"""News feed for Indian stocks. Combines Google News RSS + Yahoo Finance RSS.

Both endpoints are free, no API key required. We tag each item with source and
limit total items to keep prompt size sane.
"""

import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Optional

import httpx

log = logging.getLogger(__name__)

GOOGLE_NEWS_URL = (
    "https://news.google.com/rss/search"
    "?q={q}&hl=en-IN&gl=IN&ceid=IN:en"
)
YAHOO_RSS_URL = "https://feeds.finance.yahoo.com/rss/2.0/headline?s={s}.NS&region=IN&lang=en-IN"

DEFAULT_TIMEOUT = 8.0
MAX_ITEMS_PER_SOURCE = 8


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "").strip()


def _parse_rss(xml_text: str, source: str) -> list[dict]:
    items: list[dict] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        log.warning("rss parse failed for %s: %s", source, exc)
        return items

    for item in root.iter("item"):
        title = _strip_html((item.findtext("title") or "").strip())
        link = (item.findtext("link") or "").strip()
        pub = (item.findtext("pubDate") or "").strip()
        desc = _strip_html((item.findtext("description") or "").strip())[:240]

        published_iso: Optional[str] = None
        if pub:
            try:
                published_iso = parsedate_to_datetime(pub).isoformat()
            except (TypeError, ValueError):
                published_iso = pub

        if title:
            items.append({
                "title": title,
                "link": link,
                "published": published_iso,
                "summary": desc,
                "source": source,
            })
        if len(items) >= MAX_ITEMS_PER_SOURCE:
            break
    return items


def fetch_google_news(query: str) -> list[dict]:
    url = GOOGLE_NEWS_URL.format(q=httpx.QueryParams({"q": query})["q"])
    try:
        resp = httpx.get(url, timeout=DEFAULT_TIMEOUT, follow_redirects=True)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        log.warning("google news fetch failed: %s", exc)
        return []
    return _parse_rss(resp.text, "Google News")


def fetch_yahoo_news(ticker: str) -> list[dict]:
    url = YAHOO_RSS_URL.format(s=ticker.upper())
    try:
        resp = httpx.get(url, timeout=DEFAULT_TIMEOUT, follow_redirects=True)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        log.debug("yahoo news fetch failed: %s", exc)
        return []
    return _parse_rss(resp.text, "Yahoo Finance")


def get_news(ticker: str, company_name: Optional[str] = None) -> dict:
    """Fetch combined news. Returns {items, sources, count}."""
    queries = []
    if company_name:
        queries.append(f"{company_name} stock")
    queries.append(f"{ticker} NSE BSE")

    seen_titles: set[str] = set()
    items: list[dict] = []

    for q in queries:
        for it in fetch_google_news(q):
            key = it["title"].lower()[:80]
            if key not in seen_titles:
                seen_titles.add(key)
                items.append(it)

    for it in fetch_yahoo_news(ticker):
        key = it["title"].lower()[:80]
        if key not in seen_titles:
            seen_titles.add(key)
            items.append(it)

    items.sort(key=lambda x: x.get("published") or "", reverse=True)
    items = items[:15]

    return {
        "items": items,
        "sources": sorted({i["source"] for i in items}),
        "count": len(items),
        "fetched_at": datetime.utcnow().isoformat(),
    }


def format_for_prompt(news: dict) -> str:
    if not news.get("items"):
        return "_No live news items retrieved._"
    lines: list[str] = []
    for i, it in enumerate(news["items"][:12], 1):
        date_short = (it.get("published") or "")[:10]
        lines.append(
            f"{i}. [{it['source']}] {date_short} — {it['title']}"
            + (f"\n   {it['summary']}" if it.get("summary") else "")
        )
    return "\n".join(lines)
