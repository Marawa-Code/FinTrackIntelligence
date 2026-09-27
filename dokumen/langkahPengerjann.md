# Langkah Pengerjaan FinTrack Intelligence (Bernomor)

Cara pakai: suruh AI agent kamu **satu nomor dalam satu waktu**, contoh:
> "Kerjakan nomor 1"

Jangan suruh "kerjakan semua" — tiap nomor sengaja dibuat berdiri sendiri (self-contained) supaya agent tidak mengerjakan hal di luar scope nomor itu, dan supaya kamu bisa cek hasilnya dulu sebelum lanjut ke nomor berikutnya.

⚠️ **Nomor 1–4 = Backend** (folder terpisah `fintrack-backend/`, satu-satunya yang pegang API key Sectors)
⚠️ **Nomor 5–8 = Mobile App** (folder terpisah `fintrack-mobile/`, TIDAK pernah pegang API key)

---

### Nomor 1 — Setup project backend
```
Buatkan project Python FastAPI baru di folder ini dengan struktur:
- main.py (entry point kosong dulu, cuma health check endpoint GET /health)
- .env.example (isi: SECTORS_API_KEY=isi_disini)
- .gitignore (ignore .env, __pycache__, venv)
- requirements.txt (fastapi, uvicorn, requests, python-dotenv)
- config.py (baca SECTORS_API_KEY dari file .env)

Jangan menulis API key asli di mana pun. Saya akan isi .env sendiri nanti.
```
**Setelah agent selesai:** kamu bikin file `.env` manual, isi `SECTORS_API_KEY=key_asli_kamu`.

---

### Nomor 2 — Endpoint ringkasan 4 bank
```
Tambahkan endpoint GET /api/banks/summary di main.py.
Endpoint ini memanggil Sectors API (https://api.sectors.app/v2/company/report/{symbol}/)
untuk 4 simbol: BBCA, BBRI, BMRI, BBNI. Gunakan SECTORS_API_KEY dari config.py
di header Authorization.
Response: array JSON berisi symbol, company_name, last_close_price,
market_cap, daily_close_change untuk tiap bank.
```

---

### Nomor 3 — Endpoint histori harga & ranking
```
Tambahkan 2 endpoint baru di main.py:

1. GET /api/banks/{symbol}/history?start=YYYY-MM-DD&end=YYYY-MM-DD
   -> panggil https://api.sectors.app/v2/daily/{symbol}/ dengan parameter
      start & end, kembalikan array OHLC (open, high, low, close, volume, date)

2. GET /api/banks/ranking
   -> ambil data 4 bank dari /api/banks/summary, urutkan berdasarkan
      daily_close_change dari terbesar ke terkecil, kembalikan array
      dengan field: rank, symbol, daily_close_change
```

---

### Nomor 4 — Cache & jalankan backend
```
Tambahkan caching sederhana (file JSON lokal atau in-memory dict dengan TTL
5 menit) ke semua endpoint di atas, supaya tidak memanggil Sectors API
berulang kali untuk data yang sama dalam waktu singkat.

Lalu buatkan instruksi cara menjalankan backend ini dengan uvicorn,
dan cara mengecek IP address lokal komputer saya (untuk diakses dari HP).
```
**Setelah ini:** jalankan `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`, lalu tes buka `http://localhost:8000/api/banks/summary` di browser — harus keluar JSON, bukan error.

---

### Nomor 5 — Setup project mobile (Expo)
```
Buatkan project Expo (React Native) baru dengan npx create-expo-app.
Install React Navigation untuk 3 screen: HomeScreen, DetailScreen, RankingScreen
(isi masing-masing masih kosong/placeholder dulu).
Buat juga file config/api.js berisi:
  export const BASE_URL = "http://192.168.x.x:8000";
(nanti saya ganti sesuai IP asli).
Jangan tambahkan kode apa pun yang berhubungan dengan API key Sectors —
app ini hanya akan memanggil BASE_URL di atas.
```

---

### Nomor 6 — HomeScreen (daftar 4 bank)
```
Isi HomeScreen: fetch data dari `${BASE_URL}/api/banks/summary`,
tampilkan sebagai daftar card — tiap card menampilkan nama bank,
harga terakhir, dan persentase perubahan harian (warna hijau kalau naik,
merah kalau turun). Tambahkan loading indicator saat data belum datang.
Tap salah satu card akan navigasi ke DetailScreen dengan membawa symbol bank itu.
```

---

### Nomor 7 — DetailScreen (grafik tren) & RankingScreen
```
Isi DetailScreen: fetch dari `${BASE_URL}/api/banks/{symbol}/history`
(30 hari terakhir), tampilkan sebagai grafik garis (pakai
react-native-chart-kit atau victory-native) untuk harga close harian.

Isi RankingScreen: fetch dari `${BASE_URL}/api/banks/ranking`,
tampilkan sebagai tabel/list terurut, ranking #1 di paling atas.
```

---

### Nomor 8 — Jalankan & polish tampilan
```
Tambahkan empty state (kalau data kosong/gagal fetch), basic styling
(warna, spacing, font) di ketiga screen supaya rapi untuk direkam
sebagai video demo. Tidak perlu login/autentikasi user.
```
**Setelah ini:** ganti `BASE_URL` di `config/api.js` sesuai IP dari Nomor 4, jalankan `npx expo start`, buka aplikasi **Expo Go** di HP (harus 1 WiFi yang sama dengan laptop), scan QR code yang muncul.

---

## Setelah nomor 1–8 selesai
Lanjut ke bagian rekam video demo & submission sesuai PRD_FinTrack_Intelligence.md Section 9.
