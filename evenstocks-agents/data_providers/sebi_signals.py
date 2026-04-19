"""SEBI / governance red-flag signal extractor.

Derives heuristic warnings from Screener-scraped data already in our SQLite DB:
- Pros/cons text mining for known red-flag phrases
- Financial-table heuristics (cash-flow vs profit divergence, rising debtor days)
- Promoter / pledge mentions

This is a *signal pre-processor* — the LLM agent layers context on top of these
structured findings, instead of guessing from the raw tables.
"""

import re
from typing import Any, Optional

RED_FLAG_KEYWORDS = [
    ("auditor", "Auditor change or qualified opinion mentioned"),
    ("qualified opinion", "Auditor qualified opinion"),
    ("pledged", "Promoter shares pledged"),
    ("pledge", "Promoter pledging"),
    ("related party", "Related-party transactions flagged"),
    ("related-party", "Related-party transactions flagged"),
    ("contingent", "Contingent liabilities significant"),
    ("debtor days", "Rising debtor days"),
    ("working capital", "Working capital stretch"),
    ("low promoter holding", "Low promoter skin-in-the-game"),
    ("decreasing promoter", "Promoter holding declining"),
    ("interest coverage", "Interest coverage stress"),
    ("dilution", "Equity dilution"),
    ("equity dilution", "Equity dilution"),
    ("capitalising interest", "Interest capitalisation"),
    ("might be capitalising", "Possible interest capitalisation"),
    ("low return on equity", "Sub-par RoE"),
    ("not paying out dividend", "Dividend policy weak vs profits"),
]


def _to_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(",", "").replace("%", "").replace("₹", "")
    if not s or s in {"-", "—"}:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _scan_text(items: Any) -> list[dict]:
    if not items:
        return []
    if isinstance(items, str):
        items = [items]
    out: list[dict] = []
    for raw in items:
        text = (raw or "").lower()
        for kw, label in RED_FLAG_KEYWORDS:
            if kw in text:
                out.append({"signal": label, "evidence": raw, "source": "cons"})
                break
    return out


def _cashflow_vs_profit(financial_tables: dict) -> Optional[dict]:
    """Flag if recent operating cash flow << net profit (earnings quality concern)."""
    cf = financial_tables.get("cash_flows") or financial_tables.get("cash_flow") or []
    pl = financial_tables.get("profit_loss") or financial_tables.get("p&l") or []
    if not cf or not pl:
        return None

    def _last_row(rows, label_substr):
        for row in rows:
            label = str(row.get("Narration") or row.get("") or row.get("metric") or "").lower()
            if label_substr in label:
                values = [v for k, v in row.items() if k not in {"Narration", "", "metric"}]
                nums = [_to_float(v) for v in values if _to_float(v) is not None]
                return nums[-3:] if nums else None
        return None

    op_cf = _last_row(cf, "operating activity") or _last_row(cf, "cash from operations")
    net_profit = _last_row(pl, "net profit")
    if not op_cf or not net_profit:
        return None
    try:
        ratio = sum(op_cf) / sum(net_profit) if sum(net_profit) else 0
    except ZeroDivisionError:
        return None
    if ratio < 0.5 and sum(net_profit) > 0:
        return {
            "signal": "Operating cash flow << reported net profit (3y average)",
            "evidence": f"Sum CFO/Net Profit ≈ {ratio:.2f} over last 3 years",
            "source": "financials",
        }
    return None


def extract_red_flags(snapshot: dict) -> dict:
    """Return structured red-flag findings for an LLM agent to reason over."""
    info = snapshot.get("company_info") or {}
    fin = snapshot.get("financial_tables") or {}

    findings: list[dict] = []
    findings.extend(_scan_text(info.get("cons")))
    cf_flag = _cashflow_vs_profit(fin)
    if cf_flag:
        findings.append(cf_flag)

    promoter_pct = _to_float(info.get("promoter_holding"))
    if promoter_pct is not None and promoter_pct < 30:
        findings.append({
            "signal": "Low promoter holding (<30%)",
            "evidence": f"Promoter holding ≈ {promoter_pct}%",
            "source": "shareholding",
        })

    debt_eq = _to_float(info.get("debt_to_equity"))
    if debt_eq is not None and debt_eq > 1.5:
        findings.append({
            "signal": "High leverage (D/E > 1.5)",
            "evidence": f"Debt/Equity ≈ {debt_eq}",
            "source": "balance_sheet",
        })

    roe = _to_float(info.get("return_on_equity"))
    if roe is not None and roe < 8:
        findings.append({
            "signal": "Sub-par RoE (<8%)",
            "evidence": f"RoE ≈ {roe}%",
            "source": "ratios",
        })

    interest_cov = _to_float(info.get("interest_coverage"))
    if interest_cov is not None and interest_cov < 2:
        findings.append({
            "signal": "Weak interest coverage (<2x)",
            "evidence": f"Interest coverage ≈ {interest_cov}x",
            "source": "ratios",
        })

    seen = set()
    deduped: list[dict] = []
    for f in findings:
        key = f["signal"]
        if key not in seen:
            seen.add(key)
            deduped.append(f)

    severity = "low"
    if len(deduped) >= 4:
        severity = "high"
    elif len(deduped) >= 2:
        severity = "medium"

    return {
        "findings": deduped,
        "count": len(deduped),
        "severity": severity,
    }


def format_for_prompt(redflags: dict) -> str:
    items = redflags.get("findings") or []
    if not items:
        return "_No structured red-flag signals detected from available data._"
    lines = [f"Severity: **{redflags['severity']}** | Findings: **{redflags['count']}**", ""]
    for i, f in enumerate(items, 1):
        lines.append(f"{i}. **{f['signal']}** _(source: {f['source']})_")
        if f.get("evidence"):
            ev = re.sub(r"\s+", " ", str(f["evidence"]))[:200]
            lines.append(f"   - Evidence: {ev}")
    return "\n".join(lines)
