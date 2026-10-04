/**
 * Geometri bilah tab.
 *
 * Bilahnya menempel penuh di dasar layar dan ikut mengambil ruang di dalam
 * susunan layar, bukan terapung di atas isinya. Karena itu React Navigation
 * sudah menyisakan ruangnya sendiri, dan tiap layar tidak perlu lagi
 * menambahkan jarak gulung khusus di bagian bawah.
 *
 * Tingginya dihitung bersama tinggi bilah sistem Android di App.js, karena
 * angka itu baru diketahui saat aplikasi berjalan.
 */
export const TAB_BAR_HEIGHT = 64;

/**
 * Geometri halaman versi web.
 *
 * Di browser, isi halaman dibatasi lebarnya lalu ditaruh di tengah, karena satu
 * baris teks yang melintang selebar monitor sulit dibaca: mata harus menempuh
 * jarak jauh untuk pindah ke baris berikutnya. Angkanya dipakai bersama oleh
 * kepala halaman dan isi layar, supaya tombol di kepala halaman sejajar dengan
 * tepi kiri kartu di bawahnya. Tanpa satu sumber, keduanya pelan-pelan
 * bergeser sendiri-sendiri dan terlihat tidak satu baris.
 *
 * Tidak dipakai sama sekali di ponsel.
 */
export const LEBAR_MAKS_HALAMAN = 1160;
export const PADDING_HALAMAN = 32;
