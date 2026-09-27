# PRD: FinTrack Intelligence

**Hackathon:** Sectors Hackathon 2026 (Indonesia)
**Track:** Track 3 · Market Intelligence
**Status:** Draft v1.0
**Deadline submit:** 8 Oktober 2026, 23:59 WIB

---

## 1. Problem Statement

Pelaku bisnis dan investor di Indonesia kesulitan memantau **sinyal dan pola pasar keuangan** secara berkelanjutan karena data tersebar di banyak sumber (data resmi bursa, berita, kompetitor) dan sulit dibaca sebagai satu kesatuan tren jangka panjang. Dibutuhkan sistem yang mengumpulkan data ini secara otomatis dan mengubahnya menjadi sinyal, skor, dan insight yang mendukung pengambilan keputusan bisnis.

## 2. Product Vision

**FinTrack Intelligence** adalah sistem intelijen pasar keuangan yang:
1. Mengumpulkan data resmi pasar saham Indonesia secara berkelanjutan
2. Mengubah data mentah menjadi sinyal, skor, ranking, dan perbandingan yang mudah dibaca
3. Mendukung deteksi tren historis dan pola untuk keputusan bisnis jangka panjang

## 3. Goals & Success Metrics

| Goal | Metrik keberhasilan |
|---|---|
| Data resmi terkumpul otomatis | Bisa narik data ≥1 emiten tanpa error, terjadwal/berkala |
| Ubah data jadi sinyal | Minimal 1 jenis skor/indikator turunan (bukan cuma data mentah) |
| Bisa dibandingkan antar entitas | Bisa bandingkan ≥2 perusahaan/subsektor sekaligus |
| Bisa didemoin | Ada tampilan (dashboard/report) yang bisa dilihat juri dalam <3 menit |

## 4. Target User

- Analis ritel / investor individu yang tidak punya waktu memantau pasar tiap hari
- Tim riset kecil (startup, UMKM finansial) yang butuh insight pasar tanpa tim data science besar

## 5. Scope — MVP (Minimum Viable Product)

### 5.1 In Scope (wajib ada untuk submission)
- [ ] **Data ingestion**: ambil data resmi dari Sectors API untuk 4 emiten sektor perbankan: `BBCA`, `BBRI`, `BMRI`, `BBNI`
- [ ] **Penyimpanan data**: simpan hasil fetch ke local storage/database (supaya hemat API credit, tidak fetch berulang)
- [ ] **Pengolahan sinyal**: hitung minimal 1 indikator turunan, contoh:
  - % perubahan harga (harian/mingguan/bulanan)
  - Moving average sederhana (7 hari / 30 hari)
  - Skor relatif antar perusahaan dalam 1 subsektor (ranking berdasarkan market cap growth, dsb)
- [ ] **Tampilan hasil**: dashboard atau report yang menampilkan:
  - Tabel/kartu ringkasan per perusahaan
  - Grafik tren harga
  - Ranking/perbandingan antar perusahaan dalam sektor yang sama
- [ ] **Deliverable hackathon**: repo publik, video teaser 1 menit, video judging maks 3 menit, 1 kalimat problem statement, snapshot tim, link post sosial media (lihat Section 9)

### 5.2 Out of Scope (untuk MVP, bisa jadi pengembangan lanjutan)
- Data media sosial (sentiment analysis dari Twitter/X, dsb) — bukan bagian dari Sectors API, butuh integrasi tambahan terpisah
- Prediksi harga menggunakan machine learning kompleks
- Notifikasi real-time / alert otomatis
- Multi-user / autentikasi pengguna

> Catatan: deskripsi awal produk menyebut "data resmi, media sosial, kompetitor". Untuk MVP hackathon, prioritaskan **data resmi** (tersedia langsung dari Sectors API) dan **kompetitor** (lewat perbandingan antar emiten/subsektor, juga dari Sectors API). Data media sosial ditandai sebagai *stretch goal* karena butuh API/sumber data terpisah di luar Sectors.

## 6. Data Source & API Integration

**Provider:** Sectors Financial API v2 (`https://api.sectors.app/v2`)

**Autentikasi:**
- Header: `Authorization: <API_KEY>` (bukan format `Bearer <key>`, langsung value key-nya)
- API key disimpan sebagai environment variable `SECTORS_API_KEY`, **jangan hardcode di kode atau commit ke repo publik**
- Kredit API terbatas (1.000 credit dari hackathon, tiap request memotong kredit) — cache/simpan hasil fetch untuk menghindari pemanggilan berulang pada data yang sama

**Endpoint yang relevan (perlu diverifikasi exact path & parameter di API Playground / sectors.app/api sebelum implementasi final):**

| Kebutuhan | Endpoint (perkiraan) | Keterangan |
|---|---|---|
| Profil & fundamental perusahaan | `GET /v2/company/report/{symbol}/` | Overview, market cap, harga terakhir, all-time high/low |
| Harga saham historis harian | `GET /v2/daily/{symbol}/?start=&end=` | OHLC (open/high/low/close), volume, market cap per hari |
| Laporan keuangan historis | `GET /v2/company/financials/{symbol}/` | Income statement, balance sheet, dll |
| Perbandingan/agregat subsektor | `GET /v2/subsector/report/{subsector}/` | Data agregat untuk 1 subsektor (misal "banks") |
| Screener perusahaan | `GET /v2/companies/?q={query}` | Pencarian natural language |
| Daftar referensi | `GET /v2/subsectors/`, `/v2/industries/`, dll | Daftar kategori untuk mapping |

**Format response:** JSON. Contoh field penting dari `company/report`: `symbol`, `company_name`, `overview.market_cap`, `overview.last_close_price`, `overview.all_time_price`.

## 7. Proposed Tech Stack

| Layer | Opsi rekomendasi | Alasan |
|---|---|---|
| Data fetching | Python + `requests` | Sudah terbukti jalan, sederhana |
| Penyimpanan | SQLite / file JSON lokal | Ringan, tidak perlu server database terpisah untuk MVP |
| Pengolahan data | Python (`pandas` untuk perhitungan tren/agregasi) | Standar untuk analisis data tabular |
| Tampilan/dashboard | Streamlit atau halaman web (HTML/JS) | Cepat dibuat, cocok untuk demo hackathon |
| Penjadwalan (opsional) | `schedule` (Python) atau cron job | Untuk "berkelanjutan" sesuai deskripsi produk |

*(AI agent dipersilakan mengusulkan stack alternatif bila lebih efisien, selama memenuhi requirement fungsional di atas.)*

## 8. System Architecture (high-level)

```
[Sectors API] 
     │ (HTTP GET + API key)
     ▼
[Data Ingestion Layer] → simpan mentah ke [Local Storage/DB]
     │
     ▼
[Processing Layer] → hitung indikator turunan (tren, skor, ranking)
     │
     ▼
[Presentation Layer] → dashboard/report untuk end-user & juri
```

## 9. Hackathon Submission Requirements

Sesuai rules resmi (hackathon.sectors.app/rules), submission harus menyertakan:
- Link repo publik (GitHub)
- Video teaser 1 menit
- Video judging (maks 3 menit, public/unlisted)
- 1 kalimat problem statement
- Track yang dipilih: **Track 3 — Market Intelligence**
- Snapshot tim
- Link post media sosial (wajib, sesuai ketentuan sponsorship)

Submit sebelum **8 Oktober 2026, 23:59 WIB** — submission membekukan project secara otomatis begitu dikirim.

## 10. Constraints & Risks

- **Kredit API terbatas** (1.000 kredit, expire 3 bulan setelah diterbitkan) → wajib caching, jangan fetch ulang data yang sama
- **Exact endpoint path/parameter API belum 100% dikonfirmasi** dari dokumentasi resmi (masih berdasarkan hasil reverse-engineering CLI komunitas) → AI agent harus memvalidasi tiap endpoint di API Playground sebelum menganggapnya final
- **Data media sosial tidak tersedia dari Sectors API** → jika ingin tetap dimasukkan, perlu sumber data terpisah (di luar cakupan MVP ini)
- **Roster tim sudah terkunci** sejak klaim API credit — tidak bisa tambah/kurangi anggota

## 11. Decisions (Final — untuk dieksekusi langsung oleh AI agent)

1. **Fokus sektor demo:** Subsektor **Perbankan (Banks)**, dengan 4 emiten: `BBCA`, `BBRI`, `BMRI`, `BBNI`. (Bisa diperluas ke sektor lain setelah MVP jalan, tapi tidak wajib untuk submission.)
2. **Deployment:** **Jalan lokal saja** (tidak perlu deploy online). Aplikasi cukup dijalankan di mesin developer dan direkam layarnya untuk video teaser (1 menit) dan video judging (maks 3 menit) sesuai requirement submission.
3. **Definisi "kompetitor":** Perusahaan sejenis di **IDX saja**, menggunakan data dari Sectors API (`subsector report` dan/atau `companies` screener dengan filter subsektor yang sama). Tidak perlu integrasi sumber data eksternal di luar Sectors untuk MVP ini.
