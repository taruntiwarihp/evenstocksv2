"""Sentiment Analyst — Phase 3: consumes live Reddit Indian-investing-sub data."""

import logging

from config import settings
from data_providers import reddit_feed

from .base import BaseAgent

log = logging.getLogger(__name__)


class SentimentAnalyst(BaseAgent):
    name = "sentiment"
    model = settings.QUICK_MODEL
    max_tokens = 800

    def system_prompt(self) -> str:
        return (
            "You are a retail sentiment analyst tracking Indian investor mood across "
            "r/IndianStockMarket, r/IndianStreetBets, r/IndiaInvestments, r/DalalStreetTalks. "
            "You distinguish hype cycles from genuine conviction and treat extreme euphoria as a "
            "contrarian warning. You quote actual posts when calling out the mood."
        )

    def user_prompt(self, context: dict) -> str:
        ticker = context.get("ticker", "UNKNOWN")
        company_info = context.get("company_info") or {}
        company_name = company_info.get("stock_name") or ticker

        try:
            reddit = reddit_feed.get_reddit_mentions(ticker, company_name=company_name)
        except Exception as exc:
            log.warning("reddit fetch failed for %s: %s", ticker, exc)
            reddit = {"mentions": [], "count": 0, "total_score": 0, "total_comments": 0}

        formatted = reddit_feed.format_for_prompt(reddit)

        return f"""## Live Reddit signal for **{ticker}** ({company_name})

{formatted}

---

## Your task

Analyse what Indian retail is *actually saying* and produce:

### Volume & engagement
Is this stock being talked about a lot, a little, or barely? (Use the counts above.)

### Mood
What's the dominant tone — bullish thesis, panic, FOMO, deep skepticism? Cite 1-2 specific post titles.

### Narratives
What story is retail buying into? (Multibagger? Turnaround? Quick flip? Long-term hold?)

### Contrarian signal
- Extreme euphoria (multiple "to the moon" / "10x" posts) → caution flag
- Fear capitulation → potential opportunity
- Quiet but quality discussion → neutral / institutional setup

### Verdict
One of: **Extreme Greed / Greedy / Neutral / Fearful / Extreme Fear**

If the feed has 0 mentions, say so explicitly — that itself is a signal (lack of retail attention).
Keep under 220 words."""
