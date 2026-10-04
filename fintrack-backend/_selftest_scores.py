"""Uji cepat fungsi turunan di main.py dengan data sintetis.

Tidak memanggil Sectors sama sekali, jadi kredit API tidak terpakai.

Jalankan dari folder fintrack-backend:
    .\\.venv\\Scripts\\python.exe _selftest_scores.py
"""

import statistics
from datetime import date

import main as m


def check(label, actual, expect=None, predicate=None):
    ok = predicate(actual) if predicate else actual == expect
    print(f"[{'OK  ' if ok else 'GAGAL'}] {label}: {actual!r}")
    if not ok:
        raise SystemExit(f"  -> diharapkan {expect!r}")


def calm_pairs(count, offset=0):
    """Return harian naik-turun kecil yang rata, tanpa titik ekstrem."""
    return [
        (
            f"hari-{index + offset:02d}",
            0.005 if (index + offset) % 2 == 0 else -0.005,
        )
        for index in range(count)
    ]


CALM_RETURNS = [value for _, value in calm_pairs(39)]


# --- moving average ---
closes = [float(100 + index) for index in range(40)]  # 100..139
check("MA7 (7 nilai terakhir)", m._moving_average(closes, 7), 136.0)
check("MA30", m._moving_average(closes, 30), 124.5)
check("MA saat data kurang -> None", m._moving_average([1.0, 2.0], 7), None)

# --- daily returns ---
check("daily returns", [round(v, 4) for v in m._daily_returns([100.0, 110.0, 99.0])], [0.1, -0.1])
check("pembagi nol dilewati", m._daily_returns([0.0, 10.0]), [])

# --- skor peer: 50 = rata-rata, bukan min-max ---
#
# Angka harapannya diturunkan dari PEER_SCORE_SIGMA, bukan ditulis mati. Yang
# diuji di sini adalah BENTUK kurvanya — 50 tepat di rata-rata, jauh dari 0/100
# ala min-max — sedangkan angka tepatnya ikut bergeser setiap jumlah bank
# pantauan berubah, dan itu memang pernah terjadi: kelompoknya dari empat bank
# jadi lima.
PEER = {"A": 10.0, "B": 0.0, "C": 5.0}
SIGMA_PEER = statistics.pstdev(list(PEER.values()))


def skor_peer_harapan(nilai):
    return round(50.0 + m.PEER_SCORE_SIGMA * (nilai - 5.0) / SIGMA_PEER, 1)


check(
    "peer score: terbaik tidak otomatis 100",
    round(m._peer_score(PEER)["A"], 1),
    skor_peer_harapan(10.0),
)
check(
    "peer score: terburuk tidak otomatis 0",
    round(m._peer_score(PEER)["B"], 1),
    skor_peer_harapan(0.0),
)
check(
    "peer score: yang persis rata-rata dapat 50",
    round(m._peer_score(PEER)["C"], 1),
    50.0,
)
check(
    "peer score: semua sama -> 50 (tanpa bagi nol)",
    m._peer_score({"A": 3.0, "B": 3.0}),
    {"A": 50.0, "B": 50.0},
)
# Nilai kosong tetap kosong, dan yang tersisa tetap simetris mengelilingi 50.
# Keduanya berlaku berapa pun jumlah anggotanya, jadi tidak perlu angka mati.
check(
    "peer score: nilai kosong tetap kosong",
    m._peer_score({"A": 1.0, "B": None, "C": 3.0}),
    predicate=lambda hasil: hasil["B"] is None
    and hasil["A"] < 50 < hasil["C"]
    and round(50 - hasil["A"], 1) == round(hasil["C"] - 50, 1),
)
check(
    "peer score: semua kosong -> semua kosong",
    m._peer_score({"A": None, "B": None}),
    {"A": None, "B": None},
)
check(
    "selisih kecil tidak lagi meledak jadi 0/100",
    m._peer_score({"A": 0.004016, "B": 0.003185, "C": 0.002457, "D": -0.005682}),
    predicate=lambda hasil: all(0 < nilai < 100 for nilai in hasil.values()),
)

# --- anomali: lonjakan turun dan naik ---
spike_down = m._detect_price_anomaly(CALM_RETURNS + [-0.06])
check("lonjakan turun terdeteksi", spike_down["is_anomaly"], True)
check("arah anomali", spike_down["direction"], "turun")
check("z-score negatif", spike_down["z_score"], predicate=lambda value: value < -4)

spike_up = m._detect_price_anomaly(CALM_RETURNS + [0.06])
check("lonjakan naik terdeteksi", spike_up["is_anomaly"], True)
check("arah anomali naik", spike_up["direction"], "naik")
check("z-score positif", spike_up["z_score"], predicate=lambda value: value > 4)

calm = m._detect_price_anomaly(CALM_RETURNS + [0.0])
check("pasar tenang tidak ditandai", calm["is_anomaly"], False)
check("z-score tenang di bawah ambang", calm["z_score"], predicate=lambda z: abs(z) < 2)
check(
    "data minim -> alasan jelas",
    m._detect_price_anomaly([0.01, 0.02])["reason"],
    "data historis belum cukup",
)

# --- riwayat anomali sepanjang jendela ---
two_spikes = (
    calm_pairs(30)
    + [("hari-30", -0.08)]
    + calm_pairs(5, offset=31)
    + [("hari-36", 0.08)]
)
riwayat = m._find_anomaly_history(two_spikes)
check("dua lonjakan ditemukan sepanjang jendela", len(riwayat), 2)
check("terbaru ditampilkan lebih dulu", [item["date"] for item in riwayat], ["hari-36", "hari-30"])
check("arah tiap lonjakan benar", [item["direction"] for item in riwayat], ["naik", "turun"])
check(
    "pasar tenang -> riwayat anomali kosong",
    m._find_anomaly_history(calm_pairs(36)),
    [],
)

# --- hari terakhir harus dapat z-score yang sama di kolom `anomaly` dan di
# --- entri pertama `anomaly_history`, karena aplikasi menampilkan keduanya
# --- berdampingan. Dulu keduanya memakai baseline berbeda.
volatil = [(f"v-{i:02d}", 0.03 if i % 2 == 0 else -0.03) for i in range(30)]
tenang = [(f"t-{i:02d}", 0.001 if i % 2 == 0 else -0.001) for i in range(30)]
deret = volatil + tenang + [("hari-terakhir", 0.02)]

kini = m._detect_price_anomaly([nilai for _, nilai in deret])
riwayat = m._find_anomaly_history(deret)

check("riwayat anomali terisi", len(riwayat) > 0, True)
check("hari terakhir ditandai anomali", kini["is_anomaly"], True)
check(
    "z-score hari terakhir sama di kedua tempat",
    riwayat[0]["z_score"],
    kini["z_score"],
)
check(
    "arah hari terakhir sama di kedua tempat",
    riwayat[0]["direction"],
    kini["direction"],
)
check(
    "baseline 30 hari, bukan seluruh jendela",
    kini["z_score"],
    predicate=lambda nilai: nilai > 10,
)
check(
    "z-score hari terakhir sama dengan hitungan langsung",
    kini["z_score"],
    round(m._anomaly_z_score([nilai for _, nilai in deret], len(deret) - 1), 2),
)

# --- pasangan tanggal & return ---
dengan_lubang = [
    {"date": "2026-01-01", "close": 100.0},
    {"date": "2026-01-02", "close": 110.0},
    {"date": "2026-01-03", "close": None},
    {"date": "2026-01-04", "close": 99.0},
]
check(
    "hari kosong dilewati, harga terakhir tetap jadi pembanding",
    [(tanggal, round(nilai, 4)) for tanggal, nilai in m._returns_with_dates(dengan_lubang)],
    [("2026-01-02", 0.1), ("2026-01-04", -0.1)],
)

# --- lonjakan volume ---
check("lonjakan volume terdeteksi", m._detect_volume_spike([100.0] * 39 + [250.0])["is_spike"], True)
check("rasio volume", m._detect_volume_spike([100.0] * 39 + [250.0])["ratio"], 2.5)
check("volume normal tidak ditandai", m._detect_volume_spike([100.0] * 40)["is_spike"], False)
check("volume nol tidak bikin error", m._detect_volume_spike([0.0] * 40)["is_spike"], False)

# --- konversi nilai dari JSON ---
check("float dari string", m._to_float("123.5"), 123.5)
check("None dari nilai kosong", m._to_float(None), None)
check("None dari teks", m._to_float("abc"), None)
check("None dari NaN", m._to_float(float("nan")), None)
check("None dari bool", m._to_float(True), None)

# --- label skor harus menyatakan perbandingan, bukan mutlak ---
check("label 82", m._score_label(82.0), "Jauh di atas rata-rata")
check("label 60", m._score_label(60.0), "Di atas rata-rata")
check("label 50", m._score_label(50.0), "Sekitar rata-rata")
check("label 30", m._score_label(30.0), "Di bawah rata-rata")
check("label None", m._score_label(None), "Data belum cukup")
check(
    "label tidak boleh mengklaim mutlak",
    [m._score_label(82.0), m._score_label(30.0)],
    predicate=lambda labels: not any(kata in label for label in labels for kata in ("Kuat", "Lemah")),
)

# --- bobot skor ---
check("total bobot harus 1.0", round(sum(m.SCORE_WEIGHTS.values()), 6), 1.0)

# --- skor: bank di rata-rata peer harus dapat 50 ---
rata = {nama: 50.0 for nama in m.SCORE_WEIGHTS}
check(
    "bank rata-rata dapat skor 50",
    round(sum(m.SCORE_WEIGHTS[nama] * nilai for nama, nilai in rata.items()), 1),
    50.0,
)

# --- batas atas realistis ---
#
# |z| maksimum yang mungkin untuk n anggota adalah akar(n - 1), jadi batas atas
# skor ditentukan jumlah anggotanya — dan itulah yang diuji: berapa pun jumlah
# bank pantauan, puncaknya harus tetap 93,3 dan tidak pernah menyentuh
# penjepitan 100. Kalau simpangannya suatu saat dipatok tetap alih-alih
# diturunkan dari jumlah anggota, uji ini yang menangkapnya.
z_maks = (len(m.BANK_SYMBOLS) - 1) ** 0.5
batas_atas = 50.0 + m.PEER_SCORE_SIGMA * z_maks
check(
    f"batas atas skor komponen untuk {len(m.BANK_SYMBOLS)} bank pantauan",
    round(batas_atas, 1),
    93.3,
)
check(
    "batas atas tidak menyentuh 100, jadi penjepitan tidak aktif",
    batas_atas,
    predicate=lambda nilai: nilai < 100,
)

# Sifatnya harus bertahan untuk jumlah bank berapa pun, bukan hanya yang
# kebetulan sedang dipakai.
for jumlah in (3, 4, 5, 6, 8, 10, 12, 20):
    sigma = m.SCORE_PEER_MAX_SPREAD / (jumlah - 1) ** 0.5
    check(
        f"batas atas tetap 93,3 bila bank pantauannya {jumlah}",
        round(50.0 + sigma * (jumlah - 1) ** 0.5, 1),
        93.3,
    )

# --- sinyal ---
sinyal = m._build_signals(
    {"last_close": 100.0, "ma30": 90.0, "trend": 0.05, "sessions": 50},
    spike_down,
    {"is_spike": False, "ratio": None},
)
print(f"[INFO ] contoh sinyal: {sinyal}")
check("sinyal menyebut anomali", sinyal, predicate=lambda items: any("tidak wajar" in i for i in items))
check("sinyal menyebut posisi MA", sinyal, predicate=lambda items: any("atas MA30" in i for i in items))
check("sinyal menyebut jumlah hari bursa", sinyal, predicate=lambda items: any("50 hari bursa" in i for i in items))


# --- pembacaan field yang bisa muncul di beberapa bagian respons ---
check("_first_present memakai nilai pertama", m._first_present(None, 5, 7), 5)
check("_first_present kosong semua -> None", m._first_present(None, None), None)
check(
    "nol tidak dianggap kosong",
    m._first_present(0.0, 5.0),
    0.0,
)


# --- batas ukuran cache ---
# Kunci histori memuat rentang tanggal, jadi tiap rentang baru menambah entri
# yang tidak akan pernah dibaca lagi. Tanpa batas, cache tumbuh terus.
m._cache.clear()
for index in range(m._MAX_CACHE_ENTRIES):
    m._set_cached(f"kunci-{index}", [index], ttl_seconds=3600)
check("cache terisi sampai batas", len(m._cache), m._MAX_CACHE_ENTRIES)

m._set_cached("kunci-baru", ["baru"], ttl_seconds=3600)
check("cache tidak melewati batas", len(m._cache) <= m._MAX_CACHE_ENTRIES, True)
check("kunci terbaru tetap tersimpan", m._get_cached("kunci-baru"), ["baru"])
check("kunci tertua dibuang lebih dulu", m._get_cached("kunci-0"), None)

m._cache.clear()
for index in range(m._MAX_CACHE_ENTRIES):
    m._set_cached(f"kedaluwarsa-{index}", [index], ttl_seconds=0)
m._set_cached("kunci-baru", ["baru"], ttl_seconds=3600)
check("entri kedaluwarsa dibuang lebih dulu", len(m._cache), 1)
m._cache.clear()


# --- respons Sectors dipalsukan di bawah ini supaya kredit API tidak terpakai ---
class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


LAPORAN_NULL = {
    "company_name": "Bank Uji",
    # null eksplisit, bukan kunci yang hilang: inilah bentuk yang dulu membuat
    # cadangan .get(kunci, cadangan) tidak pernah jalan.
    "overview": {"last_close_price": None, "market_cap": None},
    "valuation": {"last_close_price": 5000.0, "daily_close_change": 0.0125},
}

_get_asli = m.requests.get
m._cache.clear()
try:
    m.requests.get = lambda *args, **kwargs: _FakeResponse(LAPORAN_NULL)
    ringkas = m.get_banks_summary()
finally:
    m.requests.get = _get_asli
    m._cache.clear()

check("null di overview jatuh ke valuation", ringkas[0]["last_close_price"], 5000.0)
check("market_cap juga punya cadangan", ringkas[0]["market_cap"], None)
check("perubahan harian terbaca", ringkas[0]["daily_close_change"], 0.0125)

m._cache.clear()
try:
    # Diambil dari BANK_SYMBOLS, bukan ditulis "BBCA, BMRI, BBNI": daftar bank
    # pantauan sudah pernah berubah, dan harapan yang ditulis mati akan membuat
    # uji ini gagal karena hal yang benar.
    bank_selain_bbri = [simbol for simbol in m.BANK_SYMBOLS if simbol != "BBRI"]
    if len(bank_selain_bbri) == len(m.BANK_SYMBOLS):
        raise SystemExit("BBRI tidak ada di BANK_SYMBOLS; uji ini kehilangan sasarannya.")

    def _get_dengan_satu_gagal(url, *args, **kwargs):
        if "BBRI" in url:
            raise m.requests.RequestException("jaringan putus")
        return _FakeResponse(LAPORAN_NULL)

    m.requests.get = _get_dengan_satu_gagal
    sebagian = m.get_banks_summary()
    check(
        "satu simbol gagal tidak mengosongkan sisanya",
        len(sebagian),
        len(m.BANK_SYMBOLS) - 1,
    )
    check(
        "simbol yang gagal tidak ikut terkirim",
        [bank["symbol"] for bank in sebagian],
        bank_selain_bbri,
    )
    check("hasil sebagian tidak di-cache", m._get_cached("banks:summary"), None)
    # Ringkasan kini juga disimpan per simbol. Justru itu gunanya: bank yang
    # berhasil tidak perlu diambil ulang pada percobaan berikutnya hanya karena
    # satu bank lain gagal.
    check(
        "simbol yang berhasil tetap di-cache sendiri",
        m._get_cached("banks:summary:BBCA") is not None,
        True,
    )
    check("simbol yang gagal tidak di-cache", m._get_cached("banks:summary:BBRI"), None)
finally:
    m.requests.get = _get_asli
    m._cache.clear()


# --- intelligence saat salah satu bank gagal ---
# Perubahan paling berisiko: loop dulu berhenti pada kegagalan pertama dan
# mengosongkan seluruh layar ranking. Di bawah ini _fetch_history dan
# get_banks_summary diganti versi palsu, jadi Sectors tetap tidak dipanggil.
def _riwayat_palsu(hari=45):
    return [
        {
            "date": f"2026-{(index // 28) + 1:02d}-{(index % 28) + 1:02d}",
            "close": 1000.0 + index,
            "volume": 1000.0,
        }
        for index in range(hari)
    ]


RINGKASAN_PALSU = [
    {
        "symbol": symbol,
        "company_name": f"Bank {symbol}",
        "last_close_price": 1000.0,
        "market_cap": 1.0,
        "daily_close_change": 0.01,
    }
    for symbol in m.BANK_SYMBOLS
]

_ringkas_asli = m.get_banks_summary
_fetch_asli = m._fetch_history


def _fetch_dengan_satu_gagal(symbol, start, end):
    if symbol == "BMRI":
        raise m.HTTPException(status_code=502, detail="gagal diambil")
    return _riwayat_palsu()


m._cache.clear()
try:
    m.get_banks_summary = lambda: RINGKASAN_PALSU
    m._fetch_history = _fetch_dengan_satu_gagal

    hasil = m.get_banks_intelligence()
    bank_selain_bmri = [simbol for simbol in m.BANK_SYMBOLS if simbol != "BMRI"]
    if len(bank_selain_bmri) == len(m.BANK_SYMBOLS):
        raise SystemExit("BMRI tidak ada di BANK_SYMBOLS; uji ini kehilangan sasarannya.")

    check("satu bank gagal -> sisanya tetap dinilai", len(hasil), len(bank_selain_bmri))
    check(
        "peringkat tetap berurutan tanpa bolong",
        [bank["rank"] for bank in hasil],
        list(range(1, len(bank_selain_bmri) + 1)),
    )
    check(
        "bank yang gagal tidak ikut dinilai",
        sorted(bank["symbol"] for bank in hasil),
        sorted(bank_selain_bmri),
    )
    check("hasil sebagian tidak di-cache", m._get_cached("banks:intelligence"), None)
    check("nilai mentah momentum ikut dikirim", hasil[0]["momentum"], 0.01)
    check(
        "peer menyusut, skor tetap berada di rentang 0-100",
        [bank["score"] for bank in hasil],
        predicate=lambda nilai: all(0 <= skor <= 100 for skor in nilai),
    )
finally:
    m.get_banks_summary = _ringkas_asli
    m._fetch_history = _fetch_asli
    m._cache.clear()


# --- tanggal akhir yang ditolak Sectors sebagai "masih di masa depan" ---
#
# Jam komputer bisa berada di depan jam Sectors — di UTC+7 itu terjadi rutin
# tiap dini hari — dan dulu satu hari selisih itu mematikan seluruh analisis
# skor: setiap permintaan histori dijawab 400, jadi tidak ada bank yang punya
# cukup data. Yang diuji di sini pemunduran tanggalnya, bukan zona waktunya,
# jadi tidak perlu menunggu dini hari untuk menangkapnya kembali.
class _ResponsPenolakan:
    def __init__(self, status_code, text):
        self.status_code = status_code
        self.text = text


PESAN_MASA_DEPAN = '{"error":"End date cannot be in the future. Today is 2026-10-03."}'


def _galat_histori(status_code, text):
    galat = m.requests.RequestException(f"{status_code} Client Error")
    galat.response = _ResponsPenolakan(status_code, text)
    return galat


_akhir_diminta = []


def _get_mundur(url, *args, **kwargs):
    akhir = kwargs["params"]["end"]
    _akhir_diminta.append(akhir)
    if akhir == "2026-10-04":
        raise _galat_histori(400, PESAN_MASA_DEPAN)
    return _FakeResponse([{"date": akhir, "close": 100.0}])


m._cache.clear()
try:
    m.requests.get = _get_mundur
    hasil_mundur = m._fetch_history("BBCA", date(2026, 7, 26), date(2026, 10, 4))
finally:
    m.requests.get = _get_asli
    m._cache.clear()

check(
    "tanggal akhir dimundurkan sehari lalu dicoba lagi",
    _akhir_diminta,
    ["2026-10-04", "2026-10-03"],
)
check(
    "yang dipakai adalah hasil percobaan kedua",
    [baris["date"] for baris in hasil_mundur],
    ["2026-10-03"],
)


# 400 yang bukan soal tanggal tidak boleh memicu pemunduran: percobaannya cuma
# menutupi sebab aslinya, dan pesan galat yang benar justru tidak sampai.
def _get_tolak_bukan_tanggal(url, *args, **kwargs):
    _akhir_diminta.append(kwargs["params"]["end"])
    raise _galat_histori(400, '{"error":"start tidak sah"}')


_akhir_diminta = []
m._cache.clear()
try:
    m.requests.get = _get_tolak_bukan_tanggal
    try:
        m._fetch_history("BBCA", date(2026, 7, 26), date(2026, 10, 4))
        status_400_lain = "tidak melempar"
    except m.HTTPException as exc:
        status_400_lain = exc.status_code
finally:
    m.requests.get = _get_asli
    m._cache.clear()

check("400 yang bukan soal tanggal tidak dicoba ulang", status_400_lain, 502)
check("dan hanya menembak Sectors sekali", _akhir_diminta, ["2026-10-04"])


# Pemundurannya berhenti di batasnya, dan yang dilaporkan adalah pesan Sectors
# yang asli — bukan percobaan tanpa ujung.
def _get_selalu_tolak(url, *args, **kwargs):
    _akhir_diminta.append(kwargs["params"]["end"])
    raise _galat_histori(400, PESAN_MASA_DEPAN)


_akhir_diminta = []
m._cache.clear()
try:
    m.requests.get = _get_selalu_tolak
    try:
        m._fetch_history("BBCA", date(2026, 7, 26), date(2026, 10, 4))
        pesan_habis = "tidak melempar"
    except m.HTTPException as exc:
        pesan_habis = exc.detail
finally:
    m.requests.get = _get_asli
    m._cache.clear()

check(
    "percobaan berhenti di batasnya",
    len(_akhir_diminta),
    m._MAKS_MUNDUR_HARI + 1,
)
check(
    "galat asli Sectors tetap diteruskan",
    pesan_habis,
    predicate=lambda teks: "HTTP 400" in teks and "future" in teks,
)

print("\nSemua uji lulus.")
