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
- `GET /api/banks/ranking`

### Mobile

Ikuti [panduan aplikasi mobile](fintrack-mobile/README.md). Atur `BASE_URL` di `fintrack-mobile/config/api.js` ke IPv4 Wi-Fi komputer, lalu jalankan Expo dan buka QR code dengan Expo Go pada HP yang memakai Wi-Fi sama.

## Data dan batasan

Data pasar bersumber dari Sectors Financial API v2. Cache backend berada di memori dan hilang ketika server dimulai ulang. Aplikasi ini untuk demo lokal; API key tidak boleh dimasukkan ke aplikasi mobile atau commit ke repo.

## Hackathon

Track 3 — Market Intelligence. Naskah video dan checklist submission ada di [SUBMISSION_GUIDE.md](SUBMISSION_GUIDE.md).
