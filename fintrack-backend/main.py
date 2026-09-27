import math
import statistics
from datetime import date, timedelta
from threading import Lock
from time import monotonic

import requests
from fastapi import FastAPI, HTTPException

from config import SECTORS_API_KEY

app = FastAPI(title="FinTrack Intelligence API")
SECTORS_API_BASE_URL = "https://api.sectors.app/v2"
BANK_SYMBOLS = ("BBCA", "BBRI", "BMRI", "BBNI")

CACHE_TTL_SECONDS = 5 * 60
# Harga terakhir perlu segar, tapi OHLC harian hanya berubah sekali per hari
# bursa. Cache histori dibuat lebih panjang supaya kredit Sectors tidak
# terbuang saat pengguna membuka-tutup layar (PRD bagian Constraints).
HISTORY_CACHE_TTL_SECONDS = 60 * 60

# Jendela analisis untuk skor komposit dan deteksi anomali. 70 hari kalender
# dipilih supaya selalu tersedia >= 30 hari bursa untuk MA30 dan z-score.
INTELLIGENCE_WINDOW_DAYS = 70
MIN_CLOSES_FOR_SCORE = 30
ANOMALY_Z_THRESHOLD = 2.0
VOLUME_SPIKE_RATIO = 2.0
# Jumlah hari bursa yang dipakai sebagai pembanding saat menghitung z-score
# sebuah hari, dan berapa banyak temuan anomali yang dikirim ke aplikasi.
ANOMALY_LOOKBACK_DAYS = 30
ANOMALY_HISTORY_LIMIT = 5
# Satu simpangan baku antar peer bernilai 25 poin pada skala 0-100, sehingga
# skor 50 berarti persis rata-rata keempat bank.
PEER_SCORE_SIGMA = 25.0

# Bobot skor komposit. Skor sengaja bersifat relatif antar bank dalam
# subsektor yang sama, sesuai PRD: "skor relatif antar perusahaan dalam
# 1 subsektor".
SCORE_WEIGHTS = {
    "momentum": 0.30,
    "trend": 0.30,
    "stability": 0.20,
    "ma_position": 0.20,
}

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


def _set_cached(
    key: str, value: list[dict[str, object]], ttl_seconds: int = CACHE_TTL_SECONDS
) -> None:
    with _cache_lock:
        _cache[key] = (monotonic() + ttl_seconds, value)


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


def _fetch_history(symbol: str, start: date, end: date) -> list[dict[str, object]]:
    """Ambil OHLC harian dari Sectors, dengan cache per simbol dan rentang."""
    cache_key = f"banks:history:{symbol}:{start.isoformat()}:{end.isoformat()}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    if not SECTORS_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="SECTORS_API_KEY belum dikonfigurasi di file .env.",
        )

    url = f"{SECTORS_API_BASE_URL}/daily/{symbol}/"
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
            detail=f"Gagal mengambil histori Sectors untuk {symbol}.",
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
    _set_cached(cache_key, history, HISTORY_CACHE_TTL_SECONDS)
    return history


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

    return _fetch_history(normalized_symbol, start, end)


@app.get("/api/banks/ranking")
def get_banks_ranking() -> list[dict[str, object]]:
    """Peringkat harian sederhana berdasarkan perubahan harga penutupan."""
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


def _to_float(value: object) -> float | None:
    """Ubah nilai apa pun dari JSON menjadi float, atau None bila tidak valid."""
    if isinstance(value, bool):
        return None
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _numeric_series(history: list[dict[str, object]], field: str) -> list[float]:
    values = []
    for record in history:
        number = _to_float(record.get(field))
        if number is not None:
            values.append(number)
    return values


def _moving_average(values: list[float], window: int) -> float | None:
    if len(values) < window:
        return None
    return sum(values[-window:]) / window


def _daily_returns(closes: list[float]) -> list[float]:
    returns = []
    for previous, current in zip(closes, closes[1:]):
        if previous:
            returns.append((current - previous) / previous)
    return returns


def _returns_with_dates(
    history: list[dict[str, object]],
) -> list[tuple[str, float]]:
    """Pasangan (tanggal, return harian) secara berurutan.

    Hari tanpa harga valid dilewati, tapi harga valid terakhir tetap dipakai
    sebagai pembanding hari berikutnya supaya tidak muncul lompatan palsu.
    """
    pairs: list[tuple[str, float]] = []
    previous: float | None = None
    for record in history:
        current = _to_float(record.get("close"))
        if current is None:
            continue
        if previous:
            pairs.append((str(record.get("date")), (current - previous) / previous))
        previous = current
    return pairs


def _find_anomaly_history(
    returns_with_dates: list[tuple[str, float]],
) -> list[dict[str, object]]:
    """Cari semua hari dengan lonjakan harga tidak wajar sepanjang jendela.

    Tiap hari dibandingkan dengan ANOMALY_LOOKBACK_DAYS hari sebelumnya, bukan
    hanya hari terakhir, supaya lonjakan tidak wajar yang terjadi beberapa hari
    lalu tetap terdeteksi dan bisa ditampilkan di aplikasi.
    """
    found: list[dict[str, object]] = []

    for index in range(ANOMALY_LOOKBACK_DAYS, len(returns_with_dates)):
        window = returns_with_dates[index - ANOMALY_LOOKBACK_DAYS : index]
        baseline = [value for _, value in window]
        sigma = statistics.pstdev(baseline)
        if sigma == 0:
            continue

        date_value, current = returns_with_dates[index]
        z_score = (current - statistics.fmean(baseline)) / sigma
        if abs(z_score) >= ANOMALY_Z_THRESHOLD:
            found.append(
                {
                    "date": date_value,
                    "z_score": round(z_score, 2),
                    "direction": "naik" if current >= 0 else "turun",
                    "change": round(current, 4),
                }
            )

    # Terbaru lebih dulu, lalu dibatasi agar payload tetap ringkas.
    found.reverse()
    return found[:ANOMALY_HISTORY_LIMIT]


def _peer_score(raw: dict[str, float | None]) -> dict[str, float | None]:
    """Ubah nilai mentah jadi skor relatif 0-100 terhadap rata-rata peer.

    Skor 50 berarti persis rata-rata keempat bank. Memakai z-score, bukan
    normalisasi min-max: min-max selalu memberi 100 ke bank terbaik dan 0 ke
    terburuk walau selisih aslinya sangat kecil, sehingga komponen seperti
    "posisi MA" bisa tampak 100 padahal harga bank itu ada di bawah MA-nya.

    Untuk n = 4, |z| maksimum yang mungkin adalah akar(n - 1) = 1,73 sehingga
    skor berada di kisaran 7-93 dan penjepitan 0/100 praktis tidak pernah kena.
    """
    present = [value for value in raw.values() if value is not None]
    if not present:
        return {symbol: None for symbol in raw}

    mean = statistics.fmean(present)
    sigma = statistics.pstdev(present)
    if math.isclose(sigma, 0.0):
        return {symbol: (None if value is None else 50.0) for symbol, value in raw.items()}

    return {
        symbol: (
            None
            if value is None
            else round(
                max(0.0, min(100.0, 50.0 + PEER_SCORE_SIGMA * (value - mean) / sigma)), 1
            )
        )
        for symbol, value in raw.items()
    }


def _detect_price_anomaly(returns: list[float]) -> dict[str, object]:
    """Deteksi lonjakan harga tidak wajar lewat z-score perubahan harian.

    Perubahan terakhir dibandingkan dengan sebaran perubahan sebelumnya pada
    jendela analisis. Ambang |z| >= 2 dipakai sebagai penanda anomali.
    """
    if len(returns) < MIN_CLOSES_FOR_SCORE:
        return {
            "is_anomaly": False,
            "z_score": None,
            "direction": None,
            "reason": "data historis belum cukup",
        }

    latest, baseline = returns[-1], returns[:-1]
    sigma = statistics.pstdev(baseline)
    if sigma == 0:
        return {
            "is_anomaly": False,
            "z_score": 0.0,
            "direction": None,
            "reason": "volatilitas nol",
        }

    z_score = (latest - statistics.fmean(baseline)) / sigma
    return {
        "is_anomaly": abs(z_score) >= ANOMALY_Z_THRESHOLD,
        "z_score": round(z_score, 2),
        "direction": "naik" if latest >= 0 else "turun",
        "threshold": ANOMALY_Z_THRESHOLD,
    }


def _detect_volume_spike(volumes: list[float]) -> dict[str, object]:
    if len(volumes) < MIN_CLOSES_FOR_SCORE:
        return {"is_spike": False, "ratio": None}

    latest = volumes[-1]
    average = statistics.fmean(volumes[:-1])
    if average == 0:
        return {"is_spike": False, "ratio": None}

    ratio = latest / average
    return {"is_spike": ratio >= VOLUME_SPIKE_RATIO, "ratio": round(ratio, 2)}


def _load_market_window(
    symbol: str, end: date
) -> tuple[list[float], list[float], list[tuple[str, float]]]:
    """Ambil deret close, volume, dan return bertanggal untuk jendela analisis.

    Jendela 70 hari kalender biasanya menyisakan lebih dari 30 hari bursa,
    tapi periode libur panjang bisa membuatnya kurang dari itu. Bila terjadi,
    jendela dilebarkan sampai tiga kali lipat sebelum menyerah.
    """
    closes: list[float] = []
    volumes: list[float] = []
    returns_with_dates: list[tuple[str, float]] = []

    for window in (INTELLIGENCE_WINDOW_DAYS, INTELLIGENCE_WINDOW_DAYS * 3):
        history = _fetch_history(symbol, end - timedelta(days=window), end)
        closes = _numeric_series(history, "close")
        volumes = _numeric_series(history, "volume")
        returns_with_dates = _returns_with_dates(history)
        if len(closes) > MIN_CLOSES_FOR_SCORE:
            break

    return closes, volumes, returns_with_dates


def _score_label(score: float | None) -> str:
    """Label yang jujur menyatakan skor ini perbandingan, bukan penilaian mutlak.

    Bank bisa berada "di atas rata-rata" peer-nya walaupun harganya sedang
    turun, karena keempat bank turun bersama.
    """
    if score is None:
        return "Data belum cukup"
    if score >= 65:
        return "Jauh di atas rata-rata"
    if score >= 55:
        return "Di atas rata-rata"
    if score >= 45:
        return "Sekitar rata-rata"
    return "Di bawah rata-rata"


def _build_signals(
    metrics: dict[str, object],
    anomaly: dict[str, object],
    volume_spike: dict[str, object],
) -> list[str]:
    signals = []

    if anomaly.get("is_anomaly"):
        signals.append(
            f"Lonjakan {anomaly.get('direction')} tidak wajar "
            f"(z-score {anomaly.get('z_score')})"
        )

    if volume_spike.get("is_spike"):
        signals.append(f"Volume {volume_spike.get('ratio')}x rata-rata")

    last_close = metrics.get("last_close")
    ma30 = metrics.get("ma30")
    if last_close is not None and ma30 is not None:
        signals.append("Harga di atas MA30" if last_close > ma30 else "Harga di bawah MA30")

    trend = metrics.get("trend")
    sessions = metrics.get("sessions")
    if trend is not None and sessions:
        signals.append(
            f"Tren {sessions} hari bursa {'+' if trend >= 0 else ''}"
            f"{trend * 100:.2f}%"
        )

    return signals


@app.get("/api/banks/intelligence")
def get_banks_intelligence() -> list[dict[str, object]]:
    """Skor komposit, peringkat, dan sinyal anomali untuk empat bank.

    Semua angka di sini adalah turunan dari data Sectors (bukan data mentah):
    MA7/MA30, return jendela analisis, volatilitas, z-score lonjakan harga,
    riwayat anomali, dan skor relatif 0-100 antar bank dalam subsektor yang
    sama.

    Perlu ditegaskan: skornya bersifat RELATIF. Bank bisa berlabel "di atas
    rata-rata" walaupun harganya sedang turun, kalau ketiga pesaingnya turun
    lebih dalam. Nilai mentah (trend, MA7/MA30, sinyal) disertakan supaya
    gambaran mutlaknya tetap terbaca.
    """
    cached = _get_cached("banks:intelligence")
    if cached is not None:
        return cached

    summaries = {bank["symbol"]: bank for bank in get_banks_summary()}

    end = date.today()

    metrics: dict[str, dict[str, object]] = {}
    anomalies: dict[str, dict[str, object]] = {}
    volume_spikes: dict[str, dict[str, object]] = {}
    anomaly_histories: dict[str, list[dict[str, object]]] = {}

    for symbol in BANK_SYMBOLS:
        closes, volumes, dated_returns = _load_market_window(symbol, end)
        returns = _daily_returns(closes)

        ma7 = _moving_average(closes, 7)
        ma30 = _moving_average(closes, 30)
        last_close = closes[-1] if closes else None

        trend = None
        if len(closes) >= 2 and closes[0]:
            trend = (closes[-1] - closes[0]) / closes[0]

        volatility = statistics.pstdev(returns) if len(returns) >= 2 else None

        ma_position = None
        if last_close is not None:
            offsets = [
                last_close / average - 1 for average in (ma7, ma30) if average
            ]
            if offsets:
                ma_position = statistics.fmean(offsets)

        change = _to_float((summaries.get(symbol) or {}).get("daily_close_change"))
        momentum = change if change is not None else (returns[-1] if returns else None)

        metrics[symbol] = {
            "last_close": last_close,
            "ma7": ma7,
            "ma30": ma30,
            "trend": trend,
            "volatility": volatility,
            "ma_position": ma_position,
            "momentum": momentum,
            "sessions": len(closes),
        }
        anomalies[symbol] = _detect_price_anomaly(returns)
        volume_spikes[symbol] = _detect_volume_spike(volumes)
        anomaly_histories[symbol] = _find_anomaly_history(dated_returns)

    # Momentum dan tren: makin besar makin baik.
    # Stabilitas: volatilitas dibalik supaya makin tenang makin tinggi.
    momentum_score = _peer_score(
        {symbol: metrics[symbol]["momentum"] for symbol in BANK_SYMBOLS}
    )
    trend_score = _peer_score(
        {symbol: metrics[symbol]["trend"] for symbol in BANK_SYMBOLS}
    )
    stability_score = _peer_score(
        {
            symbol: (
                None
                if metrics[symbol]["volatility"] is None
                else -metrics[symbol]["volatility"]
            )
            for symbol in BANK_SYMBOLS
        }
    )
    ma_score = _peer_score(
        {symbol: metrics[symbol]["ma_position"] for symbol in BANK_SYMBOLS}
    )

    results = []
    for symbol in BANK_SYMBOLS:
        summary = summaries.get(symbol) or {}
        components = {
            "momentum": momentum_score[symbol],
            "trend": trend_score[symbol],
            "stability": stability_score[symbol],
            "ma_position": ma_score[symbol],
        }

        if all(value is not None for value in components.values()):
            score = round(
                sum(
                    SCORE_WEIGHTS[name] * value  # type: ignore[operator]
                    for name, value in components.items()
                ),
                1,
            )
        else:
            score = None

        anomaly = anomalies[symbol]
        volume_spike = volume_spikes[symbol]

        results.append(
            {
                "symbol": symbol,
                "company_name": summary.get("company_name"),
                "score": score,
                "score_label": _score_label(score),
                "components": dict(components),
                "daily_close_change": summary.get("daily_close_change"),
                "last_close_price": summary.get("last_close_price"),
                "market_cap": summary.get("market_cap"),
                "ma7": (
                    None
                    if metrics[symbol]["ma7"] is None
                    else round(metrics[symbol]["ma7"], 2)  # type: ignore[arg-type]
                ),
                "ma30": (
                    None
                    if metrics[symbol]["ma30"] is None
                    else round(metrics[symbol]["ma30"], 2)  # type: ignore[arg-type]
                ),
                # Jarak harga ke MA rata-rata, dipakai mentah oleh aplikasi
                # supaya skor komponen "Posisi MA" bisa dibaca berdampingan
                # dengan angka sebenarnya. Dinamai ma_gap, bukan ma_position,
                # agar tidak tertukar dengan skor komponennya.
                "ma_gap": (
                    None
                    if metrics[symbol]["ma_position"] is None
                    else round(metrics[symbol]["ma_position"], 4)  # type: ignore[arg-type]
                ),
                "trend": (
                    None
                    if metrics[symbol]["trend"] is None
                    else round(metrics[symbol]["trend"], 4)  # type: ignore[arg-type]
                ),
                "volatility": (
                    None
                    if metrics[symbol]["volatility"] is None
                    else round(metrics[symbol]["volatility"], 4)  # type: ignore[arg-type]
                ),
                "anomaly": anomaly,
                "anomaly_history": anomaly_histories[symbol],
                "volume_spike": volume_spike,
                "signals": _build_signals(metrics[symbol], anomaly, volume_spike),
                "sessions": metrics[symbol]["sessions"],
            }
        )

    ordered = sorted(
        results,
        key=lambda bank: (
            bank["score"] is not None,
            bank["score"] or 0,
        ),
        reverse=True,
    )
    intelligence = [
        {"rank": rank, **bank} for rank, bank in enumerate(ordered, start=1)
    ]

    _set_cached("banks:intelligence", intelligence)
    return intelligence
