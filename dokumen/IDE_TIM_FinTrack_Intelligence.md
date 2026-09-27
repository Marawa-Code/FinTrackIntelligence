# Ide Tim — FinTrack Intelligence

**Hackathon:** Sectors Hackathon 2026
**Track:** Track 3 · Market Intelligence

---

## Problem Statement (1 kalimat, untuk submission)
> Investor ritel dan tim riset kecil di Indonesia sulit memantau tren dan anomali pasar saham secara berkelanjutan karena data tersebar, sehingga FinTrack Intelligence menyajikan skor dan ranking otomatis antar emiten untuk mendukung keputusan bisnis.

*(Silakan disesuaikan gaya bahasanya, tapi struktur "untuk siapa + masalah apa + apa solusinya" ini yang diminta panitia.)*

## Latar Belakang Masalah
- Data pasar saham resmi tersedia, tapi **mentah dan terpisah-pisah** per emiten
- Investor individu / tim riset kecil **tidak punya waktu** memantau puluhan saham tiap hari
- Sulit membandingkan performa satu perusahaan dengan kompetitornya secara cepat
- Dibutuhkan cara untuk **mengubah data mentah menjadi sinyal** yang langsung bisa dipakai ambil keputusan

## Solusi: FinTrack Intelligence
Sistem intelijen pasar yang **mengumpulkan data resmi pasar saham Indonesia** (lewat Sectors API) dan mengubahnya menjadi:
- **Skor komposit relatif 0–100** — gabungan momentum, tren, stabilitas, dan posisi harga terhadap MA7/MA30. Angka 50 berarti persis rata-rata keempat bank
- **Deteksi anomali** — penanda otomatis untuk pergerakan harga harian yang menyimpang lebih dari dua simpangan baku dari sebaran 30 hari bursa sebelumnya
- **Ranking & perbandingan kompetitor** — keempat bank dalam satu layar, sehingga terlihat siapa yang paling bertahan ketika seluruh sektor bergerak turun

> ⚠️ Sesuai aturan Track 3: produk **wajib** menghasilkan insight turunan (skor/ranking/anomali), bukan cuma menampilkan data mentah dalam tampilan berbeda. Ini prinsip inti yang membedakan FinTrack dari sekadar "aplikasi lihat harga saham".

## Target Pengguna
| Siapa | Kebutuhan |
|---|---|
| Investor ritel individu | Insight cepat tanpa harus analisis manual tiap hari |
| Tim riset kecil (startup/UMKM finansial) | Alat pembanding kompetitor tanpa tim data science besar |

## Fitur Utama (MVP)
1. **Data resmi 4 bank** (BBCA, BBRI, BMRI, BBNI) — harga terakhir, perubahan harian, histori penutupan harian, dan nama emiten
2. **Skor komposit relatif 0–100** — bobot momentum 30%, tren 30%, stabilitas 20%, posisi MA 20%. Tiap komponen diubah jadi z-score terhadap rata-rata keempat bank, jadi skor menunjukkan posisi sebuah bank di antara pesaingnya — bukan penilaian mutlak
3. **Deteksi anomali** — z-score perubahan harga harian terhadap sebaran 30 hari bursa sebelumnya; `|z| ≥ 2` ditandai sebagai lonjakan tidak wajar, lengkap dengan riwayat sepanjang jendela analisis
4. **Grafik tren historis** — per emiten, mudah dibaca lewat mobile app
5. **Nilai mentah di samping tiap skor** — MA7, MA30, tren, volatilitas, dan jarak harga ke MA ditampilkan berdampingan dengan skor komponennya, supaya skor relatif tidak pernah terbaca sebagai klaim mutlak

## Diferensiasi / Kenapa ini Menarik
- Fokus **niche jelas** (sub-sektor perbankan) → mudah dijelaskan dalam video 1 menit
- **Mobile-first** (React Native + Expo) → demo tinggal scan QR, terasa lebih "produk nyata" dibanding web dashboard biasa
- Arsitektur **aman** (API key tidak pernah ada di sisi aplikasi mobile) → nilai plus di "technical depth & execution" saat dinilai juri

## Tech Stack Singkat
- Backend: Python FastAPI (pegang API key, olah data)
- Frontend: React Native + Expo (demo via Expo Go)
- Data source: Sectors Financial API v2

## Kepatuhan yang Wajib Diingat
- Tambahkan **disclaimer**: "Produk ini adalah alat informasi & analisis, bukan nasihat/rekomendasi investasi"
- Tidak boleh ada fitur eksekusi order beli/jual otomatis
- Repo baru, dibuat setelah 19 Agustus 2026, tetap publik ≥90 hari setelah 17 Oktober 2026

## Dokumen Pendukung Lain
- `PRD_FinTrack_Intelligence.md` — spesifikasi produk detail
- `langkahPengerjann.md` — langkah pengerjaan bernomor, checklist eksekusi untuk AI agent
- `SECTORS_HACKATHON_RULES.md` — aturan resmi lengkap
- `SUBMISSION_GUIDE.md` — checklist submission dan problem statement
- `NASKAH_VIDEO_DAN_POST_FinTrack.md` — naskah video teaser & judging, plus caption media sosial
- `../fintrack-backend/README.md` dan `../fintrack-mobile/README.md` — cara menjalankan backend dan aplikasi mobile
