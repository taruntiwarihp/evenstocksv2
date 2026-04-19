"""Indian retail goal planner.

Pure-math utilities for the most common questions:
  - "How big a SIP do I need to hit ₹X in N years?"
  - "If I lump-sum invest ₹Y, what does it become in N years?"
  - "Adjust target for inflation"
  - Suggest equity/debt mix by horizon

No LLM needed — these are deterministic compounding formulas. We layer Indian
defaults (12% nominal equity CAGR, 6% inflation, 7% debt yield).
"""

from dataclasses import dataclass, asdict
from typing import Optional

EQUITY_CAGR_DEFAULT = 0.12
DEBT_YIELD_DEFAULT = 0.07
INFLATION_DEFAULT = 0.06


@dataclass
class GoalPlan:
    target_corpus: float
    horizon_years: float
    real_target_corpus: float          # inflation-adjusted target in today's rupees
    expected_return_pct: float         # blended portfolio return
    equity_pct: int
    debt_pct: int
    monthly_sip_required: float
    lumpsum_required: float
    notes: list[str]

    def to_dict(self) -> dict:
        return asdict(self)


def suggest_allocation(horizon_years: float) -> tuple[int, int]:
    """Heuristic equity/debt split by horizon."""
    if horizon_years < 3:
        return (20, 80)
    if horizon_years < 5:
        return (50, 50)
    if horizon_years < 10:
        return (70, 30)
    return (80, 20)


def blended_return(equity_pct: int, debt_pct: int) -> float:
    return (
        (equity_pct / 100.0) * EQUITY_CAGR_DEFAULT
        + (debt_pct / 100.0) * DEBT_YIELD_DEFAULT
    )


def fv_lumpsum(principal: float, annual_rate: float, years: float) -> float:
    return principal * ((1 + annual_rate) ** years)


def fv_sip(monthly: float, annual_rate: float, years: float) -> float:
    """Future value of monthly SIP, end-of-month."""
    n = years * 12
    if n <= 0 or monthly <= 0:
        return 0.0
    r = annual_rate / 12.0
    if r == 0:
        return monthly * n
    return monthly * (((1 + r) ** n - 1) / r) * (1 + r)


def required_sip(target: float, annual_rate: float, years: float) -> float:
    n = years * 12
    if n <= 0 or target <= 0:
        return 0.0
    r = annual_rate / 12.0
    if r == 0:
        return target / n
    factor = (((1 + r) ** n - 1) / r) * (1 + r)
    return target / factor if factor else 0.0


def required_lumpsum(target: float, annual_rate: float, years: float) -> float:
    if years <= 0 or target <= 0:
        return target
    return target / ((1 + annual_rate) ** years)


def plan(
    target_corpus: float,
    horizon_years: float,
    inflation_pct: float = INFLATION_DEFAULT * 100,
    equity_pct: Optional[int] = None,
) -> GoalPlan:
    """Build a complete plan."""
    notes: list[str] = []
    if equity_pct is None:
        eq, dt = suggest_allocation(horizon_years)
    else:
        eq = max(0, min(100, equity_pct))
        dt = 100 - eq
        notes.append(f"User-specified allocation: {eq}% equity / {dt}% debt.")

    rate = blended_return(eq, dt)
    real_target = fv_lumpsum(target_corpus, inflation_pct / 100, horizon_years)
    sip = required_sip(real_target, rate, horizon_years)
    lump = required_lumpsum(real_target, rate, horizon_years)

    notes.append(
        f"Assumed: equity {EQUITY_CAGR_DEFAULT*100:.0f}% CAGR, debt "
        f"{DEBT_YIELD_DEFAULT*100:.0f}% CAGR → blended {rate*100:.2f}%."
    )
    notes.append(
        f"Inflation @ {inflation_pct:.1f}% bumps your ₹{target_corpus:,.0f} target to "
        f"₹{real_target:,.0f} in year-{horizon_years:.0f} rupees."
    )

    return GoalPlan(
        target_corpus=round(target_corpus, 2),
        horizon_years=horizon_years,
        real_target_corpus=round(real_target, 2),
        expected_return_pct=round(rate * 100, 2),
        equity_pct=eq,
        debt_pct=dt,
        monthly_sip_required=round(sip, 2),
        lumpsum_required=round(lump, 2),
        notes=notes,
    )
