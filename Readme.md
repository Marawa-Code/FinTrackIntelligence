# FinTrack Intelligence

Dashboard intelijen pasar lokal untuk membandingkan bank-bank IDX. Lima bank pantauan — BBCA, BBRI, BMRI, BBNI, dan BNLI — dapat skor komposit penuh, sementara 43 bank lain di subsektor perbankan tetap bisa dibuka detailnya dan diadu berpasangan. Aplikasi mengambil data Sectors API melalui backend FastAPI, lalu menampilkan harga terakhir, perubahan harian, histori harga, dan ranking.

## Struktur

- `fintrack-backend/` — FastAPI yang menyimpan satu-satunya API key Sectors dan menyediakan cache in-memory 5 menit.
- `fintrack-mobile/` — Expo React Native dengan tab Bank, Ranking, Sektor, Anomali, dan Chat, plus layar Detail Bank dan Adu Bank.

## Prasyarat

- **Python 3.10 atau lebih baru.** `main.py` memakai anotasi `str | None` tanpa `from __future__ import annotations`, dan FastAPI mengevaluasinya saat runtime — di 3.9 aplikasinya gagal start.
- **Node 20 atau lebih baru**, untuk Expo SDK 57 dan React Native 0.86.
- **Expo Go** di HP, bila ingin menjalankan versi mobile.
- **Dua kunci API.** Keduanya hanya dipakai backend; tidak satu pun boleh masuk ke aplikasi mobile.
  - **Sectors** — buat akun di [sectors.app](https://sectors.app), lalu ambil kuncinya dari API Playground di [sectors.app/api](https://sectors.app/api).
  - **OpenRouter** — [openrouter.ai/keys](https://openrouter.ai/keys).

## Menjalankan lokal

### Backend

Ikuti instruksi lengkap di [README backend](fintrack-backend/README.md). Dua hal yang paling mudah terlewat:

- Buat `fintrack-backend/.env` dengan menyalin [`.env.example`](fintrack-backend/.env.example), bukan menulisnya dari nol. Isinya tiga variabel: `SECTORS_API_KEY`, `OPENROUTER_API_KEY`, dan `CORS_ALLOWED_ORIGINS`. Tanpa `OPENROUTER_API_KEY` backend tetap berjalan, tetapi `POST /api/chat` membalas `503`.
- Jalankan backend pada port `8000` dengan host `0.0.0.0`, supaya bisa dijangkau HP lewat Wi-Fi.

Endpoint utama:

- `GET /health`
- `GET /api/banks/summary`
- `GET /api/banks/{symbol}/history?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /api/banks/{symbol}/profile` — profil satu bank, termasuk bank di luar daftar pantauan
- `GET /api/banks/ranking` — peringkat harian sederhana berdasarkan perubahan harga
- `GET /api/banks/intelligence` — skor komposit 0–100, MA7/MA30, tren, volatilitas, dan sinyal anomali
- `GET /api/banks/score-trend` — deret skor harian untuk grafik
- `GET /api/sector/banks` — laporan subsektor perbankan
- `GET /api/sector/members` — seluruh anggota subsektor dan status pantauannya
- `POST /api/chat` — tanya jawab soal saham bank dan soal fitur aplikasi, dijawab model lewat OpenRouter

### Mobile

Ikuti [panduan aplikasi mobile](fintrack-mobile/README.md). Alamat backend tidak perlu diatur: `fintrack-mobile/config/api.js` menurunkannya sendiri dari alamat Metro yang sedang dipakai, jadi pindah Wi-Fi tidak menuntut perubahan apa pun. Jalankan Expo, lalu buka QR code dengan Expo Go pada HP yang memakai Wi-Fi sama.

## Data dan batasan

Data pasar bersumber dari Sectors Financial API v2. Cache backend berada di memori dan hilang ketika server dimulai ulang. Cache ringkasan berlaku 5 menit, sedangkan cache histori berlaku 1 jam karena OHLC harian hanya berubah sekali per hari bursa.

Aplikasi ini untuk demo lokal; API key tidak boleh dimasukkan ke aplikasi mobile atau commit ke repo.

## Skor komposit dan sinyal

Skor 0–100 di endpoint `/api/banks/intelligence` adalah **skor relatif**: tiap komponen diubah jadi z-score terhadap rata-rata bank pantauan, sehingga angka 50 berarti persis rata-rata kelompok itu. Skor menunjukkan posisi sebuah bank dibanding bank pantauan lainnya pada hari itu, bukan penilaian absolut. Bobotnya momentum 30%, tren 30%, stabilitas 20%, dan posisi MA 20%.

Konsekuensinya, bank di luar `BANK_SYMBOLS` **tidak punya skor sama sekali** — bukan berskor nol, melainkan tidak punya pembanding. Bank seperti itu tetap bisa dibuka detailnya dan diadu berpasangan; yang tidak ada hanyalah angka skornya.

Label skor memakai kata perbandingan ("di atas rata-rata", bukan "kuat"), karena bank bisa berlabel di atas rata-rata walaupun harganya sedang turun — bila bank pantauan lain turun lebih dalam. Backend juga menyertakan nilai mentah (MA7, MA30, tren, volatilitas, jarak harga ke MA, jumlah hari bursa) supaya gambaran absolutnya tetap terbaca, dan aplikasi menampilkannya berdampingan dengan skor tiap komponen.

Sinyal anomali memakai z-score perubahan harga harian terhadap sebaran 30 hari bursa sebelumnya; `|z| >= 2` ditandai sebagai lonjakan tidak wajar. Selain status hari terakhir, endpoint mengembalikan `anomaly_history`: seluruh lonjakan tidak wajar sepanjang jendela analisis (maksimal 5 terbaru, lengkap dengan tanggal, z-score, dan arah). Lonjakan volume ditandai bila volume terakhir mencapai dua kali rata-rata.

## Disclaimer

FinTrack Intelligence adalah alat informasi dan analisis, bukan nasihat atau rekomendasi investasi. Disclaimer ini juga ditampilkan di dalam aplikasi mobile.

## Hackathon

Track 3 — Market Intelligence. Naskah video dan checklist submission ada di [SUBMISSION_GUIDE.md](dokumen/SUBMISSION_GUIDE.md).
