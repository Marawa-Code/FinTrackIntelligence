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
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Cek endpoint health di `http://localhost:8000/health` dan ringkasan bank di `http://localhost:8000/api/banks/summary`.

## Mencari IP lokal untuk akses dari HP

1. Pastikan HP dan komputer terhubung ke Wi-Fi yang sama.
2. Di PowerShell, jalankan `ipconfig`.
3. Cari **IPv4 Address** pada adapter Wi-Fi yang aktif, biasanya berbentuk `192.168.x.x`.
4. Dari HP, buka `http://<IP-IPv4-komputer>:8000/health`, misalnya `http://192.168.1.10:8000/health`.

Jika tidak dapat diakses, pastikan firewall Windows mengizinkan koneksi Python/Uvicorn pada jaringan privat.

## Cache

Response summary, histori (per simbol dan rentang tanggal), serta ranking disimpan dalam memori selama 5 menit. Cache hilang saat proses backend dimulai ulang.
