import requests
from fastapi import FastAPI, HTTPException

from config import SECTORS_API_KEY

app = FastAPI(title="FinTrack Intelligence API")
SECTORS_API_BASE_URL = "https://api.sectors.app/v2"
BANK_SYMBOLS = ("BBCA", "BBRI", "BMRI", "BBNI")


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/banks/summary")
def get_banks_summary() -> list[dict[str, object]]:
    if not SECTORS_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="SECTORS_API_KEY belum dikonfigurasi di file .env.",
        )

    headers = {"Authorization": SECTORS_API_KEY}
    summaries = []

    for symbol in BANK_SYMBOLS:
        url = f"{SECTORS_API_BASE_URL}/company/report/{symbol}/"
        try:
            response = requests.get(
                url,
                headers=headers,
                params={"sections": "overview,valuation"},
                timeout=15,
            )
            response.raise_for_status()
            report = response.json()
        except requests.RequestException as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Gagal mengambil data Sectors untuk {symbol}.",
            ) from exc
        except ValueError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Sectors mengembalikan JSON tidak valid untuk {symbol}.",
            ) from exc

        overview = report.get("overview") or {}
        valuation = report.get("valuation") or {}
        summaries.append(
            {
                "symbol": report.get("symbol", symbol),
                "company_name": report.get("company_name"),
                "last_close_price": overview.get(
                    "last_close_price", valuation.get("last_close_price")
                ),
                "market_cap": overview.get("market_cap"),
                "daily_close_change": valuation.get("daily_close_change"),
            }
        )

    return summaries
