"""Macro-India analyst — reads RBI, CPI, FII flow, USD/INR, crude headlines and
synthesises the regime backdrop that any Indian-equity verdict depends on."""

import logging

from data_providers import macro_india

from .base import BaseAgent

log = logging.getLogger(__name__)


class MacroAnalyst(BaseAgent):
    name = "macro"
    max_tokens = 900

    def system_prompt(self) -> str:
        return (
            "You are a macro strategist focused on Indian equity markets. You read RBI policy, "
            "CPI / WPI prints, GDP nowcasts, FII / DII flow data, USD-INR, Brent and global rate "
            "expectations, and translate them into a *regime call* for Indian stocks: risk-on, "
            "risk-off, rotation, defensives. You explicitly link macro to sector-level winners/losers."
        )

    def user_prompt(self, context: dict) -> str:
        ticker = context.get("ticker", "UNKNOWN")
        company_info = context.get("company_info") or {}
        sector = company_info.get("sector") or company_info.get("industry") or ""

        try:
            macro = macro_india.get_macro_snapshot(sector=sector)
        except Exception as exc:
            log.warning("macro fetch failed: %s", exc)
            macro = {"by_topic": {}, "sector_items": [], "sector": sector}

        formatted = macro_india.format_for_prompt(macro)

        return f"""## Macro-India backdrop for **{ticker}** (sector: {sector or 'unknown'})

{formatted}

---

## Your task

Synthesise into a markdown report:

### Regime call
1 line: **Risk-On / Cautious-Risk-On / Neutral / Risk-Off**, based on rates + flows + currency.

### Key drivers right now
- RBI / monetary policy stance
- CPI / inflation trajectory
- FII / DII flow direction
- USD-INR & oil tailwind/headwind
- Global cue (Fed, China, geopolitics) if relevant in the headlines

### Sector implication for **{sector or ticker}**
Is the macro tailwind, headwind, or neutral for this specific sector? Why?

### Watchlist
2-3 macro events in the next 2-4 weeks that could change the call (RBI MPC, CPI print, Fed meet, Budget, etc.).

### Verdict
One of: **Macro Tailwind / Macro Neutral / Macro Headwind**

Quote actual headlines / dates from the feed. If feed is sparse, say so. Keep under 280 words."""
