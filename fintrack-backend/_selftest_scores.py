"""Uji cepat fungsi turunan di main.py dengan data sintetis.

Tidak memanggil Sectors sama sekali, jadi kredit API tidak terpakai.

Jalankan dari folder fintrack-backend:
    .\\.venv\\Scripts\\python.exe _selftest_scores.py
"""

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
check(
    "peer score: terbaik tidak otomatis 100",
    round(m._peer_score({"A": 10.0, "B": 0.0, "C": 5.0})["A"], 1),
    80.6,
)
check(
    "peer score: terburuk tidak otomatis 0",
    round(m._peer_score({"A": 10.0, "B": 0.0, "C": 5.0})["B"], 1),
    19.4,
)
check(
    "peer score: yang persis rata-rata dapat 50",
    round(m._peer_score({"A": 10.0, "B": 0.0, "C": 5.0})["C"], 1),
    50.0,
)
check(
    "peer score: semua sama -> 50 (tanpa bagi nol)",
    m._peer_score({"A": 3.0, "B": 3.0}),
    {"A": 50.0, "B": 50.0},
)
check(
    "peer score: nilai kosong tetap kosong",
    m._peer_score({"A": 1.0, "B": None, "C": 3.0}),
    {"A": 25.0, "B": None, "C": 75.0},
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

# --- batas atas realistis: semua komponen pada |z| maksimum n=4 ---
batas_atas = 50.0 + m.PEER_SCORE_SIGMA * (4 - 1) ** 0.5
check(
    "batas atas skor komponen (akar(n-1) = 1,73)",
    round(batas_atas, 1),
    93.3,
)
check(
    "batas atas tidak menyentuh 100, jadi penjepitan tidak aktif",
    batas_atas,
    predicate=lambda nilai: nilai < 100,
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

print("\nSemua uji lulus.")
