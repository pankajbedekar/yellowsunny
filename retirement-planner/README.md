# YellowSunny Retirement Planner

Vanilla HTML/CSS/JavaScript frontend with a FastAPI/Python calculation backend, designed for `https://yellowsunny.com/retirement-planner/`.

## Current behavior

- Scenario Name defaults to `Default` and is saved in exported JSON.
- Export filename is `retirement-plan-<Scenario-Name>.json`.
- Import/Export are JSON-only and labeled **Import Scenario** / **Export Scenario**.
- 49-year worksheet.
- Income and expenses inflate from their own start year.
- Distributions do **not** inflate.
- Distribution types: Normal, Early 72t, Early 55+, RMD.
- Asset types: 401K, Savings/Brokerage, IRA, Other.
- Asset growth defaults to 5%; inflation defaults to 3.5%.
- Tax estimate can use either a user-entered **flat tax rate** or the selected filing status with fixed **2026 federal standard deductions and progressive ordinary-income brackets**.
- The 2026 tax tables are centralized in `backend/calculations.py` for easy future updates.
- The simplified tax model treats all entered income and distributions as ordinary taxable income. Flat-tax mode applies the entered percentage directly to Income + Distributions and does not use the standard deduction or brackets. The model does not separately account for credits, capital gains, special Social Security taxation, state taxes, or distribution penalties.
- Distribution Type is currently saved/classified but does not change the calculation.
- The application is stateless; it does not persist scenarios to a database.

## Run locally on Windows PowerShell

From the `retirement-planner` directory:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8001
```

Open `http://localhost:8001/`.

## Docker / Hetzner

```bash
docker compose up -d --build
```

The Docker Compose file binds the app to `127.0.0.1:8001` so Caddy remains the only public entry point.

Use this inside the existing `yellowsunny.com` Caddy site block before the main-site catch-all:

```caddyfile
handle_path /retirement-planner/* {
    reverse_proxy 127.0.0.1:8001
}
```

Then validate and reload Caddy:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## YellowSunny visual theme

The planner uses the same warm ivory / mustard-yellow visual palette as the main YellowSunny landing page. `frontend/assets/Yellowsunny.png` is rendered as a very faint fixed background watermark. The backend serves the complete `frontend` directory through one `StaticFiles` mount so CSS, JavaScript, and image assets work under the Caddy `/retirement-planner/` route.
