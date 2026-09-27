# FinTrack Intelligence

Dashboard intelijen pasar lokal untuk membandingkan empat emiten perbankan IDX: BBCA, BBRI, BMRI, dan BBNI. Aplikasi mengambil data Sectors API melalui backend FastAPI, lalu menampilkan harga terakhir, perubahan harian, histori 30 hari, dan ranking.

## Struktur

- `fintrack-backend/` — FastAPI yang menyimpan satu-satunya API key Sectors dan menyediakan cache in-memory 5 menit.
- `fintrack-mobile/` — Expo React Native dengan screen Home, Detail, dan Ranking.

## Menjalankan lokal

### Backend

Ikuti instruksi lengkap di [README backend](fintrack-backend/README.md). Buat `fintrack-backend/.env` berisi `SECTORS_API_KEY=<api-key-anda>`, lalu jalankan backend pada port `8000` dengan host `0.0.0.0`.

Endpoint utama:

- `GET /health`
- `GET /api/banks/summary`
- `GET /api/banks/{symbol}/history?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /api/banks/ranking` — peringkat harian sederhana berdasarkan perubahan harga
- `GET /api/banks/intelligence` — skor komposit 0–100, MA7/MA30, tren, volatilitas, dan sinyal anomali

### Mobile

Ikuti [panduan aplikasi mobile](fintrack-mobile/README.md). Atur `BASE_URL` di `fintrack-mobile/config/api.js` ke IPv4 Wi-Fi komputer, lalu jalankan Expo dan buka QR code dengan Expo Go pada HP yang memakai Wi-Fi sama.

## Data dan batasan

Data pasar bersumber dari Sectors Financial API v2. Cache backend berada di memori dan hilang ketika server dimulai ulang. Cache ringkasan berlaku 5 menit, sedangkan cache histori berlaku 1 jam karena OHLC harian hanya berubah sekali per hari bursa.

Aplikasi ini untuk demo lokal; API key tidak boleh dimasukkan ke aplikasi mobile atau commit ke repo.

## Skor komposit dan sinyal

Skor 0–100 di endpoint `/api/banks/intelligence` adalah **skor relatif**: tiap komponen diubah jadi z-score terhadap rata-rata empat bank, sehingga angka 50 berarti persis rata-rata keempatnya. Skor menunjukkan posisi sebuah bank dibanding tiga pesaingnya pada hari itu, bukan penilaian absolut. Bobotnya momentum 30%, tren 30%, stabilitas 20%, dan posisi MA 20%.

Label skor memakai kata perbandingan ("di atas rata-rata", bukan "kuat"), karena bank bisa berlabel di atas rata-rata walaupun harganya sedang turun — bila ketiga pesaingnya turun lebih dalam. Backend juga menyertakan nilai mentah (MA7, MA30, tren, volatilitas, jarak harga ke MA, jumlah hari bursa) supaya gambaran absolutnya tetap terbaca, dan aplikasi menampilkannya berdampingan dengan skor tiap komponen.

Sinyal anomali memakai z-score perubahan harga harian terhadap sebaran 30 hari bursa sebelumnya; `|z| >= 2` ditandai sebagai lonjakan tidak wajar. Selain status hari terakhir, endpoint mengembalikan `anomaly_history`: seluruh lonjakan tidak wajar sepanjang jendela analisis (maksimal 5 terbaru, lengkap dengan tanggal, z-score, dan arah). Lonjakan volume ditandai bila volume terakhir mencapai dua kali rata-rata.

## Disclaimer

FinTrack Intelligence adalah alat informasi dan analisis, bukan nasihat atau rekomendasi investasi. Disclaimer ini juga ditampilkan di dalam aplikasi mobile.

## Hackathon

Track 3 — Market Intelligence. Naskah video dan checklist submission ada di [SUBMISSION_GUIDE.md](dokumen/SUBMISSION_GUIDE.md).
