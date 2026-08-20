from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .calculations import calculate_retirement_plan
from .models import CalculationResponse, RetirementPlan


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = FastAPI(
    title="YellowSunny Retirement Planner",
    version="1.2.1",
    root_path=os.getenv("ROOT_PATH", ""),
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/calculate", response_model=CalculationResponse)
def calculate(plan: RetirementPlan) -> CalculationResponse:
    return CalculationResponse(worksheet=calculate_retirement_plan(plan))


# Keep this mount after all /api routes. It serves index.html plus CSS, JS,
# images, and any future frontend assets from one directory. This also works
# cleanly when Caddy strips the /retirement-planner prefix before proxying.
app.mount(
    "/",
    StaticFiles(directory=FRONTEND_DIR, html=True),
    name="frontend",
)
