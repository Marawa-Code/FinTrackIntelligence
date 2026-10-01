# FinTrack Intelligence Backend

Backend lokal FastAPI untuk mengambil ringkasan dan histori harga saham dari Sectors API.

## Persiapan

Jalankan perintah berikut dari PowerShell di folder proyek:

```powershell
cd fintrack-backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Buat file `.env` di folder `fintrack-backend/` dengan isi berikut, lalu ganti nilainya dengan API key Anda:

```env
SECTORS_API_KEY=isi_dengan_api_key_anda
```

Jangan commit file `.env`; file itu sudah diabaikan oleh Git.

## Menjalankan backend

Dari folder `fintrack-backend/` yang sama, jalankan:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

```

Cek endpoint health di `http://localhost:8000/health` dan ringkasan bank di `http://localhost:8000/api/banks/summary`.

## Mencari IP lokal untuk akses dari HP

1. Pastikan HP dan komputer terhubung ke Wi-Fi yang sama.
2. Di PowerShell, jalankan `ipconfig`.
3. Cari **IPv4 Address** pada adapter Wi-Fi yang aktif, biasanya berbentuk `192.168.x.x`.
4. Dari HP, buka `http://<IP-IPv4-komputer>:8000/health`, misalnya `http://192.168.1.10:8000/health`.

Jika tidak dapat diakses, pastikan firewall Windows mengizinkan koneksi Python/Uvicorn pada jaringan privat.

## Endpoint

| Endpoint | Keterangan |
|---|---|
| `GET /health` | Cek backend hidup |
| `GET /api/banks/summary` | Harga terakhir, market cap, perubahan harian 4 bank |
| `GET /api/banks/{symbol}/history?start=&end=` | OHLC harian per emiten |
| `GET /api/banks/ranking` | Peringkat harian sederhana berdasarkan perubahan harga |
| `GET /api/banks/intelligence` | Skor komposit 0–100, MA7/MA30, tren, volatilitas, sinyal & riwayat anomali |

## Skor komposit dan sinyal anomali

`/api/banks/intelligence` menghitung turunan dari data Sectors, bukan menampilkan
data mentah:

- **Skor 0–100** yang bersifat *relatif* antar empat bank. Tiap komponen diubah
  jadi z-score terhadap rata-rata keempat bank, lalu digabung dengan bobot:
  momentum 30% (perubahan harian), tren 30% (return sepanjang jendela),
  stabilitas 20% (volatilitas dibalik), dan posisi MA 20% (harga terhadap MA7
  dan MA30).
- **Label skor** memakai kata perbandingan, bukan penilaian mutlak: 65+ "Jauh di
  atas rata-rata", 55+ "Di atas rata-rata", 45+ "Sekitar rata-rata", sisanya
  "Di bawah rata-rata". Bank bisa berlabel di atas rata-rata walau harganya
  sedang turun, bila ketiga pesaingnya turun lebih dalam.
- **Sinyal anomali** dari z-score perubahan harga harian terakhir terhadap
  sebaran 30 hari bursa sebelumnya. `|z| >= 2` ditandai sebagai lonjakan tidak
  wajar.
- **Riwayat anomali** (`anomaly_history`) menelusuri seluruh jendela analisis,
  bukan hanya hari terakhir, lalu mengembalikan maksimal 5 temuan terbaru
  (tanggal, z-score, arah, besaran perubahan).
- **Lonjakan volume** bila volume terakhir mencapai dua kali rata-rata jendela.

### Kenapa z-score, bukan min–max

Normalisasi min–max selalu memberi 100 kepada bank terbaik dan 0 kepada yang
terburuk, walau selisih aslinya sangat tipis. Akibatnya komponen "posisi MA"
bisa tampak 100 padahal harga bank itu justru berada di bawah MA-nya. Dengan
z-score, skor 50 berarti persis rata-rata peer. Untuk empat bank, `|z|`
maksimum yang mungkin adalah `akar(n - 1) = 1,73`, sehingga skor komponen
mentok di kisaran 6,7–93,3 dan penjepitan 0/100 praktis tidak pernah aktif.

Jendela analisis 70 hari kalender; kalau hari bursa yang tersedia kurang dari 32
(deteksi anomali butuh 30 hari baseline plus dua harga penutup, misalnya karena
libur panjang), jendela otomatis dilebarkan sampai tiga kali lipat.

## Cache

Ringkasan, ranking, dan skor disimpan dalam memori selama 5 menit. Histori OHLC
disimpan 1 jam karena data harian hanya berubah sekali per hari bursa — ini menghemat
kredit Sectors saat pengguna membuka-tutup layar. Cache hilang saat proses backend
dimulai ulang.

Kunci cache histori memuat rentang tanggal, jadi tiap rentang baru menghasilkan
kunci baru yang tidak akan pernah dibaca lagi. Cache dibatasi 256 entri dan
membersihkan entri kedaluwarsa lebih dulu saat penuh, supaya tidak tumbuh terus
selama server hidup.

## Bila sebagian bank gagal diambil

Keempat bank diambil satu per satu. Kalau salah satunya gagal (rate limit,
jaringan, atau data kosong), bank itu dilewati dan sisanya tetap dikirim — layar
ranking tidak ikut kosong hanya karena satu emiten bermasalah.

Hasil yang tidak lengkap sengaja **tidak** di-cache, supaya permintaan
berikutnya masih mencoba melengkapi, bukan menyajikan daftar bolong selama lima
menit. Skor tetap relatif: bila hanya tiga bank yang berhasil diambil, ketiganya
dibandingkan satu sama lain.

Kalau seluruh bank gagal, endpoint mengembalikan `502` — jadi aplikasi
menampilkan pesan koneksi, bukan layar kosong yang membingungkan.
