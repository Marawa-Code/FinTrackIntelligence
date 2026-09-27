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
- **Ranking** — urutan performa antar emiten dalam 1 sub-sektor
- **Skor/sinyal turunan** — bukan cuma angka mentah, tapi kesimpulan yang bisa langsung dibaca
- **Perbandingan kompetitor** — lihat siapa unggul di sektor yang sama

> ⚠️ Sesuai aturan Track 3: produk **wajib** menghasilkan insight turunan (skor/ranking/anomali), bukan cuma menampilkan data mentah dalam tampilan berbeda. Ini prinsip inti yang membedakan FinTrack dari sekadar "aplikasi lihat harga saham".

## Target Pengguna
| Siapa | Kebutuhan |
|---|---|
| Investor ritel individu | Insight cepat tanpa harus analisis manual tiap hari |
| Tim riset kecil (startup/UMKM finansial) | Alat pembanding kompetitor tanpa tim data science besar |

## Fitur Utama (MVP)
1. **Data resmi 4 bank** (BBCA, BBRI, BMRI, BBNI) — harga & profil fundamental
2. **Ranking otomatis** — urutan performa berdasarkan perubahan harga
3. **Grafik tren historis** — per emiten, mudah dibaca lewat mobile app
4. *(Rekomendasi tambahan, lihat catatan di bawah)* — deteksi anomali sederhana atau skor komposit, supaya makin jelas ini "intelligence" bukan sekadar "data viewer"

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
- `LANGKAH_BERNOMOR.md` — checklist eksekusi untuk AI agent
- `SECTORS_HACKATHON_RULES.md` — aturan resmi lengkap
- `EXECUTION_PLAN_Backend_Mobile.md` — arsitektur backend + mobile terpisah
