"""Uji endpoint skor terhadap Sectors API yang sebenarnya.

PERHATIAN: skrip ini memanggil Sectors API dan MEMAKAI KREDIT
(4 panggilan company/report + 4 panggilan daily = 8 kredit).
Jalankan sekali saja, lalu tempel seluruh keluarannya.

Jalankan dari folder fintrack-backend:
    .\\.venv\\Scripts\\python.exe _cek_endpoint.py
"""

import json

import main

print("Memanggil Sectors API... (8 kredit)\n")

hasil = main.get_banks_intelligence()

print("=== RINGKASAN ===")
for bank in hasil:
    print(
        f"{bank['rank']}. {bank['symbol']:<5} skor={bank['score']} "
        f"({bank['score_label']})"
    )
    print(f"    komponen     : {bank['components']}")
    print(f"    MA7/MA30     : {bank['ma7']} / {bank['ma30']}  (jarak {bank['ma_gap']})")
    print(f"    hari bursa   : {bank['sessions']}")
    print(f"    volume spike : {bank['volume_spike']}")
    print(f"    anomali kini : {bank['anomaly']}")
    print(f"    riwayat      : {bank['anomaly_history']}")
    print(f"    sinyal       : {bank['signals']}")
    print()

print("=== CEK 1: satuan daily_close_change ===")
for bank in hasil:
    nilai = bank["daily_close_change"]
    if nilai is None:
        print(f"{bank['symbol']:<5} None  -> FIELD TIDAK DITEMUKAN. Cek section valuation/overview.")
    elif abs(nilai) < 1:
        print(f"{bank['symbol']:<5} {nilai!r:<10} -> pecahan, BENAR (0.0124 = 1,24%)")
    else:
        print(f"{bank['symbol']:<5} {nilai!r:<10} -> PERSEN. Aplikasi akan salah, tampil dikali 100.")

print("\n=== CEK 2: ketersediaan data historis ===")
for bank in hasil:
    if bank["sessions"] < 30:
        print(f"{bank['symbol']:<5} hanya {bank['sessions']} hari bursa -> MA30 kosong, skor None")
    elif bank["ma30"] is None:
        print(f"{bank['symbol']:<5} {bank['sessions']} hari bursa tapi MA30 None -> ADA MASALAH")
    else:
        print(f"{bank['symbol']:<5} {bank['sessions']} hari bursa -> cukup, MA30={bank['ma30']}")

print("\n=== CEK 3: skor terhitung semua? ===")
kosong = [bank["symbol"] for bank in hasil if bank["score"] is None]
if kosong:
    print(f"Skor kosong untuk: {kosong} -> komponen tidak lengkap, cek data historisnya.")
else:
    print("Keempat bank punya skor. Fitur skor siap dipakai.")

print("\n=== CEK 4: sebaran skor ===")
skor = [bank["score"] for bank in hasil if bank["score"] is not None]
if skor:
    print(f"tertinggi={max(skor)} terendah={min(skor)} selisih={round(max(skor) - min(skor), 1)}")
    if max(skor) == min(skor):
        print("PERINGATAN: semua skor sama, skor tidak punya daya beda.")
    if max(skor) > 93.4 or min(skor) < 6.6:
        print(
            "PERINGATAN: ada komponen yang menyentuh batas penjepitan 0/100. "
            "Untuk 4 bank, skor komponen seharusnya mentok di 93,3 / 6,7."
        )

print("\n=== CEK 5: riwayat anomali bisa ditampilkan di video? ===")
ada_riwayat = [bank["symbol"] for bank in hasil if bank["anomaly_history"]]
if ada_riwayat:
    print(f"Ada temuan anomali pada: {ada_riwayat} -> badge bisa direkam.")
else:
    print(
        "Belum ada lonjakan tidak wajar sepanjang jendela. Ini wajar saat pasar tenang; "
        "badge anomali tetap valid karena dihitung dari data nyata."
    )

print("\n=== CEK 6: label harus relatif, bukan mutlak ===")
for bank in hasil:
    label = bank["score_label"]
    if any(kata in label for kata in ("Kuat", "Lemah", "Bagus", "Buruk")):
        print(f"{bank['symbol']:<5} '{label}' -> MASIH MENGKLAIM MUTLAK, perlu diganti.")
    else:
        print(f"{bank['symbol']:<5} '{label}' -> relatif, benar.")

print("\n=== JSON MENTAH (untuk dokumentasi video) ===")
print(json.dumps(hasil, indent=2, ensure_ascii=False))
