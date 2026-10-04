# FinTrack Mobile

Aplikasi Expo untuk melihat ringkasan harga bank pantauan, histori harga, skor relatif, dan ranking perubahan harian.

## Menjalankan aplikasi

1. Jalankan backend dari folder `fintrack-backend/` sesuai instruksi di README backend. Backend perlu berjalan pada port `8000` dengan host `0.0.0.0`.
2. Jalankan `ipconfig` dan ambil **IPv4 Address pada adapter Wi-Fi**. Pastikan baris **Default Gateway** di adapter itu terisi — itu penanda jaringan yang benar. Adapter virtual seperti VirtualBox tidak punya gateway, dan alamatnya tidak akan pernah bisa dijangkau HP walaupun backend menjawab di komputer sendiri.
3. Taruh alamat itu di `BASE_URL` pada `config/api.js`, misalnya `http://192.168.1.10:8000`. Angkanya berbeda di tiap komputer dan berubah setiap kali pindah jaringan.
4. Pastikan HP dan komputer memakai Wi-Fi yang sama.
5. Dari folder `fintrack-mobile/`, jalankan `npm install`, lalu `npx expo start --lan`.
6. Buka Expo Go di HP dan scan QR code yang ditampilkan terminal.

Aplikasi mobile hanya berkomunikasi dengan backend lokal dan tidak menyimpan API key Sectors.

## Kalau data gagal dimuat

Gejalanya `ConnectException` atau `Failed to connect to /<alamat>:8000` pada kartu bank, padahal bundle JavaScript berhasil dimuat dan terminal Expo tidak menampilkan error. Artinya aplikasi dan backend sehat; yang salah hanya alamat di `config/api.js`, biasanya karena komputer sudah pindah Wi-Fi sejak alamat itu dicatat.

Urutan pemeriksaannya:

1. Pastikan backend masih berjalan. Buka `http://127.0.0.1:8000/health` di browser komputer; harus muncul `{"status":"ok"}`.
2. Jalankan `ipconfig`, ambil IPv4 adapter Wi-Fi yang punya Default Gateway, lalu samakan dengan `BASE_URL`.
3. Bila alamatnya sudah benar tetapi tetap gagal, kemungkinan Windows Firewall memblokir port `8000` untuk Python. Node tidak terblokir, karena HP sudah berhasil memuat bundle dari Metro.
