import { NativeModules, Platform } from 'react-native';

// Alamat backend diturunkan sendiri, bukan ditulis tetap.
//
// Sebelumnya berkas ini memuat satu alamat yang harus disunting tiap kali
// komputer pindah Wi-Fi. Angkanya mudah lupa diganti, dan gejalanya
// membingungkan: aplikasi terbuka, bundle JavaScript berhasil dimuat, terminal
// Expo bersih tanpa galat, tapi setiap kartu bank gagal tersambung. Yang salah
// bukan Metro, melainkan alamat backend yang sudah basi.
//
// Sekarang alamatnya mengikuti alamat Metro yang sedang dipakai. Metro
// disajikan dari komputer yang sama dengan backend, jadi host yang dipakai
// aplikasi untuk memuat bundle — dan yang sudah terbukti terjangkau dari HP —
// adalah host backend juga.
//
// Yang diambil hanya host-nya, bukan portnya: Metro memakai 8081 sedangkan
// backend 8000, dan keduanya tidak selalu sama.
const PORT_BACKEND = 8000;

// Jalan keluar untuk keadaan yang tidak bisa ditebak sendiri: mode tunnel
// (`expo start --tunnel`), emulator dengan `adb reverse`, atau build rilis yang
// bundle-nya ikut tertanam sehingga tidak ada Metro untuk ditanyai. Isi di
// `fintrack-mobile/.env`, yang tidak ikut masuk repositori:
//
//     EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
//
// Expo menyalin nilai berawalan EXPO_PUBLIC_ ke dalam bundle saat dibangun,
// jadi ini benar-benar pengganti, bukan sekadar cadangan.
const DARI_ENV = process.env.EXPO_PUBLIC_BACKEND_URL;

// Dipakai hanya bila tidak ada env di atas dan hostnya tidak bisa ditentukan.
// Angka ini IP adaptor Wi-Fi komputer pengembang, jadi di mesin lain ia hanya
// kebetulan benar kalau jaringannya sama.
const CADANGAN = 'http://192.168.100.12:8000';

/**
 * Host komputer yang menyajikan bundle, atau null bila tidak diketahui.
 *
 * Di web, halaman disajikan Metro dari komputer yang sama, jadi host halaman
 * itu sendiri jawabannya. Membukanya dari komputer lain di jaringan yang sama
 * juga tetap benar, karena alamat backendnya ikut berpindah sendirinya.
 *
 * Di ponsel, React Native menyimpan alamat bundle di modul native SourceCode.
 * Isinya berbentuk 'http://192.168.100.12:8081/index.bundle?platform=android'.
 * Modul itu tidak dijamin ada, dan pada sebagian versi menyentuh nama modul
 * yang tidak dikenal melempar galat alih-alih mengembalikan undefined — jadi
 * seluruhnya dibungkus penjaga, dan kegagalannya diperlakukan sebagai "tidak
 * diketahui" alih-alih diteruskan ke pemanggilnya.
 *
 * Kedua bentuk pengambilan dicoba karena React Native sendiri mengakses modul
 * ini lewat pembungkus spec, sedangkan jalur bridge yang lama menaruh
 * konstantanya sebagai properti biasa.
 */
function hostPengembang() {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return null;
    return window.location.hostname || null;
  }

  try {
    const modul = NativeModules?.SourceCode;
    const alamat = modul?.getConstants?.().scriptURL ?? modul?.scriptURL;
    if (typeof alamat !== 'string') return null;
    // Kurung siku didahulukan untuk IPv6, yang penulisannya memuat titik dua
    // dan akan terpotong kalau diperlakukan sama seperti IPv4.
    const cocok = alamat.match(/^https?:\/\/(\[[^\]]+\]|[^/:]+)/);
    return cocok ? cocok[1] : null;
  } catch {
    return null;
  }
}

const host = hostPengembang();

export const BASE_URL = DARI_ENV || (host ? `http://${host}:${PORT_BACKEND}` : CADANGAN);
