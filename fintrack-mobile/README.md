# FinTrack Mobile

Aplikasi Expo untuk melihat ringkasan harga empat bank, histori 30 hari bursa, dan ranking perubahan harian.

## Menjalankan aplikasi

1. Jalankan backend dari folder `fintrack-backend/` sesuai instruksi di README backend. Backend perlu berjalan pada port `8000` dengan host `0.0.0.0`.
2. Jalankan `ipconfig` di komputer dan catat IPv4 adapter Wi-Fi yang aktif.
3. Sesuaikan `BASE_URL` di `config/api.js` jika alamat komputer berubah. Contoh: `http://192.168.1.10:8000`.
4. Pastikan HP dan komputer memakai Wi-Fi yang sama.
5. Dari folder `fintrack-mobile/`, jalankan `npm install`, lalu `npx expo start --lan`.
6. Buka Expo Go di HP dan scan QR code yang ditampilkan terminal.

Aplikasi mobile hanya berkomunikasi dengan backend lokal dan tidak menyimpan API key Sectors.
