# FinTrack Mobile

Aplikasi Expo untuk melihat ringkasan harga bank pantauan, histori harga, skor relatif, dan ranking perubahan harian.

## Menjalankan aplikasi

1. Jalankan backend dari folder `fintrack-backend/` sesuai instruksi di README backend. Backend perlu berjalan pada port `8000` dengan host `0.0.0.0`.
2. Pastikan HP dan komputer memakai Wi-Fi yang sama.
3. Dari folder `fintrack-mobile/`, jalankan `npm install`, lalu `npx expo start --lan`.
4. Buka Expo Go di HP dan scan QR code yang ditampilkan terminal.

Alamat backend **tidak perlu diatur**. `config/api.js` menurunkan hostnya dari alamat Metro yang sedang dipakai — Metro disajikan dari komputer yang sama dengan backend, jadi host yang mengantarkan bundle ke HP adalah host backend juga. Pindah Wi-Fi karena itu tidak menuntut perubahan apa pun.

Yang tidak bisa diturunkan sendiri cuma tiga keadaan, karena tidak ada Metro untuk ditanyai: `expo start --tunnel` (alamat tunnel tidak meneruskan port `8000`), emulator yang memakai `adb reverse`, dan build rilis yang bundle-nya ikut tertanam. Untuk ketiganya, isi `fintrack-mobile/.env`:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
```

Berkas itu diabaikan Git, dan nilainya menang atas hasil penurunan otomatis.

Aplikasi mobile hanya berkomunikasi dengan backend lokal dan tidak menyimpan API key Sectors.

## Kalau data gagal dimuat

Gejalanya `ConnectException` atau `Failed to connect to /<alamat>:8000` pada kartu bank, padahal bundle JavaScript berhasil dimuat dan terminal Expo tidak menampilkan error.

Karena alamat backend diturunkan dari alamat Metro, dan Metro itu juga yang mengantarkan bundle ke HP, berhasilnya bundle termuat berarti alamatnya sudah pasti benar. Yang tersisa cuma dua sebab:

1. Pastikan backend masih berjalan. Buka `http://127.0.0.1:8000/health` di browser komputer; harus muncul `{"status":"ok"}`.
2. Bila backend hidup tetapi tetap gagal, kemungkinan Windows Firewall memblokir port `8000` untuk Python. Node tidak terblokir — itulah sebabnya bundle tetap sampai ke HP sementara backendnya tidak.

Kalau HP dan komputer ternyata berbeda jaringan, gejalanya bukan alamat `:8000` di atas, melainkan bundle yang tidak pernah termuat sama sekali: aplikasi berhenti di layar Expo Go dan QR code-nya perlu di-scan ulang.
