# Sectors Hackathon 2026 — Dokumen Referensi Lengkap

Sumber resmi: hackathon.sectors.app/rules, hackathon.sectors.app/tracks/market-intelligence
Diringkas untuk: AI coding agent yang mengerjakan project **FinTrack Intelligence**

---

## 1. Semangat Kompetisi

Ini **bukan** kompetisi "siapa yang kodenya paling canggih". Yang dinilai: **apakah produk ini benar-benar bisa dipakai orang sungguhan, hari ini juga**, dengan data Sectors sebagai inti (core), bukan cuma tempelan.

> "Solve an interesting problem thoughtfully with Sectors API"

## 2. Tanggal Penting

| Milestone | Tanggal |
|---|---|
| Registrasi dibuka | 19 Agustus 2026 |
| Build period dibuka | 19 Agustus 2026 |
| Registrasi ditutup | **7 Oktober 2026, 23:59 WIB** |
| Build period & submission ditutup | **8 Oktober 2026, 23:59 WIB** |
| Periode judging | 9–16 Oktober 2026 |
| Pengumuman pemenang | 17 Oktober 2026 |

## 3. Eligibility (Kelayakan Peserta)

- Terbuka untuk WNI atau residen yang berdomisili di Indonesia
- Semua umur boleh ikut; di bawah 18 tahun wajib ada persetujuan orang tua/wali (termasuk untuk publikasi media & penerimaan hadiah)
- Karyawan/kontraktor/juri/mentor/organizer dari Supertype, Sectors, Algoritma (+ keluarga inti mereka) **tidak boleh** ikut
- Registrasi **gratis**
- **Setiap anggota tim wajib** membuat akun Sectors dan **menyelesaikan onboarding** di sectors.app **sebelum menulis kode project apa pun**. Ini diverifikasi saat eligibility check — kalau ada 1 anggota yang belum onboarding, submission tim bisa dianggap tidak valid.

## 4. Tim & API Credits

- Solo atau tim 2–4 orang (solo dihitung sebagai "tim satu orang")
- Satu orang **hanya boleh** terdaftar di 1 tim. Kalau ketahuan di banyak tim, dikeluarkan dari semua tim (kecuali ada kolusi sengaja → semua tim terkait didiskualifikasi)
- **Satu tim hanya boleh submit 1 project**
- **Roster tim terkunci** begitu tim klaim 1.000 API credit bonus (sudah terjadi di kasus kamu)
- Tiap tim menunjuk **1 perwakilan** sebagai kontak resmi, pemegang API credit, dan penerima hadiah
- Hadiah diberikan per tim; cara bagi hadiah adalah urusan internal tim

### Soal API Credits
- 1.000 credit per tim, klaim lewat team page setelah semua onboarding selesai
- **Bikin akun tambahan buat dapat credit ekstra untuk project yang sama = pelanggaran, bisa didiskualifikasi**
- Credit **hanya untuk develop project kompetisi**, tidak bisa dipindah tangan, tidak bisa ditukar uang/kompensasi lain, dan **expire saat event berakhir** (kecuali organizer bilang lain)

## 5. Build Period & Batasan Kerja

- Build period: **19 Agustus – 8 Oktober 2026, 23:59 WIB**. Tim bebas mulai kapan saja dalam rentang ini, tidak ada "build week" khusus
- **Sebelum 19 Agustus 2026: ide, riset, sketsa, desain, planning BOLEH. Menulis kode project TIDAK BOLEH**
- Repository **harus dibuat selama build period**. Juri bisa cek commit history — repo yang dibuat sebelum 19 Agustus, atau kode yang dipindah dari project lama, **bisa kena diskualifikasi**
- Mulai dari template/boilerplate publik **boleh** — yang penting first commit jatuh di dalam build period
- Boleh pakai boilerplate, framework, library, kode open-source publik, **selama bukan produk jadi**. Meng-open-source project lama sendiri sebelum event khusus untuk dipakai ulang saat event = **dilarang**
- Project harus **eksklusif untuk Sectors Hackathon** — tidak boleh mengandung kerja dari project sebelumnya, dan tidak boleh disubmit ke kompetisi lain
- **Repo & aplikasi ter-freeze** begitu tim submit, atau saat deadline 8 Oktober — mana yang lebih dulu. Setelah freeze, **tidak boleh ada commit/push/edit apa pun**, termasuk bug fix. Pelanggaran = diskualifikasi
- **Satu-satunya pengecualian freeze:** kalau API key/credential bocor. Lapor ke Slack `#support`, revoke & rotate credential dulu, baru push commit yang **isinya cuma penghapusan credential itu**

## 6. Persyaratan Project

### Persyaratan umum (berlaku semua track)
- Project **wajib pakai Sectors MCP atau Sectors REST API sebagai sumber data inti**, bukan cuma 1 panggilan dekoratif. **Kalau data Sectors dihapus, fungsi inti produk harus hilang** — ini tes utamanya
- Harus berupa **working prototype/MVP** dengan core workflow yang jalan end-to-end. Bagian kasar/belum sempurna boleh, tapi **produk yang tidak jalan sama sekali tidak lolos judging**
- **Live deployment TIDAK wajib** — repo publik + video judging yang menunjukkan core workflow end-to-end sudah cukup untuk lolos eligibility check. (Real-world usability tetap bobot penilaian tertinggi, jadi produk yang keliatan meyakinkan tetap lebih unggul)
- Stack, tools, bahasa pemrograman, lisensi, platform **bebas** — tidak ada batasan
- **Automated trade execution DILARANG di semua track.** Produk boleh analisis, screening, scoring, alert, dan bantu keputusan — TAPI **tidak boleh** menempatkan/mengeksekusi/mengotomasi order beli/jual di akun broker/real

### Definisi Track 3 — Market Intelligence (track yang dipilih)

> Produk yang mengubah data Sectors jadi **insight** untuk keputusan pasar finansial.

**Syarat wajib (qualifying test):** Project harus menghasilkan **insight turunan** (analysis yang dihasilkan DARI data), **bukan data itu sendiri**. Komponen AI/LLM **opsional** untuk track ini.

**✅ Yang MEMENUHI syarat:**
- Sinyal atau skor (signals/scores)
- Ranking
- Screener dengan logika custom
- Deteksi anomali
- Analisis komparatif
- Riset tersintesis (synthesized research)

**❌ Yang TIDAK memenuhi syarat:**
> "Produk yang **hanya menampilkan data mentah Sectors dalam bentuk visual berbeda**, sebaik apa pun presentasinya, **tidak memenuhi syarat** untuk track ini."

**⚠️ IMPLIKASI PENTING untuk FinTrack Intelligence:** Fitur "lihat harga saham 4 bank" saja **TIDAK CUKUP** dan berisiko dipindah track atau gagal eligibility check. Fitur **ranking** dan **perbandingan antar bank** yang sudah ada di rencana kita **WAJIB benar-benar jalan dan jadi pusat produk**, bukan pelengkap. Pertimbangkan menambah minimal 1 lagi dari: skor komposit, deteksi anomali (misal lonjakan harga tidak wajar), atau riset komparatif tertulis otomatis.

**Contoh arah (bukan daftar ide yang mengikat):**
1. Custom screener yang me-ranking perusahaan pakai logika finansial sendiri
2. Anomaly detector yang mendeteksi perilaku pasar/perusahaan yang tidak biasa
3. Produk riset komparatif yang mengubah banyak data point Sectors jadi 1 tampilan pendukung keputusan

### Batas antar track
- Track ditentukan oleh **apa yang produk itu benar-benar lakukan secara fundamental**, bukan tampilannya
- Agent dengan dashboard tetap masuk "AI Agents & Assistants"
- Pipeline otomatis yang juga menghasilkan skor bisa masuk "Automation & Workflows" ATAU "Market Intelligence" — tim yang pilih track mana yang paling mewakili inti project
- Kalau project tidak memenuhi track yang dipilih, **juri boleh memindahkan ke track yang cocok** (bukan langsung diskualifikasi). Diskualifikasi berbasis track hanya terjadi kalau project **tidak cocok track manapun**
- Kalau ragu, tanya di Slack `#discussion` selama build period

## 7. Penggunaan AI

**Diperbolehkan penuh, tanpa batasan, tanpa wajib disclosure.** Coding tools berbasis AI (code generation, completion, agent, dll) boleh dipakai sebebas-bebasnya — termasuk "vibe coding" dengan AI agent yang kamu lakukan sekarang. **Yang dinilai adalah hasilnya**, bukan siapa/apa yang menulis kodenya.

## 8. Persyaratan Submission

Submit lewat **hackathon portal** (hackathon.sectors.app/portal/submit) sebelum **8 Oktober 2026, 23:59 WIB**. Harus menyertakan:

1. **Link repo publik** — harus tetap publik minimal **90 hari setelah pengumuman pemenang**. Kalau di-private-kan sebelum itu, **kehilangan hak hadiah** (bisa diganti pemenang lain). **Hapus semua API key sebelum submit!**
2. **Video teaser 1 menit** — screen recording produk yang jalan, dipublikasikan publik di YouTube/media sosial
3. **Video judging maks 3 menit** — walkthrough lengkap: masalah, target pengguna, core workflow. Boleh YouTube/Vimeo (public/unlisted), Google Drive (link sharing aktif), atau Loom. **Video yang tidak bisa diakses = tidak dinilai**
4. **1 kalimat problem statement** — untuk siapa produk ini dan masalah apa yang diselesaikan
5. **Pilihan track** + daftar nama anggota tim
6. **Post media sosial** — publikasikan project di Instagram/LinkedIn/Threads/TikTok, tag akun resmi Sectors, pakai [template thumbnail](https://canva.link/mexgt4g89m17xln) yang disediakan

Submission & video boleh **Bahasa Indonesia atau Inggris** — tidak ada yang diunggulkan dalam penilaian.

## 9. Judging (Penilaian)

Judging **sepenuhnya asinkron**, 9–16 Oktober 2026, berdasarkan materi submission saja. **Tidak ada sesi presentasi live** — video dan repo harus "berbicara sendiri".

### Eligibility check (lolos/gagal — syarat mutlak sebelum dinilai)
- Submission lengkap
- Produk benar-benar jalan (bekerja)
- Data Sectors dipakai sebagai sumber inti
- Semua anggota tim sudah verifikasi onboarding Sectors

### Kriteria penilaian (untuk yang lolos eligibility check)

| Kriteria | Bobot | Yang dinilai |
|---|---|---|
| **Real-world usability** | **40%** | Seberapa baik project menjawab masalah nyata? Bisakah orang pakai ini hari ini dan dapat manfaat? |
| **Video demo & storytelling** | **30%** | Seberapa menarik, engaging, dan berkualitas video-nya? Apakah berhasil menyampaikan masalah ke target audiens? |
| **Technical depth & execution** | **30%** | Diverifikasi lewat repo GitHub: seberapa inovatif penggunaan Sectors API/MCP? Apakah produk ini nyata, fungsional, dikerjakan dengan baik, dan **tidak dipalsukan untuk demo**? |

**Keputusan juri final dan mengikat.**

## 10. Hadiah

Total pool: **IDR 50.000.000** (gabungan cash + langganan Sectors Insider + API credit)

| Peringkat | Cash | Sectors Insider | API Credits |
|---|---|---|---|
| Juara 1 | IDR 15.000.000 | 6 bulan | 20.000 |
| Runner-up | IDR 9.000.000 | 4 bulan | 15.000 |
| 3 Finalis (masing-masing) | IDR 2.000.000 | 2 bulan | 10.000 |

- Cash ditransfer ke perwakilan tim; pajak hadiah mengikuti hukum Indonesia yang berlaku
- Langganan Insider & API credit hadiah masuk ke akun Sectors perwakilan tim
- API credit hadiah **expire 3 bulan** setelah diterbitkan
- Pemenang di bawah 18 tahun menerima hadiah lewat orang tua/wali
- Organizer bisa minta verifikasi identitas — gagal verifikasi dalam 7 hari bisa bikin hadiah dialihkan ke pemenang pengganti
- Pengumuman: **17 Oktober 2026**, di website kompetisi & Instagram (Sectors & Algoritma)

## 11. Publisitas & Hak Konten

- Dengan submit, peserta memberi izin ke Sectors & Supertype untuk menampilkan/mempublikasikan/mempromosikan submission (video, screenshot, nama project, nama peserta) di website/medsos/newsletter/materi promosi mereka, **tanpa kompensasi tambahan**
- **Hak kekayaan intelektual project tetap sepenuhnya milik peserta** — Sectors & Supertype tidak klaim kepemilikan atas kode/produk yang dibuat
- Peserta bertanggung jawab memastikan project tidak melanggar hak kekayaan intelektual pihak lain

## 12. Kode Etik

- Semua peserta wajib menjaga lingkungan yang aman, welcoming, bebas harassment di Slack, medsos, dan semua channel event
- Project berisi konten diskriminatif (SARA), harassment, atau melanggar hukum → **otomatis didiskualifikasi**
- **Project tidak boleh memberikan nasihat finansial.** Produk harus memposisikan diri sebagai **alat informasi & analisis**, bukan rekomendasi investasi. **Wajib sertakan disclaimer** di tempat yang relevan
- Pelanggaran bisa dilaporkan di channel `#support` Slack resmi

## 13. Diskualifikasi

Organizer bisa mendiskualifikasi peserta/tim atas kebijakan mereka sendiri, termasuk untuk: melanggar aturan ini, curang (termasuk pelanggaran kode-sebelum-event dan pelanggaran code-freeze), bikin akun ganda untuk API credit ekstra, submission duplikat, pelanggaran kode etik, atau perilaku tidak sportif lainnya.

## 14. Dukungan

- Organizer bisa update aturan ini sebelum 19 Agustus 2026. Perubahan setelah registrasi dibuka akan diumumkan di semua channel resmi dan tidak akan merugikan peserta yang sudah mulai dengan aturan sebelumnya
- Pertanyaan: Slack `#discussion`, atau email panitia
- Slack invite: join.slack.com/t/sectorshackathon/shared_invite/zt-4akrt2esz-kQbyWdxMZElrRyPa6r2VcA

---

## ⚠️ Checklist Kepatuhan Khusus untuk AI Agent

Sebelum/selama coding, AI agent **WAJIB** patuh ke poin-poin ini:

- [ ] **JANGAN** commit API key Sectors ke repo mana pun (harus lewat `.env` yang di-gitignore)
- [ ] Pastikan repo dibuat **setelah 19 Agustus 2026** dan first commit dalam rentang build period
- [ ] Fitur inti **tidak boleh cuma menampilkan data mentah** — harus ada olahan (skor/ranking/anomali/riset komparatif), sesuai qualifying test Track 3
- [ ] **Jangan** implementasi fitur apa pun yang mengeksekusi order beli/jual otomatis (automated trade execution dilarang total)
- [ ] Tambahkan **disclaimer** yang jelas: produk ini alat informasi/analisis, **bukan** nasihat/rekomendasi investasi
- [ ] Jangan gunakan kode dari project lama/sebelumnya — semua harus ditulis baru selama build period
- [ ] Setelah submit, **jangan ada commit/push apa pun lagi** kecuali darurat kebocoran API key (dan itu pun cuma boleh commit penghapusan credential)
- [ ] Repo harus tetap **publik** minimal 90 hari setelah 17 Oktober 2026
