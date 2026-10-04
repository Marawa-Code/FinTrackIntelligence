/**
 * Satu tempat untuk seluruh warna, sudut, dan ukuran huruf.
 *
 * Sebelum berkas ini ada, setiap layar menulis ulang nilainya sendiri. Hasilnya
 * tujuh abu-abu berbeda untuk pekerjaan yang sama, dua latar terang yang nyaris
 * tidak bisa dibedakan, dan enam belas ukuran huruf — termasuk pasangan yang
 * bedanya setengah poin dan praktis tidak terlihat. Semua itu disatukan di sini
 * supaya mengubah tampilan cukup dilakukan sekali.
 *
 * Nama-namanya menyebut peran, bukan warnanya. `body` lebih tahan lama daripada
 * `abuTua`, karena abu tua bisa berubah jadi apa saja tanpa membuat namanya
 * salah.
 */

export const colors = {
  // Latar dan permukaan
  screen: '#F3F7F5', // latar seluruh layar
  surface: '#FFFFFF', // kartu dan kotak di atas latar
  chip: '#F1F5F4', // label kecil dan alur batang skor
  border: '#E5ECE9',

  // Teks
  ink: '#16332E', // judul dan angka utama
  body: '#63736F', // teks sekunder
  faint: '#8A9895', // cetakan terkecil dan data mentah

  // Merek
  brand: '#167D68',
  brandSoft: '#EAF4F1', // latar lencana peringkat
  onBrand: '#FFFFFF', // teks di atas permukaan merek

  // Arah harga dan tinggi-rendahnya skor
  up: '#16835D',
  down: '#C34F54',
  top: '#16835D', // skor di atas rata-rata
  above: '#2F8A6E',
  below: '#B0743A',

  // Peringatan
  alert: '#B4472F',
  alertSoft: '#FBEEE9',

  // Kotak riwayat anomali, bernada hangat supaya terbedakan dari kartu biasa
  warnSurface: '#FBF4EC',
  warnBorder: '#F0E1CC',
  warnText: '#8A6420',

  // Garis pembanding di grafik skor bergerak. Dibedakan lewat kepekatan, bukan
  // warna warni: bank yang sedang dibuka memakai `brand`, dan empat nada abu ini
  // sengaja lebih redup supaya ia tetap yang paling menonjol.
  //
  // Jumlahnya empat karena bank pantauan ada lima: satu untuk bank yang dibuka,
  // sisanya untuk para pembanding. Kalau paletnya lebih sedikit daripada
  // pembandingnya, dua bank akan memakai nada yang sama persis dan garisnya
  // tertukar saat dibaca.
  peerLineA: '#7E9C95',
  peerLineB: '#A3BAB3',
  peerLineC: '#C4D3CE',
  peerLineD: '#DEE7E4',
};

export const radius = {
  bar: 4, // alur batang skor
  small: 6, // lencana kecil
  inner: 10, // kotak di dalam kartu
  control: 12, // tombol dan lencana
  card: 16,
  pill: 999,
};

export const font = {
  micro: 11, // label huruf besar, catatan kaki
  small: 12.5, // baris sekunder
  body: 13.5, // teks dan baris data standar
  strong: 15, // angka yang ditegaskan
  title: 17, // judul kartu kosong dan simbol bank
  display: 26, // angka besar sekunder, mis. skor di kartu ranking
  screenTitle: 28, // judul layar
  displayLg: 32, // angka utama sebuah kartu, mis. kapitalisasi sektor
  hero: 38, // skor utama di layar Detail
};
