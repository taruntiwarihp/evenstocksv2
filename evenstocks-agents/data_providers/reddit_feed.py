"""Reddit feed for Indian retail sentiment.

Hits public Reddit JSON endpoints (no OAuth needed) across Indian investing subs,
de-dupes, and returns top mentions of a given ticker/company.
"""

import logging
import time
from datetime import datetime, timezone
from typing import Optional

import httpx

log = logging.getLogger(__name__)

INDIA_SUBS = [
    "IndianStockMarket",
    "IndianStreetBets",
    "IndiaInvestments",
    "DalalStreetTalks",
    "StockMarketIndia",
]

USER_AGENT = "evenstocks-agents/0.3 (educational sentiment bot)"
DEFAULT_TIMEOUT = 6.0
PER_SUB_LIMIT = 6


def _search_sub(sub: str, query: str) -> list[dict]:
    url = f"https://www.reddit.com/r/{sub}/search.json"
    params = {
        "q": query,
        "restrict_sr": "1",
        "sort": "new",
        "t": "month",
        "limit": str(PER_SUB_LIMIT),
    }
    try:
        resp = httpx.get(
            url,
            params=params,
            headers={"User-Agent": USER_AGENT},
            timeout=DEFAULT_TIMEOUT,
            follow_redirects=True,
        )
        if resp.status_code == 429:
            log.info("reddit rate-limit on r/%s", sub)
            return []
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        log.debug("reddit fetch r/%s failed: %s", sub, exc)
        return []

    try:
        data = resp.json()
    except ValueError:
        return []

    posts: list[dict] = []
    for child in data.get("data", {}).get("children", []):
        d = child.get("data") or {}
        created = d.get("created_utc") or 0
        posts.append({
            "subreddit": sub,
            "title": (d.get("title") or "")[:240],
            "score": d.get("score") or 0,
            "num_comments": d.get("num_comments") or 0,
            "url": f"https://www.reddit.com{d.get('permalink', '')}",
            "selftext": (d.get("selftext") or "")[:280],
            "created_iso": datetime.fromtimestamp(created, tz=timezone.utc).isoformat() if created else None,
        })
    return posts


def get_reddit_mentions(ticker: str, company_name: Optional[str] = None) -> dict:
    """Search Indian investing subs for ticker + company mentions."""
    queries = [ticker.upper()]
    if company_name and company_name.upper() != ticker.upper():
        queries.append(company_name)

    seen_urls: set[str] = set()
    mentions: list[dict] = []

    for sub in INDIA_SUBS:
        for q in queries:
            for post in _search_sub(sub, q):
                if post["url"] in seen_urls:
                    continue
                seen_urls.add(post["url"])
                mentions.append(post)
            time.sleep(0.15)  # be polite to Reddit

    mentions.sort(key=lambda p: p.get("score") or 0, reverse=True)
    mentions = mentions[:20]

    total_score = sum(m["score"] for m in mentions)
    total_comments = sum(m["num_comments"] for m in mentions)

    return {
        "mentions": mentions,
        "count": len(mentions),
        "total_score": total_score,
        "total_comments": total_comments,
        "subs_searched": INDIA_SUBS,
        "fetched_at": datetime.utcnow().isoformat(),
    }


def format_for_prompt(reddit: dict) -> str:
    items = reddit.get("mentions") or []
    if not items:
        return "_No recent Reddit mentions found in Indian investing subs._"
    lines = [
        f"Total mentions: **{reddit['count']}** | Aggregate karma: **{reddit['total_score']}** | Comments: **{reddit['total_comments']}**",
        "",
    ]
    for i, m in enumerate(items[:12], 1):
        when = (m.get("created_iso") or "")[:10]
        lines.append(
            f"{i}. r/{m['subreddit']} ({when}) — score {m['score']} / {m['num_comments']}c — "
            f"{m['title']}"
        )
        if m.get("selftext"):
            lines.append(f"   > {m['selftext'][:160]}")
    return "\n".join(lines)
