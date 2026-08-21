from __future__ import annotations

from .models import CashFlowRow, FilingStatus, RetirementPlan, WorksheetRow


WORKSHEET_YEARS = 49
TAX_YEAR = 2026

# 2026 federal ordinary-income tax brackets.
# Each tuple is (upper taxable-income limit, marginal rate). The final upper
# limit is None. Keeping the schedule here makes annual tax updates simple.
FEDERAL_TAX_BRACKETS_2026: dict[FilingStatus, tuple[tuple[float | None, float], ...]] = {
    "Single": (
        (12_400, 0.10),
        (50_400, 0.12),
        (105_700, 0.22),
        (201_775, 0.24),
        (256_225, 0.32),
        (640_600, 0.35),
        (None, 0.37),
    ),
    "Married Filing Jointly": (
        (24_800, 0.10),
        (100_800, 0.12),
        (211_400, 0.22),
        (403_550, 0.24),
        (512_450, 0.32),
        (768_700, 0.35),
        (None, 0.37),
    ),
    "Married Filing Separately": (
        (12_400, 0.10),
        (50_400, 0.12),
        (105_700, 0.22),
        (201_775, 0.24),
        (256_225, 0.32),
        (384_350, 0.35),
        (None, 0.37),
    ),
    "Head of Household": (
        (17_700, 0.10),
        (67_450, 0.12),
        (105_700, 0.22),
        (201_750, 0.24),
        (256_200, 0.32),
        (640_600, 0.35),
        (None, 0.37),
    ),
}

# 2026 standard deductions. The model uses these before applying the brackets.
# It remains a simplified estimate: all entered income and distributions are
# treated as ordinary taxable income, with no credits or special tax treatment.
STANDARD_DEDUCTION_2026: dict[FilingStatus, float] = {
    "Single": 16_100,
    "Married Filing Jointly": 32_200,
    "Married Filing Separately": 16_100,
    "Head of Household": 24_150,
}


def _inflated_total(rows: list[CashFlowRow], year: int, inflation_rate: float) -> float:
    total = 0.0
    for row in rows:
        if row.startYear is None or row.endYear is None:
            continue
        if row.startYear <= year <= row.endYear:
            years_since_start = year - row.startYear
            total += row.annual * ((1.0 + inflation_rate) ** years_since_start)
    return total


def _flat_total(rows: list[CashFlowRow], year: int) -> float:
    """Sum active rows without inflation adjustment."""
    total = 0.0
    for row in rows:
        if row.startYear is None or row.endYear is None:
            continue
        if row.startYear <= year <= row.endYear:
            total += row.annual
    return total


def _federal_income_tax_2026(gross_ordinary_income: float, filing_status: FilingStatus) -> float:
    """Estimate 2026 federal income tax using the standard deduction and brackets."""
    taxable_income = max(
        0.0,
        gross_ordinary_income - STANDARD_DEDUCTION_2026[filing_status],
    )
    if taxable_income <= 0:
        return 0.0

    tax = 0.0
    lower_bound = 0.0

    for upper_bound, rate in FEDERAL_TAX_BRACKETS_2026[filing_status]:
        if upper_bound is None:
            tax += max(0.0, taxable_income - lower_bound) * rate
            break

        amount_in_bracket = min(taxable_income, upper_bound) - lower_bound
        if amount_in_bracket > 0:
            tax += amount_in_bracket * rate

        if taxable_income <= upper_bound:
            break
        lower_bound = upper_bound

    return tax


def calculate_retirement_plan(plan: RetirementPlan) -> list[WorksheetRow]:
    """Calculate the 49-year retirement worksheet.

    Current assumptions:
    - Income and expenses inflate from each row's start year.
    - Distributions stay at the entered annual amount; inflation is not applied.
    - Federal tax uses either the user-entered flat tax rate or the fixed 2026
      standard deduction and progressive tax brackets for the selected filing status.
    - All entered income and distributions are treated as ordinary taxable income.
    - Distribution Type is retained for scenario classification and future rules;
      it does not currently alter the tax or withdrawal calculation.
    - Savings accumulates net cash flow.
    - Distributions are subtracted from portfolio before growth is applied.
    """

    assumptions = plan.assumptions
    inflation_rate = assumptions.inflationPercent / 100.0
    growth_rate = assumptions.assetGrowthPercent / 100.0

    previous_portfolio = sum(
        asset.amount for asset in plan.assets if asset.type != "Savings/Brokerage"
    )
    previous_savings = sum(
        asset.amount for asset in plan.assets if asset.type == "Savings/Brokerage"
    )

    current_year = assumptions.retirementYear
    current_age = assumptions.retirementAge
    worksheet: list[WorksheetRow] = []

    for _ in range(WORKSHEET_YEARS):
        income = _inflated_total(plan.income, current_year, inflation_rate)
        expenses = _inflated_total(plan.expenses, current_year, inflation_rate)
        distributions = _flat_total(plan.distributions, current_year)

        gross_taxable_income = income + distributions
        if assumptions.filingStatus == "Use flat tax rate":
            taxes = gross_taxable_income * (assumptions.flatTaxPercent / 100.0)
        else:
            taxes = _federal_income_tax_2026(
                gross_taxable_income,
                assumptions.filingStatus,
            )
        net_income = income + distributions - taxes
        net_cash_flow = net_income - expenses

        savings = previous_savings + net_cash_flow
        previous_savings = savings

        portfolio = (previous_portfolio - distributions) * (1.0 + growth_rate)
        previous_portfolio = portfolio

        worksheet.append(
            WorksheetRow(
                year=current_year,
                age=current_age,
                income=income,
                distributions=distributions,
                taxes=taxes,
                netIncome=net_income,
                expenses=expenses,
                netCashFlow=net_cash_flow,
                savings=savings,
                portfolioAssets=portfolio,
            )
        )

        current_year += 1
        current_age += 1

    return worksheet
