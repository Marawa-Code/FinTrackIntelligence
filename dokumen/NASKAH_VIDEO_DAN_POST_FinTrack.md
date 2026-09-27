# Naskah Video dan Post Media Sosial — FinTrack Intelligence

> **Berkas ini menggantikan dua bagian naskah di `SUBMISSION_GUIDE.md`** (bagian "Naskah teaser
> 1 menit" dan "Naskah judging video maksimal 3 menit"). Alasan penggantian ada di bagian
> terakhir berkas ini. Bagian checklist dan problem statement di `SUBMISSION_GUIDE.md` masih
> berlaku dan tidak diubah.

---

## 0. Sebelum merekam — wajib dilakukan

1. **Nyalakan backend.** `cd fintrack-backend`, lalu `uvicorn main:app --host 0.0.0.0 --port 8000`.
   Buka `http://localhost:8000/health` di browser komputer, pastikan `{"status":"ok"}`.
2. **Samakan IP.** Cek `ipconfig`, bandingkan **IPv4 Address** dengan isi
   `fintrack-mobile/config/api.js`. Kalau berbeda, ubah `BASE_URL` lalu restart Expo. Ini
   penyebab kegagalan paling umum saat demo — IP Wi-Fi berubah sejak terakhir dipakai.
3. **HP dan komputer di Wi-Fi yang sama.** Matikan data seluler di HP supaya tidak berpindah
   jaringan diam-diam di tengah rekaman.
4. **Buka aplikasi sekali sebelum merekam.** Layar pertama memuat agak lambat (backend
   memanggil Sectors). Jangan sampai detik pertama rekaman berisi spinner.
5. **⚠️ JANGAN sampai API key terlihat.** Tutup jendela terminal yang menampilkan isi `.env`,
   dan jangan buka berkas `.env` di editor selama merekam. Aturan baris 106: hapus semua API
   key sebelum submit. Video teaser dipublikasikan **publik**, jadi kebocoran di situ permanen.
6. **Baca ulang angkanya, jangan hafalkan.** Semua angka di naskah ini diambil **27 September
   2026**. Harga berubah setiap hari bursa, jadi skor saat Anda merekam **akan berbeda**.
   Buka layar Ranking dan Detail hari itu, lalu bacakan yang benar-benar tampil. Kalau naskah
   dan layar berbeda, **layar yang benar** — jangan pernah menyebut angka yang tidak ada di layar.
7. **Mode pesawat untuk notifikasi.** Atau aktifkan Jangan Ganggu. Notifikasi WhatsApp di tengah
   rekaman merusak kualitas video, dan 30% nilai ada di kualitas video.

---

## 1. Video teaser (60 detik, wajib publik)

Aturan baris 107: **screen recording produk yang jalan**, dipublikasikan **publik** di
YouTube/media sosial. Format: satu rekaman layar menerus, hanya judul dan penutup yang boleh
berupa kartu terpisah.

Batas aman narasi: **≤ 130 kata**. Kalau kepanjangan, potong bagian Detail (0:45–0:54) lebih dulu.

| Waktu | Yang tampil di layar | Narasi |
|---|---|---|
| 0:00–0:07 | Kartu judul: **FinTrack Intelligence** — Track 3, Market Intelligence | "Empat bank terbesar Indonesia. Mana yang sedang bertahan paling baik?" |
| 0:07–0:18 | **Home.** Empat kartu bank: harga, persentase perubahan harian, dan pil skor. Gerakkan jari pelan menyusuri kartu. | "FinTrack Intelligence merangkum BBCA, BBRI, BMRI, dan BBNI dari data Sectors. Harga, perubahan harian, dan skor relatif — dalam satu layar." |
| 0:18–0:33 | Tekan **"Lihat ranking harian"**. Layar Ranking terbuka. **Berhenti di kartu BBCA**, jangan langsung gulir. Sorot angka skor besarnya. | "Skornya bukan penilaian mutlak. Angka 50 berarti persis rata-rata keempatnya. BBCA tertinggi, 69 — padahal tren 48 hari bursanya minus 3,47 persen. Skor itu datang dari stabilitas dan kedekatannya ke rata-rata pergerakan, bukan dari kenaikan harga." |
| 0:33–0:45 | Gulir pelan ke kartu **BBRI**. Berhenti saat **kotak riwayat anomali** masuk layar. Tahan tiga detik di situ. | "Sistem juga menandai lonjakan harga yang tidak wajar. BBRI punya tiga dalam 48 hari bursa terakhir — lengkap dengan tanggal dan z-score-nya." |
| 0:45–0:54 | Kembali ke Home, buka **Detail** satu bank, tunjukkan grafik 30 hari. | "Dan semuanya bisa ditelusuri sampai harga penutupan hariannya." |
| 0:54–1:00 | Kartu penutup: nama produk + **Track 3 — Market Intelligence** | "FinTrack Intelligence. Alat analisis, bukan nasihat investasi." |

**Yang wajib terlihat di teaser** — periksa ulang sebelum mengunggah:
- [ ] Angka skor komposit besar di layar Ranking (bukan cuma harga)
- [ ] Kotak riwayat anomali di kartu BBRI
- [ ] Grafik 30 hari di Detail
- [ ] Kalimat penutup yang menyebut "bukan nasihat investasi"

---

## 2. Video judging (maksimal 3 menit, boleh unlisted)

Aturan baris 108: walkthrough lengkap — masalah, target pengguna, core workflow. Boleh
YouTube/Vimeo (public/unlisted), Google Drive (sharing aktif), atau Loom.
**Video yang tidak bisa diakses = tidak dinilai.**

Batas aman narasi: **≤ 380 kata**.

### 0:00–0:20 — Masalah dan pengguna

Tampil: kartu judul, lalu potongan layar Home.

> "Investor ritel dan tim riset kecil yang memantau saham perbankan IDX harus membuka banyak
> sumber terpisah untuk satu pertanyaan sederhana: di antara bank-bank besar, mana yang
> sebenarnya sedang bertahan paling baik? Membandingkan pergerakan satu per satu menyita waktu,
> dan angka mentah tidak langsung menjawabnya."

### 0:20–0:40 — Produk

Tampil: **Home**, gulir pelan keempat kartu.

> "FinTrack Intelligence adalah dashboard lokal yang menyatukan BBCA, BBRI, BMRI, dan BBNI
> dalam satu layar. Setiap kartu menunjukkan harga terakhir, perubahan harian yang diberi tanda
> warna, dan skor relatif terhadap tiga bank lainnya."

### 0:40–1:05 — Data dan arsitektur

Tampil: **jendela terminal backend** (pastikan `.env` tidak terlihat), lalu `localhost:8000/health`,
lalu layar Ranking kembali.

> "Semua data berasal dari Sectors Financial API. Backend FastAPI memanggil dua endpoint —
> laporan perusahaan untuk ringkasan dan data harian untuk histori harga. Aplikasi Expo di HP
> hanya memanggil backend lokal; **API key tidak pernah ada di aplikasi mobile**, hanya di berkas
> `.env` yang di-gitignore. Ringkasan di-cache lima menit, histori satu jam, supaya kredit
> Sectors tidak terbuang saat pengguna membuka-tutup layar."

### 1:05–2:30 — Demo langsung (inti video)

Tampil: alur Home → Detail → kembali → Ranking. **Di sinilah qualifying test terbukti.**

**(a) 1:05–1:25 — Detail.** Buka satu bank, tunjukkan grafik 30 hari.
> "Dari Home, tiap bank bisa dibuka untuk melihat harga penutupan harian 30 hari terakhir."

**(b) 1:25–1:55 — Ranking, skor komposit.** Kembali, buka Ranking. Berhenti di kartu BBCA.
> "Di layar ranking, tiap bank dapat skor gabungan dari empat komponen: momentum, tren,
> stabilitas, dan posisi harga terhadap moving average. Bobotnya 30, 30, 20, dan 20 persen.
> BBCA memimpin dengan 69 koma 1 — meskipun tren 48 hari bursanya minus 3,47 persen. Skor
> tinggi itu berasal dari volatilitasnya yang paling rendah dan posisinya yang paling dekat ke
> rata-rata pergerakannya."

**(c) 1:55–2:15 — ⭐ Momen technical depth: kenapa BBNI skor trennya 50 padahal turun.**

Gulir ke kartu **BBNI**. Sorot baris komponen mentahnya.
> "Perhatikan BBNI. Skor trennya 50 — hampir tepat rata-rata — padahal trennya turun 2,51 persen.
> Itu bukan kesalahan hitung. Rata-rata keempat bank juga turun sekitar 2,5 persen, jadi BBNI
> memang berada tepat di tengah. Justru karena itu setiap skor komponen saya tampilkan
> berdampingan dengan angka sebenarnya: Tren 50 di sebelah minus 2,51 persen. Skor relatif tidak
> boleh dibaca sebagai klaim mutlak."

**(d) 2:15–2:30 — Deteksi anomali.** Sorot kotak riwayat anomali di kartu BBRI.
> "Untuk anomali, tiap hari dibandingkan dengan sebaran 30 hari bursa sebelumnya memakai
> z-score. Kalau menyimpang lebih dari dua simpangan baku, hari itu ditandai. BBRI punya tiga
> dalam 48 hari bursa terakhir — dua turun, satu naik — lengkap dengan tanggal, z-score, dan
> besaran perubahannya."

### 2:30–2:50 — Nilai produk dan batasan (jujur)

> "Nilainya ada di pertanyaan yang dijawab: ketika seluruh sektor turun, mana yang paling
> bertahan. Untuk MVP ini, cakupannya sengaja dibatasi — baru empat bank di sektor perbankan,
> hanya berjalan lokal, dan datanya bisa berbeda dengan data resmi bursa. Kami belum menambahkan
> prediksi machine learning maupun fitur media sosial."

### 2:50–3:00 — Penutup

Tampil: kartu penutup dengan nama produk + Track 3.

> "FinTrack Intelligence membantu investor ritel membaca pergerakan saham perbankan IDX dari
> satu dashboard. Track 3 — Market Intelligence. Alat informasi dan analisis, bukan nasihat
> investasi."

**Yang wajib terlihat di video judging** — periksa ulang sebelum mengunggah:
- [ ] Skor komposit + keempat komponennya
- [ ] Nilai mentah berdampingan dengan skor komponen (momen BBNI)
- [ ] Riwayat anomali dengan tanggal dan z-score
- [ ] Grafik 30 hari (bukti datanya nyata, bukan angka karangan)
- [ ] Disclaimer disebut minimal sekali secara lisan **dan** terlihat di layar
- [ ] Tidak ada API key yang terlihat di frame mana pun

---

## 3. Post media sosial

Aturan baris 111: publikasikan di **Instagram / LinkedIn / Threads / TikTok**, **tag akun resmi
Sectors**, dan **pakai template thumbnail** yang disediakan:
https://canva.link/mexgt4g89m17xln

> **⚠️ Isi dulu sebelum posting.** Pengendali akun resmi Sectors **tidak disebutkan** di dokumen
> aturan mana pun, jadi saya tidak mengarangnya. Ambil nama akun yang benar dari channel
> `#support` di Slack resmi atau dari Instagram Sectors, lalu ganti `[AKUN_RESMI_SECTORS]` di bawah.

### Versi pendek — TikTok / Threads / Instagram

> Empat bank terbesar Indonesia. Mana yang sedang bertahan paling baik?
>
> FinTrack Intelligence merangkum BBCA, BBRI, BMRI, dan BBNI dari data Sectors dalam satu
> dashboard lokal. Bukan cuma menampilkan harga: tiap bank dapat skor relatif dari momentum,
> tren, stabilitas, dan posisi terhadap moving average — plus penanda otomatis untuk lonjakan
> harga yang tidak wajar, lengkap dengan z-score-nya.
>
> Ketika seluruh sektor turun, yang berguna bukan "murah atau tidak", tapi "siapa yang paling
> bertahan". Itu yang kami coba jawab.
>
> Alat informasi dan analisis, bukan nasihat atau rekomendasi investasi.
>
> #SectorsHackathon #MarketIntelligence [AKUN_RESMI_SECTORS]

### Versi panjang — LinkedIn

> **FinTrack Intelligence — membaca pergerakan bank IDX dari satu dashboard**
>
> Kami mengikuti Sectors Hackathon 2026 di Track 3 — Market Intelligence.
>
> **Masalahnya:** investor ritel dan tim riset kecil harus membuka banyak sumber terpisah untuk
> menjawab satu pertanyaan sederhana — di antara bank-bank besar IDX, mana yang sebenarnya
> sedang bertahan paling baik? Angka mentah tidak langsung menjawabnya.
>
> **Yang kami bangun:** dashboard lokal yang menyatukan BBCA, BBRI, BMRI, dan BBNI. Semua data
> diambil dari Sectors Financial API lewat backend FastAPI, lalu diolah menjadi insight turunan:
>
> - **Skor komposit relatif** 0–100 dari momentum, tren, stabilitas, dan posisi harga terhadap
>   MA7/MA30. Nilai 50 berarti persis rata-rata keempat bank.
> - **Deteksi anomali** memakai z-score perubahan harga harian terhadap sebaran 30 hari bursa
>   sebelumnya, plus riwayat lonjakan sepanjang jendela analisis.
>
> Satu keputusan desain yang kami anggap penting: skornya **relatif**, bukan mutlak. Bank bisa
> berlabel "di atas rata-rata" walaupun harganya sedang turun, bila ketiga pesaingnya turun lebih
> dalam. Karena itu setiap skor komponen kami tampilkan berdampingan dengan angka sebenarnya,
> supaya tidak pernah terbaca sebagai klaim mutlak.
>
> **Batasan MVP:** baru empat bank di sektor perbankan, berjalan lokal, dan data dapat berbeda
> dengan data resmi bursa. Belum ada prediksi ML maupun fitur media sosial.
>
> Produk ini alat informasi dan analisis, **bukan** nasihat atau rekomendasi investasi.
>
> #SectorsHackathon #MarketIntelligence #Fintech #IDX [AKUN_RESMI_SECTORS]

---

## 4. Kenapa naskah lama diganti

Naskah di `SUBMISSION_GUIDE.md` ditulis sebelum fitur skor komposit dan deteksi anomali ada.
Dua akibatnya:

1. **Menyebut "ranking harian"** — padahal yang dibangun sekarang adalah skor komposit berbobot
   dengan riwayat anomali. Naskah lama menjual produk yang lebih sederhana daripada yang ada.
2. **Lebih serius: naskah judging mengalokasikan 65 detik untuk demo tanpa sekali pun menyebut
   skor komposit atau anomali.** Padahal aturan baris 183 mensyaratkan fitur inti **tidak boleh
   cuma menampilkan data mentah** — harus ada olahan berupa skor/ranking/anomali. Video judging
   adalah tempat penilai memverifikasi syarat itu. Direkam apa adanya, penilai akan melihat data
   mentah dalam tampilan rapi, dan justru fitur yang menentukan kelulusan tidak pernah muncul.

Naskah baru ini menaruh bukti qualifying test di porsi terbesar kedua video: teaser 0:18–0:45
(27 dari 60 detik) dan judging 1:25–2:30 (65 dari 180 detik).
