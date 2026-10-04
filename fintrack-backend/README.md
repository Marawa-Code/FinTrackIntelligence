# FinTrack Intelligence Backend

Backend lokal FastAPI untuk mengambil ringkasan dan histori harga saham dari Sectors API.

## Persiapan

Persyaratannya **Python 3.10 atau lebih baru**: `main.py` memakai anotasi
`str | None` tanpa `from __future__ import annotations`, dan FastAPI
mengevaluasinya saat runtime, jadi di 3.9 aplikasinya gagal start.

Jalankan perintah berikut dari PowerShell di folder proyek:

```powershell
cd fintrack-backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Buat file `.env` di folder `fintrack-backend/` dengan **menyalin
[`.env.example`](.env.example)**, lalu ganti nilainya dengan API key Anda.
Isinya tiga variabel:

```env
SECTORS_API_KEY=isi_dengan_api_key_anda
OPENROUTER_API_KEY=isi_dengan_api_key_anda
CORS_ALLOWED_ORIGINS=*
```

Tanpa `OPENROUTER_API_KEY` backend tetap berjalan dan seluruh endpoint pasar
normal, tetapi `POST /api/chat` membalas `503`. `CORS_ALLOWED_ORIGINS` hanya
perlu diubah bila ingin membatasi asal permintaan; nilai bawaannya `*` supaya
demo lewat `expo start --web` jalan.

Jangan commit file `.env`; file itu sudah diabaikan oleh Git. Kunci Sectors
diambil dari API Playground di [sectors.app/api](https://sectors.app/api),
kunci OpenRouter dari [openrouter.ai/keys](https://openrouter.ai/keys).

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
| `GET /api/banks/summary` | Harga terakhir, market cap, perubahan harian bank pantauan |
| `GET /api/banks/{symbol}/history?start=&end=` | OHLC harian per emiten (simbol apa pun di subsektor) |
| `GET /api/banks/{symbol}/profile` | Profil satu bank: ringkasan + sinyal, plus skor bila bank itu dipantau |
| `GET /api/banks/ranking` | Peringkat harian sederhana berdasarkan perubahan harga |
| `GET /api/banks/intelligence` | Skor komposit 0–100, MA7/MA30, tren, volatilitas, sinyal & riwayat anomali |
| `GET /api/banks/score-trend` | Deret skor harian tiap bank pantauan untuk grafik |
| `GET /api/sector/banks` | Ringkasan laporan subsektor perbankan |
| `GET /api/sector/members` | Seluruh anggota subsektor, ditandai mana yang punya skor |
| `POST /api/chat` | Tanya jawab soal saham bank dan soal fitur aplikasi, dijawab model lewat OpenRouter |

Daftar bank yang dipantau ada di `BANK_SYMBOLS` (`main.py`). Bank di luar
daftar itu tetap bisa dibuka lewat `/history` dan `/profile`, tetapi **tidak
punya skor sama sekali** — skornya *relatif antar bank pantauan*, jadi bank di
luar kelompoknya tidak punya pembanding dan bukan berarti berskor nol.

`GET /api/banks/{symbol}/profile` menarik dua panggilan Sectors untuk bank yang
tidak dipantau (ringkasan + histori), sedangkan bank pantauan biasanya hanya
membaca cache karena dasbor sudah mengisinya.

`POST /api/chat` menerima `{ "question": "..." }` dan mengembalikan
`{ "answer": "..." }`. Butuh `OPENROUTER_API_KEY` di `.env`; tanpa kunci itu
endpointnya menjawab 503.

## Skor komposit dan sinyal anomali

`/api/banks/intelligence` menghitung turunan dari data Sectors, bukan menampilkan
data mentah:

- **Skor 0–100** yang bersifat *relatif* antar bank pantauan (`BANK_SYMBOLS`,
  saat ini lima bank: BBCA, BBRI, BMRI, BBNI, BNLI). Tiap komponen diubah jadi
  z-score terhadap rata-rata kelompok itu, lalu digabung dengan bobot: momentum
  30% (perubahan harian), tren 30% (return sepanjang jendela), stabilitas 20%
  (volatilitas dibalik), dan posisi MA 20% (harga terhadap MA7 dan MA30).
- **Label skor** memakai kata perbandingan, bukan penilaian mutlak: 65+ "Jauh di
  atas rata-rata", 55+ "Di atas rata-rata", 45+ "Sekitar rata-rata", sisanya
  "Di bawah rata-rata". Bank bisa berlabel di atas rata-rata walau harganya
  sedang turun, bila bank pantauan lain turun lebih dalam.
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
z-score, skor 50 berarti persis rata-rata peer. Untuk `n` bank pantauan, `|z|`
maksimum yang mungkin adalah `akar(n - 1)`, sehingga skor komponen mentok jauh
sebelum 0 dan 100 dan penjepitan praktis tidak pernah aktif.

`PEER_SCORE_SIGMA` karena itu **diturunkan** dari jumlah bank pantauan, bukan
dipatok tetap: `25 * akar(3) / akar(n - 1)`. Untuk lima bank hasilnya 21,65 dan
batas atas skor tetap 93,3 — angka yang sama seperti saat kelompoknya masih
empat bank. Kalau sigma-nya ditulis mati, menambah atau mengurangi bank pantauan
akan diam-diam menggeser arti setiap skor.

Jendela analisis 70 hari kalender; kalau hari bursa yang tersedia kurang dari 32
(deteksi anomali butuh 30 hari baseline plus dua harga penutup, misalnya karena
libur panjang), jendela otomatis dilebarkan sampai tiga kali lipat.

Tanggal akhir jendela selalu "hari ini" menurut jam komputer, dan jam komputer
bisa berada di depan jam Sectors — di UTC+7 itu terjadi rutin tiap dini hari,
saat tanggal lokal sudah berganti sementara Sectors masih di hari sebelumnya.
Sectors menolak tanggal akhir yang menurutnya belum tiba, jadi permintaan
histori diulang dengan tanggal yang dimundurkan sehari, sampai tiga kali. Tanpa
itu, seluruh analisis skor mati selama jendela waktu tersebut karena setiap
permintaan histori dijawab `400`.

## Cache

Ringkasan, ranking, skor, dan profil disimpan dalam memori selama 5 menit.
Histori OHLC disimpan 1 jam karena data harian hanya berubah sekali per hari
bursa — ini menghemat kredit Sectors saat pengguna membuka-tutup layar. Daftar
anggota subsektor juga 1 jam: keanggotaannya praktis tidak pernah berubah.
Cache hilang saat proses backend dimulai ulang.

Kunci cache histori memuat rentang tanggal, jadi tiap rentang baru menghasilkan
kunci baru yang tidak akan pernah dibaca lagi. Cache dibatasi 256 entri dan
membersihkan entri kedaluwarsa lebih dulu saat penuh, supaya tidak tumbuh terus
selama server hidup.

## Bila sebagian bank gagal diambil

Bank pantauan diambil satu per satu. Kalau salah satunya gagal (rate limit,
jaringan, atau data kosong), bank itu dilewati dan sisanya tetap dikirim — layar
ranking tidak ikut kosong hanya karena satu emiten bermasalah.

Hasil yang tidak lengkap sengaja **tidak** di-cache, supaya permintaan
berikutnya masih mencoba melengkapi, bukan menyajikan daftar bolong selama lima
menit. Yang berhasil tetap disimpan per simbol, jadi percobaan berikutnya hanya
menarik bank yang tadi gagal. Skor tetap relatif: bila hanya sebagian bank yang
berhasil diambil, sisanya dibandingkan satu sama lain.

Kalau seluruh bank gagal, endpoint mengembalikan `502` — jadi aplikasi
menampilkan pesan koneksi, bukan layar kosong yang membingungkan.
