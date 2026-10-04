import json
import math
import statistics
from datetime import date, timedelta
from threading import Lock
from time import monotonic
from typing import Any

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import CORS_ALLOWED_ORIGINS, OPENROUTER_API_KEY, SECTORS_API_KEY

app = FastAPI(title="FinTrack Intelligence API")

# Aplikasi mobile tidak butuh CORS — React Native bukan browser. Tapi demo
# lewat `expo start --web` berjalan di browser dan seluruh fetch-nya akan
# diblokir tanpa middleware ini. Backend hanya menyajikan data pasar publik,
# tanpa cookie maupun kredensial, jadi origin dibuka lebar secara sadar
# (allow_credentials dibiarkan False, syarat wajib bila origin "*").
#
# POST ikut didaftarkan karena endpoint /api/chat menerima pertanyaan lewat
# badan permintaan. Tanpa itu, demo di browser gagal pada preflight walaupun
# endpointnya sendiri sehat.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

SECTORS_API_BASE_URL = "https://api.sectors.app/v2"
# Lima bank terbesar menurut kapitalisasi pasar di subsektor perbankan.
#
# Urutannya sudah diperiksa langsung ke screener Sectors (order_by=-market_cap)
# dan cocok dengan papan `top_mcap` pada laporan subsektor.
#
# Daftar ini dipatok manual, bukan diambil saat berjalan, karena seluruh
# aplikasi bergantung padanya: kalau pengambilan daftarnya gagal, tidak ada
# satu bank pun yang bisa ditampilkan. Yang perlu diketahui sebelum menambah
# anggota: tiap bank di sini menaikkan pemakaian kredit Sectors sekitar 4 per
# putaran penuh, karena ringkasan harga, histori skor, histori tren skor, dan
# histori grafik masing-masing punya rentang tanggal dan masa cache sendiri —
# tidak ada yang bisa menumpang yang lain. Bank di luar daftar ini tidak
# memakan kredit apa pun selama hanya ditampilkan sebagai nama.
BANK_SYMBOLS = ("BBCA", "BBRI", "BMRI", "BBNI", "BNLI")

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
# Deteksi anomali butuh ANOMALY_LOOKBACK_DAYS return sebagai baseline ditambah
# satu hari yang dinilai, jadi minimal ANOMALY_LOOKBACK_DAYS + 2 harga close.
# Ambang inilah yang mengikat saat jendela dianalisis, bukan
# MIN_CLOSES_FOR_SCORE: tanpa ini, jendela berhenti melebar di 31 close padahal
# anomali masih menyerah dengan alasan "data historis belum cukup".
MIN_CLOSES_FOR_ANOMALY = ANOMALY_LOOKBACK_DAYS + 2
# Jarak satu simpangan baku antar peer pada skala 0-100. Angkanya dipilih
# supaya skor tertinggi yang mungkin tetap 93,3 — batas yang sama seperti waktu
# kelompoknya masih empat bank.
#
# Sebabnya z-score terhadap sampel kecil terikat oleh akar(n - 1), sehingga
# batas atas skor ikut bergeser tiap kali jumlah bank pantauan berubah. Kalau
# simpangannya dipatok 25 seperti waktu kelompoknya empat bank, lima bank akan
# mendorong skor maksimum ke 50 + 25 * akar(4) = 100 — tepat menyentuh
# penjepitan yang justru dihindari dengan memilih z-score ketimbang min-max,
# dan skor puncak jadi bertumpuk di 100 tanpa lagi membedakan apa pun.
#
# Jadi simpangannya diturunkan dari jumlah anggotanya, bukan ditulis tetap.
# Untuk empat bank hasilnya persis 25,0 seperti sebelumnya; untuk lima bank
# jadi 21,65.
SCORE_PEER_MAX_SPREAD = 25.0 * math.sqrt(3.0)
PEER_SCORE_SIGMA = SCORE_PEER_MAX_SPREAD / math.sqrt(len(BANK_SYMBOLS) - 1)

# Bobot skor komposit. Skor sengaja bersifat relatif, sesuai PRD: "skor relatif
# antar perusahaan dalam 1 subsektor".
#
# Yang perlu diluruskan: kelompok pembandingnya bukan seluruh 48 bank
# subsektor, melainkan BANK_SYMBOLS saja. Subsektor ini terlalu lebar untuk
# dibandingkan penuh — bank kecil dengan kapitalisasi sepersekian persen
# kelompoknya akan menyeret rata-rata dan membuat skor bank besar selalu
# tampak istimewa tanpa alasan. Karena itu skor HANYA ada untuk bank pantauan,
# dan itu sebabnya bank di luar daftar tidak bisa diberi skor apa pun, bukan
# sekadar belum dihitung.
SCORE_WEIGHTS = {
    "momentum": 0.30,
    "trend": 0.30,
    "stability": 0.20,
    "ma_position": 0.20,
}

# Cache menyimpan dua bentuk: daftar bank (ringkasan, peringkat, histori) dan
# satu objek laporan subsektor. Karena itu isinya bertipe Any, bukan daftar.
_cache: dict[str, tuple[float, Any]] = {}
_cache_lock = Lock()

# Kunci cache histori memuat rentang tanggal, jadi tiap rentang baru yang
# diminta aplikasi menghasilkan kunci baru yang tidak akan pernah dibaca lagi.
# Tanpa batas, cache tumbuh terus selama proses hidup. Batas ini jauh di atas
# kebutuhan demo, jadi normalnya tidak pernah tersentuh.
_MAX_CACHE_ENTRIES = 256


def _get_cached(key: str) -> Any:
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
    key: str, value: Any, ttl_seconds: int = CACHE_TTL_SECONDS
) -> None:
    with _cache_lock:
        if len(_cache) >= _MAX_CACHE_ENTRIES:
            now = monotonic()
            for stale in [
                k for k, (expires_at, _) in _cache.items() if expires_at <= now
            ]:
                del _cache[stale]

            # Kalau masih penuh, buang yang paling lama disimpan. Dict menjaga
            # urutan penyisipan, jadi kunci paling awal adalah yang paling tua.
            while len(_cache) >= _MAX_CACHE_ENTRIES:
                del _cache[next(iter(_cache))]

        _cache[key] = (monotonic() + ttl_seconds, value)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


def _ringkas_galat_sectors(exc: Exception) -> str:
    """Alasan penolakan Sectors, sesingkat yang masih berguna.

    Tanpa ini, semua kegagalan Sectors tampil sebagai satu kalimat yang sama,
    dan kalimat itu tidak membedakan tiga hal yang penanganannya jauh berbeda:
    kredit habis (429), kunci salah (401/403), dan jaringan putus. Ketiganya
    pernah terjadi di proyek ini, dan ketiganya butuh tindakan yang berbeda.

    Statusnya diambil dari `exc.response`, bukan lewat `requests.HTTPError`,
    karena bentuk itu mengikat kode ini pada modul `requests` yang di pengujian
    diganti tiruan — cabangnya jadi tidak pernah benar-benar teruji.

    Badan jawabannya dipotong: sebagian pesan penolakan panjang, dan yang
    dibutuhkan hanya kalimat pertamanya. Kunci API tidak pernah ikut ke sini,
    karena ia dikirim sebagai header, bukan bagian dari badan jawaban.
    """
    respons = getattr(exc, "response", None)
    if respons is None:
        return f"{type(exc).__name__}: {exc}"

    # Dibaca lewat getattr supaya respons tiruan di pengujian yang tidak punya
    # atribut ini tidak berubah dari galat 502 menjadi galat 500.
    status = getattr(respons, "status_code", "?")
    potongan = str(getattr(respons, "text", "") or "").strip().replace("\n", " ")[:160]
    return f"HTTP {status} {potongan}".strip()


def _first_present(*values: object) -> object:
    """Nilai pertama yang bukan None, atau None bila semuanya kosong.

    Dipakai untuk field yang bisa muncul di lebih dari satu bagian respons
    Sectors. `dict.get(kunci, cadangan)` tidak cukup untuk itu: argumen
    cadangan hanya dipakai kalau kuncinya tidak ada sama sekali, sedangkan
    Sectors juga bisa mengirim kuncinya dengan nilai null. Akibatnya harga
    tampil kosong walaupun nilainya tersedia di bagian lain.
    """
    for value in values:
        if value is not None:
            return value
    return None


def _fetch_summary(symbol: str) -> dict[str, object]:
    """Ringkasan satu bank dari Sectors, dengan cache per simbol.

    Dipecah keluar dari get_banks_summary supaya bank yang BUKAN bank pantauan
    bisa diambil sendiri saat diminta — itulah yang membuat adu dua bank
    sembarang hanya menarik data dua bank, bukan seluruh subsektor.

    Galat sengaja dibiarkan naik apa adanya. Pemanggilnya yang tahu apakah satu
    bank yang gagal masih boleh dilewati diam-diam (daftar beranda, yang lebih
    baik menampilkan sebagian daripada kosong) atau harus dilaporkan ke
    pengguna (halaman satu bank, yang tidak ada gunanya tanpa bank itu).
    """
    cache_key = f"banks:summary:{symbol}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    response = requests.get(
        f"{SECTORS_API_BASE_URL}/company/report/{symbol}/",
        headers={"Authorization": SECTORS_API_KEY},
        params={"sections": "overview,valuation"},
        timeout=15,
    )
    response.raise_for_status()
    report = response.json()

    # Sectors bisa membalas daftar, bukan objek, dan `.get` di bawah akan
    # meledak jadi 500 yang tidak menjelaskan apa pun. Dijadikan ValueError
    # supaya tertangkap jalur galat yang sama dengan badan bukan-JSON.
    if not isinstance(report, dict):
        raise ValueError("Laporan perusahaan bukan objek.")

    overview = report.get("overview") or {}
    valuation = report.get("valuation") or {}
    summary = {
        "symbol": symbol,
        "company_name": report.get("company_name"),
        "last_close_price": _first_present(
            overview.get("last_close_price"), valuation.get("last_close_price")
        ),
        "market_cap": _first_present(
            overview.get("market_cap"), valuation.get("market_cap")
        ),
        # Perubahan harian dilaporkan di bagian valuation, tapi urutan
        # cadangannya dibalik terhadap dua field di atas supaya tidak
        # bergantung pada asumsi soal bagian mana yang benar.
        #
        # Satuannya pecahan, bukan persen: 0,004016 berarti naik 0,40%.
        # Sudah diverifikasi terhadap harga penutup pada data Sectors
        # yang sebenarnya, jadi JANGAN dikali 100 di sini. Kalau suatu
        # saat Sectors mengubah satuannya, gejalanya adalah angka di
        # aplikasi meleset 100 kali lipat.
        "daily_close_change": _first_present(
            valuation.get("daily_close_change"), overview.get("daily_close_change")
        ),
    }
    _set_cached(cache_key, summary)
    return summary


@app.get("/api/banks/summary")
def get_banks_summary() -> list[dict[str, object]]:
    """Ringkasan seluruh bank pantauan, urut sesuai BANK_SYMBOLS."""
    cached = _get_cached("banks:summary")
    if cached is not None:
        return cached

    if not SECTORS_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="SECTORS_API_KEY belum dikonfigurasi di file .env.",
        )

    summaries = []
    failed: list[str] = []

    for symbol in BANK_SYMBOLS:
        try:
            summaries.append(_fetch_summary(symbol))
        except (requests.RequestException, ValueError) as exc:
            # Satu simbol gagal tidak boleh mengosongkan seluruh dashboard.
            # Simbol yang berhasil tetap dikirim, dan hasilnya sengaja tidak
            # di-cache supaya percobaan berikutnya bisa melengkapi yang bolong.
            #
            # Sejak ringkasan disimpan per simbol juga, yang bolong di sini
            # tinggal bank yang memang gagal — bank yang berhasil tidak ikut
            # diambil ulang hanya karena satu bank lain gagal.
            print(f"[FinTrack] Gagal mengambil ringkasan {symbol}: {exc}")
            failed.append(symbol)

    if not summaries:
        raise HTTPException(
            status_code=502,
            detail="Gagal mengambil data Sectors untuk seluruh bank.",
        )

    if not failed:
        _set_cached("banks:summary", summaries)

    return summaries


# Berapa kali tanggal akhir boleh dimundurkan saat Sectors menolaknya sebagai
# "masih di masa depan". Satu hari menutup selisih zona waktu, dan tiga adalah
# batas yang jelas-jelas lebih dari cukup — kalau sampai tersentuh, penyebabnya
# bukan lagi zona waktu dan pesan galatnya yang asli justru lebih berguna.
_MAKS_MUNDUR_HARI = 3


def _sectors_menolak_tanggal_masa_depan(exc: Exception) -> bool:
    """Apakah Sectors menolak permintaan ini karena tanggal akhirnya belum tiba.

    Diperiksa dari status DAN isi badan jawabannya, tidak dari statusnya saja.
    400 dipakai Sectors untuk banyak hal, dan memundurkan tanggal pada galat
    yang sebenarnya soal lain hanya akan menutupi penyebab aslinya dengan
    percobaan yang tidak ada gunanya.
    """
    respons = getattr(exc, "response", None)
    if respons is None or getattr(respons, "status_code", None) != 400:
        return False
    return "future" in str(getattr(respons, "text", "") or "").lower()


def _fetch_history(symbol: str, start: date, end: date) -> list[dict[str, object]]:
    """Ambil OHLC harian dari Sectors, dengan cache per simbol dan rentang.

    Tanggal akhirnya dimundurkan lalu dicoba lagi bila Sectors menolaknya
    sebagai "masih di masa depan". Itu bukan kesalahan masukan: jam komputer
    bisa berada di depan jam Sectors, dan di Indonesia (UTC+7) selisih itu
    terjadi rutin setiap dini hari — tanggal lokal sudah berganti sementara
    Sectors masih di hari sebelumnya. Sebelum ini, seluruh analisis skor mati
    selama jendela itu karena tiap permintaan histori dijawab 400.

    Yang dipakai adalah percobaan ulang, bukan tanggal yang ditebak di muka,
    karena "hari ini" menurut Sectors tidak bisa diketahui dari sisi sini;
    menebaknya berarti salah tiap kali zona waktunya berbeda dari dugaan.
    """
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
    tanggal_akhir = end

    # Satu percobaan normal, lalu _MAKS_MUNDUR_HARI percobaan yang tanggalnya
    # dimundurkan sehari tiap kali.
    for sisa_mundur in range(_MAKS_MUNDUR_HARI + 1):
        try:
            response = requests.get(
                url,
                headers={"Authorization": SECTORS_API_KEY},
                params={"start": start.isoformat(), "end": tanggal_akhir.isoformat()},
                timeout=15,
            )
            response.raise_for_status()
            records = response.json()
            break
        except requests.RequestException as exc:
            if sisa_mundur < _MAKS_MUNDUR_HARI and _sectors_menolak_tanggal_masa_depan(exc):
                tanggal_akhir -= timedelta(days=1)
                continue
            raise HTTPException(
                status_code=502,
                detail=(
                    f"Gagal mengambil histori Sectors untuk {symbol}: "
                    f"{_ringkas_galat_sectors(exc)}"
                ),
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
    # Urutan dari Sectors tidak dijamin menaik, sedangkan MA, tren, dan return
    # di bawah semuanya mengasumsikan data terbaru ada di paling akhir. Kalau
    # asumsi itu meleset, MA7 diam-diam dihitung dari hari terlama dan tren
    # jadi terbalik tanpa satu pun error. Diurutkan sekali di sini.
    history.sort(key=lambda record: str(record.get("date") or ""))
    _set_cached(cache_key, history, HISTORY_CACHE_TTL_SECONDS)
    return history


# Kode saham di BEI selalu empat huruf. Bentuk inilah yang menjaga endpoint
# per simbol, bukan daftar bank pantauan: layar Adu memang harus bisa memuat
# bank mana pun dari 48 anggota subsektor, jadi daftar itu tidak lagi bisa
# dipakai sebagai penjaga. Yang tersisa adalah bentuknya — dan itu cukup,
# karena salah ketik maupun simbol karangan akan ditolak Sectors sendiri.
#
# Tanpa penjaga ini, setiap ketikan salah menjadi satu permintaan ke Sectors,
# dan itu kredit yang habis untuk simbol yang tidak pernah ada.
def _normalize_ticker(symbol: str) -> str:
    """Rapikan simbol jadi kode empat huruf, atau tolak sebagai 422."""
    normalized = symbol.upper().removesuffix(".JK")
    if len(normalized) != 4 or not normalized.isascii() or not normalized.isalpha():
        raise HTTPException(status_code=422, detail="Simbol saham tidak sah.")
    return normalized


@app.get("/api/banks/{symbol}/history")
def get_bank_history(symbol: str, start: date, end: date) -> list[dict[str, object]]:
    """Riwayat OHLC harian satu saham.

    Dulu endpoint ini menolak apa pun di luar bank pantauan. Sekarang tidak
    lagi, karena layar Adu mengadu dua bank sembarang dan bank di luar
    pantauan tetap punya harga — yang tidak dimilikinya hanya skor.
    """
    normalized_symbol = _normalize_ticker(symbol)
    if start > end:
        raise HTTPException(
            status_code=422,
            detail="Tanggal start harus lebih awal atau sama dengan end.",
        )

    return _fetch_history(normalized_symbol, start, end)


@app.get("/api/banks/{symbol}/profile")
def get_bank_profile(symbol: str) -> dict[str, object]:
    """Profil satu bank, dihitung saat diminta.

    Inilah yang membuat layar Adu bisa memuat bank mana pun dari 48 anggota
    subsektor tanpa memproses ke-48-nya di depan: satu panggilan hanya menyentuh
    bank yang benar-benar dipilih, dan bank yang tidak dipilih tidak pernah
    disentuh sama sekali.

    Biayanya dua kredit Sectors per bank — laporan ringkas dan riwayat harganya.
    Untuk bank pantauan ada satu tarikan tambahan, yaitu skor kompositnya, tapi
    itu biasanya sudah hangat karena layar utama memuatnya lebih dulu; dan
    justru itu sebabnya skor tidak dihitung di sini melainkan dibaca dari
    /api/banks/intelligence, supaya tidak ada dua rumus skor yang bisa
    berselisih.

    Skor komposit hanya ada untuk bank pantauan, dan itu bukan kekurangan yang
    bisa ditambal: skornya z-score terhadap kelompok pembandingnya, jadi bank
    di luar kelompok itu memang tidak punya skor. Bukan nol, melainkan tidak
    terdefinisi. Field `tracked` yang membedakannya, dan aplikasi menampilkan
    catatan alih-alih angka kosong.
    """
    normalized_symbol = _normalize_ticker(symbol)

    if not SECTORS_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="SECTORS_API_KEY belum dikonfigurasi di file .env.",
        )

    cache_key = f"banks:profile:{normalized_symbol}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        summary = _fetch_summary(normalized_symbol)
    except requests.RequestException as exc:
        # Sectors menjawab 404 untuk perusahaan yang memang tidak ada. Itu beda
        # dari jaringan yang sedang bermasalah, dan beda pula cara
        # mengatakannya kepada pengguna — yang satu salah ketik, yang satu
        # coba lagi nanti.
        #
        # Statusnya dibaca dari `exc.response`, bukan lewat `except
        # requests.HTTPError`: keduanya sama saja bagi permintaan sungguhan,
        # tapi bentuk kedua mengikat kode ini pada modul `requests` yang di
        # pengujian justru diganti tiruan, sehingga cabangnya tidak pernah
        # benar-benar teruji.
        respons = getattr(exc, "response", None)
        if respons is not None and respons.status_code == 404:
            raise HTTPException(
                status_code=404, detail="Simbol saham tidak dikenal."
            ) from exc
        raise HTTPException(
            status_code=502,
            detail=(
                f"Ringkasan {normalized_symbol} belum dapat diambil dari Sectors: "
                f"{_ringkas_galat_sectors(exc)}"
            ),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Ringkasan {normalized_symbol} belum dapat diambil dari Sectors.",
        ) from exc

    closes, volumes, dated_returns = _load_market_window(normalized_symbol, date.today())

    metrics = _compute_metrics(closes, _to_float(summary.get("daily_close_change")))
    anomaly = _detect_price_anomaly(_daily_returns(closes))
    volume_spike = _detect_volume_spike(volumes)

    tracked = normalized_symbol in BANK_SYMBOLS
    score: object = None
    score_label: object = None
    components: object = None
    if tracked:
        # Dibaca dari endpoint skor yang sudah ada, bukan dihitung ulang.
        try:
            for bank in get_banks_intelligence():
                if bank.get("symbol") == normalized_symbol:
                    score = bank.get("score")
                    score_label = bank.get("score_label")
                    components = bank.get("components")
                    break
        except HTTPException as exc:
            # Profilnya tetap berguna tanpa skor: harganya lengkap. Yang hilang
            # cuma satu angka, dan mengosongkan seluruh halaman karenanya akan
            # jauh lebih merugikan daripada menampilkannya tanpa skor.
            print(f"[FinTrack] Skor {normalized_symbol} tidak tersedia: {exc.detail}")

    profile = {
        "symbol": normalized_symbol,
        "company_name": summary.get("company_name"),
        "tracked": tracked,
        "score": score,
        "score_label": score_label,
        "components": components,
        "last_close_price": summary.get("last_close_price"),
        "market_cap": summary.get("market_cap"),
        "daily_close_change": summary.get("daily_close_change"),
        "ma7": _rounded(metrics["ma7"], 2),
        "ma30": _rounded(metrics["ma30"], 2),
        "ma_gap": _rounded(metrics["ma_position"], 4),
        "momentum": _rounded(metrics["momentum"], 4),
        "trend": _rounded(metrics["trend"], 4),
        "volatility": _rounded(metrics["volatility"], 4),
        "sessions": metrics["sessions"],
        "anomaly": anomaly,
        "anomaly_history": _find_anomaly_history(dated_returns),
        "volume_spike": volume_spike,
        "signals": _build_signals(metrics, anomaly, volume_spike),
    }

    # Hanya profil yang utuh yang ditahan. Kalau skornya gagal terbaca di atas,
    # hasilnya tetap disimpan supaya bank itu tidak diambil ulang berkali-kali
    # hanya karena satu angka yang mungkin sedang bermasalah di hulu.
    _set_cached(cache_key, profile)
    return profile


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
    # Sama seperti intelligence: ranking yang tidak lengkap tidak di-cache,
    # supaya bank yang sempat gagal diambil tetap dicoba lagi pada permintaan
    # berikutnya dan tidak absen selama lima menit.
    if len(ranking) == len(BANK_SYMBOLS):
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


def _rounded(value: object, digits: int) -> float | None:
    """Bulatkan bila ada isinya, biarkan None apa adanya.

    `round(None, 2)` meledak, sedangkan hampir semua metrik turunan di sini
    boleh kosong — bank yang riwayatnya terlalu pendek tidak punya MA30.
    Pemeriksaan None yang tersebar di puluhan tempat pernah terlewat sekali,
    jadi sekarang dikumpulkan di satu fungsi.
    """
    number = _to_float(value)
    return None if number is None else round(number, digits)


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


def _anomaly_z_score(returns: list[float], index: int) -> float | None:
    """Z-score return pada `index` terhadap ANOMALY_LOOKBACK_DAYS hari sebelumnya.

    Satu-satunya tempat z-score anomali dihitung. Sebelumnya deteksi hari
    terakhir memakai seluruh jendela sebagai baseline sementara penelusuran
    riwayat memakai 30 hari, sehingga satu tanggal yang sama bisa tampil dengan
    dua z-score berbeda di layar. Mengembalikan None bila baseline belum cukup
    atau volatilitasnya nol.
    """
    if index < ANOMALY_LOOKBACK_DAYS:
        return None

    baseline = returns[index - ANOMALY_LOOKBACK_DAYS : index]
    sigma = statistics.pstdev(baseline)
    if sigma == 0:
        return None

    return (returns[index] - statistics.fmean(baseline)) / sigma


def _find_anomaly_history(
    returns_with_dates: list[tuple[str, float]],
) -> list[dict[str, object]]:
    """Cari semua hari dengan lonjakan harga tidak wajar sepanjang jendela.

    Tiap hari dibandingkan dengan ANOMALY_LOOKBACK_DAYS hari sebelumnya, bukan
    hanya hari terakhir, supaya lonjakan tidak wajar yang terjadi beberapa hari
    lalu tetap terdeteksi dan bisa ditampilkan di aplikasi.
    """
    found: list[dict[str, object]] = []
    returns = [value for _, value in returns_with_dates]

    for index in range(ANOMALY_LOOKBACK_DAYS, len(returns_with_dates)):
        z_score = _anomaly_z_score(returns, index)
        if z_score is None:
            continue

        date_value, current = returns_with_dates[index]
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

    Skor 50 berarti persis rata-rata kelompoknya. Memakai z-score, bukan
    normalisasi min-max: min-max selalu memberi 100 ke bank terbaik dan 0 ke
    terburuk walau selisih aslinya sangat kecil, sehingga komponen seperti
    "posisi MA" bisa tampak 100 padahal harga bank itu ada di bawah MA-nya.

    |z| maksimum yang mungkin adalah akar(n - 1), dan PEER_SCORE_SIGMA dipilih
    supaya z sebesar itu berhenti di 93,3 berapa pun jumlah anggotanya. Jadi
    penjepitan 0/100 praktis tidak pernah kena — tetapi hanya selama
    PEER_SCORE_SIGMA benar-benar ikut menyesuaikan saat anggotanya berubah.
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

    Perubahan terakhir dibandingkan dengan sebaran ANOMALY_LOOKBACK_DAYS hari
    sebelumnya — baseline yang sama dengan _find_anomaly_history, supaya hari
    terakhir tidak pernah dapat z-score berbeda antara kolom `anomaly` dan
    entri pertama `anomaly_history` yang ditampilkan berdampingan. Ambang
    |z| >= 2 dipakai sebagai penanda anomali.
    """
    if len(returns) <= ANOMALY_LOOKBACK_DAYS:
        return {
            "is_anomaly": False,
            "z_score": None,
            "direction": None,
            "reason": "data historis belum cukup",
        }

    z_score = _anomaly_z_score(returns, len(returns) - 1)
    if z_score is None:
        return {
            "is_anomaly": False,
            "z_score": 0.0,
            "direction": None,
            "reason": "volatilitas nol",
        }

    return {
        "is_anomaly": abs(z_score) >= ANOMALY_Z_THRESHOLD,
        "z_score": round(z_score, 2),
        "direction": "naik" if returns[-1] >= 0 else "turun",
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
    jendela dilebarkan sampai tiga kali lipat sebelum menyerah. Ambang
    berhentinya memakai MIN_CLOSES_FOR_ANOMALY supaya jendela tidak berhenti
    di titik di mana deteksi anomali masih menganggap datanya kurang.
    """
    closes: list[float] = []
    volumes: list[float] = []
    returns_with_dates: list[tuple[str, float]] = []

    for window in (INTELLIGENCE_WINDOW_DAYS, INTELLIGENCE_WINDOW_DAYS * 3):
        history = _fetch_history(symbol, end - timedelta(days=window), end)
        closes = _numeric_series(history, "close")
        volumes = _numeric_series(history, "volume")
        returns_with_dates = _returns_with_dates(history)
        if len(closes) >= MIN_CLOSES_FOR_ANOMALY:
            break

    return closes, volumes, returns_with_dates


def _compute_metrics(closes: list[float], change: float | None) -> dict[str, object]:
    """Metrik turunan dari satu deret harga penutup.

    Dipakai dua tempat: skor hari ini di /api/banks/intelligence dan tiap titik
    tanggal di /api/banks/score-trend.

    `change` adalah perubahan harian dari ringkasan Sectors. Ia hanya tersedia
    untuk hari ini, jadi pemanggil yang menghitung hari-hari lampau
    mengirimnya None dan momentum jatuh ke return hari terakhir di jendela itu.
    """
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
        offsets = [last_close / average - 1 for average in (ma7, ma30) if average]
        if offsets:
            ma_position = statistics.fmean(offsets)

    momentum = change if change is not None else (returns[-1] if returns else None)

    return {
        "last_close": last_close,
        "ma7": ma7,
        "ma30": ma30,
        "trend": trend,
        "volatility": volatility,
        "ma_position": ma_position,
        "momentum": momentum,
        "sessions": len(closes),
    }


def _composite_scores(
    metrics_by_symbol: dict[str, dict[str, object]],
) -> tuple[dict[str, float | None], dict[str, dict[str, float | None]]]:
    """Skor empat komponen dan skor kompositnya untuk sekelompok bank.

    Mengembalikan dua peta: skor komposit per simbol, dan skor keempat komponen
    per simbol.

    Satu-satunya tempat komposit dihitung. Skor bergerak sengaja memakai fungsi
    ini alih-alih menyalin rumusnya, karena salinan yang terpisah bisa diam-diam
    berselisih dengan angka besar di layar setelah salah satunya diubah.

    Momentum dan tren: makin besar makin baik. Stabilitas: volatilitas dibalik
    supaya makin tenang makin tinggi.
    """
    symbols = list(metrics_by_symbol)

    momentum_score = _peer_score(
        {symbol: metrics_by_symbol[symbol]["momentum"] for symbol in symbols}  # type: ignore[dict-item]
    )
    trend_score = _peer_score(
        {symbol: metrics_by_symbol[symbol]["trend"] for symbol in symbols}  # type: ignore[dict-item]
    )
    stability_score = _peer_score(
        {
            symbol: (
                None
                if metrics_by_symbol[symbol]["volatility"] is None
                else -metrics_by_symbol[symbol]["volatility"]  # type: ignore[operator]
            )
            for symbol in symbols
        }
    )
    ma_score = _peer_score(
        {symbol: metrics_by_symbol[symbol]["ma_position"] for symbol in symbols}  # type: ignore[dict-item]
    )

    scores: dict[str, float | None] = {}
    components_by_symbol: dict[str, dict[str, float | None]] = {}

    for symbol in symbols:
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

        scores[symbol] = score
        components_by_symbol[symbol] = components

    return scores, components_by_symbol


def _score_label(score: float | None) -> str:
    """Label yang jujur menyatakan skor ini perbandingan, bukan penilaian mutlak.

    Bank bisa berada "di atas rata-rata" peer-nya walaupun harganya sedang
    turun, karena seluruh kelompoknya turun bersama.
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
        # Arah harga dan arah penyimpangan itu dua hal berbeda: di pasar yang
        # naik pelan, harga bisa tetap naik sementara z-score-nya negatif
        # karena kenaikannya jauh di bawah kebiasaan. Menyebutnya "lonjakan
        # naik" akan menyesatkan, jadi keduanya dinyatakan terpisah.
        signals.append(
            f"Pergerakan tidak wajar (z-score {anomaly.get('z_score')}), "
            f"harga {anomaly.get('direction')}"
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
    """Skor komposit, peringkat, dan sinyal anomali untuk bank pantauan.

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

    analysed: list[str] = []
    for symbol in BANK_SYMBOLS:
        try:
            closes, volumes, dated_returns = _load_market_window(symbol, end)
        except HTTPException as exc:
            # Satu simbol yang gagal (rate limit, jaringan, data kosong) tidak
            # boleh mengosongkan seluruh layar ranking. Bank yang datanya utuh
            # tetap dihitung; peer-nya ikut menyusut dan skor tetap relatif
            # terhadap bank yang tersisa.
            print(f"[FinTrack] Gagal menganalisis {symbol}: {exc.detail}")
            continue

        change = _to_float((summaries.get(symbol) or {}).get("daily_close_change"))
        metrics[symbol] = _compute_metrics(closes, change)
        anomalies[symbol] = _detect_price_anomaly(_daily_returns(closes))
        volume_spikes[symbol] = _detect_volume_spike(volumes)
        anomaly_histories[symbol] = _find_anomaly_history(dated_returns)
        analysed.append(symbol)

    if not analysed:
        raise HTTPException(
            status_code=502,
            detail="Gagal mengambil data historis untuk seluruh bank.",
        )

    skor, komponen_per_bank = _composite_scores(
        {symbol: metrics[symbol] for symbol in analysed}
    )

    results = []
    for symbol in analysed:
        summary = summaries.get(symbol) or {}
        components = komponen_per_bank[symbol]
        score = skor[symbol]

        anomaly = anomalies[symbol]
        volume_spike = volume_spikes[symbol]

        results.append(
            {
                "symbol": symbol,
                "company_name": summary.get("company_name"),
                "score": score,
                "score_label": _score_label(score),
                "components": components,
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
                # Nilai mentah yang benar-benar dipakai menghitung skor
                # momentum. Bisa berbeda dari daily_close_change: kalau field
                # itu kosong, momentum jatuh ke return hari terakhir. Aplikasi
                # menampilkan angka ini, bukan daily_close_change, supaya label
                # mentahnya tidak pernah berbeda dari yang mendasari skor.
                "momentum": (
                    None
                    if metrics[symbol]["momentum"] is None
                    else round(metrics[symbol]["momentum"], 4)  # type: ignore[arg-type]
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

    # Hasil sebagian tidak di-cache: kalau satu bank gagal karena rate limit
    # atau jaringan, percobaan berikutnya harus tetap mencoba melengkapinya
    # alih-alih menyajikan daftar bolong selama lima menit ke depan.
    if len(analysed) == len(BANK_SYMBOLS):
        _set_cached("banks:intelligence", intelligence)

    return intelligence


# Skor bergerak: skor hari-hari lampau dihitung ulang, bukan disimpan. Sectors
# tidak menyediakan skor historis, jadi tiap titik dihitung dari harga penutup
# pada jendela yang sama dengan skor hari ini (INTELLIGENCE_WINDOW_DAYS).
SCORE_TREND_DAYS = 60
SCORE_TREND_POINTS = 20
SCORE_TREND_CACHE_TTL_SECONDS = 60 * 60


def _dated_closes(history: list[dict[str, object]]) -> list[tuple[str, float]]:
    """Deret (tanggal, harga penutup) yang sudah urut menaik.

    Hari tanpa harga valid dilewati. Daftar ini yang dipotong per jendela saat
    menghitung skor tiap tanggal, jadi bentuknya sengaja tetap sederhana.
    """
    pairs: list[tuple[str, float]] = []
    for record in history:
        harga = _to_float(record.get("close"))
        if harga is None:
            continue
        pairs.append((str(record.get("date")), harga))
    return pairs


def _sample_dates(dates: list[date], count: int) -> list[date]:
    """Ambil `count` tanggal yang tersebar merata dari daftar yang sudah urut.

    Titik terakhir selalu ikut: tanpa itu, garis tren berhenti sebelum hari ini
    dan tidak bisa disambungkan ke angka besar di layar.
    """
    if len(dates) <= count:
        return list(dates)

    step = (len(dates) - 1) / (count - 1)
    picked = {dates[round(index * step)] for index in range(count)}
    return sorted(picked)


@app.get("/api/banks/score-trend")
def get_banks_score_trend() -> dict[str, object]:
    """Skor komposit bank pantauan pada beberapa tanggal terakhir.

    Inilah yang tidak bisa diberikan /api/banks/intelligence: endpoint itu
    hanya tahu skor hari ini. Skor bersifat relatif antar peer, jadi satu titik
    di sini berarti "bagaimana bank-bank ini dibandingkan satu sama lain pada
    tanggal itu" — bukan skor bank itu dibandingkan dengan dirinya di masa lalu.

    Biayanya satu permintaan Sectors per bank untuk rentang yang lebih lebar,
    sama banyaknya dengan /api/banks/intelligence. Hasilnya di-cache satu jam.
    """
    cached = _get_cached("banks:score-trend")
    if cached is not None:
        return cached

    end = date.today()
    # Jendela tertua yang dihitung berakhir SCORE_TREND_DAYS lalu, dan jendela
    # itu sendiri memerlukan INTELLIGENCE_WINDOW_DAYS hari ke belakang. Rentang
    # ambilnya harus mencakup keduanya, kalau tidak titik paling tua akan
    # dihitung dari harga yang tidak lengkap.
    start = end - timedelta(days=INTELLIGENCE_WINDOW_DAYS + SCORE_TREND_DAYS)
    batas_awal = (end - timedelta(days=SCORE_TREND_DAYS)).isoformat()

    series_per_bank: dict[str, list[tuple[str, float]]] = {}
    for symbol in BANK_SYMBOLS:
        try:
            history = _fetch_history(symbol, start, end)
        except HTTPException as exc:
            # Sama seperti intelligence: satu bank yang gagal tidak boleh
            # mengosongkan seluruh grafik.
            print(f"[FinTrack] Gagal mengambil riwayat {symbol} untuk skor bergerak: {exc.detail}")
            continue
        deret = _dated_closes(history)
        if deret:
            series_per_bank[symbol] = deret

    if len(series_per_bank) < 2:
        raise HTTPException(
            status_code=502,
            detail="Riwayat harga belum cukup untuk menyusun skor bergerak.",
        )

    # Sumbu tanggal bersama: hanya tanggal yang ada di seluruh bank yang berhasil
    # diambil. Skor ini perbandingan antar bank pada hari yang sama, jadi
    # tanggal yang cuma dimiliki sebagian bank tidak bisa dipakai.
    tanggal_bersama = set.intersection(
        *(set(t for t, _ in deret) for deret in series_per_bank.values())
    )

    # Dikonversi ke objek tanggal, bukan dibiarkan sebagai teks, supaya batas
    # jendela bisa dihitung dengan pengurangan hari. Tanggal yang tidak terbaca
    # dilewati alih-alih menggagalkan seluruh endpoint.
    sumbu: list[date] = []
    for tanggal in sorted(tanggal_bersama):
        if tanggal < batas_awal:
            continue
        try:
            sumbu.append(date.fromisoformat(tanggal))
        except ValueError:
            continue

    if len(sumbu) < 2:
        raise HTTPException(
            status_code=502,
            detail="Tidak ada tanggal yang dimiliki seluruh bank pada rentang skor bergerak.",
        )

    tanggal_titik = _sample_dates(sumbu, SCORE_TREND_POINTS)
    tanggal_terakhir = tanggal_titik[-1].isoformat()

    # Perubahan harian dari ringkasan Sectors hanya ada untuk hari ini, dan
    # itulah sumber momentum yang dipakai skor besar di layar. Titik terakhir
    # sengaja memakai sumber yang sama supaya ujung garis bertemu persis dengan
    # angka di atasnya.
    #
    # Tanpa ini keduanya bisa berselisih jauh, bukan cuma membulat: perubahan
    # dari ringkasan dan return hari terakhir di endpoint histori pernah
    # berbeda tanda untuk bank yang sama (+0,96% vs -0,95%). Karena momentum
    # berbobot 0,30, selisih sekecil itu menggeser titik terakhir sampai 8 poin
    # dari angka besar yang ditampilkan tepat di atasnya.
    perubahan_hari_ini = {
        bank["symbol"]: _to_float(bank.get("daily_close_change"))
        for bank in get_banks_summary()
    }

    points: list[dict[str, object]] = []
    for tanggal in tanggal_titik:
        batas_jendela = (tanggal - timedelta(days=INTELLIGENCE_WINDOW_DAYS)).isoformat()
        batas_akhir = tanggal.isoformat()
        titik_terakhir = batas_akhir == tanggal_terakhir

        metrics = {
            symbol: _compute_metrics(
                [harga for t, harga in deret if batas_jendela <= t <= batas_akhir],
                # Titik lampau tidak punya padanan ringkasan ini, jadi
                # momentumnya memakai return hari terakhir di jendelanya sendiri.
                perubahan_hari_ini.get(symbol) if titik_terakhir else None,
            )
            for symbol, deret in series_per_bank.items()
        }
        skor, _ = _composite_scores(metrics)
        points.append({"date": batas_akhir, "scores": skor})

    payload = {
        "as_of": points[-1]["date"],
        "window_days": INTELLIGENCE_WINDOW_DAYS,
        "symbols": sorted(series_per_bank),
        "points": points,
    }

    # Sama seperti intelligence: kalau ada bank yang gagal, hasilnya tidak
    # di-cache supaya percobaan berikutnya masih bisa melengkapinya.
    if len(series_per_bank) == len(BANK_SYMBOLS):
        _set_cached("banks:score-trend", payload, SCORE_TREND_CACHE_TTL_SECONDS)

    return payload


# Laporan subsektor memuat agregat seluruh bank di subsektor ini sekaligus
# papan peringkatnya, dan setiap panggilan menagih satu kredit Sectors. Isinya
# bergerak lambat — kapitalisasi pasar berubah harian, laba dan pendapatan
# kuartalan — jadi cache-nya dibuat jauh lebih panjang daripada ringkasan
# harga: aplikasi boleh dibuka berulang kali tanpa menagih kredit baru.
SECTOR_CACHE_TTL_SECONDS = 60 * 60

# Nama kunci metrik pada tiap papan peringkat. `top_revenue` sengaja tidak
# dipatok karena isinya belum pernah diperiksa langsung; barisnya tetap
# terbaca lewat pencarian angka di _board_rows.
SECTOR_BOARD_METRIC_KEYS = {
    "top_mcap": "market_cap",
    "top_profit": "profit_ttm",
    "top_growth": "revenue_growth",
}

# Urutan papan di aplikasi, beserta cara menampilkan angkanya. Sectors
# mengirim rasio sebagai pecahan, bukan persen.
SECTOR_BOARDS = (
    ("top_mcap", "Kapitalisasi pasar terbesar", "rupiah"),
    ("top_profit", "Laba terbesar (TTM)", "rupiah"),
    ("top_revenue", "Pendapatan terbesar (TTM)", "rupiah"),
    ("top_growth", "Pertumbuhan pendapatan tertinggi", "persen"),
)


def _sector_metric(block: object, *keys: str) -> float | None:
    """Angka pertama yang ada di antara `keys` pada sebuah objek Sectors."""
    if not isinstance(block, dict):
        return None

    for key in keys:
        value = block.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return float(value)

    return None


def _board_rows(board: object, metric_key: str | None) -> list[dict[str, object]]:
    """Ubah satu papan peringkat Sectors menjadi daftar baris siap tampil.

    Sectors mengirim papan sebagai objek berkunci simbol saham, misalnya
    `{"BBCA.JK": {"name": ..., "market_cap": ...}}`, dan urutan kuncinya sudah
    urut peringkat. Nama kunci metriknya berbeda antar papan, dan satu papan
    belum pernah diperiksa langsung, jadi angkanya dicari sebagai field
    numerik selain `name` alih-alih ditebak namanya.
    """
    if not isinstance(board, dict):
        return []

    rows: list[dict[str, object]] = []
    for symbol, entry in board.items():
        if not isinstance(entry, dict):
            continue

        value = entry.get(metric_key) if metric_key is not None else None
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            value = None
            for key, candidate in entry.items():
                if key == "name" or isinstance(candidate, bool):
                    continue
                if isinstance(candidate, (int, float)):
                    value = candidate
                    break

        if value is None:
            continue

        clean_symbol = str(symbol).upper().removesuffix(".JK")
        rows.append(
            {
                "symbol": clean_symbol,
                "name": entry.get("name"),
                "value": value,
                # Bank pantauan punya skor komposit; yang lain tidak, karena
                # skornya relatif terhadap kelompok pembanding dan bank di luar
                # kelompok itu memang tidak punya. Aplikasi memakai penanda ini
                # untuk memutuskan barisnya bisa dibuka atau hanya nama.
                "tracked": clean_symbol in BANK_SYMBOLS,
            }
        )

    return rows


@app.get("/api/sector/banks")
def get_sector_banks() -> dict[str, object]:
    """Denyut subsektor perbankan dan papan peringkat anggotanya.

    Perlu ditegaskan: endpoint Sectors yang dipakai di sini TIDAK mengirim
    daftar lengkap anggota subsektor, hanya lima teratas per metrik. Jadi
    layar sektor memang menampilkan peringkat teratas, bukan seluruh bank.
    """
    cached = _get_cached("sector:banks")
    if cached is not None:
        return cached

    if not SECTORS_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="SECTORS_API_KEY belum dikonfigurasi di file .env.",
        )

    try:
        response = requests.get(
            f"{SECTORS_API_BASE_URL}/subsector/report/banks/",
            headers={"Authorization": SECTORS_API_KEY},
            timeout=30,
        )
        response.raise_for_status()
        report = response.json()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Laporan subsektor perbankan belum dapat diambil dari Sectors: "
                f"{_ringkas_galat_sectors(exc)}"
            ),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="Format laporan subsektor tidak dikenali.",
        ) from exc

    if not isinstance(report, dict):
        raise HTTPException(
            status_code=502,
            detail="Format laporan subsektor tidak dikenali.",
        )

    statistics = report.get("statistics")
    statistics = statistics if isinstance(statistics, dict) else {}

    market_cap = report.get("market_cap")
    market_cap = market_cap if isinstance(market_cap, dict) else {}
    mcap_summary = market_cap.get("mcap_summary")
    mcap_change = (
        mcap_summary.get("mcap_change") if isinstance(mcap_summary, dict) else None
    )

    companies = report.get("companies")
    top_companies = companies.get("top_companies") if isinstance(companies, dict) else None
    top_companies = top_companies if isinstance(top_companies, dict) else {}

    payload = {
        "sub_sector": report.get("sub_sector"),
        "total_companies": _sector_metric(statistics, "total_companies"),
        "market_cap": {
            "total": _sector_metric(market_cap, "total_market_cap"),
            "average": _sector_metric(market_cap, "avg_market_cap"),
            "change_1w": _sector_metric(mcap_change, "1w"),
            "change_ytd": _sector_metric(mcap_change, "ytd"),
            "change_1y": _sector_metric(mcap_change, "1y"),
        },
        "valuation": {
            "median_pe": _sector_metric(statistics, "filtered_median_pe"),
            "weighted_average_pe": _sector_metric(
                statistics, "filtered_weighted_avg_pe"
            ),
        },
        "boards": [
            {
                "key": key,
                "title": title,
                "format": number_format,
                "rows": _board_rows(
                    top_companies.get(key), SECTOR_BOARD_METRIC_KEYS.get(key)
                ),
            }
            for key, title, number_format in SECTOR_BOARDS
        ],
    }

    # Berbeda dari skor bank, laporan ini tidak pernah datang sebagian: satu
    # panggilan berhasil berarti seluruh isinya lengkap. Jadi selalu di-cache.
    _set_cached("sector:banks", payload, SECTOR_CACHE_TTL_SECONDS)

    return payload


# --- Papan peringkat lintas seluruh bank subsektor ---------------------------
#
# Berbeda dari laporan subsektor di atas, yang hanya memuat lima teratas per
# metrik, screener ini mengurutkan SELURUH 48 bank anggota subsektor. Yang
# didapat darinya hanya simbol dan nama, tanpa nilai — jadi papannya menjawab
# "siapa", bukan "berapa". Angka perbankan tidak ikut, dan itu memang batas
# dari endpoint ini.
SCREENER_URL = f"{SECTORS_API_BASE_URL}/companies/"

# Slug subsektor yang dipakai di klausa `where`. Daftar slug yang sah datang
# dari endpoint /subsectors/.
SUB_SECTOR_SLUG = "banks"

SCREENER_CACHE_TTL_SECONDS = 60 * 60

# Berapa nama yang ikut ke tiap papan. Cukup panjang untuk memberi model
# gambaran peringkat, sekaligus menjaga konteks percakapan tidak membengkak.
SCREENER_BOARD_LIMIT = 10

# Berapa nama bank yang ikut sebagai daftar anggota. 200 adalah batas atas
# yang diizinkan Sectors, dan subsektor ini berisi 48 bank — jadi satu
# panggilan menutup seluruhnya tanpa perlu penomoran halaman.
SCREENER_MEMBER_LIMIT = 200

# (kunci, judul, order_by). Tanda minus berarti menurun, jadi tanpa minus
# berarti yang terkecil lebih dulu.
#
# Keenamnya sudah diperiksa langsung ke Sectors, dan urutan yang keluar cocok
# dengan yang diketahui tentang perbankan Indonesia: papan ROE dipuncaki BMRI
# lalu BBCA dan BBRI, papan dividen dipuncaki BMRI dan BJBR. Itu penting,
# karena balasannya tidak memuat nilai sama sekali — urutan itulah satu-satunya
# bukti bahwa pengurutannya benar-benar terjadi. Kalau `order_by` diabaikan
# diam-diam, hasilnya akan urut abjad dan papan ini menyesatkan tanpa terlihat
# rusak. Periksa ulang dengan cara itu bila ada yang aneh nanti.
SCREENER_BOARDS = (
    ("pe_terendah", "P/E terendah (forward)", "forward_pe"),
    ("pe_tertinggi", "P/E tertinggi (forward)", "-forward_pe"),
    ("roe_tertinggi", "ROE tertinggi", "-roe_ttm"),
    ("dividen_tertinggi", "Dividen tertinggi", "-yield_ttm"),
    ("pb_terendah", "PB terendah", "pb_mrq"),
    ("terkecil", "Kapitalisasi pasar terkecil", "market_cap"),
)


def _fetch_screener(order_by: str | None, limit: int) -> list[dict[str, object]]:
    """Sekumpulan bank anggota subsektor, dalam urutan yang diminta.

    `order_by` None berarti Sectors memakai bawaannya sendiri, yaitu urut
    simbol — itulah yang dipakai untuk mengambil daftar anggotanya.
    """
    if not SECTORS_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="SECTORS_API_KEY belum dikonfigurasi di file .env.",
        )

    params: dict[str, object] = {
        "where": f"sub_sector = '{SUB_SECTOR_SLUG}'",
        "limit": limit,
    }
    if order_by is not None:
        params["order_by"] = order_by

    try:
        response = requests.get(
            SCREENER_URL,
            headers={"Authorization": SECTORS_API_KEY},
            params=params,
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Daftar bank subsektor belum dapat diambil dari Sectors: "
                f"{_ringkas_galat_sectors(exc)}"
            ),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="Format daftar bank subsektor tidak dikenali.",
        ) from exc

    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list):
        raise HTTPException(
            status_code=502,
            detail="Format daftar bank subsektor tidak dikenali.",
        )

    baris: list[dict[str, object]] = []
    for item in results:
        if not isinstance(item, dict):
            continue
        symbol = item.get("symbol")
        if symbol is None:
            continue
        baris.append(
            {
                "symbol": str(symbol).upper().removesuffix(".JK"),
                "name": item.get("company_name"),
            }
        )

    return baris


def _screener_cached(
    key: str,
    order_by: str | None,
    limit: int,
    ttl_seconds: int = SCREENER_CACHE_TTL_SECONDS,
) -> list[dict[str, object]]:
    """Screener dengan cache per papan, bukan satu cache gabungan.

    Dipisah begitu supaya satu metrik yang suatu saat tidak lagi didukung
    Sectors hanya menjatuhkan papannya sendiri. Kalau ketujuhnya disimpan
    dalam satu entri, satu kegagalan akan membuang seluruh isi cache dan
    memaksa tujuh panggilan baru pada percakapan berikutnya.
    """
    cached = _get_cached(key)
    if cached is not None:
        return cached

    baris = _fetch_screener(order_by, limit)

    # Hasil kosong sengaja tidak disimpan. Subsektor perbankan tidak mungkin
    # benar-benar kosong, jadi daftar kosong hampir pasti berarti kuerinya
    # tidak berkenan di sisi Sectors. Menahannya di cache selama satu jam
    # hanya akan menyembunyikan masalahnya.
    if baris:
        _set_cached(key, baris, ttl_seconds)

    return baris


def _sub_sector_overview() -> dict[str, object]:
    """Seluruh bank anggota subsektor, plus papan peringkat lintas semuanya."""
    anggota: list[dict[str, object]] = []
    try:
        anggota = _screener_cached("screener:anggota", None, SCREENER_MEMBER_LIMIT)
    except HTTPException as exc:
        print(f"[FinTrack] Gagal mengambil daftar anggota subsektor: {exc.detail}")

    boards: list[dict[str, object]] = []
    for kunci, judul, order_by in SCREENER_BOARDS:
        try:
            baris = _screener_cached(
                f"screener:{kunci}", order_by, SCREENER_BOARD_LIMIT
            )
        except HTTPException as exc:
            print(f"[FinTrack] Gagal mengambil papan {kunci}: {exc.detail}")
            continue

        if baris:
            boards.append({"key": kunci, "title": judul, "rows": baris})

    if not anggota and not boards:
        raise HTTPException(
            status_code=502,
            detail="Daftar bank subsektor belum dapat diambil dari Sectors.",
        )

    return {
        "total_members": len(anggota) if anggota else None,
        "members": anggota,
        "boards": boards,
    }


@app.get("/api/sector/members")
def get_sector_members() -> dict[str, object]:
    """Seluruh bank anggota subsektor: kode, nama, dan penanda bank pantauan.

    Dua layar memakainya untuk hal berbeda. Layar Sektor menyaring yang TIDAK
    dipantau, karena lima bank pantauan sudah tampil di papan peringkatnya dan
    yang belum terlihat justru sisanya. Layar Adu memakainya sebagai daftar
    lengkap 48 bank yang bisa dipilih — dan di sana penanda `tracked` yang
    menentukan bank mana yang punya skor.

    Nama dan kode saja, tanpa skor maupun harga. Skor hanya terdefinisi di
    dalam kelompok pembandingnya, sedangkan harga per bank berarti satu
    panggilan Sectors per bank — dua hal yang memang tidak boleh dibayar di
    depan oleh layar yang belum tentu memilih bank itu.

    Justru itu endpoint ini terpisah dari /api/sector/banks: yang ini satu
    kredit (satu kueri screener terstruktur), sedangkan yang itu satu kredit
    laporan subsektor. Digabung berarti layar Sektor membayar keduanya.
    Keduanya berbagi kunci cache dengan ringkasan subsektor milik chat, jadi
    bila chat sudah pernah memuatnya, permintaan ini gratis.
    """
    # Sengaja tidak ditangkap: kalau daftar anggotanya sendiri gagal, tidak ada
    # yang bisa dikirim, dan galat 502 dari _screener_cached sudah menjelaskan
    # sebabnya dengan tepat.
    anggota = _screener_cached("screener:anggota", None, SCREENER_MEMBER_LIMIT)

    # Yang menentukan "dipantau penuh" adalah BANK_SYMBOLS, bukan angka yang
    # ditulis di sini — jadi menambah bank pantauan otomatis memindahkan bank
    # itu ke kelompok bertanda, di kedua layar sekaligus.
    return {
        "total_members": len(anggota),
        "tracked_count": sum(
            1 for baris in anggota if baris["symbol"] in BANK_SYMBOLS
        ),
        "members": [
            {
                "symbol": baris["symbol"],
                "name": baris.get("name"),
                "tracked": baris["symbol"] in BANK_SYMBOLS,
            }
            for baris in anggota
        ],
    }


OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
# Model gratis dipilih supaya demo tidak memakai kredit berbayar. Yang
# dibutuhkan model di sini bukan pengetahuan luas, melainkan kepatuhan pada
# batasan di system prompt dan kemampuan merangkai ulang data yang sudah
# diringkas di bawah.
#
# Nemotron 3 Ultra adalah model penalaran: ia menyusun langkah berpikir lebih
# dulu sebelum menjawab, jadi jawabannya lebih lama datang daripada model
# biasa. Ini yang membuat tenggat di bawah perlu longgar.
OPENROUTER_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"

# Model gratis bisa mengantre saat ramai, dan model penalaran menambah waktu
# berpikir di atasnya. Karena itu tenggatnya jauh lebih longgar daripada
# permintaan ke Sectors.
#
# Aplikasi mobile harus memakai tenggat yang lebih panjang dari angka ini.
# Kalau sisi aplikasi menyerah lebih dulu, pengguna melihat galat sambungan
# padahal backendnya masih menunggu jawaban yang sebenarnya akan datang.
OPENROUTER_TIMEOUT_SECONDS = 60

MAX_QUESTION_LENGTH = 500

DISCLAIMER = "Ini bukan nasihat investasi"

# Batasan di bawah ini adalah bagian dari kepatuhan pada aturan lomba: jawaban
# tidak boleh menjadi rekomendasi investasi dan tidak boleh keluar dari topik
# perbankan Indonesia. Karena itu aturannya ditulis eksplisit, bukan disiratkan.
#
# Bagian "cara membaca data" ada bukan karena modelnya perlu diatur gayanya,
# tapi karena data yang dikirim MEMANG tidak seragam kedalamannya: bank
# pantauan dilacak penuh, sedangkan bank lain hanya muncul sebagai nama di
# papan peringkat tanpa nilai apa pun. Tanpa penjelasan itu, model akan
# menyimpulkan sendiri bahwa angka yang tidak ada berarti nol, atau mengarang
# harga untuk bank yang tidak pernah dikirimi harga.
#
# Aturan penulisan di poin 4 menyebut penanda tebal sebagai satu-satunya yang
# boleh, dan itu disengaja: sisi aplikasi memang bisa menggambar yang itu,
# sedangkan judul, daftar berbutir, dan tabel akan tampil sebagai tanda
# mentah. Jadi daftarnya bukan sekadar imbauan gaya, melainkan kesepakatan
# dengan apa yang bisa digambar layar chat.

# Daftar bank pantauan disusun dari BANK_SYMBOLS, bukan ditulis ulang di dalam
# prompt. Kalau anggotanya berubah, promptnya ikut berubah sendiri — dan
# ketidakcocokan antara jumlah bank di prompt dan jumlah bank di data adalah
# persis jenis kesalahan yang membuat model mengarang harga.
_BANKS_SPOKEN = (
    ", ".join(BANK_SYMBOLS[:-1]) + f", dan {BANK_SYMBOLS[-1]}"
    if len(BANK_SYMBOLS) > 1
    else BANK_SYMBOLS[0]
)

CHAT_SYSTEM_PROMPT = """\
Anda asisten FinTrack Intelligence, aplikasi pemantau saham perbankan \
Indonesia. Cakupan Anda adalah seluruh bank yang terdaftar di subsektor \
perbankan Bursa Efek Indonesia, sebatas data yang diberikan di bawah.

Aturan yang tidak boleh dilanggar:
1. Jawab HANYA berdasarkan data yang diberikan. Jangan menambah angka, harga, \
peristiwa, atau berita apa pun dari luar data itu. Kalau data yang diberikan \
tidak memuat jawabannya, katakan terus terang bahwa datanya tidak tersedia.
2. Jangan pernah menyarankan beli, jual, atau tahan, dan jangan memberi saran \
investasi dalam bentuk apa pun. Bila diminta, tolak dengan singkat lalu \
tawarkan menjelaskan datanya saja.
3. Jangan menjawab pertanyaan di luar topik perbankan Indonesia. Bila \
pertanyaannya di luar topik, katakan bahwa Anda hanya membahas saham bank.
4. Tulis jawaban sebagai teks biasa. Satu-satunya penanda yang boleh dipakai \
adalah **dua bintang** untuk menebalkan nama bank atau angka penting. Jangan \
memakai penanda lain seperti # untuk judul, tanda hubung di awal baris untuk \
daftar, atau tabel, karena aplikasi menampilkan jawaban apa adanya dan \
penanda itu akan ikut tercetak.
5. Akhiri setiap jawaban dengan kalimat persis: "{disclaimer}"

Cara membaca data yang diberikan:
- Kedalamannya tidak sama untuk semua bank. Bank pantauan — {pantauan} — punya \
harga, kapitalisasi pasar, dan skor lengkap, dan hanya bank-bank itu yang \
punya angka seperti itu.
- Skor komposit 0-100 TIDAK ada di data ini. Kalau ditanya soal skor, katakan \
skor tidak tersedia, lalu sebutkan yang memang ada: harga, kapitalisasi pasar, \
perubahan harian, atau urutan pada papan peringkat. Jangan mengarang angka \
skor dalam bentuk apa pun.
- Laporan subsektor memuat angka agregat dan lima teratas per metrik, lengkap \
dengan nilainya.
- Papan peringkat memuat sepuluh teratas untuk beberapa metrik lain, TAPI \
HANYA NAMA DAN URUTAN, tanpa nilai sama sekali. Jangan menyebut angka apa pun \
untuk papan ini. Sebut urutannya saja, misalnya "yang tertinggi adalah BMRI, \
disusul BBCA". Kalau ditanya berapa nilainya, katakan angka itu tidak ada di \
data, dan sebutkan urutannya.
- Peringkat harian bank pantauan dihitung dari perubahan harga hari itu, bukan \
dari skor. Jadi "peringkat 1" di sana berarti naik paling tinggi hari ini.
- Untuk bank di luar daftar pantauan itu, harga dan kapitalisasi pasarnya tidak \
tersedia. Kalau ditanya, katakan terus terang bahwa angkanya tidak ada, lalu \
sebutkan apa yang memang ada — misalnya bank itu menempati urutan berapa pada \
papan yang mana.

Jawab dalam bahasa Indonesia, ringkas dan langsung ke intinya. Sebut angka \
dari data bila relevan, dan jangan mengarang bila tidak ada.""".format(
    disclaimer=DISCLAIMER, pantauan=_BANKS_SPOKEN
)


class ChatRequest(BaseModel):
    question: str


def _context_section(title: str, fetcher) -> str | None:
    """Satu bagian konteks, atau None kalau sumbernya sedang gagal.

    Satu endpoint yang mati tidak boleh mengosongkan seluruh bahan jawaban.
    Percakapan yang kehilangan laporan subsektor masih berguna; percakapan yang
    gagal total tidak. Karena itu kegagalannya dicatat lalu dilewati, bukan
    diteruskan sebagai galat ke pengguna.
    """
    try:
        data = fetcher()
    except HTTPException as exc:
        print(f"[FinTrack] {title} tidak ikut ke konteks chat: {exc.detail}")
        return None

    return f"{title}:\n{json.dumps(data, ensure_ascii=False, indent=2)}"


def _chat_context() -> str:
    """Data yang dijadikan pijakan jawaban model.

    Semuanya dipanggil sebagai fungsi Python, bukan lewat HTTP ke diri sendiri:
    server ini tidak selalu punya alamat yang bisa dihubungi dari dalam
    dirinya sendiri, dan memanggil lewat jaringan hanya menambah satu
    perjalanan bolak-balik yang bisa gagal sendiri. Efek sampingnya
    menguntungkan — cache yang sudah ada ikut terpakai, jadi percakapan tidak
    memanggil ulang Sectors tiap kali ada pertanyaan.
    """
    bagian = [
        _context_section("RINGKASAN BANK PANTAUAN", get_banks_summary),
        # Judulnya menyebut "HARIAN" dengan sengaja. Di dalam aplikasi kata
        # "peringkat" berarti peringkat skor komposit, sedangkan yang dikirim
        # ke sini peringkat perubahan harga hari itu. Dua hal berbeda dengan
        # nama yang sama adalah cara paling mudah membuat model menjawab
        # pertanyaan yang tidak ditanyakan.
        _context_section(
            "PERINGKAT BANK PANTAUAN MENURUT PERUBAHAN HARGA HARIAN",
            get_banks_ranking,
        ),
        _context_section("LAPORAN SUBSEKTOR PERBANKAN", get_sector_banks),
        _context_section("SELURUH BANK ANGGOTA SUBSEKTOR", _sub_sector_overview),
    ]

    tersedia = [satu for satu in bagian if satu]
    if not tersedia:
        raise HTTPException(
            status_code=502,
            detail="Data bank belum dapat diambil dari Sectors.",
        )

    return "\n\n".join(tersedia)


def _dengan_disclaimer(jawaban: str) -> str:
    """Memastikan kalimat penutup selalu ada.

    Model bisa lupa mematuhi satu dari lima aturan, dan aturan penutup ini
    yang paling mudah terlewat karena isinya bukan jawaban. Karena itu
    penutupnya dijamin di sini, bukan diserahkan pada kepatuhan model. Kalau
    model sudah menulisnya sendiri, tidak ditambahkan dua kali.
    """
    teks = jawaban.strip()
    if DISCLAIMER.lower() in teks.lower():
        return teks
    return f"{teks}\n\n{DISCLAIMER}"


def _cincang(data: object, batas: int = 400) -> str:
    """Balasan OpenRouter dipotong supaya muat ditampilkan di layar.

    Dipakai hanya saat menyalin balasan ke pesan galat. Balasannya bisa
    sepanjang apa saja — muatan penuh, daftar penyedia, jejak penalaran — dan
    tanpa dipotong, satu galat bisa memenuhi seluruh layar chat.
    """
    try:
        teks = json.dumps(data, ensure_ascii=False)
    except (TypeError, ValueError):
        teks = repr(data)

    return teks if len(teks) <= batas else f"{teks[:batas]}..."


@app.post("/api/chat")
def post_chat(payload: ChatRequest) -> dict[str, str]:
    """Menjawab pertanyaan soal saham bank berdasarkan data yang ada."""
    pertanyaan = payload.question.strip()
    if not pertanyaan:
        raise HTTPException(status_code=422, detail="Pertanyaan tidak boleh kosong.")
    if len(pertanyaan) > MAX_QUESTION_LENGTH:
        raise HTTPException(
            status_code=422,
            detail=f"Pertanyaan terlalu panjang (maksimal {MAX_QUESTION_LENGTH} karakter).",
        )

    if not OPENROUTER_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="OPENROUTER_API_KEY belum dikonfigurasi di file .env.",
        )

    konteks = _chat_context()

    try:
        response = requests.post(
            OPENROUTER_API_URL,
            headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
            json={
                "model": OPENROUTER_MODEL,
                "messages": [
                    {"role": "system", "content": CHAT_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"{konteks}\n\nPERTANYAAN PENGGUNA:\n{pertanyaan}",
                    },
                ],
                # Suhu rendah supaya jawabannya berpijak pada data yang
                # diberikan, bukan mengarang kalimat yang terdengar masuk akal.
                "temperature": 0.2,
            },
            timeout=OPENROUTER_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        hasil = response.json()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"OpenRouter tidak dapat dihubungi: {exc}",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="Jawaban OpenRouter bukan JSON yang sah.",
        ) from exc

    pilihan = hasil.get("choices")
    if not isinstance(pilihan, list) or not pilihan:
        # Balasannya ikut dibawa, bukan disembunyikan di balik kalimat umum.
        # Beberapa sebab yang sangat berbeda berakhir di cabang ini dengan
        # pesan yang sama persis: penyedia yang menolak, model yang kehabisan
        # jatah token, permintaan yang tidak diterima, dan model yang sedang
        # penuh. Isi balasannya yang membedakan, dan tanpa itu satu-satunya
        # cara mengetahuinya adalah menebak.
        print(
            "[FinTrack] OpenRouter tanpa choices "
            f"(HTTP {response.status_code}): {_cincang(hasil, 2000)}"
        )
        raise HTTPException(
            status_code=502,
            detail=(
                f"OpenRouter tidak mengirim pilihan jawaban "
                f"(HTTP {response.status_code}): {_cincang(hasil)}"
            ),
        )

    pesan = pilihan[0].get("message") or {}
    jawaban = pesan.get("content")
    if not isinstance(jawaban, str) or not jawaban.strip():
        # finish_reason pembeda utamanya, dan itulah yang paling menentukan
        # langkah berikutnya: "length" berarti model kehabisan jatah token
        # sebelum sempat menulis jawaban — lazim pada model penalaran, yang
        # menghabiskan anggaran lebih dulu untuk berpikir — sedangkan "stop"
        # berarti modelnya memang berhenti sendiri tanpa menulis apa pun.
        # Keduanya tampak sama dari sisi aplikasi, tetapi perbaikannya
        # berlawanan arah.
        alasan = pilihan[0].get("finish_reason")
        print(
            f"[FinTrack] OpenRouter tanpa isi "
            f"(finish_reason={alasan!r}): {_cincang(hasil, 2000)}"
        )
        raise HTTPException(
            status_code=502,
            detail=(
                "OpenRouter mengirim jawaban kosong "
                f"(finish_reason: {alasan or 'tidak disebutkan'})."
            ),
        )

    return {"answer": _dengan_disclaimer(jawaban)}
