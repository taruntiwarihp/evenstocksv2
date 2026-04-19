"""SEBI / governance red-flag analyst.

Reads pre-extracted structured signals from data_providers.sebi_signals and asks
the LLM to interpret them in the Indian regulatory context (SEBI rules, listing
obligations, common forensic patterns).
"""

import logging

from data_providers import sebi_signals

from .base import BaseAgent

log = logging.getLogger(__name__)


class SebiRedFlagAnalyst(BaseAgent):
    name = "sebi_redflag"
    max_tokens = 900

    def system_prompt(self) -> str:
        return (
            "You are a forensic accountant and SEBI compliance analyst with 20 years of "
            "experience flagging Indian listed-company governance issues. You know the "
            "common red-flag patterns: pledged promoter holdings, related-party transactions, "
            "auditor changes, qualified opinions, cash-flow vs reported-profit divergence, "
            "interest capitalisation, equity dilution and weak shareholding disclosures. "
            "You explicitly distinguish *severity* (low/medium/high) and tell retail investors "
            "whether a flag is dealbreaker, watch-item, or minor."
        )

    def user_prompt(self, context: dict) -> str:
        ticker = context.get("ticker", "UNKNOWN")
        company_info = context.get("company_info") or {}
        fin = context.get("financial_tables") or {}

        snapshot = {"company_info": company_info, "financial_tables": fin}
        try:
            redflags = sebi_signals.extract_red_flags(snapshot)
        except Exception as exc:
            log.warning("sebi signals extract failed for %s: %s", ticker, exc)
            redflags = {"findings": [], "count": 0, "severity": "unknown"}

        formatted = sebi_signals.format_for_prompt(redflags)

        cons_list = company_info.get("cons") or []
        if isinstance(cons_list, list):
            cons_text = "\n".join(f"- {c}" for c in cons_list[:8]) or "_(none reported)_"
        else:
            cons_text = str(cons_list)[:600]

        return f"""## Governance / SEBI red-flag scan for **{ticker}**

### Auto-extracted structured findings
{formatted}

### Screener-listed cons (raw)
{cons_text}

---

## Your task

Interpret the findings above through a SEBI / governance lens and produce:

### Headline assessment
1 sentence: how concerning is this company's governance profile?

### Findings by severity
For each finding, assign **High / Medium / Low** severity and explain why a *retail Indian investor* should care.

### Hidden risks not yet captured
What else should an investor check (board independence, auditor history, related-party loans, ESOP dilution, promoter pledge trend)?

### Verdict
One of: **Clean / Watchlist / Caution / Avoid**

Be blunt. If governance is fine, say so. If it's a known forensic-accounting pattern, name it. Keep under 280 words."""
