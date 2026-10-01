/**
 * Geometri bilah tab terapung.
 *
 * Tinggi dan jaraknya dipakai App.js untuk menggambar bilahnya, sedangkan
 * TAB_BAR_CLEARANCE dipakai keempat layar bertab sebagai jarak gulung tambahan
 * di bagian bawah.
 *
 * Bilahnya terapung di atas isi layar, jadi React Navigation tidak lagi
 * menyisakan ruang untuknya di dalam layar seperti bilah biasa. Jarak itu harus
 * diberikan sendiri oleh tiap layar — kalau tidak, baris terakhir pada daftar
 * akan tertutup bilah.
 */
export const TAB_BAR_HEIGHT = 64;
export const TAB_FLOAT_GAP = 12;
export const TAB_BAR_RADIUS = 18;

// Tinggi bilah + jarak bawahnya + tinggi bilah sistem Android (paling besar
// 48 untuk navigasi tiga tombol) + sedikit ruang napas.
export const TAB_BAR_CLEARANCE = 128;
