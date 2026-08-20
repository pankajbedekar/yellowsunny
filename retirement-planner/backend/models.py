from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


AssetType = Literal["401K", "Savings/Brokerage", "IRA", "Other"]
DistributionType = Literal["Normal", "Early 72t", "Early 55+", "RMD"]
FilingStatus = Literal[
    "Single",
    "Married Filing Jointly",
    "Married Filing Separately",
    "Head of Household",
]


class Assumptions(BaseModel):
    scenarioName: str = Field(default="Default", min_length=1, max_length=80)
    retirementAge: int = Field(default=65, ge=40, le=100)
    retirementYear: int = Field(default=2035, ge=1900, le=2200)
    filingStatus: FilingStatus = "Single"
    assetGrowthPercent: float = Field(default=5.0, ge=-50, le=100)
    inflationPercent: float = Field(default=3.5, ge=-10, le=100)


class CashFlowRow(BaseModel):
    name: str = ""
    annual: float = Field(default=0.0, ge=0)
    startYear: int | None = Field(default=None, ge=1900, le=2200)
    endYear: int | None = Field(default=None, ge=1900, le=2200)

    @model_validator(mode="after")
    def check_year_range(self) -> "CashFlowRow":
        if (
            self.startYear is not None
            and self.endYear is not None
            and self.endYear < self.startYear
        ):
            raise ValueError("endYear must be greater than or equal to startYear")
        return self


class DistributionRow(CashFlowRow):
    distributionType: DistributionType = "Normal"


class AssetRow(BaseModel):
    name: str = ""
    type: AssetType = "401K"
    amount: float = Field(default=0.0, ge=0)

    @field_validator("type", mode="before")
    @classmethod
    def normalize_legacy_asset_type(cls, value: str) -> str:
        # Keep older exported scenarios importable after combining these types.
        if value in {"Savings", "Brokerage"}:
            return "Savings/Brokerage"
        return value


class RetirementPlan(BaseModel):
    assumptions: Assumptions
    income: list[CashFlowRow] = Field(default_factory=list)
    expenses: list[CashFlowRow] = Field(default_factory=list)
    distributions: list[DistributionRow] = Field(default_factory=list)
    assets: list[AssetRow] = Field(default_factory=list)


class WorksheetRow(BaseModel):
    year: int
    age: int
    income: float
    expenses: float
    distributions: float
    taxes: float
    netCashFlow: float
    savings: float
    portfolioAssets: float


class CalculationResponse(BaseModel):
    worksheet: list[WorksheetRow]
