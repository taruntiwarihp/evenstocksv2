"""Indian capital-gains tax engine.

Rates as of FY2024-25 (Union Budget Jul-2024 onward, applicable through 2026):
  - STCG on listed equity (Section 111A) : 20% (raised from 15% in Jul-2024)
  - LTCG on listed equity (Section 112A) : 12.5% above ₹1.25L exemption (raised from 10% above ₹1L)
  - Holding period for LTCG eligibility   : > 12 months
  - STT must be paid (assumed for listed equity)

Surcharge + 4% cess apply on top for higher income brackets — kept out of the
default calc to stay portable for retail. We expose `surcharge_pct` for callers
who need the precise after-tax figure.
"""

from dataclasses import dataclass
from typing import Optional

LTCG_EXEMPTION = 125_000          # ₹1.25L per FY (post-Jul-2024)
STCG_RATE = 0.20                  # 20% flat
LTCG_RATE = 0.125                 # 12.5% above exemption
LTCG_HOLDING_MONTHS = 12
CESS_RATE = 0.04                  # 4% Health & Education cess on tax


@dataclass
class TaxBreakdown:
    holding_type: str              # "STCG" | "LTCG"
    gross_gain: float
    taxable_gain: float
    base_tax: float
    cess: float
    surcharge: float
    total_tax: float
    net_gain: float
    effective_rate_pct: float
    notes: list[str]


def compute_tax(
    buy_price: float,
    sell_price: float,
    quantity: int,
    holding_months: float,
    other_ltcg_realised_this_fy: float = 0.0,
    surcharge_pct: float = 0.0,
) -> TaxBreakdown:
    """Compute capital-gains tax on a single equity trade.

    Args:
        buy_price, sell_price, quantity: trade economics in INR
        holding_months: months between buy and sell
        other_ltcg_realised_this_fy: prior LTCG already eaten part of the ₹1.25L exemption
        surcharge_pct: 0/10/15/25/37 — based on slab
    """
    gross_gain = (sell_price - buy_price) * quantity
    notes: list[str] = []

    if gross_gain <= 0:
        return TaxBreakdown(
            holding_type="STCG" if holding_months <= LTCG_HOLDING_MONTHS else "LTCG",
            gross_gain=gross_gain,
            taxable_gain=0.0,
            base_tax=0.0,
            cess=0.0,
            surcharge=0.0,
            total_tax=0.0,
            net_gain=gross_gain,
            effective_rate_pct=0.0,
            notes=["No gain — capital loss can be set off / carried forward 8 years."],
        )

    if holding_months <= LTCG_HOLDING_MONTHS:
        holding_type = "STCG"
        taxable = gross_gain
        base_tax = taxable * STCG_RATE
        notes.append("STCG @ 20% (Section 111A, post-Jul-2024 rate).")
    else:
        holding_type = "LTCG"
        exemption_left = max(LTCG_EXEMPTION - other_ltcg_realised_this_fy, 0)
        taxable = max(gross_gain - exemption_left, 0)
        base_tax = taxable * LTCG_RATE
        if exemption_left > 0:
            notes.append(
                f"₹{exemption_left:,.0f} of LTCG exemption (₹1.25L FY cap) used here."
            )
        notes.append("LTCG @ 12.5% on excess above exemption (Section 112A).")

    surcharge = base_tax * (surcharge_pct / 100.0)
    cess = (base_tax + surcharge) * CESS_RATE
    total_tax = base_tax + surcharge + cess
    net_gain = gross_gain - total_tax
    effective = (total_tax / gross_gain) * 100 if gross_gain else 0.0

    if surcharge_pct == 0:
        notes.append("Surcharge assumed 0% — adjust upward if income > ₹50L.")

    return TaxBreakdown(
        holding_type=holding_type,
        gross_gain=round(gross_gain, 2),
        taxable_gain=round(taxable, 2),
        base_tax=round(base_tax, 2),
        cess=round(cess, 2),
        surcharge=round(surcharge, 2),
        total_tax=round(total_tax, 2),
        net_gain=round(net_gain, 2),
        effective_rate_pct=round(effective, 2),
        notes=notes,
    )


def project_after_tax(current_price: float, target_price: float, horizon_months: float) -> dict:
    """Quick after-tax return projection for a 1-share trade.

    Used by Portfolio Manager to show retail what the verdict actually looks like
    after the IT department takes its cut.
    """
    if not current_price or not target_price or current_price <= 0:
        return {"available": False}

    breakdown = compute_tax(
        buy_price=current_price,
        sell_price=target_price,
        quantity=1,
        holding_months=horizon_months,
    )
    pre_tax_pct = ((target_price - current_price) / current_price) * 100
    post_tax_pct = (breakdown.net_gain / current_price) * 100 if current_price else 0.0

    return {
        "available": True,
        "horizon_months": horizon_months,
        "holding_type": breakdown.holding_type,
        "pre_tax_return_pct": round(pre_tax_pct, 2),
        "post_tax_return_pct": round(post_tax_pct, 2),
        "tax_drag_pct": round(pre_tax_pct - post_tax_pct, 2),
        "effective_tax_rate_pct": breakdown.effective_rate_pct,
        "notes": breakdown.notes,
    }


def format_for_prompt(projection: Optional[dict]) -> str:
    if not projection or not projection.get("available"):
        return "_Tax projection unavailable (price/target missing)._"
    return (
        f"- Holding type: **{projection['holding_type']}** (horizon ≈ {projection['horizon_months']}m)\n"
        f"- Pre-tax return: **{projection['pre_tax_return_pct']}%**\n"
        f"- Post-tax return: **{projection['post_tax_return_pct']}%**\n"
        f"- Tax drag: {projection['tax_drag_pct']}% (effective rate {projection['effective_tax_rate_pct']}%)\n"
        f"- Notes: {'; '.join(projection['notes'])}"
    )
