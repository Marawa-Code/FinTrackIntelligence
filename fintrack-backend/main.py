from datetime import date
from threading import Lock
from time import monotonic

import requests
from fastapi import FastAPI, HTTPException

from config import SECTORS_API_KEY

app = FastAPI(title="FinTrack Intelligence API")
SECTORS_API_BASE_URL = "https://api.sectors.app/v2"
BANK_SYMBOLS = ("BBCA", "BBRI", "BMRI", "BBNI")
CACHE_TTL_SECONDS = 5 * 60
_cache: dict[str, tuple[float, list[dict[str, object]]]] = {}
_cache_lock = Lock()


def _get_cached(key: str) -> list[dict[str, object]] | None:
    with _cache_lock:
        entry = _cache.get(key)
        if entry is None:
            return None

        expires_at, value = entry
        if monotonic() >= expires_at:
            del _cache[key]
            return None

        return value


def _set_cached(key: str, value: list[dict[str, object]]) -> None:
    with _cache_lock:
        _cache[key] = (monotonic() + CACHE_TTL_SECONDS, value)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/banks/summary")
def get_banks_summary() -> list[dict[str, object]]:
    cached = _get_cached("banks:summary")
    if cached is not None:
        return cached

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
                "symbol": symbol,
                "company_name": report.get("company_name"),
                "last_close_price": overview.get(
                    "last_close_price", valuation.get("last_close_price")
                ),
                "market_cap": overview.get("market_cap"),
                "daily_close_change": valuation.get("daily_close_change"),
            }
        )

    _set_cached("banks:summary", summaries)
    return summaries


@app.get("/api/banks/{symbol}/history")
def get_bank_history(symbol: str, start: date, end: date) -> list[dict[str, object]]:
    normalized_symbol = symbol.upper().removesuffix(".JK")
    if normalized_symbol not in BANK_SYMBOLS:
        raise HTTPException(status_code=404, detail="Simbol bank tidak didukung.")
    if start > end:
        raise HTTPException(
            status_code=422,
            detail="Tanggal start harus lebih awal atau sama dengan end.",
        )
    cache_key = f"banks:history:{normalized_symbol}:{start.isoformat()}:{end.isoformat()}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    if not SECTORS_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="SECTORS_API_KEY belum dikonfigurasi di file .env.",
        )

    url = f"{SECTORS_API_BASE_URL}/daily/{normalized_symbol}/"
    try:
        response = requests.get(
            url,
            headers={"Authorization": SECTORS_API_KEY},
            params={"start": start.isoformat(), "end": end.isoformat()},
            timeout=15,
        )
        response.raise_for_status()
        records = response.json()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gagal mengambil histori Sectors untuk {normalized_symbol}.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="Sectors mengembalikan JSON histori yang tidak valid.",
        ) from exc

    if not isinstance(records, list):
        raise HTTPException(
            status_code=502,
            detail="Format data histori dari Sectors tidak sesuai.",
        )

    fields = ("date", "open", "high", "low", "close", "volume")
    history = [
        {field: record.get(field) for field in fields}
        for record in records
        if isinstance(record, dict)
    ]
    _set_cached(cache_key, history)
    return history


@app.get("/api/banks/ranking")
def get_banks_ranking() -> list[dict[str, object]]:
    cached = _get_cached("banks:ranking")
    if cached is not None:
        return cached

    summaries = get_banks_summary()
    ordered = sorted(
        summaries,
        key=lambda bank: (
            bank["daily_close_change"] is not None,
            bank["daily_close_change"] or 0,
        ),
        reverse=True,
    )
    ranking = [
        {
            "rank": rank,
            "symbol": bank["symbol"],
            "daily_close_change": bank["daily_close_change"],
        }
        for rank, bank in enumerate(ordered, start=1)
    ]
    _set_cached("banks:ranking", ranking)
    return ranking
